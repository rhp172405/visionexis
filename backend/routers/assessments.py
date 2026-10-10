from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from routers.sessions import VALID_TASK_TYPES

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def _to_read(assessment: models.Assessment) -> schemas.AssessmentRead:
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
    )


@router.post("/create", response_model=schemas.AssessmentRead, status_code=201)
def create_assessment(
    payload: schemas.AssessmentCreate,
    force_new: bool = False,
    db: Session = Depends(get_db)
):
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
            return _to_read(existing)

    assessment = models.Assessment(patient_id=payload.patient_id, status="in_progress")
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return _to_read(assessment)


@router.get("/{assessment_id}", response_model=schemas.AssessmentRead)
def get_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _to_read(assessment)


@router.post("/{assessment_id}/end", response_model=schemas.AssessmentRead)
def end_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    completed_types = {
        s.task_type for s in assessment.task_sessions if s.status == "completed"
    }
    assessment.status = "completed" if completed_types == VALID_TASK_TYPES else "closed_early"
    assessment.ended_at = datetime.utcnow()

    db.commit()
    db.refresh(assessment)
    return _to_read(assessment)
