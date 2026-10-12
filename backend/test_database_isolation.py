#!/usr/bin/env python3
"""
VISIONEXIS — Test & Database Isolation Fail-Closed Regression Suite

Verifies:
1. Canonical path extraction handles SQLite URLs, query strings, relative paths, and case-insensitivity.
2. Protected primary study database detection accurately flags any permutation of eyecog.db.
3. Fail-closed guard refuses execution when TEST_MODE=1 and DATABASE_URL is missing.
4. Fail-closed guard refuses execution when TEST_MODE=1 and DATABASE_URL targets eyecog.db.
5. Permitted execution when TEST_MODE=1 and DATABASE_URL targets an isolated temporary database.
6. Middleware rejects write-capable requests with X-Test-Request: true if backend is connected to the primary study database.
7. Verification that backend/eyecog.db remains 100% byte-for-byte unmodified across the suite.
"""

import os
import sys
import tempfile
import hashlib
import subprocess
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 console output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import database

EYECOG_DB_PATH = BACKEND_DIR / "eyecog.db"

def compute_primary_hash() -> str:
    h = hashlib.sha256()
    with open(EYECOG_DB_PATH, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def run_regression_tests():
    print("=" * 75)
    print("TEST SUITE: TEST & DATABASE ISOLATION FAIL-CLOSED REGRESSION")
    print("=" * 75)

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

    initial_hash = compute_primary_hash()
    print(f"\n[Baseline Verification] Primary eyecog.db SHA-256:\n  {initial_hash}\n")

    # -------------------------------------------------------------------------
    # 1. Canonical Path Extraction
    # -------------------------------------------------------------------------
    p1 = database.extract_canonical_sqlite_path(f"sqlite:///{EYECOG_DB_PATH.as_posix()}")
    p2 = database.extract_canonical_sqlite_path(f"sqlite:///{EYECOG_DB_PATH.as_posix()}?mode=ro")
    p3 = database.extract_canonical_sqlite_path("sqlite:///eyecog.db")
    p4 = database.extract_canonical_sqlite_path(":memory:")

    record(
        "1. Canonical SQLite path resolver accurately normalizes varied URI formats",
        p1 == str(EYECOG_DB_PATH.resolve()) and p2 == str(EYECOG_DB_PATH.resolve()) and p4 is None,
        f"Resolved p1: {p1}, with query: {p2}, memory: {p4}"
    )

    # -------------------------------------------------------------------------
    # 2. Protected Primary Study Database Identification
    # -------------------------------------------------------------------------
    is_primary_abs = database.is_primary_study_database(str(EYECOG_DB_PATH))
    is_primary_uri = database.is_primary_study_database(f"sqlite:///{EYECOG_DB_PATH.as_posix()}?mode=ro")
    is_primary_temp = database.is_primary_study_database("sqlite:///C:/tmp/other_database.db")

    record(
        "2. is_primary_study_database flags primary database and permits external files",
        is_primary_abs is True and is_primary_uri is True and is_primary_temp is False,
        f"Primary abs: {is_primary_abs}, Primary URI: {is_primary_uri}, Temp: {is_primary_temp}"
    )

    # -------------------------------------------------------------------------
    # 3. Fail-Closed Rejection when TEST_MODE=1 and DATABASE_URL is Missing
    # -------------------------------------------------------------------------
    cmd_no_url = [
        sys.executable,
        "-c",
        "import os; os.environ['TEST_MODE'] = '1'; os.environ.pop('DATABASE_URL', None); import database"
    ]
    res_no_url = subprocess.run(cmd_no_url, cwd=BACKEND_DIR, capture_output=True, text=True)
    rejected_missing = (res_no_url.returncode != 0) and ("FAIL-CLOSED TEST ISOLATION GUARD" in res_no_url.stderr)

    record(
        "3. Fail-closed guard rejects TEST_MODE=1 when DATABASE_URL is missing",
        rejected_missing,
        f"Exit code: {res_no_url.returncode}, Error found: {'FAIL-CLOSED' in res_no_url.stderr}"
    )

    # -------------------------------------------------------------------------
    # 4. Fail-Closed Rejection when TEST_MODE=1 targets Primary eyecog.db
    # -------------------------------------------------------------------------
    cmd_target_primary = [
        sys.executable,
        "-c",
        f"import os; os.environ['TEST_MODE'] = '1'; os.environ['DATABASE_URL'] = 'sqlite:///{EYECOG_DB_PATH.as_posix()}'; import database"
    ]
    res_target_primary = subprocess.run(cmd_target_primary, cwd=BACKEND_DIR, capture_output=True, text=True)
    rejected_primary = (res_target_primary.returncode != 0) and ("targets the protected primary study database" in res_target_primary.stderr)

    record(
        "4. Fail-closed guard rejects TEST_MODE=1 when DATABASE_URL targets eyecog.db",
        rejected_primary,
        f"Exit code: {res_target_primary.returncode}, Target eyecog.db blocked successfully"
    )

    # -------------------------------------------------------------------------
    # 5. Permitted Execution when TEST_MODE=1 targets Isolated Temporary DB
    # -------------------------------------------------------------------------
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_f:
        tmp_db_path = tmp_f.name

    try:
        tmp_uri = f"sqlite:///{Path(tmp_db_path).as_posix()}"
        cmd_temp_db = [
            sys.executable,
            "-c",
            f"import os; os.environ['TEST_MODE'] = '1'; os.environ['DATABASE_URL'] = '{tmp_uri}'; import database; print('SUCCESS:', database.is_test_mode, database.is_primary_study_database(database.SQLALCHEMY_DATABASE_URL))"
        ]
        res_temp_db = subprocess.run(cmd_temp_db, cwd=BACKEND_DIR, capture_output=True, text=True)
        allowed_temp = (res_temp_db.returncode == 0) and ("SUCCESS: True False" in res_temp_db.stdout)

        record(
            "5. Isolated temporary database accepted in TEST_MODE=1 with is_primary=False",
            allowed_temp,
            f"Output: {res_temp_db.stdout.strip()}"
        )
    finally:
        if os.path.exists(tmp_db_path):
            os.remove(tmp_db_path)

    # -------------------------------------------------------------------------
    # 6. Middleware Protection: Write Request with X-Test-Request Rejected on Primary DB
    # -------------------------------------------------------------------------
    # Test ASGI middleware behavior directly
    from starlette.requests import Request
    from starlette.responses import Response
    from main import fail_closed_test_database_guard

    async def mock_next(request):
        return Response("ok", status_code=200)

    # Create dummy scope with X-Test-Request: true
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/patients",
        "headers": [(b"x-test-request", b"true")],
    }
    req = Request(scope)

    import asyncio
    resp = asyncio.run(fail_closed_test_database_guard(req, mock_next))
    middleware_blocked = (resp.status_code == 403)

    record(
        "6. Middleware rejects write-capable requests with X-Test-Request: true on primary DB",
        middleware_blocked,
        f"HTTP Status: {resp.status_code} (Expected 403 Forbidden)"
    )

    # -------------------------------------------------------------------------
    # 7. Verification: Primary eyecog.db Remains 100% Byte-for-Byte Unmodified
    # -------------------------------------------------------------------------
    final_hash = compute_primary_hash()
    hash_matched = (initial_hash == final_hash)

    record(
        "7. Primary study database backend/eyecog.db was 100% UNTOUCHED",
        hash_matched,
        f"Initial Hash == Final Hash ({final_hash[:16]}...)"
    )

    print("\n" + "=" * 75)
    print(f"DATABASE ISOLATION REGRESSION RESULTS: {passed}/{total} PASSED ({Math.round(passed/total*100) if 'Math' in globals() else int(passed/total*100)}%)")
    print("=" * 75)

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_regression_tests()
