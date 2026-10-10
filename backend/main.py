from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

import models
from database import Base, engine, SessionLocal
from seed import seed_if_empty
from routers import patients, sessions, assessments, dashboard, gaze, reports
from services.gaze_persistence import backfill_all_sessions

Base.metadata.create_all(bind=engine)

# create_all only creates missing tables; it won't add new columns to a
# table that already existed (e.g. "sessions" before the Assessment model
# was introduced), so patch that in manually.
inspector = inspect(engine)
if "sessions" in inspector.get_table_names():
    existing_columns = {col["name"] for col in inspector.get_columns("sessions")}
    if "assessment_id" not in existing_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN assessment_id VARCHAR(36)"))

import os

is_production = (
    os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod")
    or os.environ.get("RENDER") is not None
)
default_seed = "false" if is_production else "true"
should_seed = os.environ.get("SEED_DEMO_DATA", default_seed).lower() in ("true", "1", "yes")
with SessionLocal() as db:
    if should_seed:
        seed_if_empty(db)
    backfill_all_sessions(db)

app = FastAPI(
    title="VISIONEXIS API",
    description="Software-Based Webcam Gaze Analysis & Visual-Cognitive Assessment System",
    version="2.0.0",
)

# Configure allowed origins from environment with local fallbacks
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
env_origins = os.environ.get("CORS_ORIGINS", "")
if env_origins:
    for origin in env_origins.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(assessments.router)
app.include_router(dashboard.router)
app.include_router(gaze.router)
app.include_router(reports.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
