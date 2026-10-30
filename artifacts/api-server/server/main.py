import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

load_dotenv()

from .routes import router
from .database import create_tables
from .routes.reading_plans import ensure_daily_bible_plan

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Youth Connect API", version="1.0.0")
WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist" / "public"
WEB_INDEX = WEB_DIST / "index.html"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


def service_status():
    return {"status": "ok", "service": "youth-connect-api"}


@app.get("/", include_in_schema=False)
async def web_root():
    if WEB_INDEX.is_file():
        return FileResponse(WEB_INDEX)
    return service_status()


@app.get("/api", include_in_schema=False)
@app.get("/healthz", include_in_schema=False)
async def root_health():
    return service_status()


@app.get("/{path:path}", include_in_schema=False)
async def web_fallback(path: str):
    if path == "api" or path.startswith("api/") or not WEB_INDEX.is_file():
        raise HTTPException(404, "Not found.")

    candidate = (WEB_DIST / path).resolve()
    if candidate.is_relative_to(WEB_DIST.resolve()) and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(WEB_INDEX)


@app.on_event("startup")
async def startup():
    create_tables()
    ensure_daily_bible_plan()
    logger.info("Database tables verified.")
