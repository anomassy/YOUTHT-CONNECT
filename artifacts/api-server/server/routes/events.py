from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from ..database import db_cursor, insert_returning
from ..auth import require_auth, require_admin

router = APIRouter()


class CreateEventRequest(BaseModel):
    title: str
    description: str = ""
    location: str = ""
    startsAt: str  # ISO datetime string


@router.get("/events")
def list_events(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM events ORDER BY starts_at ASC")
        rows = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT event_id FROM event_rsvps WHERE user_id = %s", (user_id,))
        rsvp_ids = {r["event_id"] for r in cur.fetchall()}

    events = []
    for r in rows:
        events.append({
            "id": r["id"],
            "title": r["title"],
            "description": r["description"],
            "location": r["location"],
            "startsAt": r["starts_at"],
            "createdAt": r["created_at"],
            "isRsvped": r["id"] in rsvp_ids,
        })
    return {"events": events}


@router.post("/events", status_code=201)
def create_event(body: CreateEventRequest, user_id: int = Depends(require_admin)):
    if not body.title or not body.startsAt:
        raise HTTPException(400, "Title and start date are required.")
    try:
        starts_at = datetime.fromisoformat(body.startsAt.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Invalid startsAt date format.")
    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "events",
            """INSERT INTO events (title, description, location, starts_at)
               VALUES (%s, %s, %s, %s)""",
            (body.title, body.description, body.location, starts_at),
        ))
    return {"event": {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "location": row["location"],
        "startsAt": row["starts_at"],
        "createdAt": row["created_at"],
    }}


@router.post("/events/{event_id}/rsvp")
def toggle_rsvp(event_id: int, user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM event_rsvps WHERE event_id = %s AND user_id = %s LIMIT 1",
            (event_id, user_id),
        )
        existing = cur.fetchone()

    if existing:
        with db_cursor(commit=True) as cur:
            cur.execute("DELETE FROM event_rsvps WHERE id = %s", (existing["id"],))
        return {"isRsvped": False}

    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO event_rsvps (event_id, user_id) VALUES (%s, %s)",
            (event_id, user_id),
        )
    return {"isRsvped": True}
