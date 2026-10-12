#!/usr/bin/env python3
"""
Test Suite: Backend Network Safety, Launch Defaults, and CORS Policy
Verifies:
1. start-backend.ps1 enforces --host 127.0.0.1.
2. backend/main.py defaults host to 127.0.0.1.
3. CORS configuration prohibits wildcard regexes (e.g. arbitrary Vercel apps).
4. FastAPI application rejects unauthorized origins and permits designated local origins.
"""

import os
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from main import app

def run_tests():
    print("=" * 70)
    print("TEST SUITE: NETWORK SAFETY, LAUNCH DEFAULTS & CORS POLICY")
    print("=" * 70)

    # 1. Inspect start-backend.ps1
    start_script = (BASE_DIR / "start-backend.ps1").read_text(encoding="utf-8")
    assert "--host 127.0.0.1" in start_script, "start-backend.ps1 must enforce '--host 127.0.0.1'"
    print("  [PASS] 1. start-backend.ps1 explicitly locks host to 127.0.0.1")

    # 2. Inspect backend/main.py host default
    main_code = (BACKEND_DIR / "main.py").read_text(encoding="utf-8")
    assert 'os.environ.get("HOST", "127.0.0.1")' in main_code, "main.py must default HOST to 127.0.0.1"
    print("  [PASS] 2. backend/main.py default host is 127.0.0.1 (loopback interface)")

    # 3. Verify absence of wildcard origin regex
    assert "allow_origin_regex" not in main_code, "Wildcard allow_origin_regex must be removed from main.py"
    print("  [PASS] 3. Wildcard domain CORS regexes eliminated from middleware")

    # 4. Test CORS Middleware configuration directly on FastAPI app
    cors_middleware = [m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware"]
    assert len(cors_middleware) == 1, "CORSMiddleware must be configured on app"
    
    cors_kwargs = cors_middleware[0].kwargs
    allow_origins = cors_kwargs.get("allow_origins", [])
    allow_origin_regex = cors_kwargs.get("allow_origin_regex")

    # Assert origins
    assert "http://localhost:5173" in allow_origins, "localhost:5173 must be allowed"
    assert "http://127.0.0.1:5173" in allow_origins, "127.0.0.1:5173 must be allowed"
    assert "http://localhost:3000" in allow_origins, "localhost:3000 must be allowed"
    print("  [PASS] 4a. Authorized origins explicitly defined in CORS middleware configuration")

    # Assert regex is disabled
    assert allow_origin_regex is None or allow_origin_regex == "", (
        f"allow_origin_regex must be None or empty, got {allow_origin_regex}"
    )
    # 5. Live ASGI CORS evaluation for allowed vs disallowed origins
    import asyncio

    async def evaluate_origin(origin_val: str):
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/dashboard/summary",
            "query_string": b"",
            "headers": [(b"origin", origin_val.encode()), (b"host", b"127.0.0.1:8001")],
        }
        headers_out = {}
        async def receive(): return {"type": "http.request"}
        async def send(msg):
            if msg["type"] == "http.response.start":
                for k, v in msg.get("headers", []):
                    headers_out[k.decode().lower()] = v.decode()
        await app(scope, receive, send)
        return headers_out.get("access-control-allow-origin")

    # Assert allowed origin receives ACAO header
    acao_allowed = asyncio.run(evaluate_origin("http://localhost:5173"))
    assert acao_allowed == "http://localhost:5173", f"Expected 'http://localhost:5173', got {acao_allowed}"
    print("  [PASS] 5a. Allowed origin (http://localhost:5173) correctly granted CORS headers")

    # Assert disallowed Vercel origin is rejected (no ACAO header)
    acao_disallowed = asyncio.run(evaluate_origin("https://unauthorized.vercel.app"))
    assert acao_disallowed is None, f"Unauthorized origin must not receive ACAO header, got {acao_disallowed}"
    print("  [PASS] 5b. Disallowed Vercel origin (https://unauthorized.vercel.app) rejected (ACAO header omitted)")

    # Assert arbitrary foreign domain is rejected
    acao_foreign = asyncio.run(evaluate_origin("https://external-tracker.net"))
    assert acao_foreign is None, f"Foreign origin must not receive ACAO header, got {acao_foreign}"
    print("  [PASS] 5c. Foreign domain origin (https://external-tracker.net) rejected")

    print("\n" + "=" * 70)
    print("ALL NETWORK SAFETY & CORS TESTS PASSED (100%)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
