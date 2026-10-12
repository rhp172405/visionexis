#!/usr/bin/env python3
"""
VISIONEXIS — Staging & Cloud Readiness Automated Test Suite

Verifies:
1. Health check endpoint (/api/health) reports service readiness and database
   connectivity without exposing secrets, credentials, or participant data.
2. Simulated database failure causes /api/health to return HTTP 503 degraded status.
3. CORS policy strictly enforces exact allowed origins and rejects wildcard origins
   and unauthorized domains (including unauthorized .vercel.app domains).
4. Environment & database configuration enforcement:
   - Disallows silent SQLite fallback in production and staging environments.
   - Requires DATABASE_URL when ENVIRONMENT is 'production' or 'staging'.
   - Disallows SQLite URLs in production and staging environments.
   - Normalizes legacy 'postgres://' connection strings.
5. PostgreSQL schema DDL compilation and compatibility across all 8 models.
6. API error handling and response sanitization (no internal DB traces leaked).
7. Participant record isolation:
   - Disallows cross-linking sessions across different participants (HTTP 404).
   - Disallows cross-participant baseline assessment tampering (HTTP 400).
   - Verifies cascade deletion of participant A does not touch participant B.
8. Primary study database (backend/eyecog.db) SHA-256 hash byte-for-byte unmodified.
"""

import os
import sys
import json
import tempfile
import hashlib
import asyncio
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 console output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import database
import models
import schemas
from main import app
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql

EYECOG_DB_PATH = BACKEND_DIR / "eyecog.db"


def compute_file_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


async def asgi_request(
    app_instance,
    method: str,
    path: str,
    headers: list[tuple[bytes, bytes]] | None = None,
    body: bytes = b"",
) -> tuple[int, dict, bytes]:
    """Execute ASGI request against the FastAPI application in-memory."""
    req_headers = headers or []
    if not any(k.lower() == b"host" for k, _ in req_headers):
        req_headers.append((b"host", b"127.0.0.1:8001"))

    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": req_headers,
    }

    status_code = 0
    resp_headers: dict[str, str] = {}
    resp_body = bytearray()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        nonlocal status_code, resp_headers, resp_body
        if message["type"] == "http.response.start":
            status_code = message["status"]
            for k, v in message.get("headers", []):
                resp_headers[k.decode("latin1").lower()] = v.decode("latin1")
        elif message["type"] == "http.response.body":
            resp_body.extend(message.get("body", b""))

    await app_instance(scope, receive, send)
    return status_code, resp_headers, bytes(resp_body)


def run_all_checks():
    print("=" * 75)
    print("VISIONEXIS — CLOUD & STAGING READINESS VERIFICATION SUITE")
    print("=" * 75)

    initial_hash = compute_file_sha256(EYECOG_DB_PATH)
    print(f"\n[Baseline Verification] Primary eyecog.db SHA-256:\n  {initial_hash}\n")

    passed = 0
    total = 0

    def record(name: str, condition: bool, detail: str = ""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"  [PASS] {name}")
            if detail:
                print(f"         Detail: {detail}")
            passed += 1
        else:
            print(f"  [FAIL] {name}")
            if detail:
                print(f"         Detail: {detail}")

    # =========================================================================
    # 1. Health Endpoint Verification
    # =========================================================================
    status, hdrs, body = asyncio.run(
        asgi_request(app, "GET", "/api/health")
    )
    health_data = json.loads(body.decode()) if status == 200 else {}
    record(
        "1a. Health endpoint (/api/health) returns HTTP 200 and reports database connected",
        status == 200 and health_data.get("status") == "ok" and health_data.get("database") == "connected",
        f"Status: {status}, Payload: {health_data}"
    )

    # Verify zero secret or credential leakage in health response
    serialized_health = json.dumps(health_data).lower()
    has_leakage = any(term in serialized_health for term in ["password", "secret", "token", "postgresql://", "sqlite", "eyecog.db"])
    record(
        "1b. Health endpoint exposes zero credentials, file paths, or participant records",
        not has_leakage and "patients" not in health_data,
        f"Clean payload verified (no leak of DB credentials or internal state)"
    )

    # 1c. Simulated database failure causes /api/health to return HTTP 503 degraded
    from unittest.mock import patch
    with patch.object(database.engine, "connect", side_effect=Exception("Simulated connection timeout/refusal")):
        st_fail, _, b_fail = asyncio.run(
            asgi_request(app, "GET", "/api/health")
        )
        fail_data = json.loads(b_fail.decode()) if st_fail == 503 else {}
        fail_leakage = any(term in json.dumps(fail_data).lower() for term in ["password", "secret", "token", "postgresql://", "sqlite", "eyecog.db", "traceback", "simulated"])
        record(
            "1c. Simulated database failure causes /api/health to return HTTP 503 with sanitized degraded payload",
            st_fail == 503 and fail_data.get("status") == "degraded" and fail_data.get("database") == "unavailable" and not fail_leakage,
            f"Status: {st_fail}, Payload: {fail_data}"
        )

    # =========================================================================
    # 2. CORS Policy & Origin Restrictions
    # =========================================================================
    # 2a. Approved local origin
    st_loc, h_loc, _ = asyncio.run(
        asgi_request(
            app, "GET", "/api/health",
            headers=[(b"origin", b"http://localhost:5173")]
        )
    )
    record(
        "2a. Approved local origin (http://localhost:5173) granted Access-Control-Allow-Origin",
        h_loc.get("access-control-allow-origin") == "http://localhost:5173",
        f"ACAO header: {h_loc.get('access-control-allow-origin')}"
    )

    # 2b. Disapproved Vercel preview/spoofed origin
    st_unauth, h_unauth, _ = asyncio.run(
        asgi_request(
            app, "GET", "/api/health",
            headers=[(b"origin", b"https://unauthorized-preview.vercel.app")]
        )
    )
    record(
        "2b. Unauthorized Vercel origin (https://unauthorized-preview.vercel.app) strictly rejected",
        "access-control-allow-origin" not in h_unauth,
        f"ACAO header correctly omitted: {h_unauth.get('access-control-allow-origin')}"
    )

    # 2c. Foreign third-party domain
    st_for, h_for, _ = asyncio.run(
        asgi_request(
            app, "GET", "/api/health",
            headers=[(b"origin", b"https://arbitrary-attacker-site.com")]
        )
    )
    record(
        "2c. Foreign domain (https://arbitrary-attacker-site.com) strictly rejected",
        "access-control-allow-origin" not in h_for,
        f"ACAO header correctly omitted: {h_for.get('access-control-allow-origin')}"
    )

    # 2d. Wildcard origin elimination
    cors_mw = [m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware"]
    cors_origins = cors_mw[0].kwargs.get("allow_origins", []) if cors_mw else []
    record(
        "2d. Wildcard origin '*' strictly prohibited in CORS allow_origins",
        "*" not in cors_origins,
        f"Configured origins count: {len(cors_origins)} (Wildcard absent)"
    )

    # =========================================================================
    # 3. Cloud Database Configuration & Fail-Closed Guard
    # =========================================================================
    # 3a. Production/staging enforces DATABASE_URL presence
    import subprocess
    cmd_staging_no_url = [
        sys.executable,
        "-c",
        "import os; os.environ['ENVIRONMENT'] = 'staging'; os.environ.pop('DATABASE_URL', None); import database"
    ]
    res_staging_no_url = subprocess.run(cmd_staging_no_url, cwd=BACKEND_DIR, capture_output=True, text=True)
    record(
        "3a. Staging environment without DATABASE_URL fails closed (RuntimeError)",
        res_staging_no_url.returncode != 0 and "DATABASE_URL environment variable is required" in res_staging_no_url.stderr,
        f"Exit code: {res_staging_no_url.returncode}"
    )

    # 3b. Production/staging disallows SQLite URL
    cmd_staging_sqlite = [
        sys.executable,
        "-c",
        "import os; os.environ['ENVIRONMENT'] = 'staging'; os.environ['DATABASE_URL'] = 'sqlite:///some_staging.db'; import database"
    ]
    res_staging_sqlite = subprocess.run(cmd_staging_sqlite, cwd=BACKEND_DIR, capture_output=True, text=True)
    record(
        "3b. Staging environment with SQLite DATABASE_URL fails closed (RuntimeError)",
        res_staging_sqlite.returncode != 0 and "SQLite database is disallowed" in res_staging_sqlite.stderr,
        f"Exit code: {res_staging_sqlite.returncode}"
    )

    # 3c. Legacy postgres:// URL scheme normalization
    cmd_postgres_norm = [
        sys.executable,
        "-c",
        "import os; os.environ['ENVIRONMENT'] = 'development'; os.environ['DATABASE_URL'] = 'postgres://user:pass@localhost:5432/db'; import database; print('URL:', database.SQLALCHEMY_DATABASE_URL)"
    ]
    res_norm = subprocess.run(cmd_postgres_norm, cwd=BACKEND_DIR, capture_output=True, text=True)
    record(
        "3c. Legacy 'postgres://' connection string normalized to PostgreSQL engine URL",
        res_norm.returncode == 0 and ("postgresql://user:pass@localhost:5432/db" in res_norm.stdout or "postgresql+pg8000://user:pass@localhost:5432/db" in res_norm.stdout),
        f"Normalized output: {res_norm.stdout.strip()}"
    )

    # =========================================================================
    # 4. PostgreSQL Dialect DDL Compilation Compatibility
    # =========================================================================
    pg_dialect = postgresql.dialect()
    all_models = [
        models.Patient,
        models.VisualHistory,
        models.ClinicalFindings,
        models.Assessment,
        models.TaskSession,
        models.GazeEvent,
        models.TaskResult,
        models.Report,
    ]
    ddl_success = True
    ddl_errors = []
    for m in all_models:
        try:
            ddl_stmt = str(CreateTable(m.__table__).compile(dialect=pg_dialect))
            if not ddl_stmt or "CREATE TABLE" not in ddl_stmt:
                ddl_success = False
                ddl_errors.append(f"{m.__tablename__}: Empty DDL")
        except Exception as e:
            ddl_success = False
            ddl_errors.append(f"{m.__tablename__}: {e}")

    record(
        "4. All 8 database models compile valid DDL under PostgreSQL dialect",
        ddl_success,
        f"Verified models: {len(all_models)}/8 successfully compiled" if ddl_success else f"Errors: {ddl_errors}"
    )

    # =========================================================================
    # 5. Participant Isolation & Zero Cross-Contamination in Isolated Temp DB
    # =========================================================================
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    try:
        temp_url = f"sqlite:///{Path(tmp_db_path).as_posix()}"
        temp_engine = create_engine(temp_url)
        database.Base.metadata.create_all(bind=temp_engine)
        TempSession = sessionmaker(bind=temp_engine)

        with TempSession() as session:
            # Create synthetic participant A
            p_a = models.Patient(
                id="syn-pat-001",
                patient_code="P-SYN-001",
                name="Synthetic Subject Alpha",
                age=25,
                gender="Non-binary",
            )
            # Create synthetic participant B
            p_b = models.Patient(
                id="syn-pat-002",
                patient_code="P-SYN-002",
                name="Synthetic Subject Beta",
                age=35,
                gender="Female",
            )
            session.add_all([p_a, p_b])
            session.commit()

            # Create assessment for Participant A
            asm_a = models.Assessment(
                id="syn-asm-001",
                patient_id=p_a.id,
                status="in_progress",
            )
            # Create assessment for Participant B
            asm_b = models.Assessment(
                id="syn-asm-002",
                patient_id=p_b.id,
                status="in_progress",
            )
            session.add_all([asm_a, asm_b])
            session.commit()

            # Create session for Participant A
            sess_a = models.TaskSession(
                id="syn-sess-001",
                patient_id=p_a.id,
                assessment_id=asm_a.id,
                task_type="visual_search",
                status="completed",
            )
            session.add(sess_a)
            session.commit()

            # Add gaze events and results to session A
            gaze_a = models.GazeEvent(
                id="syn-gaze-001",
                session_id=sess_a.id,
                timestamp=100.0,
                x=500.0,
                y=300.0,
                event_type="raw",
            )
            res_a = models.TaskResult(
                id="syn-res-001",
                session_id=sess_a.id,
                accuracy_pct=92.0,
                rt_ms=1200.0,
            )
            session.add_all([gaze_a, res_a])
            session.commit()

        # 5a. Verify Cross-Linking Rejection in Router logic
        from routers import sessions as sessions_router
        from routers import assessments as assessments_router
        from fastapi import HTTPException

        # Attempt to create session for Participant B with Participant A's assessment
        cross_link_blocked = False
        with TempSession() as db_session:
            payload_cross = schemas.SessionCreate(
                patient_id="syn-pat-002",  # Participant B
                assessment_id="syn-asm-001",  # Participant A's assessment!
                task_type="visual_search",
            )
            try:
                sessions_router.create_session(payload_cross, db=db_session)
            except HTTPException as e:
                cross_link_blocked = (e.status_code == 404) and ("Assessment not found for this patient" in e.detail)

        record(
            "5a. Cross-linking participant session to another participant's assessment rejected (HTTP 404)",
            cross_link_blocked,
            "Participant B cannot attach sessions to Participant A's assessment visit"
        )

        # 5b. Baseline cross-tampering guard
        baseline_tamper_blocked = False
        with TempSession() as db_session:
            tamper_payload = {
                "assessment_id": "syn-asm-001",  # Assessment A
                "patient_id": "syn-pat-002",      # But patient B ID!
                "npc_break_cm": 6.0,
            }
            try:
                assessments_router.save_baseline_assessment("syn-asm-001", tamper_payload, db=db_session)
            except HTTPException as e:
                baseline_tamper_blocked = (e.status_code == 400) and ("does not match" in e.detail)

        record(
            "5b. Cross-participant baseline data tampering rejected (HTTP 400)",
            baseline_tamper_blocked,
            "Mismatched participant_id rejected before baseline write"
        )

        # 5c. Cascade deletion isolation: Deleting Participant A leaves Participant B completely unaffected
        with TempSession() as db_session:
            pat_a_row = db_session.get(models.Patient, "syn-pat-001")
            db_session.delete(pat_a_row)
            db_session.commit()

            # Confirm A's records deleted
            a_patients = db_session.query(models.Patient).filter_by(id="syn-pat-001").count()
            a_asms = db_session.query(models.Assessment).filter_by(id="syn-asm-001").count()
            a_sessions = db_session.query(models.TaskSession).filter_by(id="syn-sess-001").count()
            a_gazes = db_session.query(models.GazeEvent).filter_by(session_id="syn-sess-001").count()

            # Confirm B's records 100% intact
            b_patients = db_session.query(models.Patient).filter_by(id="syn-pat-002").count()
            b_asms = db_session.query(models.Assessment).filter_by(id="syn-asm-002").count()

            isolation_verified = (
                a_patients == 0 and a_asms == 0 and a_sessions == 0 and a_gazes == 0
                and b_patients == 1 and b_asms == 1
            )

        record(
            "5c. Cascade deletion of Participant A completely isolates and preserves Participant B",
            isolation_verified,
            f"Participant A rows: 0, Participant B patient: {b_patients}, assessment: {b_asms}"
        )

        temp_engine.dispose()
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except Exception:
                pass

    # =========================================================================
    # 6. API Error Response Sanitization
    # =========================================================================
    st_404, _, b_404 = asyncio.run(
        asgi_request(app, "GET", "/api/patients/non-existent-uuid-1234")
    )
    data_404 = json.loads(b_404.decode()) if b_404 else {}
    record(
        "6a. Non-existent resource returns clean HTTP 404 without internal trace",
        st_404 == 404 and data_404.get("detail") == "Patient not found",
        f"Status: {st_404}, Detail: {data_404.get('detail')}"
    )

    st_bad_task, _, b_bad_task = asyncio.run(
        asgi_request(
            app, "POST", "/api/sessions/create",
            headers=[(b"content-type", b"application/json")],
            body=json.dumps({"patient_id": "p1", "assessment_id": "a1", "task_type": "invalid_task"}).encode()
        )
    )
    record(
        "6b. Invalid task type rejected with clean HTTP 400",
        st_bad_task == 400,
        f"Status: {st_bad_task}"
    )

    # =========================================================================
    # 7. Primary Study Database Hash Integrity Verification
    # =========================================================================
    final_hash = compute_file_sha256(EYECOG_DB_PATH)
    hash_matched = (initial_hash == final_hash)
    record(
        "7. Primary study database backend/eyecog.db was 100% UNTOUCHED (0 bytes written)",
        hash_matched,
        f"Initial Hash == Final Hash ({final_hash[:16]}...)"
    )

    print("\n" + "=" * 75)
    print(f"STAGING READINESS REGRESSION RESULTS: {passed}/{total} PASSED ({int(passed/total*100)}%)")
    print("=" * 75)

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    run_all_checks()
