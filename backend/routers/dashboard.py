from datetime import datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

FLAG_ACCURACY_THRESHOLD = 70.0
RECENT_SESSIONS_LIMIT = 10


@router.get("/summary", response_model=schemas.DashboardResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    today_start = datetime.combine(datetime.utcnow().date(), time.min)

    sessions_today = (
        db.query(func.count(models.TaskSession.id))
        .filter(models.TaskSession.started_at >= today_start)
        .scalar()
        or 0
    )

    avg_accuracy = (
        db.query(func.avg(models.TaskResult.accuracy_pct))
        .filter(models.TaskResult.accuracy_pct.isnot(None))
        .scalar()
    )

    flagged_cases = (
        db.query(func.count(models.TaskResult.id))
        .filter(models.TaskResult.accuracy_pct < FLAG_ACCURACY_THRESHOLD)
        .scalar()
        or 0
    )

    avg_rt_ms = (
        db.query(func.avg(models.TaskResult.rt_ms))
        .filter(models.TaskResult.rt_ms.isnot(None))
        .scalar()
    )
    avg_task_time_s = round(avg_rt_ms / 1000, 1) if avg_rt_ms is not None else None

    rows = (
        db.query(models.TaskSession, models.Patient, models.TaskResult)
        .join(models.Patient, models.TaskSession.patient_id == models.Patient.id)
        .outerjoin(models.TaskResult, models.TaskResult.session_id == models.TaskSession.id)
        .order_by(models.TaskSession.started_at.desc())
        .limit(RECENT_SESSIONS_LIMIT)
        .all()
    )

    recent_sessions = [
        schemas.RecentSessionRow(
            session_id=session.id,
            patient_code=patient.patient_code,
            patient_name=patient.name,
            task_type=session.task_type,
            accuracy_pct=result.accuracy_pct if result else None,
            rt_ms=result.rt_ms if result else None,
            status=session.status,
            flagged=bool(result and result.accuracy_pct is not None
                          and result.accuracy_pct < FLAG_ACCURACY_THRESHOLD),
            started_at=session.started_at,
        )
        for session, patient, result in rows
    ]

    # Compute patient assessments grouping and attempt indexing
    all_assessments = (
        db.query(models.Assessment, models.Patient)
        .join(models.Patient, models.Assessment.patient_id == models.Patient.id)
        .order_by(models.Assessment.started_at.asc())
        .all()
    )

    patient_attempts: dict[str, list] = {}
    for assessment, patient in all_assessments:
        if patient.id not in patient_attempts:
            patient_attempts[patient.id] = []
        patient_attempts[patient.id].append((assessment, patient))

    patient_assessments: list[schemas.PatientAssessmentSummary] = []
    for patient_id, attempts in patient_attempts.items():
        total_attempts = len(attempts)
        for idx, (assessment, patient) in enumerate(attempts):
            attempt_number = idx + 1
            is_latest = (attempt_number == total_attempts)

            completed_sessions = [
                s for s in assessment.task_sessions if s.status == "completed"
            ]
            tasks_completed = len(completed_sessions)
            
            # Assessment status: completed ONLY if all 3 tasks are finished and verified
            if tasks_completed >= 3 and assessment.status == "completed":
                status = "completed"
            elif assessment.status == "closed_early":
                status = "closed_early"
            else:
                status = "in_progress"

            accuracies = [
                s.result.accuracy_pct
                for s in completed_sessions
                if s.result and s.result.accuracy_pct is not None
            ]
            avg_acc = round(sum(accuracies) / len(accuracies), 1) if accuracies else None
            flagged = any(a < FLAG_ACCURACY_THRESHOLD for a in accuracies)

            patient_assessments.append(
                schemas.PatientAssessmentSummary(
                    assessment_id=assessment.id,
                    patient_id=patient.id,
                    patient_code=patient.patient_code,
                    patient_name=patient.name,
                    attempt_number=attempt_number,
                    is_latest=is_latest,
                    status=status,
                    tasks_completed=tasks_completed,
                    total_tasks=3,
                    avg_accuracy=avg_acc,
                    started_at=assessment.started_at,
                    ended_at=assessment.ended_at,
                    flagged=flagged,
                )
            )

    # Order newest attempts first
    patient_assessments.sort(key=lambda a: a.started_at, reverse=True)

    return schemas.DashboardResponse(
        kpis=schemas.KpiSummary(
            sessions_today=sessions_today,
            avg_accuracy=round(avg_accuracy, 1) if avg_accuracy is not None else None,
            flagged_cases=flagged_cases,
            avg_task_time_s=avg_task_time_s,
        ),
        recent_sessions=recent_sessions,
        patient_assessments=patient_assessments,
    )
