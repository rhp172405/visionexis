from datetime import datetime
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from routers.sessions import VALID_TASK_TYPES
from auth import (
    get_current_auth,
    enforce_patient_access,
    enforce_assessment_access,
    create_session_token,
    AuthContext,
)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def _to_read(assessment: models.Assessment, session_token: Optional[str] = None) -> schemas.AssessmentRead:
    completed_by_type = {
        s.task_type: s
        for s in assessment.task_sessions
        if s.status == "completed"
    }
    tasks = []
    for task_type in sorted(VALID_TASK_TYPES):
        session = completed_by_type.get(task_type)
        tasks.append(schemas.AssessmentTaskStatus(
            task_type=task_type,
            status="completed" if session else "pending",
            session_id=session.id if session else None,
            accuracy_pct=session.result.accuracy_pct if session and session.result else None,
        ))
    return schemas.AssessmentRead(
        id=assessment.id,
        patient_id=assessment.patient_id,
        status=assessment.status,
        started_at=assessment.started_at,
        ended_at=assessment.ended_at,
        tasks=tasks,
        session_token=session_token,
    )


@router.post("/create", response_model=schemas.AssessmentRead, status_code=201)
def create_assessment(
    payload: schemas.AssessmentCreate,
    force_new: bool = False,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    enforce_patient_access(auth, payload.patient_id)
    patient = db.get(models.Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    existing = (
        db.query(models.Assessment)
        .filter(
            models.Assessment.patient_id == payload.patient_id,
            models.Assessment.status == "in_progress",
        )
        .order_by(models.Assessment.started_at.desc())
        .first()
    )
    if existing:
        if force_new or payload.force_new:
            existing.status = "closed_early"
            existing.ended_at = datetime.utcnow()
            db.commit()
        else:
            token = create_session_token(patient_id=existing.patient_id, assessment_id=existing.id)
            return _to_read(existing, session_token=token)

    assessment = models.Assessment(patient_id=payload.patient_id, status="in_progress")
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    token = create_session_token(patient_id=assessment.patient_id, assessment_id=assessment.id)
    return _to_read(assessment, session_token=token)


@router.get("/{assessment_id}", response_model=schemas.AssessmentRead)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)
    return _to_read(assessment)


@router.post("/{assessment_id}/end", response_model=schemas.AssessmentRead)
def end_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    completed_types = {
        s.task_type for s in assessment.task_sessions if s.status == "completed"
    }
    assessment.status = "completed" if completed_types == VALID_TASK_TYPES else "closed_early"
    assessment.ended_at = datetime.utcnow()

    db.commit()
    db.refresh(assessment)
    return _to_read(assessment)


@router.post("/{assessment_id}/baseline", response_model=Dict[str, Any], status_code=200)
def save_baseline_assessment(
    assessment_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    # Guard against cross-assessment ID tampering
    payload_asm_id = payload.get("assessment_id")
    if payload_asm_id and payload_asm_id != assessment_id:
        raise HTTPException(
            status_code=400,
            detail=f"Payload assessment_id '{payload_asm_id}' does not match URL assessment_id '{assessment_id}'"
        )

    # Guard against cross-patient tampering
    payload_pat_id = payload.get("patient_id")
    if payload_pat_id and payload_pat_id != assessment.patient_id:
        raise HTTPException(
            status_code=400,
            detail=f"Payload patient_id '{payload_pat_id}' does not match assessment patient_id '{assessment.patient_id}'"
        )

    payload["assessment_id"] = assessment_id
    payload["patient_id"] = assessment.patient_id
    if not payload.get("recorded_at"):
        payload["recorded_at"] = datetime.utcnow().isoformat()

    assessment.baseline_json = json.dumps(payload)
    db.commit()
    db.refresh(assessment)

    return json.loads(assessment.baseline_json)


@router.get("/{assessment_id}/baseline", response_model=Optional[Dict[str, Any]])
def get_baseline_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    if not assessment.baseline_json:
        return None

    try:
        return json.loads(assessment.baseline_json)
    except Exception:
        return None
