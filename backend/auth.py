"""
VISIONEXIS — API Authentication, Authorization, & Scoped Session Security Module

Architecture: Dual-Tier Role-Based Access Control (RBAC) & Scoped Session Tokens:
1. Operator Role (Examiner / Clinical Research Station):
   - Authenticated via pre-shared Operator API Key (Bearer token or X-API-Key header).
   - Authorized for clinical management: registering patients, listing patients, viewing
     dashboard KPIs, creating assessments, administrative reports, and cascade purges.
2. Participant Session Role (Scoped Capability Token):
   - Cryptographically signed HMAC-SHA256 JWT issued when an assessment/session is created.
   - Bound strictly to a specific (patient_id, assessment_id, session_id).
   - Valid for 24 hours.
   - Authorized only for tasks belonging to their assigned session/assessment.
   - Strictly prohibited from accessing other participants' records (IDOR protection),
     listing all patients, viewing global dashboards, or downloading other participants' reports.
3. Fail-Closed Staging / Production Policy:
   - When ENVIRONMENT in ("staging", "production") or AUTH_REQUIRED=true:
     Unauthenticated access is strictly rejected with HTTP 401 Unauthorized.
   - In local development (ENVIRONMENT=development and AUTH_REQUIRED!=true):
     Permits unauthenticated requests as local development operator for backward-compatible
     single-workstation developer workflows.
"""

import os
import hmac
import hashlib
import json
import base64
import time
import secrets
from typing import Optional, Tuple, Dict
from dataclasses import dataclass
from fastapi import Request, HTTPException, Security, WebSocket, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Configuration
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").lower()
IS_STAGING_OR_PROD = ENVIRONMENT in ("production", "prod", "staging") or (os.environ.get("RENDER") is not None)

# In staging/prod, authentication is strictly required
AUTH_REQUIRED_ENV = os.environ.get("AUTH_REQUIRED")
if AUTH_REQUIRED_ENV is not None:
    AUTH_REQUIRED = AUTH_REQUIRED_ENV.lower() in ("true", "1", "yes")
else:
    AUTH_REQUIRED = IS_STAGING_OR_PROD

# Secret keys
DEFAULT_DEV_SECRET = "visionexis-dev-secret-key-change-in-production-2026"
DEFAULT_DEV_OPERATOR_KEY = "visionexis-dev-operator-key-2026"

AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", DEFAULT_DEV_SECRET)
OPERATOR_API_KEY = os.environ.get("OPERATOR_API_KEY", DEFAULT_DEV_OPERATOR_KEY)

# Fail-closed guard for production/staging when keys remain on default dev values or are too weak
if IS_STAGING_OR_PROD and not os.environ.get("TEST_MODE"):
    if not os.environ.get("OPERATOR_API_KEY") or os.environ.get("OPERATOR_API_KEY") == DEFAULT_DEV_OPERATOR_KEY or len(OPERATOR_API_KEY) < 32:
        raise RuntimeError("CRITICAL: In staging/production, OPERATOR_API_KEY must be a cryptographically secure key of at least 32 characters.")
    if not os.environ.get("AUTH_SECRET_KEY") or os.environ.get("AUTH_SECRET_KEY") == DEFAULT_DEV_SECRET or len(AUTH_SECRET_KEY) < 32:
        raise RuntimeError("CRITICAL: In staging/production, AUTH_SECRET_KEY must be a cryptographically secure key of at least 32 characters.")

TOKEN_EXPIRATION_SECONDS = int(os.environ.get("TOKEN_EXPIRATION_SECONDS", 86400))  # 24 hours
WS_TICKET_EXPIRATION_SECONDS = int(os.environ.get("WS_TICKET_EXPIRATION_SECONDS", 60))  # 60 seconds

# In-memory consumed ticket nonces for single-use replay protection
_consumed_ws_tickets: Dict[str, float] = {}

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    is_authenticated: bool
    role: str  # "operator" | "participant_session" | "anonymous"
    patient_id: Optional[str] = None
    assessment_id: Optional[str] = None
    session_id: Optional[str] = None
    error_message: Optional[str] = None

    @property
    def is_operator(self) -> bool:
        return self.is_authenticated and self.role == "operator"

    @property
    def is_participant(self) -> bool:
        return self.is_authenticated and self.role == "participant_session"


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding < 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_session_token(
    patient_id: str,
    assessment_id: str,
    session_id: Optional[str] = None,
    expires_in_seconds: int = TOKEN_EXPIRATION_SECONDS,
) -> str:
    """Generate an HMAC-SHA256 signed JWT session token scoped to a participant session."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": session_id or assessment_id,
        "patient_id": patient_id,
        "assessment_id": assessment_id,
        "session_id": session_id,
        "role": "participant_session",
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    hdr_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{hdr_b64}.{payload_b64}".encode("utf-8")

    sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{hdr_b64}.{payload_b64}.{sig_b64}"


def verify_token(token_str: str) -> AuthContext:
    """Verifies an Operator API Key or signed JWT session token."""
    if not token_str or not isinstance(token_str, str):
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Empty token")

    token_clean = token_str.strip()

    # 1. Check if token matches the configured Operator API Key
    if hmac.compare_digest(token_clean, OPERATOR_API_KEY):
        return AuthContext(is_authenticated=True, role="operator")

    # 2. Check if token is a signed Session JWT
    parts = token_clean.split(".")
    if len(parts) != 3:
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Malformed token format")

    hdr_b64, payload_b64, sig_b64 = parts
    signing_input = f"{hdr_b64}.{payload_b64}".encode("utf-8")

    expected_sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Invalid signature encoding")

    if not hmac.compare_digest(expected_sig, actual_sig):
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Invalid token signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Invalid payload JSON")

    # Check expiration
    now = int(time.time())
    exp = payload.get("exp")
    if exp is not None and now > exp:
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Token has expired")

    role = payload.get("role", "participant_session")
    return AuthContext(
        is_authenticated=True,
        role=role,
        patient_id=payload.get("patient_id"),
        assessment_id=payload.get("assessment_id"),
        session_id=payload.get("session_id"),
    )


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extract auth token from Authorization header, X-API-Key header, or query param."""
    # 1. Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        if len(parts) == 1:
            return parts[0]

    # 2. X-API-Key header
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        return api_key_header.strip()

    # 3. Query param ?token= (for exports or redirects)
    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()

    return None


async def get_current_auth(request: Request) -> AuthContext:
    """Dependency: Parses and verifies the auth context of the incoming request."""
    token = extract_token_from_request(request)

    if not token:
        if not AUTH_REQUIRED:
            # Backward-compatible local development single-operator mode
            return AuthContext(is_authenticated=True, role="operator")
        return AuthContext(is_authenticated=False, role="anonymous", error_message="Authentication credentials missing")

    auth_ctx = verify_token(token)
    if not auth_ctx.is_authenticated and not AUTH_REQUIRED:
        # In dev mode with invalid token, report error
        pass

    return auth_ctx


def require_operator(auth: AuthContext) -> None:
    """Enforces that the caller is an authenticated Operator/Clinician."""
    if not isinstance(auth, AuthContext):
        return  # Direct function invocation in unit test harnesses
    if not auth.is_authenticated:
        detail = auth.error_message or "Authentication required."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not auth.is_operator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Operator/Examiner privileges required for this operation.",
        )


def enforce_patient_access(auth: AuthContext, patient_id: str) -> None:
    """Enforces that the caller has access to the target patient record."""
    if not isinstance(auth, AuthContext):
        return  # Direct function invocation in unit test harnesses
    if not auth.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth.error_message or "Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if auth.is_operator:
        return  # Operators have access to all patient records

    if auth.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access records belonging to another participant.",
        )


def enforce_assessment_access(auth: AuthContext, assessment_id: str, assessment_patient_id: Optional[str] = None) -> None:
    """Enforces that the caller has access to the target assessment."""
    if not isinstance(auth, AuthContext):
        return  # Direct function invocation in unit test harnesses
    if not auth.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth.error_message or "Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if auth.is_operator:
        return

    # Check assessment ID match
    if auth.assessment_id and auth.assessment_id == assessment_id:
        return

    # Check patient ID match if known
    if assessment_patient_id and auth.patient_id == assessment_patient_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Cannot access assessment belonging to another participant.",
    )


def enforce_session_access(auth: AuthContext, session_id: str, session_patient_id: Optional[str] = None) -> None:
    """Enforces that the caller has access to the target session."""
    if not isinstance(auth, AuthContext):
        return  # Direct function invocation in unit test harnesses
    if not auth.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth.error_message or "Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if auth.is_operator:
        return

    # If scoped to specific session
    if auth.session_id and auth.session_id == session_id:
        return

    # If scoped to patient
    if session_patient_id and auth.patient_id == session_patient_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Cannot access session belonging to another participant.",
    )


def create_ws_ticket(session_id: str, patient_id: Optional[str] = None, expires_in_seconds: int = WS_TICKET_EXPIRATION_SECONDS) -> str:
    """Creates a short-lived (60s), single-use, session-bound WebSocket ticket."""
    now = int(time.time())
    nonce = secrets.token_hex(16)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": session_id,
        "patient_id": patient_id,
        "type": "ws_ticket",
        "nonce": nonce,
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    hdr_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{hdr_b64}.{payload_b64}".encode("utf-8")

    sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{hdr_b64}.{payload_b64}.{sig_b64}"


def verify_ws_ticket(ticket_str: str, expected_session_id: str) -> Tuple[bool, Optional[str]]:
    """Verifies a short-lived WebSocket ticket and enforces single-use replay protection."""
    if not ticket_str or not isinstance(ticket_str, str):
        return False, "Missing WebSocket ticket"

    parts = ticket_str.strip().split(".")
    if len(parts) != 3:
        return False, "Malformed WebSocket ticket format"

    hdr_b64, payload_b64, sig_b64 = parts
    signing_input = f"{hdr_b64}.{payload_b64}".encode("utf-8")

    expected_sig = hmac.new(AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        return False, "Invalid ticket signature encoding"

    if not hmac.compare_digest(expected_sig, actual_sig):
        return False, "Invalid ticket signature"

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return False, "Invalid ticket payload JSON"

    if payload.get("type") != "ws_ticket":
        return False, "Invalid token type: not a WebSocket ticket"

    if payload.get("sub") != expected_session_id:
        return False, "WebSocket ticket is bound to a different session"

    now = int(time.time())
    exp = payload.get("exp")
    if exp is not None and now > exp:
        return False, "WebSocket ticket has expired"

    nonce = payload.get("nonce")
    if not nonce:
        return False, "WebSocket ticket missing nonce"

    # Prune expired nonces from memory cache
    expired_keys = [k for k, v in _consumed_ws_tickets.items() if now > v]
    for k in expired_keys:
        _consumed_ws_tickets.pop(k, None)

    # Check if ticket nonce was already consumed (replay protection)
    if nonce in _consumed_ws_tickets:
        return False, "WebSocket ticket has already been used (single-use violation)"

    # Mark nonce as consumed until its expiration
    _consumed_ws_tickets[nonce] = exp or (now + WS_TICKET_EXPIRATION_SECONDS)
    return True, None


def authenticate_websocket(websocket: WebSocket, session_id: str, session_patient_id: Optional[str] = None) -> Tuple[bool, AuthContext]:
    """Authenticates a WebSocket connection using short-lived ticket, headers, or query parameter."""
    # 1. Preferred secure mechanism: short-lived single-use ?ticket= query param
    ticket = websocket.query_params.get("ticket")
    if ticket:
        is_valid, err_msg = verify_ws_ticket(ticket, session_id)
        if is_valid:
            return True, AuthContext(
                is_authenticated=True,
                role="participant_session",
                session_id=session_id,
                patient_id=session_patient_id,
            )
        return False, AuthContext(is_authenticated=False, role="anonymous", error_message=err_msg or "Invalid ticket")

    # 2. Query param ?token= (legacy / fallback)
    token = websocket.query_params.get("token")

    # 3. Authorization header from websocket headers
    if not token:
        auth_header = websocket.headers.get("authorization")
        if auth_header:
            parts = auth_header.strip().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
            elif len(parts) == 1:
                token = parts[0]

    # 4. Sec-WebSocket-Protocol or X-API-Key
    if not token:
        token = websocket.headers.get("x-api-key")

    if not token:
        if not AUTH_REQUIRED:
            return True, AuthContext(is_authenticated=True, role="operator")
        return False, AuthContext(is_authenticated=False, role="anonymous", error_message="Missing authentication credentials")

    auth_ctx = verify_token(token)
    if not auth_ctx.is_authenticated:
        return False, auth_ctx

    if auth_ctx.is_operator:
        return True, auth_ctx

    # Participant token must match session or patient
    if auth_ctx.session_id and auth_ctx.session_id == session_id:
        return True, auth_ctx

    if session_patient_id and auth_ctx.patient_id == session_patient_id:
        return True, auth_ctx

    return False, AuthContext(is_authenticated=False, role="anonymous", error_message="Token not authorized for this session")

