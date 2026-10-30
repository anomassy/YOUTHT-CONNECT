import json
import logging
import os
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..bible_plan import (
    DAILY_BIBLE_PLAN_TITLE,
    chapter_for_date,
    daily_chapters,
    plan_start_date,
)
from ..quarterly import CURRENT_QUARTERLY
from ..database import db_cursor, insert_returning
from ..auth import require_auth, require_admin

router = APIRouter()
logger = logging.getLogger(__name__)


class ReadingPlanDayInput(BaseModel):
    dayNumber: int
    passage: str
    reflection: str = ""


class CreateReadingPlanRequest(BaseModel):
    title: str
    description: str = ""
    days: list[ReadingPlanDayInput]


def ensure_daily_bible_plan():
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id, start_date FROM reading_plans WHERE title = %s LIMIT 1",
            (DAILY_BIBLE_PLAN_TITLE,),
        )
        plan = cur.fetchone()
        if plan:
            plan_id = plan["id"]
            if plan["start_date"] is None:
                cur.execute(
                    "UPDATE reading_plans SET start_date = %s WHERE id = %s",
                    (plan_start_date(), plan_id),
                )
        else:
            plan = insert_returning(
                cur,
                "reading_plans",
                """INSERT INTO reading_plans (title, description, start_date)
                   VALUES (%s, %s, %s)""",
                (
                    DAILY_BIBLE_PLAN_TITLE,
                    "Read one Bible chapter each day, from Genesis through Revelation.",
                    plan_start_date(),
                ),
            )
            plan_id = plan["id"]

        cur.execute(
            "SELECT day_number FROM reading_plan_days WHERE plan_id = %s",
            (plan_id,),
        )
        existing_days = {row["day_number"] for row in cur.fetchall()}
        for day_number, passage in enumerate(daily_chapters(), start=1):
            if day_number not in existing_days:
                cur.execute(
                    """INSERT INTO reading_plan_days
                       (plan_id, day_number, passage, reflection)
                       VALUES (%s, %s, %s, %s)""",
                    (plan_id, day_number, passage, ""),
                )


def _todays_reading(user_id: int) -> dict:
    with db_cursor() as cur:
        cur.execute(
            """SELECT r.start_date, d.id, d.day_number, d.passage,
                      s.summary, p.id AS progress_id
               FROM reading_plans r
               JOIN reading_plan_days d ON d.plan_id = r.id
               LEFT JOIN reading_summaries s ON s.plan_day_id = d.id
               LEFT JOIN reading_progress p
                 ON p.plan_day_id = d.id AND p.user_id = %s
               WHERE r.title = %s ORDER BY d.day_number LIMIT 1""",
            (user_id, DAILY_BIBLE_PLAN_TITLE),
        )
        plan = cur.fetchone()
    if not plan or not plan["start_date"]:
        logger.error("Daily Bible plan has not been initialized.")
        raise HTTPException(500, "The daily Bible reading schedule is not initialized.")
    scheduled = chapter_for_date(plan["start_date"])
    if not scheduled:
        return {"complete": True, "passage": None, "summary": None}
    day_number, passage, scheduled_date = scheduled
    with db_cursor() as cur:
        cur.execute(
            """SELECT d.id, d.day_number, d.passage, s.summary, p.id AS progress_id
               FROM reading_plans r
               JOIN reading_plan_days d ON d.plan_id = r.id
               LEFT JOIN reading_summaries s ON s.plan_day_id = d.id
               LEFT JOIN reading_progress p
                 ON p.plan_day_id = d.id AND p.user_id = %s
               WHERE r.title = %s AND d.day_number = %s LIMIT 1""",
            (user_id, DAILY_BIBLE_PLAN_TITLE, day_number),
        )
        row = cur.fetchone()
    if not row:
        logger.error("Daily Bible plan is missing scheduled day %s.", day_number)
        raise HTTPException(500, "The daily Bible reading schedule is not initialized.")
    return {
        "dayId": row["id"],
        "dayNumber": row["day_number"],
        "passage": row["passage"] or passage,
        "date": scheduled_date.isoformat(),
        "summary": row["summary"],
        "completed": row["progress_id"] is not None,
        "complete": False,
    }


@router.get("/reading-plans")
def list_reading_plans(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM reading_plans WHERE title != %s",
            (DAILY_BIBLE_PLAN_TITLE,),
        )
        plans = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM reading_plan_days ORDER BY day_number ASC")
        days = [dict(r) for r in cur.fetchall()]

    plans_out = []
    for p in plans:
        plan_days = [
            {
                "id": d["id"],
                "planId": d["plan_id"],
                "dayNumber": d["day_number"],
                "passage": d["passage"],
                "reflection": d["reflection"],
            }
            for d in days if d["plan_id"] == p["id"]
        ]
        plans_out.append({
            "id": p["id"],
            "title": p["title"],
            "description": p["description"],
            "createdAt": p["created_at"],
            "days": plan_days,
        })
    return {"plans": plans_out}


@router.get("/reading-plans/daily")
def get_daily_reading(user_id: int = Depends(require_auth)):
    return {"reading": _todays_reading(user_id)}


@router.get("/reading-plans/quarterly")
def get_quarterly_reading(user_id: int = Depends(require_auth)):
    lessons = []
    for lesson in CURRENT_QUARTERLY["lessons"]:
        passage = lesson["passage"]
        try:
            chapter_text = _get_chapter_text(passage)
        except HTTPException:
            chapter_text = None
        lessons.append({
            "week": lesson["week"],
            "title": lesson["title"],
            "passage": passage,
            "focus": lesson["focus"],
            "summary": chapter_text[:280] if chapter_text else None,
            "text": chapter_text,
        })
    return {
        "quarterly": {
            "title": CURRENT_QUARTERLY["title"],
            "quarter": CURRENT_QUARTERLY["quarter"],
            "summary": CURRENT_QUARTERLY["summary"],
            "lessons": lessons,
        }
    }


def _get_chapter_text(passage: str) -> str:
    request = Request(
        f"https://bible-api.com/{quote(passage)}?translation=web",
        headers={"Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        logger.exception("Bible text provider returned HTTP %s for %s.", exc.code, passage)
        raise HTTPException(502, "Could not load the chapter text for its summary.") from exc
    except (URLError, TimeoutError) as exc:
        logger.exception("Could not connect to the Bible text provider for %s.", passage)
        raise HTTPException(502, "Could not connect to the Bible text provider.") from exc
    except (json.JSONDecodeError, TypeError) as exc:
        logger.exception("Bible text provider returned invalid data for %s.", passage)
        raise HTTPException(502, "The Bible text provider returned an invalid response.") from exc

    text = result.get("text") if isinstance(result, dict) else None
    if not isinstance(text, str) or not text.strip():
        logger.error("Bible text provider returned no chapter text for %s.", passage)
        raise HTTPException(502, "The Bible text provider returned no chapter text.")
    return text.strip()


@router.post("/reading-plans/daily-summary")
def generate_daily_summary(user_id: int = Depends(require_auth)):
    reading = _todays_reading(user_id)
    if reading["complete"]:
        raise HTTPException(404, "The Bible reading plan is complete.")
    if reading["summary"]:
        return {"summary": reading["summary"]}

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            503,
            "AI summaries are not configured. Set OPENAI_API_KEY in the local .env file and restart the API.",
        )

    chapter_text = _get_chapter_text(reading["passage"])
    request_body = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a careful Bible study assistant. Summarize only the "
                    "provided chapter text in 3-5 concise sentences. "
                    "Do not invent quotations or claim uncertain details as facts. "
                    "End with one short reflection question."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Summarize {reading['passage']} from the World English Bible "
                    f"using this source text:\n\n{chapter_text}\n\n"
                    "Do not reproduce the chapter text."
                ),
            },
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
    except HTTPError as exc:
        logger.exception("OpenAI returned HTTP %s while generating a reading summary.", exc.code)
        raise HTTPException(502, "The AI summary service rejected the request.") from exc
    except (URLError, TimeoutError) as exc:
        logger.exception("Could not connect to OpenAI to generate a reading summary.")
        raise HTTPException(502, "Could not connect to the AI summary service.") from exc
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        logger.exception("OpenAI returned an invalid reading summary response.")
        raise HTTPException(502, "The AI summary service returned an invalid response.") from exc

    try:
        summary = result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as exc:
        logger.exception("OpenAI response did not include summary text.")
        raise HTTPException(502, "The AI summary service returned no summary.") from exc
    if not summary:
        raise HTTPException(502, "The AI summary service returned an empty summary.")

    with db_cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO reading_summaries (plan_day_id, summary)
               VALUES (%s, %s)""",
            (reading["dayId"], summary),
        )
    return {"summary": summary}


@router.post("/reading-plans", status_code=201)
def create_reading_plan(body: CreateReadingPlanRequest, user_id: int = Depends(require_admin)):
    if not body.title.strip():
        raise HTTPException(400, "A study guide title is required.")
    if not body.days:
        raise HTTPException(400, "Add at least one verse to the study guide.")
    if any(day.dayNumber < 1 or not day.passage.strip() for day in body.days):
        raise HTTPException(400, "Each study day needs a valid number and passage.")

    with db_cursor(commit=True) as cur:
        plan = dict(insert_returning(
            cur,
            "reading_plans",
            """INSERT INTO reading_plans (title, description)
               VALUES (%s, %s)""",
            (body.title.strip(), body.description.strip()),
        ))
        for day in body.days:
            cur.execute(
                """INSERT INTO reading_plan_days (plan_id, day_number, passage, reflection)
                   VALUES (%s, %s, %s, %s)""",
                (plan["id"], day.dayNumber, day.passage.strip(), day.reflection.strip()),
            )

    return {
        "plan": {
            "id": plan["id"],
            "title": plan["title"],
            "description": plan["description"],
            "createdAt": plan["created_at"],
            "days": [
                {
                    "id": index + 1,
                    "planId": plan["id"],
                    "dayNumber": day.dayNumber,
                    "passage": day.passage.strip(),
                    "reflection": day.reflection.strip(),
                }
                for index, day in enumerate(body.days)
            ],
        }
    }


@router.get("/reading-plans/progress")
def get_reading_progress(user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM reading_progress WHERE user_id = %s",
            (user_id,),
        )
        rows = [dict(r) for r in cur.fetchall()]
    return {"progress": [{
        "id": r["id"],
        "userId": r["user_id"],
        "planDayId": r["plan_day_id"],
        "completed": r["completed"],
        "completedAt": r["completed_at"],
    } for r in rows]}


@router.post("/reading-plans/days/{day_id}/complete", status_code=201)
def complete_reading_day(day_id: int, user_id: int = Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM reading_progress WHERE user_id = %s AND plan_day_id = %s LIMIT 1",
            (user_id, day_id),
        )
        existing = cur.fetchone()

    if existing:
        row = dict(existing)
        return {"progress": {
            "id": row["id"],
            "userId": row["user_id"],
            "planDayId": row["plan_day_id"],
            "completed": row["completed"],
            "completedAt": row["completed_at"],
        }}

    with db_cursor(commit=True) as cur:
        row = dict(insert_returning(
            cur,
            "reading_progress",
            "INSERT INTO reading_progress (user_id, plan_day_id) VALUES (%s, %s)",
            (user_id, day_id),
        ))
    return {"progress": {
        "id": row["id"],
        "userId": row["user_id"],
        "planDayId": row["plan_day_id"],
        "completed": row["completed"],
        "completedAt": row["completed_at"],
    }}
