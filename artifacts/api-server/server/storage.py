import json
import mimetypes
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

from fastapi import HTTPException

SIDECAR_ENDPOINT = "http://127.0.0.1:1106"
MAX_AUDIO_SIZE = 100 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {
    ".aac",
    ".aif",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".oga",
    ".ogg",
    ".opus",
    ".wav",
    ".webm",
    ".wma",
}


def uses_local_audio_storage() -> bool:
    backend = os.environ.get("STORAGE_BACKEND", "replit").strip().lower()
    if backend not in {"local", "replit", "postgres"}:
        raise RuntimeError("STORAGE_BACKEND must be local, replit, or postgres.")
    return backend == "local"


def uses_database_object_storage() -> bool:
    backend = os.environ.get("STORAGE_BACKEND", "replit").strip().lower()
    if backend not in {"local", "replit", "postgres"}:
        raise RuntimeError("STORAGE_BACKEND must be local, replit, or postgres.")
    return backend == "postgres"


def local_audio_directory() -> Path:
    configured_path = os.environ.get(
        "LOCAL_STORAGE_DIR", "artifacts/api-server/storage"
    )
    path = Path(configured_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _storage_location() -> tuple[str, str]:
    private_dir = os.environ.get("PRIVATE_OBJECT_DIR", "").strip().strip("/")
    if not private_dir:
        raise HTTPException(500, "Object storage is not configured.")
    parts = private_dir.split("/", 1)
    if len(parts) != 2:
        raise HTTPException(500, "Object storage path is invalid.")
    return parts[0], parts[1]


def _sign_object_url(bucket_name: str, object_name: str, method: str, ttl_seconds: int) -> str:
    payload = {
        "bucket_name": bucket_name,
        "object_name": object_name,
        "method": method,
        "expires_at": (
            datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        ).isoformat().replace("+00:00", "Z"),
    }
    request = Request(
        f"{SIDECAR_ENDPOINT}/object-storage/signed-object-url",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(502, "Could not connect to object storage.") from exc

    signed_url = result.get("signed_url")
    if not signed_url:
        raise HTTPException(502, "Object storage did not return an upload URL.")
    return signed_url


def _audio_extension(name: str, content_type: str) -> str:
    extension = Path(name).suffix.lower()
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        extension = mimetypes.guess_extension(content_type.lower()) or ""
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        extension = ".audio"
    return extension


def local_audio_path(object_id: str) -> Path:
    filename = Path(object_id)
    try:
        UUID(filename.stem)
    except ValueError as exc:
        raise HTTPException(404, "Audio file not found.") from exc
    if (
        filename.name != object_id
        or filename.suffix.lower() not in ALLOWED_AUDIO_EXTENSIONS | {".audio"}
    ):
        raise HTTPException(404, "Audio file not found.")
    return local_audio_directory() / filename.name


def request_audio_upload(name: str, size: int, content_type: str) -> dict:
    if not name.strip() or size <= 0:
        raise HTTPException(400, "A valid audio file is required.")
    if size > MAX_AUDIO_SIZE:
        raise HTTPException(400, "Audio files must be 100 MB or smaller.")
    if not content_type.lower().startswith("audio/"):
        raise HTTPException(400, "Only audio files can be uploaded.")

    object_id = f"{uuid4()}{_audio_extension(name, content_type)}"
    object_path = f"/objects/uploads/{object_id}"
    if uses_database_object_storage():
        return {
            "uploadURL": f"/api/storage/database-uploads/{object_id}",
            "objectPath": object_path,
        }
    if uses_local_audio_storage():
        return {
            "uploadURL": f"/api/storage/local-uploads/{object_id}",
            "objectPath": object_path,
        }

    bucket_name, private_prefix = _storage_location()
    return {
        "uploadURL": _sign_object_url(
            bucket_name, f"{private_prefix}/uploads/{object_id}", "PUT", 900
        ),
        "objectPath": object_path,
    }


def save_local_audio(object_id: str, file_path: Path) -> Path:
    destination = local_audio_path(object_id)
    if destination.exists():
        raise HTTPException(409, "This audio upload has already been used.")
    file_path.replace(destination)
    return destination


def local_audio_file(object_id: str) -> Path:
    path = local_audio_path(object_id)
    if not path.is_file():
        raise HTTPException(404, "Audio file not found.")
    return path


def delete_local_audio(object_path: str) -> None:
    normalized = object_path.strip("/")
    if normalized.startswith("objects/"):
        normalized = normalized.removeprefix("objects/")
    if not normalized.startswith("uploads/"):
        return
    object_id = normalized.removeprefix("uploads/")
    if Path(object_id).suffix.lower() not in ALLOWED_AUDIO_EXTENSIONS | {".audio"}:
        return
    path = local_audio_path(object_id)
    if path.exists():
        path.unlink()


def request_profile_photo_upload(name: str, size: int, content_type: str) -> dict:
    if not name.strip() or size <= 0:
        raise HTTPException(400, "A valid profile photo is required.")
    if size > 10 * 1024 * 1024:
        raise HTTPException(400, "Profile photos must be 10 MB or smaller.")
    if content_type.lower() not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Profile photos must be JPG, PNG, or WebP images.")

    object_id = str(uuid4())
    if uses_database_object_storage():
        return {
            "uploadURL": f"/api/storage/database-uploads/{object_id}",
            "objectPath": f"/objects/uploads/{object_id}",
        }
    bucket_name, private_prefix = _storage_location()
    object_name = f"{private_prefix}/uploads/{object_id}"
    return {
        "uploadURL": _sign_object_url(bucket_name, object_name, "PUT", 900),
        "objectPath": f"/objects/uploads/{object_id}",
    }


def get_audio_url(object_path: str) -> str:
    normalized = object_path.strip("/")
    if not normalized.startswith("uploads/") or ".." in normalized:
        raise HTTPException(404, "Audio file not found.")
    object_id = normalized.removeprefix("uploads/")
    if uses_database_object_storage():
        return f"/api/storage/objects/{normalized}"
    if uses_local_audio_storage():
        local_audio_file(object_id)
        return f"/api/storage/local-objects/{object_id}"

    bucket_name, private_prefix = _storage_location()
    return _sign_object_url(
        bucket_name, f"{private_prefix}/{normalized}", "GET", 3600
    )


def save_database_object(object_id: str, content_type: str, content: bytes) -> None:
    from .database import db_cursor

    with db_cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO stored_objects (object_id, content_type, file_data)
               VALUES (%s, %s, %s)
               ON CONFLICT (object_id) DO NOTHING""",
            (object_id, content_type, content),
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "This upload has already been used.")


def get_database_object(object_id: str) -> tuple[bytes, str]:
    from .database import db_cursor

    with db_cursor() as cur:
        cur.execute(
            "SELECT content_type, file_data FROM stored_objects WHERE object_id = %s",
            (object_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Stored file not found.")
    return bytes(row["file_data"]), row["content_type"]


def delete_database_object(object_path: str) -> None:
    from .database import db_cursor

    normalized = object_path.strip("/")
    if normalized.startswith("objects/"):
        normalized = normalized.removeprefix("objects/")
    if not normalized.startswith("uploads/") or ".." in normalized:
        return
    object_id = normalized.removeprefix("uploads/")
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM stored_objects WHERE object_id = %s", (object_id,))
