from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

import models
import database
from database import (
    Base,
    engine,
    SessionLocal,
    SQLALCHEMY_DATABASE_URL,
    is_primary_study_database,
    is_test_mode,
    is_production,
    PRIMARY_STUDY_DB_PATH,
)
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

if "assessments" in inspector.get_table_names():
    existing_assessment_columns = {col["name"] for col in inspector.get_columns("assessments")}
    if "baseline_json" not in existing_assessment_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE assessments ADD COLUMN baseline_json TEXT"))

import os
from fastapi import Request
from starlette.responses import JSONResponse

default_seed = "false" if (is_production or is_test_mode) else "true"
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


@app.middleware("http")
async def fail_closed_test_database_guard(request: Request, call_next):
    """Refuse write-capable test requests if the server is connected to the primary study database."""
    if request.headers.get("x-test-request", "").lower() in ("true", "1", "yes"):
        if is_primary_study_database(SQLALCHEMY_DATABASE_URL):
            return JSONResponse(
                status_code=403,
                content={
                    "error": "FAIL_CLOSED_TEST_GUARD",
                    "detail": "Automated test write request rejected: Backend is connected to the protected primary study database.",
                },
            )
    response = await call_next(request)
    return response


@app.middleware("http")
async def enforce_https_in_cloud(request: Request, call_next):
    """Enforce HTTPS behind reverse proxies in cloud environments."""
    if database.is_production and not database.is_test_mode:
        if request.url.path == "/api/health":
            return await call_next(request)
        forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
        if forwarded_proto == "http":
            return JSONResponse(
                status_code=403,
                content={
                    "error": "INSECURE_TRANSPORT",
                    "detail": "Insecure HTTP transport rejected. HTTPS is strictly required in cloud environments.",
                },
            )
    return await call_next(request)


# Security Boundary Notice:
# This API operates unauthenticated by design for local single-operator research
# on an isolated loopback interface (127.0.0.1). Wildcard domain CORS regexes are
# disallowed. Any multi-user or network deployment requires an authenticated proxy.
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
env_origins = os.environ.get("CORS_ORIGINS", "")
if env_origins:
    for origin in env_origins.split(","):
        cleaned = origin.strip()
        # Strictly reject wildcard origins to prevent unauthorized cross-origin data exposure
        if cleaned and cleaned != "*" and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
    """Service health and database readiness check without exposing secrets or credentials."""
    try:
        with database.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "database": "unavailable",
            },
        )


@app.get("/api/system/environment")
def system_environment():
    raw_env = os.environ.get("ENVIRONMENT", "").lower()
    resolved_env = (
        raw_env
        if raw_env in ("production", "prod", "staging")
        else ("test" if is_test_mode else "development")
    )
    return {
        "environment": resolved_env,
        "test_mode": is_test_mode,
        "is_primary_database": is_primary_study_database(SQLALCHEMY_DATABASE_URL),
        "database_target": (
            "isolated_test"
            if is_test_mode
            else ("primary_study_sqlite" if is_primary_study_database(SQLALCHEMY_DATABASE_URL) else "external_relational")
        ),
    }


if __name__ == "__main__":
    import uvicorn
    # Default host binds strictly to loopback (127.0.0.1) for local safety
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("main:app", host=host, port=port)
