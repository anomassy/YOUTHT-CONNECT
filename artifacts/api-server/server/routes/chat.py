import random
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..database import db_cursor, insert_returning, update_returning
from ..auth import require_auth, require_admin

router = APIRouter()

VALID_ROOMS = {"friends", "anonymous"}


class SendMessageRequest(BaseModel):
    content: str
    displayName: str
    replyToId: int | None = None


class SubmitQuestionRequest(BaseModel):
    content: str


class AnswerQuestionRequest(BaseModel):
    answer: str


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
    }


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
        messages = [_message_out(dict(row)) for row in cur.fetchall()]
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


@router.delete("/chat/messages/{message_id}", status_code=204)
def delete_chat_message(message_id: int, user_id: int = Depends(require_auth)):
    with db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM chat_messages WHERE id = %s AND user_id = %s",
            (message_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Message not found or you do not own it.")


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
