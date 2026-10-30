import os
import hmac
import logging
from functools import lru_cache
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.environ.get("SESSION_SECRET")
AUTH_PROVIDER = os.environ.get("AUTH_PROVIDER", "local").strip().lower()
if AUTH_PROVIDER not in {"local", "clerk"}:
    raise RuntimeError("AUTH_PROVIDER must be either local or clerk.")
if not JWT_SECRET and AUTH_PROVIDER == "local":
    raise RuntimeError("SESSION_SECRET must be set to sign auth tokens.")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30
logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=2)
def _clerk_jwks_client(url: str):
    return jwt.PyJWKClient(url)


def clerk_identity(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    if AUTH_PROVIDER != "clerk":
        raise HTTPException(404, "Clerk authentication is not enabled.")
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    jwks_url = os.environ.get("CLERK_JWKS_URL", "").strip()
    issuer = os.environ.get("CLERK_ISSUER", "").strip()
    if not jwks_url or not issuer:
        raise HTTPException(
            503,
            "Clerk is not configured. Set CLERK_JWKS_URL and CLERK_ISSUER.",
        )
    try:
        signing_key = _clerk_jwks_client(jwks_url).get_signing_key_from_jwt(
            credentials.credentials
        )
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        logger.warning("Clerk session verification failed: %s", exc)
        raise HTTPException(401, "Invalid or expired Clerk session.") from exc

    allowed_origins = {
        origin.strip()
        for origin in os.environ.get("CLERK_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    }
    authorized_party = claims.get("azp")
    if not allowed_origins:
        raise HTTPException(
            503,
            "Clerk is not fully configured. Set CLERK_ALLOWED_ORIGINS.",
        )
    if not isinstance(authorized_party, str) or authorized_party not in allowed_origins:
        raise HTTPException(401, "Clerk session is not from an allowed application origin.")
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise HTTPException(401, "Clerk session does not identify a user.")
    return claims


def sign_token(user_id: int | None, is_admin: bool = False) -> str:
    if not JWT_SECRET:
        raise RuntimeError("SESSION_SECRET is required for local authentication.")
    payload = {
        "userId": user_id,
        "isAdmin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token_payload(token: str) -> Optional[dict]:
    if not JWT_SECRET:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def verify_token(token: str) -> Optional[int]:
    payload = verify_token_payload(token)
    if not payload:
        return None
    user_id = payload.get("userId")
    return int(user_id) if user_id is not None else None


def require_auth(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> int:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    if AUTH_PROVIDER == "clerk":
        payload = clerk_identity(credentials)
        clerk_id = payload["sub"]
        from .database import db_cursor

        with db_cursor() as cur:
            cur.execute("SELECT id FROM users WHERE clerk_id = %s LIMIT 1", (clerk_id,))
            row = cur.fetchone()
        if not row:
            raise HTTPException(
                403,
                "Your Clerk account is not linked yet. Complete account setup or contact the administrator.",
            )
        return int(row["id"])

    payload = verify_token_payload(credentials.credentials)
    if payload is None or (payload.get("userId") is None and not payload.get("isAdmin")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return int(payload.get("userId") or 0)


def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> int:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
    if AUTH_PROVIDER == "clerk":
        payload = verify_token_payload(credentials.credentials)
        if payload and payload.get("isAdmin") and payload.get("userId") in (None, 0):
            return 0
        payload = clerk_identity(credentials)
        admin_ids = {
            clerk_id.strip()
            for clerk_id in os.environ.get("ADMIN_CLERK_IDS", "").split(",")
            if clerk_id.strip()
        }
        if payload["sub"] not in admin_ids:
            raise HTTPException(status_code=403, detail="Administrator access required")
        from .database import db_cursor

        with db_cursor() as cur:
            cur.execute("SELECT id FROM users WHERE clerk_id = %s LIMIT 1", (payload["sub"],))
            row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=403,
                detail="Administrator account must be linked to a local profile.",
            )
        return int(row["id"])

    payload = verify_token_payload(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if not payload.get("isAdmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return int(payload.get("userId") or 0)
