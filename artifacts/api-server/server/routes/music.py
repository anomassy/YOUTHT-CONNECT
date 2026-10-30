import mimetypes
import os
import tempfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

from ..auth import require_auth, require_admin
from ..database import db_cursor, insert_returning
from ..storage import (
    MAX_AUDIO_SIZE,
    delete_local_audio,
    get_audio_url,
    local_audio_directory,
    local_audio_file,
    local_audio_path,
    request_audio_upload,
    save_local_audio,
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
    if row and uses_local_audio_storage():
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


@router.get("/storage/local-objects/{object_id}")
def serve_local_audio(object_id: str):
    if not uses_local_audio_storage():
        raise HTTPException(404, "Local audio storage is disabled.")
    audio_file = local_audio_file(object_id)
    media_type = mimetypes.guess_type(audio_file.name)[0] or "application/octet-stream"
    return FileResponse(audio_file, media_type=media_type)


@router.get("/storage/objects/{object_path:path}")
def serve_storage_object(object_path: str):
    return RedirectResponse(get_audio_url(object_path), status_code=307)