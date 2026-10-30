import os

from server.database import create_tables, table_names


if __name__ == "__main__":
    if not os.environ.get("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL must be configured for deployment.")
    create_tables()

    required_tables = (
        "users",
        "devotionals",
        "reading_plans",
        "reading_plan_days",
        "reading_progress",
        "reading_summaries",
        "prayer_requests",
        "prayer_prays",
        "events",
        "event_rsvps",
        "chat_messages",
        "questions",
        "music_tracks",
    )
    existing_tables = table_names()

    missing_tables = set(required_tables) - existing_tables
    if missing_tables:
        raise RuntimeError(
            "Database setup failed; missing tables: "
            + ", ".join(sorted(missing_tables))
        )
