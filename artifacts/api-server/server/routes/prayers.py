from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..database import db_cursor, insert_returning
from ..auth import require_auth

router = APIRouter()


class CreatePrayerRequest(BaseModel):
    content: str
    isAnonymous: bool = True


@router.get("/prayers")
def list_prayers(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            """SELECT pr.id, pr.user_id, pr.content, pr.is_anonymous, pr.pray_count,
                      pr.created_at, u.first_name, u.username
               FROM prayer_requests pr
               LEFT JOIN users u ON pr.user_id = u.id
               ORDER BY pr.created_at DESC""",
        )
        rows = cur.fetchall()

        cur.execute("SELECT prayer_request_id FROM prayer_prays WHERE user_id = %s", (user_id,))
        prayed_ids = {r["prayer_request_id"] for r in cur.fetchall()}

    prayers = []
    for r in rows:
        prayers.append({
            "id": r["id"],
            "content": r["content"],
            "isAnonymous": r["is_anonymous"],
            "prayCount": r["pray_count"],
            "createdAt": r["created_at"],
            "author": None if r["is_anonymous"] else (r["first_name"] or r["username"]),
            "isOwn": r["user_id"] == user_id,
            "hasPrayed": r["id"] in prayed_ids,
        })
    return {"prayers": prayers}


@router.post("/prayers", status_code=201)
def create_prayer(body: CreatePrayerRequest, user_id: int = Depends(require_auth)):
    if not body.content or not body.content.strip():
        raise HTTPException(400, "Prayer request content is required.")
    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "prayer_requests",
            """INSERT INTO prayer_requests (user_id, content, is_anonymous)
               VALUES (%s, %s, %s)""",
            (user_id, body.content.strip(), body.isAnonymous),
        ))
    return {"prayer": {
        "id": row["id"],
        "userId": row["user_id"],
        "content": row["content"],
        "isAnonymous": row["is_anonymous"],
        "prayCount": row["pray_count"],
        "createdAt": row["created_at"],
    }}


@router.post("/prayers/{prayer_id}/pray")
def toggle_pray(prayer_id: int, user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM prayer_prays WHERE prayer_request_id = %s AND user_id = %s LIMIT 1",
            (prayer_id, user_id),
        )
        existing = cur.fetchone()

    if existing:
        with db_cursor(commit=True) as cur:
            cur.execute("DELETE FROM prayer_prays WHERE id = %s", (existing["id"],))
            cur.execute(
                "UPDATE prayer_requests SET pray_count = GREATEST(pray_count - 1, 0) WHERE id = %s",
                (prayer_id,),
            )
        return {"hasPrayed": False}

    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO prayer_prays (prayer_request_id, user_id) VALUES (%s, %s)",
            (prayer_id, user_id),
        )
        cur.execute(
            "UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = %s",
            (prayer_id,),
        )
    return {"hasPrayed": True}
