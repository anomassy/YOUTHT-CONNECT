from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..database import db_cursor, insert_returning
from ..auth import require_auth, require_admin

router = APIRouter()


class CreateDevotionalRequest(BaseModel):
    title: str
    scriptureRef: str
    scriptureText: str
    body: str


@router.get("/devotionals")
def list_devotionals(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM devotionals ORDER BY publish_date DESC")
        rows = [dict(r) for r in cur.fetchall()]
    # camelCase keys to match JS schema
    return {"devotionals": [_camel(r) for r in rows]}


@router.post("/devotionals", status_code=201)
def create_devotional(body: CreateDevotionalRequest, user_id: int = Depends(require_admin)):
    if not body.title or not body.scriptureRef or not body.scriptureText or not body.body:
        raise HTTPException(400, "Missing required fields.")
    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "devotionals",
            """INSERT INTO devotionals (title, scripture_ref, scripture_text, body)
               VALUES (%s, %s, %s, %s)""",
            (body.title, body.scriptureRef, body.scriptureText, body.body),
        ))
    return {"devotional": _camel(row)}


@router.delete("/devotionals/{devotional_id}", status_code=204)
def delete_devotional(devotional_id: int, user_id: int = Depends(require_admin)):
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM devotionals WHERE id = %s", (devotional_id,))


def _camel(r: dict) -> dict:
    mapping = {
        "scripture_ref": "scriptureRef",
        "scripture_text": "scriptureText",
        "publish_date": "publishDate",
        "created_at": "createdAt",
    }
    return {mapping.get(k, k): v for k, v in r.items()}
