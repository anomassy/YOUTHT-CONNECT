import logging

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
                      p.id AS progress_id
               FROM reading_plans r
               JOIN reading_plan_days d ON d.plan_id = r.id
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
        return {"complete": True, "passage": None}
    day_number, passage, scheduled_date = scheduled
    with db_cursor() as cur:
        cur.execute(
            """SELECT d.id, d.day_number, d.passage, p.id AS progress_id
               FROM reading_plans r
               JOIN reading_plan_days d ON d.plan_id = r.id
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
    return {"quarterly": CURRENT_QUARTERLY}


@router.post("/reading-plans", status_code=201)
def create_reading_plan(body: CreateReadingPlanRequest, user_id: int = Depends(require_admin)):
    if not body.title.strip():
        raise HTTPException(400, "A study guide title is required.")
    if not body.days:
        raise HTTPException(400, "Add at least one verse to the study guide.")
    day_numbers = [day.dayNumber for day in body.days]
    if any(day_number < 1 or not day.passage.strip() for day_number, day in zip(day_numbers, body.days)):
        raise HTTPException(400, "Each study day needs a valid number and passage.")
    if len(set(day_numbers)) != len(day_numbers):
        raise HTTPException(400, "Each study day needs a unique number.")

    with db_cursor(commit=True) as cur:
        plan = dict(insert_returning(
            cur,
            "reading_plans",
            """INSERT INTO reading_plans (title, description)
               VALUES (%s, %s)""",
            (body.title.strip(), body.description.strip()),
        ))
        for day in sorted(body.days, key=lambda day: day.dayNumber):
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
            "SELECT id FROM reading_plan_days WHERE id = %s LIMIT 1",
            (day_id,),
        )
        if cur.fetchone() is None:
            raise HTTPException(404, "The selected reading day was not found.")

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
