from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services.gaze_persistence import persist_session_gaze_events
from auth import (
    get_current_auth,
    enforce_assessment_access,
    enforce_session_access,
    create_session_token,
    create_ws_ticket,
    AuthContext,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

VALID_TASK_TYPES = {"visual_search", "memory", "reading"}


@router.post("/{session_id}/ws-ticket")
def issue_websocket_ticket(
    session_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Issues a short-lived (60s), single-use WebSocket ticket bound strictly to this session."""
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    enforce_session_access(auth, session.id, session.patient_id)
    ticket = create_ws_ticket(session_id=session.id, patient_id=session.patient_id, expires_in_seconds=60)
    return {"ticket": ticket, "expires_in": 60, "session_id": session.id}


@router.post("/create", response_model=schemas.SessionRead, status_code=201)
def create_session(
    payload: schemas.SessionCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    if payload.task_type not in VALID_TASK_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid task_type: {payload.task_type}")

    patient = db.get(models.Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    assessment = db.get(models.Assessment, payload.assessment_id)
    if not assessment or assessment.patient_id != payload.patient_id:
        raise HTTPException(status_code=404, detail="Assessment not found for this patient")
    if assessment.status != "in_progress":
        raise HTTPException(status_code=400, detail="Assessment is no longer in progress")

    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    session = models.TaskSession(
        patient_id=payload.patient_id,
        assessment_id=payload.assessment_id,
        task_type=payload.task_type,
        status="pending",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    token = create_session_token(
        patient_id=session.patient_id,
        assessment_id=session.assessment_id,
        session_id=session.id,
    )
    res = schemas.SessionRead.model_validate(session)
    res.session_token = token
    return res


@router.get("/{session_id}", response_model=schemas.SessionRead)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    enforce_session_access(auth, session.id, session.patient_id)
    return session


@router.post("/{session_id}/complete", response_model=schemas.SessionRead)
def complete_session(
    session_id: str,
    payload: schemas.SessionCompleteRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    enforce_session_access(auth, session.id, session.patient_id)

    result = session.result
    if result is None:
        result = models.TaskResult(session_id=session_id)
        db.add(result)

    result.accuracy_pct = payload.accuracy_pct
    result.rt_ms = payload.rt_ms
    result.scan_path_json = payload.scan_path_json
    if payload.comparison_json is not None:
        result.comparison_json = payload.comparison_json

    session.status = "completed"
    session.ended_at = datetime.utcnow()

    db.commit()

    # Persist gaze events from raw tracking and fixation data
    try:
        persist_session_gaze_events(
            db=db,
            session_id=session_id,
            task_type=session.task_type,
            scan_path_json=payload.scan_path_json,
            comparison_json=payload.comparison_json,
        )
    except Exception as e:
        # Logging failure without breaking session completion
        print(f"Warning: Failed to persist gaze events for session {session_id}: {e}")

    db.refresh(session)
    return session
