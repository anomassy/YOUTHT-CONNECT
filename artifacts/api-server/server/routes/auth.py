from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import bcrypt
import hmac
import os

from ..database import db_cursor, insert_returning, update_returning
from ..auth import AUTH_PROVIDER, clerk_identity, sign_token, require_auth
from ..storage import request_profile_photo_upload

router = APIRouter()


def _password_bytes(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise HTTPException(400, "Password must be 72 bytes or fewer.")
    return encoded


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class AdminLoginRequest(BaseModel):
    password: str


class ProfilePhotoUploadRequest(BaseModel):
    name: str
    size: int
    contentType: str


class UpdateProfileRequest(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    bio: str | None = None
    avatarPath: str | None = None


class ClerkSyncRequest(BaseModel):
    firstName: str
    lastName: str = ""
    username: str
    email: str


def _public_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "username": row["username"],
        "email": row["email"],
        "bio": row.get("bio") or "",
        "avatarUrl": f"/api/storage{row['avatar_path']}" if row.get("avatar_path") else None,
        "createdAt": row["created_at"],
    }


@router.post("/auth/register", status_code=201)
def register(body: RegisterRequest):
    if AUTH_PROVIDER == "clerk":
        raise HTTPException(410, "Create accounts using the Clerk sign-up page.")
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    _password_bytes(body.password)

    email = body.email.strip().lower()
    username = body.username.strip().lower()

    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM users WHERE email = %s OR username = %s LIMIT 1",
            (email, username),
        )
        if cur.fetchone():
            raise HTTPException(409, "An account with that email or username already exists.")

    password_hash = _hash_password(body.password)

    with db_cursor(commit=True) as cur:
        user = dict(insert_returning(
            cur,
            "users",
            """INSERT INTO users (first_name, last_name, username, email, password_hash)
               VALUES (%s, %s, %s, %s, %s)""",
            (body.firstName.strip(), body.lastName.strip(), username, email, password_hash),
        ))

    token = sign_token(user["id"])
    return {"token": token, "user": _public_user(user)}


@router.post("/auth/login")
def login(body: LoginRequest):
    if AUTH_PROVIDER == "clerk":
        raise HTTPException(410, "Sign in using Clerk.")
    normalized = body.identifier.strip().lower()

    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM users WHERE email = %s OR username = %s LIMIT 1",
            (normalized, normalized),
        )
        row = cur.fetchone()

    if not row or not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials.")

    user = dict(row)
    token = sign_token(user["id"])
    return {"token": token, "user": _public_user(user)}


@router.post("/auth/admin-login")
def admin_login(body: AdminLoginRequest):
    configured_password = os.environ.get("ADMIN_PASSWORD")
    if not configured_password or not configured_password.strip():
        raise HTTPException(
            503,
            "Admin password is not configured. Set ADMIN_PASSWORD in the Render web service's Environment settings, then redeploy or restart the service.",
        )
    if not hmac.compare_digest(body.password, configured_password):
        raise HTTPException(401, "Invalid administrator password.")
    return {"token": sign_token(0, is_admin=True), "isAdmin": True}


@router.post("/auth/clerk-sync", status_code=201)
def sync_clerk_user(
    body: ClerkSyncRequest,
    identity: dict = Depends(clerk_identity),
):
    if AUTH_PROVIDER != "clerk":
        raise HTTPException(404, "Clerk authentication is not enabled.")
    clerk_id = identity["sub"]
    username = body.username.strip().lower()
    email = body.email.strip().lower()
    if not username or not email:
        raise HTTPException(400, "Clerk profile must include a username and email.")

    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE clerk_id = %s LIMIT 1", (clerk_id,))
        existing = cur.fetchone()
        if existing:
            return {"user": _public_user(dict(existing))}
        cur.execute(
            "SELECT id FROM users WHERE email = %s OR username = %s LIMIT 1",
            (email, username),
        )
        if cur.fetchone():
            raise HTTPException(
                409,
                "An existing account has this email or username. Ask an administrator to verify and link the existing local account.",
            )

    with db_cursor(commit=True) as cur:
        user = dict(insert_returning(
            cur,
            "users",
            """INSERT INTO users
               (first_name, last_name, username, email, password_hash, clerk_id)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                body.firstName.strip(),
                body.lastName.strip(),
                username,
                email,
                _hash_password(os.urandom(32).hex()),
                clerk_id,
            ),
        ))
    return {"user": _public_user(user)}


@router.post("/auth/profile-photo/request-url")
def request_profile_photo_upload_url(
    body: ProfilePhotoUploadRequest,
    user_id: int = Depends(require_auth),
):
    return request_profile_photo_upload(body.name, body.size, body.contentType)


@router.get("/auth/me")
def get_me(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found.")
    return {"user": _public_user(dict(row))}


@router.patch("/auth/me")
def update_me(body: UpdateProfileRequest, user_id: int = Depends(require_auth)):
    updates = {}
    if body.firstName is not None:
        updates["first_name"] = body.firstName.strip()
    if body.lastName is not None:
        updates["last_name"] = body.lastName.strip()
    if body.bio is not None:
        updates["bio"] = body.bio
    if body.avatarPath is not None:
        if body.avatarPath and not body.avatarPath.startswith("/objects/uploads/"):
            raise HTTPException(400, "A valid uploaded profile photo is required.")
        updates["avatar_path"] = body.avatarPath or None

    if not updates:
        with db_cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return {"user": _public_user(dict(cur.fetchone()))}

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    with db_cursor(commit=True) as cur:
        row = update_returning(
            cur,
            "users",
            f"UPDATE users SET {set_clause} WHERE id = %s",
            (*updates.values(), user_id),
            user_id,
        )
    return {"user": _public_user(dict(row))}
