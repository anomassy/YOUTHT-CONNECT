import json
import logging
import os
import random
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..database import db_cursor, insert_returning, update_returning
from ..auth import require_auth, require_admin
from .reading_plans import _openai_http_error

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_ROOMS = {"friends", "anonymous"}


class SendMessageRequest(BaseModel):
    content: str
    displayName: str
    replyToId: int | None = None


class SubmitQuestionRequest(BaseModel):
    content: str


class AnswerQuestionRequest(BaseModel):
    answer: str


class PinMessageRequest(BaseModel):
    visibility: str


class StarMessageRequest(BaseModel):
    starred: bool


class ReportMessageRequest(BaseModel):
    reason: str


class UpdateMessageReportRequest(BaseModel):
    status: str


@router.get("/chat/users")
def list_chat_users(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            """SELECT id, first_name, last_name, username FROM users
               WHERE id != %s ORDER BY first_name, last_name""",
            (user_id,),
        )
        users = [dict(row) for row in cur.fetchall()]
    return {
        "users": [
            {
                "id": row["id"],
                "firstName": row["first_name"],
                "lastName": row["last_name"],
                "username": row["username"],
            }
            for row in users
        ]
    }


@router.get("/chat/reports")
def list_chat_reports(user_id: int = Depends(require_admin)):
    with db_cursor() as cur:
        cur.execute(
            """SELECT r.*, COALESCE(u.username, 'admin') AS reporter_username
               FROM chat_message_reports r
               LEFT JOIN users u ON u.id = r.reported_by
               ORDER BY r.created_at DESC LIMIT 500"""
        )
        rows = [dict(row) for row in cur.fetchall()]
    return {
        "reports": [
            {
                "id": row["id"],
                "messageId": row["message_id"],
                "reportedBy": row["reported_by"],
                "reporterUsername": row["reporter_username"],
                "room": row["room"],
                "messageContent": row["message_content"],
                "messageAuthorId": row["message_author_id"],
                "reason": row["reason"],
                "status": row["status"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
    }


@router.get("/chat/{room}")
def list_messages(room: str, user_id: int = Depends(require_auth)):
    if room not in VALID_ROOMS:
        raise HTTPException(400, "Unknown chat room.")
    with db_cursor() as cur:
        cur.execute(
            """SELECT m.*, r.content AS reply_content,
                      r.display_name AS reply_display_name
               FROM chat_messages m
               LEFT JOIN chat_messages r ON r.id = m.reply_to_id
               WHERE m.room = %s ORDER BY m.created_at ASC LIMIT 200""",
            (room,),
        )
        rows = [dict(r) for r in cur.fetchall()]
        _add_message_metadata(cur, rows, user_id, room)
    return {"messages": [_message_out(r) for r in rows]}


@router.post("/chat/{room}", status_code=201)
def send_message(room: str, body: SendMessageRequest, user_id: int = Depends(require_auth)):
    if room not in VALID_ROOMS:
        raise HTTPException(400, "Unknown chat room.")
    if not body.content or not body.content.strip():
        raise HTTPException(400, "Message content is required.")
    if not body.displayName:
        raise HTTPException(400, "Display name is required.")
    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "chat_messages",
            """INSERT INTO chat_messages
               (room, user_id, display_name, content, reply_to_id)
               VALUES (%s, %s, %s, %s, %s)""",
            (room, user_id, body.displayName, body.content.strip(), body.replyToId),
        ))
        if body.replyToId:
            cur.execute(
                "SELECT content, display_name FROM chat_messages WHERE id = %s AND room = %s",
                (body.replyToId, room),
            )
            reply = cur.fetchone()
            if not reply:
                raise HTTPException(404, "Message being replied to was not found.")
            row["reply_content"] = reply["content"]
            row["reply_display_name"] = reply["display_name"]
    return {"message": _message_out(row)}


def _direct_room(user_id: int, other_user_id: int) -> str:
    if other_user_id == user_id:
        raise HTTPException(400, "You cannot start a conversation with yourself.")
    return f"dm:{min(user_id, other_user_id)}:{max(user_id, other_user_id)}"


def _message_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "room": row["room"],
        "userId": row["user_id"],
        "displayName": row["display_name"],
        "content": row["content"],
        "replyToId": row.get("reply_to_id"),
        "replyTo": (
            {
                "displayName": row["reply_display_name"],
                "content": row["reply_content"],
            }
            if row.get("reply_to_id") and row.get("reply_content") is not None
            else None
        ),
        "createdAt": row["created_at"],
        "isStarred": bool(row.get("is_starred", False)),
        "isPinned": bool(row.get("is_pinned", False)),
        "isPinnedByMe": bool(row.get("is_pinned_by_me", False)),
    }


def _add_message_metadata(cur, rows: list[dict], user_id: int, room: str):
    cur.execute(
        """SELECT s.message_id FROM chat_message_stars s
           JOIN chat_messages m ON m.id = s.message_id
           WHERE s.user_id = %s AND m.room = %s""",
        (user_id, room),
    )
    starred_ids = {row["message_id"] for row in cur.fetchall()}
    cur.execute(
        """SELECT p.message_id, p.pinned_by FROM chat_message_pins p
           JOIN chat_messages m ON m.id = p.message_id
           WHERE m.room = %s AND (p.visibility = %s OR p.pinned_by = %s)""",
        (room, "everyone", user_id),
    )
    pins_by_message = {}
    for pin in cur.fetchall():
        pins_by_message.setdefault(pin["message_id"], set()).add(pin["pinned_by"])
    for row in rows:
        pins = pins_by_message.get(row["id"], set())
        row["is_starred"] = row["id"] in starred_ids
        row["is_pinned"] = bool(pins)
        row["is_pinned_by_me"] = user_id in pins


@router.get("/chat/dm/{other_user_id}")
def list_direct_messages(other_user_id: int, user_id: int = Depends(require_auth)):
    room = _direct_room(user_id, other_user_id)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (other_user_id,))
        if not cur.fetchone():
            raise HTTPException(404, "User not found.")
        cur.execute(
            """SELECT m.*, r.content AS reply_content,
                      r.display_name AS reply_display_name
               FROM chat_messages m
               LEFT JOIN chat_messages r ON r.id = m.reply_to_id
               WHERE m.room = %s ORDER BY m.created_at ASC LIMIT 200""",
            (room,),
        )
        rows = [dict(row) for row in cur.fetchall()]
        _add_message_metadata(cur, rows, user_id, room)
        messages = [_message_out(row) for row in rows]
    return {"messages": messages}


@router.post("/chat/dm/{other_user_id}", status_code=201)
def send_direct_message(
    other_user_id: int,
    body: SendMessageRequest,
    user_id: int = Depends(require_auth),
):
    room = _direct_room(user_id, other_user_id)
    if not body.content.strip():
        raise HTTPException(400, "Message content is required.")
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (other_user_id,))
        if not cur.fetchone():
            raise HTTPException(404, "User not found.")
        row = dict(insert_returning(
            cur,
            "chat_messages",
            """INSERT INTO chat_messages
               (room, user_id, display_name, content, reply_to_id)
               VALUES (%s, %s, %s, %s, %s)""",
            (room, user_id, body.displayName, body.content.strip(), body.replyToId),
        ))
        if body.replyToId:
            cur.execute(
                "SELECT content, display_name FROM chat_messages WHERE id = %s AND room = %s",
                (body.replyToId, room),
            )
            reply = cur.fetchone()
            if not reply:
                raise HTTPException(404, "Message being replied to was not found.")
            row["reply_content"] = reply["content"]
            row["reply_display_name"] = reply["display_name"]
    return {"message": _message_out(row)}


def _get_message_for_user(cur, message_id: int, user_id: int) -> dict:
    cur.execute("SELECT * FROM chat_messages WHERE id = %s", (message_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Message not found.")
    room = row["room"]
    if room.startswith("dm:"):
        participants = room.split(":")
        if len(participants) != 3 or str(user_id) not in participants[1:]:
            raise HTTPException(403, "You cannot access this conversation.")
    elif room not in VALID_ROOMS:
        raise HTTPException(403, "You cannot access this conversation.")
    return dict(row)


@router.post("/chat/messages/{message_id}/star")
def star_chat_message(
    message_id: int,
    body: StarMessageRequest,
    user_id: int = Depends(require_auth),
):
    starred = body.starred
    with db_cursor(commit=True) as cur:
        _get_message_for_user(cur, message_id, user_id)
        if starred:
            cur.execute(
                """SELECT message_id FROM chat_message_stars
                   WHERE message_id = %s AND user_id = %s""",
                (message_id, user_id),
            )
            if not cur.fetchone():
                cur.execute(
                    """INSERT INTO chat_message_stars (message_id, user_id)
                       VALUES (%s, %s)""",
                    (message_id, user_id),
                )
        else:
            cur.execute(
                """DELETE FROM chat_message_stars
                   WHERE message_id = %s AND user_id = %s""",
                (message_id, user_id),
            )
    return {"isStarred": starred}


@router.post("/chat/messages/{message_id}/pin")
def pin_chat_message(
    message_id: int,
    body: PinMessageRequest,
    user_id: int = Depends(require_auth),
):
    if body.visibility not in {"me", "everyone"}:
        raise HTTPException(400, "Pin visibility must be 'me' or 'everyone'.")
    with db_cursor(commit=True) as cur:
        _get_message_for_user(cur, message_id, user_id)
        cur.execute(
            """DELETE FROM chat_message_pins
               WHERE message_id = %s AND pinned_by = %s""",
            (message_id, user_id),
        )
        cur.execute(
            """INSERT INTO chat_message_pins (message_id, pinned_by, visibility)
               VALUES (%s, %s, %s)""",
            (message_id, user_id, body.visibility),
        )
    return {"isPinned": True, "visibility": body.visibility}


@router.delete("/chat/messages/{message_id}/pin")
def unpin_chat_message(message_id: int, user_id: int = Depends(require_auth)):
    with db_cursor(commit=True) as cur:
        _get_message_for_user(cur, message_id, user_id)
        cur.execute(
            """DELETE FROM chat_message_pins
               WHERE message_id = %s AND pinned_by = %s""",
            (message_id, user_id),
        )
    return {"isPinnedByMe": False}


@router.post("/chat/messages/{message_id}/report", status_code=201)
def report_chat_message(
    message_id: int,
    body: ReportMessageRequest,
    user_id: int = Depends(require_auth),
):
    reason = body.reason.strip()
    if not reason or len(reason) > 1000:
        raise HTTPException(400, "Provide a report reason of up to 1000 characters.")
    with db_cursor(commit=True) as cur:
        message = _get_message_for_user(cur, message_id, user_id)
        report = dict(insert_returning(
            cur,
            "chat_message_reports",
            """INSERT INTO chat_message_reports
               (message_id, reported_by, room, message_content, message_author_id, reason)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                message_id,
                user_id,
                message["room"],
                message["content"],
                message["user_id"],
                reason,
            ),
        ))
    return {"reportId": report["id"], "status": report["status"]}


@router.patch("/chat/reports/{report_id}")
def update_chat_report(
    report_id: int,
    body: UpdateMessageReportRequest,
    user_id: int = Depends(require_admin),
):
    if body.status not in {"resolved", "dismissed"}:
        raise HTTPException(400, "Report status must be 'resolved' or 'dismissed'.")
    with db_cursor(commit=True) as cur:
        cur.execute(
            """UPDATE chat_message_reports SET status = %s
               WHERE id = %s AND status = %s""",
            (body.status, report_id, "open"),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Open report not found.")
    return {"id": report_id, "status": body.status}


@router.post("/chat/messages/{message_id}/ask-ai")
def ask_ai_about_chat_message(
    message_id: int,
    user_id: int = Depends(require_auth),
):
    with db_cursor() as cur:
        message = _get_message_for_user(cur, message_id, user_id)

    message_content = message["content"]
    if len(message_content) > 10000:
        raise HTTPException(413, "AI assistance is limited to messages of 10000 characters or fewer.")

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(503, "AI assistance is not configured. Set OPENAI_API_KEY in the Render web service environment.")
    request_body = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "Explain the chat message in clear, concise language. "
                    "Do not infer personal details or invent context."
                ),
            },
            {"role": "user", "content": message_content},
        ],
        "temperature": 0.2,
    }
    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
        answer = result["choices"][0]["message"]["content"].strip()
    except HTTPError as exc:
        detail, provider_code = _openai_http_error(exc)
        logger.error("OpenAI rejected a chat message explanation: HTTP %s, code=%s.", exc.code, provider_code)
        raise HTTPException(502, detail) from exc
    except (URLError, TimeoutError) as exc:
        logger.exception("Could not connect to OpenAI to explain a chat message.")
        raise HTTPException(502, "Could not connect to the AI assistance service.") from exc
    except (
        json.JSONDecodeError,
        UnicodeDecodeError,
        KeyError,
        IndexError,
        TypeError,
        AttributeError,
    ) as exc:
        logger.exception("OpenAI returned an invalid chat message explanation.")
        raise HTTPException(502, "The AI assistance service returned an invalid response.") from exc
    if not answer:
        raise HTTPException(502, "The AI assistance service returned an empty response.")
    return {"answer": answer}


@router.delete("/chat/messages/{message_id}", status_code=204)
def delete_chat_message(message_id: int, user_id: int = Depends(require_auth)):
    with db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM chat_messages WHERE id = %s AND user_id = %s",
            (message_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Message not found or you do not own it.")
        cur.execute("DELETE FROM chat_message_stars WHERE message_id = %s", (message_id,))
        cur.execute("DELETE FROM chat_message_pins WHERE message_id = %s", (message_id,))


@router.get("/questions")
def list_my_questions(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM questions WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        rows = [dict(r) for r in cur.fetchall()]
    return {"questions": [_camel_q(r) for r in rows]}


@router.get("/questions/all")
def list_all_questions(user_id: int = Depends(require_admin)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM questions ORDER BY created_at DESC")
        rows = [dict(r) for r in cur.fetchall()]
    return {"questions": [_camel_q(r) for r in rows]}


@router.post("/questions", status_code=201)
def submit_question(body: SubmitQuestionRequest, user_id: int = Depends(require_auth)):
    if not body.content or not body.content.strip():
        raise HTTPException(400, "Question content is required.")
    ticket_code = f"YC-{random.randint(1000, 9999)}"
    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "questions",
            """INSERT INTO questions (user_id, ticket_code, content)
               VALUES (%s, %s, %s)""",
            (user_id, ticket_code, body.content.strip()),
        ))
    return {"question": _camel_q(row)}


@router.patch("/questions/{question_id}/answer")
def answer_question(question_id: int, body: AnswerQuestionRequest, user_id: int = Depends(require_admin)):
    if not body.answer:
        raise HTTPException(400, "Answer is required.")
    with db_cursor(commit=True) as cur:
        row = update_returning(
            cur,
            "questions",
            """UPDATE questions SET answer = %s, answered_at = NOW()
               WHERE id = %s""",
            (body.answer, question_id),
            question_id,
        )
    if not row:
        raise HTTPException(404, "Question not found.")
    return {"question": _camel_q(dict(row))}


def _camel_q(r: dict) -> dict:
    return {
        "id": r["id"],
        "userId": r["user_id"],
        "ticketCode": r["ticket_code"],
        "content": r["content"],
        "answer": r["answer"],
        "createdAt": r["created_at"],
        "answeredAt": r["answered_at"],
    }
