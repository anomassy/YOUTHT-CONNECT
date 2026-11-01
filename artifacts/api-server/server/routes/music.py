import mimetypes
import os
import re
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel

from ..auth import require_auth, require_admin
from ..database import db_cursor, insert_returning
from ..storage import (
    MAX_AUDIO_SIZE,
    ALLOWED_AUDIO_EXTENSIONS,
    delete_database_object,
    delete_local_audio,
    get_database_object,
    get_audio_url,
    local_audio_directory,
    local_audio_file,
    local_audio_path,
    request_audio_upload,
    save_database_object,
    save_local_audio,
    uses_database_object_storage,
    uses_local_audio_storage,
)

router = APIRouter()


class CreateMusicRequest(BaseModel):
    title: str
    artist: str
    duration: int
    audioPath: str


class UploadUrlRequest(BaseModel):
    name: str
    size: int
    contentType: str


def _track(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "duration": row["duration"],
        "audioUrl": f"/api/storage{row['audio_path']}",
        "createdAt": row["created_at"],
    }


@router.get("/music")
def list_music(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM music_tracks ORDER BY created_at DESC")
        rows = [dict(row) for row in cur.fetchall()]
    return {"tracks": [_track(row) for row in rows]}


@router.post("/music", status_code=201)
def create_music(body: CreateMusicRequest, user_id: int = Depends(require_admin)):
    if not body.title.strip() or not body.artist.strip():
        raise HTTPException(400, "Title and artist are required.")
    if body.duration < 0:
        raise HTTPException(400, "Duration cannot be negative.")
    if not body.audioPath.startswith("/objects/uploads/"):
        raise HTTPException(400, "A valid uploaded audio file is required.")

    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "music_tracks",
            """INSERT INTO music_tracks (title, artist, duration, audio_path)
               VALUES (%s, %s, %s, %s)""",
            (body.title.strip(), body.artist.strip(), body.duration, body.audioPath),
        ))
    return {"track": _track(row)}


@router.delete("/music/{track_id}", status_code=204)
def delete_music(track_id: int, user_id: int = Depends(require_admin)):
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT audio_path FROM music_tracks WHERE id = %s", (track_id,))
        row = cur.fetchone()
        cur.execute("DELETE FROM music_tracks WHERE id = %s", (track_id,))
    if row:
        if uses_database_object_storage():
            delete_database_object(row["audio_path"])
        elif uses_local_audio_storage():
            delete_local_audio(row["audio_path"])


@router.post("/storage/uploads/request-url")
def request_upload_url(body: UploadUrlRequest, user_id: int = Depends(require_admin)):
    return request_audio_upload(body.name, body.size, body.contentType)


@router.put("/storage/local-uploads/{object_id}", status_code=201)
async def upload_local_audio(
    object_id: str,
    request: Request,
    user_id: int = Depends(require_admin),
):
    if not uses_local_audio_storage():
        raise HTTPException(404, "Local audio storage is disabled.")
    destination = local_audio_path(object_id)
    if destination.exists():
        raise HTTPException(409, "This audio upload has already been used.")

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if not content_type.startswith("audio/"):
        raise HTTPException(415, "Only audio files can be uploaded.")
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_AUDIO_SIZE:
                raise HTTPException(413, "Audio files must be 100 MB or smaller.")
        except ValueError as exc:
            raise HTTPException(400, "Invalid Content-Length header.") from exc

    descriptor, temp_name = tempfile.mkstemp(
        prefix=".audio-upload-", suffix=".tmp", dir=local_audio_directory()
    )
    temp_path = local_audio_directory() / os.path.basename(temp_name)
    total_size = 0
    try:
        with os.fdopen(descriptor, "wb") as output:
            async for chunk in request.stream():
                total_size += len(chunk)
                if total_size > MAX_AUDIO_SIZE:
                    raise HTTPException(413, "Audio files must be 100 MB or smaller.")
                output.write(chunk)
        if total_size == 0:
            raise HTTPException(400, "The uploaded audio file is empty.")
        save_local_audio(object_id, temp_path)
    finally:
        if temp_path.exists():
            temp_path.unlink()
    return {"uploaded": True}


@router.put("/storage/database-uploads/{object_id}", status_code=201)
async def upload_database_object(object_id: str, request: Request):
    if not uses_database_object_storage():
        raise HTTPException(404, "Database object storage is disabled.")

    filename = Path(object_id)
    try:
        UUID(filename.stem)
    except ValueError as exc:
        raise HTTPException(404, "Upload not found.") from exc
    if filename.name != object_id:
        raise HTTPException(404, "Upload not found.")

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type.startswith("audio/"):
        max_size = MAX_AUDIO_SIZE
        if filename.suffix.lower() not in ALLOWED_AUDIO_EXTENSIONS | {".audio"}:
            raise HTTPException(415, "Unsupported audio file type.")
    elif content_type in {"image/jpeg", "image/png", "image/webp"}:
        max_size = 10 * 1024 * 1024
        if filename.suffix:
            raise HTTPException(415, "Invalid profile photo upload path.")
    else:
        raise HTTPException(415, "Only supported audio and image files can be uploaded.")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_size:
                raise HTTPException(413, "Uploaded file exceeds the allowed size.")
        except ValueError as exc:
            raise HTTPException(400, "Invalid Content-Length header.") from exc

    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > max_size:
            raise HTTPException(413, "Uploaded file exceeds the allowed size.")
    if not content:
        raise HTTPException(400, "The uploaded file is empty.")

    save_database_object(object_id, content_type, bytes(content))
    return {"uploaded": True}


@router.get("/storage/local-objects/{object_id}")
def serve_local_audio(object_id: str):
    if not uses_local_audio_storage():
        raise HTTPException(404, "Local audio storage is disabled.")
    audio_file = local_audio_file(object_id)
    media_type = mimetypes.guess_type(audio_file.name)[0] or "application/octet-stream"
    return FileResponse(audio_file, media_type=media_type)


@router.get("/storage/objects/{object_path:path}")
def serve_storage_object(object_path: str, request: Request):
    if uses_database_object_storage():
        normalized = object_path.strip("/")
        if not normalized.startswith("uploads/") or ".." in normalized:
            raise HTTPException(404, "Stored file not found.")
        object_id = normalized.removeprefix("uploads/")
        content, content_type = get_database_object(object_id)
        return _database_object_response(content, content_type, request.headers.get("range"))
    return RedirectResponse(get_audio_url(object_path), status_code=307)


def _database_object_response(
    content: bytes, content_type: str, range_header: str | None
):
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
    }
    if not range_header:
        return Response(content, media_type=content_type, headers=headers)

    match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
    if not match or not any(match.groups()):
        return Response(
            status_code=416,
            headers={**headers, "Content-Range": f"bytes */{len(content)}"},
        )

    start_text, end_text = match.groups()
    total = len(content)
    if start_text:
        start = int(start_text)
        end = int(end_text) if end_text else total - 1
    else:
        suffix_length = int(end_text)
        start = max(total - suffix_length, 0)
        end = total - 1

    if start >= total or end < start:
        return Response(
            status_code=416,
            headers={**headers, "Content-Range": f"bytes */{total}"},
        )

    end = min(end, total - 1)
    headers["Content-Range"] = f"bytes {start}-{end}/{total}"
    return Response(
        content[start : end + 1],
        status_code=206,
        media_type=content_type,
        headers=headers,
    )