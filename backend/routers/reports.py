from datetime import datetime
from io import StringIO
import csv as csv_module
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import (
    get_current_auth,
    require_operator,
    enforce_session_access,
    enforce_assessment_access,
    AuthContext,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

FLAG_ACCURACY_THRESHOLD = 70.0

NORMATIVE = {
    "visual_search": {"accuracy_min": 85.0, "rt_max_ms": 2500.0},
    "memory":        {"accuracy_min": 70.0, "rt_max_ms": 4000.0},
    "reading":       {"accuracy_min": 66.7, "rt_max_ms": 5000.0},
}

TASK_ORDER = ["visual_search", "memory", "reading"]

TASK_LABELS = {
    "visual_search": "Visual Search",
    "memory":        "Memory & Recognition",
    "reading":       "Reading Task",
}


def _within_norm(task_type: str, accuracy: float | None, rt_ms: float | None) -> bool:
    norm = NORMATIVE.get(task_type)
    if not norm or accuracy is None or rt_ms is None:
        return False
    return accuracy >= norm["accuracy_min"] and rt_ms <= norm["rt_max_ms"]


@router.get("", response_model=list[schemas.ReportSessionRow])
def list_reports(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    require_operator(auth)
    rows = (
        db.query(models.TaskSession, models.Patient, models.TaskResult)
        .join(models.Patient, models.TaskSession.patient_id == models.Patient.id)
        .outerjoin(models.TaskResult, models.TaskResult.session_id == models.TaskSession.id)
        .filter(models.TaskSession.status == "completed")
        .order_by(models.TaskSession.started_at.desc())
        .all()
    )

    result = []
    for session, patient, task_result in rows:
        accuracy = task_result.accuracy_pct if task_result else None
        rt_ms = task_result.rt_ms if task_result else None
        duration_s = None
        if session.ended_at and session.started_at:
            duration_s = round((session.ended_at - session.started_at).total_seconds(), 1)

        result.append(schemas.ReportSessionRow(
            session_id=session.id,
            patient_code=patient.patient_code,
            patient_name=patient.name,
            patient_age=patient.age,
            patient_gender=patient.gender,
            task_type=session.task_type,
            accuracy_pct=accuracy,
            rt_ms=rt_ms,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_s=duration_s,
            flagged=bool(accuracy is not None and accuracy < FLAG_ACCURACY_THRESHOLD),
            within_norm=_within_norm(session.task_type, accuracy, rt_ms),
        ))

    return result


@router.get("/assessments", response_model=list[schemas.AssessmentReportRow])
def list_assessment_reports(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    require_operator(auth)
    """Reports grouped by assessment (patient visit), combining all 3 task modules."""
    rows = (
        db.query(models.Assessment, models.Patient)
        .join(models.Patient, models.Assessment.patient_id == models.Patient.id)
        .filter(models.Assessment.status != "in_progress")
        .order_by(models.Assessment.started_at.desc())
        .all()
    )

    result = []
    for assessment, patient in rows:
        completed_by_type = {
            s.task_type: s for s in assessment.task_sessions if s.status == "completed"
        }
        if not completed_by_type:
            continue

        task_rows = []
        accuracies = []
        any_flagged = False
        for task_type in TASK_ORDER:
            session = completed_by_type.get(task_type)
            if not session:
                task_rows.append(schemas.AssessmentTaskReportRow(task_type=task_type))
                continue

            accuracy = session.result.accuracy_pct if session.result else None
            rt_ms = session.result.rt_ms if session.result else None
            flagged = bool(accuracy is not None and accuracy < FLAG_ACCURACY_THRESHOLD)
            if accuracy is not None:
                accuracies.append(accuracy)
            any_flagged = any_flagged or flagged

            task_rows.append(schemas.AssessmentTaskReportRow(
                task_type=task_type,
                session_id=session.id,
                accuracy_pct=accuracy,
                rt_ms=rt_ms,
                within_norm=_within_norm(task_type, accuracy, rt_ms),
                flagged=flagged,
            ))

        result.append(schemas.AssessmentReportRow(
            assessment_id=assessment.id,
            patient_code=patient.patient_code,
            patient_name=patient.name,
            patient_age=patient.age,
            patient_gender=patient.gender,
            status=assessment.status,
            started_at=assessment.started_at,
            ended_at=assessment.ended_at,
            tasks_completed=len(completed_by_type),
            avg_accuracy=round(sum(accuracies) / len(accuracies), 1) if accuracies else None,
            any_flagged=any_flagged,
            tasks=task_rows,
        ))

    return result


@router.get("/{session_id}/csv")
def export_csv(
    session_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    enforce_session_access(auth, session.id, session.patient_id)

    patient = db.get(models.Patient, session.patient_id)
    events = (
        db.query(models.GazeEvent)
        .filter(models.GazeEvent.session_id == session_id)
        .order_by(models.GazeEvent.timestamp)
        .all()
    )

    buf = StringIO()
    writer = csv_module.writer(buf)
    writer.writerow(["timestamp_ms", "x", "y", "event_type", "duration_ms"])
    for e in events:
        writer.writerow([e.timestamp, round(e.x, 2), round(e.y, 2), e.event_type, e.duration_ms or ""])

    buf.seek(0)
    fname = f"visionexis_{patient.patient_code}_{session.task_type}_{session.started_at.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _gaze_stats(db: Session, session: models.TaskSession | None):
    if not session:
        return 0, 0, None, False, "Unavailable"

    gaze_count = (
        db.query(func.count(models.GazeEvent.id))
        .filter(models.GazeEvent.session_id == session.id)
        .scalar() or 0
    )
    fixation_count = (
        db.query(func.count(models.GazeEvent.id))
        .filter(models.GazeEvent.session_id == session.id,
                models.GazeEvent.event_type == "fixation")
        .scalar() or 0
    )
    avg_fixation_ms = (
        db.query(func.avg(models.GazeEvent.duration_ms))
        .filter(models.GazeEvent.session_id == session.id,
                models.GazeEvent.event_type == "fixation",
                models.GazeEvent.duration_ms.isnot(None))
        .scalar()
    )

    # Fallback: if no events exist in DB table, attempt extraction & persistence from TaskResult
    if gaze_count == 0 and session.result:
        try:
            from services.gaze_persistence import persist_session_gaze_events
            persisted = persist_session_gaze_events(
                db=db,
                session_id=session.id,
                task_type=session.task_type,
                scan_path_json=session.result.scan_path_json,
                comparison_json=session.result.comparison_json,
            )
            if persisted > 0:
                gaze_count = (
                    db.query(func.count(models.GazeEvent.id))
                    .filter(models.GazeEvent.session_id == session.id)
                    .scalar() or 0
                )
                fixation_count = (
                    db.query(func.count(models.GazeEvent.id))
                    .filter(models.GazeEvent.session_id == session.id,
                            models.GazeEvent.event_type == "fixation")
                    .scalar() or 0
                )
                avg_fixation_ms = (
                    db.query(func.avg(models.GazeEvent.duration_ms))
                    .filter(models.GazeEvent.session_id == session.id,
                            models.GazeEvent.event_type == "fixation",
                            models.GazeEvent.duration_ms.isnot(None))
                    .scalar()
                )
        except Exception:
            pass

    # Evaluate sufficiency: Valid tracking requires meaningful samples and detected fixations
    if gaze_count >= 10 and fixation_count > 0:
        is_available = True
        gaze_status_label = "Available"
    elif gaze_count > 0:
        is_available = False
        gaze_status_label = "Insufficient gaze data"
    else:
        is_available = False
        gaze_status_label = "Unavailable"

    return gaze_count, fixation_count, avg_fixation_ms, is_available, gaze_status_label


@router.get("/{session_id}/pdf")
def export_pdf(
    session_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    enforce_session_access(auth, session.id, session.patient_id)

    patient = db.get(models.Patient, session.patient_id)
    task_result = session.result
    accuracy = task_result.accuracy_pct if task_result else None
    rt_ms = task_result.rt_ms if task_result else None

    duration_s = None
    if session.ended_at and session.started_at:
        duration_s = round((session.ended_at - session.started_at).total_seconds(), 1)

    gaze_count, fixation_count, avg_fixation_ms, is_available, gaze_status_label = _gaze_stats(db, session)

    pdf_bytes = _build_pdf(
        patient=patient, session=session,
        accuracy=accuracy, rt_ms=rt_ms, duration_s=duration_s,
        gaze_count=gaze_count, fixation_count=fixation_count,
        avg_fixation_ms=avg_fixation_ms,
        is_gaze_available=is_available,
        gaze_status_label=gaze_status_label,
        within_norm=_within_norm(session.task_type, accuracy, rt_ms),
    )

    p_code = patient.patient_code.replace("-", "").strip() or "P001"
    fname = f"VISIONEXIS_{p_code}_{session.task_type}_{session.started_at.strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/assessment/{assessment_id}", response_model=schemas.CombinedAssessmentReport)
def get_assessment_report(
    assessment_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Combined assessment report details spanning all 3 task modules."""
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    patient = db.get(models.Patient, assessment.patient_id)

    # Sort completed sessions by ended_at desc to guarantee latest attempt per task type
    completed_sessions = [s for s in assessment.task_sessions if s.status == "completed"]
    completed_sessions.sort(key=lambda s: s.ended_at or s.started_at or datetime.min, reverse=True)
    completed_by_type = {}
    for s in completed_sessions:
        if s.task_type not in completed_by_type:
            completed_by_type[s.task_type] = s

    # Determine attempt number for this patient
    attempts = (
        db.query(models.Assessment.id)
        .filter(models.Assessment.patient_id == patient.id)
        .order_by(models.Assessment.started_at.asc())
        .all()
    )
    attempt_ids = [a[0] for a in attempts]
    attempt_number = attempt_ids.index(assessment_id) + 1 if assessment_id in attempt_ids else 1

    task_details: list[schemas.CombinedTaskDetail] = []
    accuracies: list[float] = []
    any_flagged = False

    for task_type in TASK_ORDER:
        session = completed_by_type.get(task_type)
        if not session:
            task_details.append(schemas.CombinedTaskDetail(
                task_type=task_type,
                status="pending",
                is_gaze_available=False,
                gaze_status_label="Unavailable",
            ))
            continue

        task_result = session.result
        accuracy = task_result.accuracy_pct if task_result else None
        rt_ms = task_result.rt_ms if task_result else None
        duration_s = None
        if session.ended_at and session.started_at:
            duration_s = round((session.ended_at - session.started_at).total_seconds(), 1)
        gaze_count, fixation_count, avg_fixation_ms, is_available, gaze_label = _gaze_stats(db, session)

        flagged = bool(accuracy is not None and accuracy < FLAG_ACCURACY_THRESHOLD)
        within_norm = _within_norm(task_type, accuracy, rt_ms)

        if accuracy is not None:
            accuracies.append(accuracy)
        if flagged:
            any_flagged = True

        task_details.append(schemas.CombinedTaskDetail(
            task_type=task_type,
            session_id=session.id,
            status=session.status,
            accuracy_pct=accuracy,
            rt_ms=rt_ms,
            duration_s=duration_s,
            gaze_count=gaze_count,
            fixation_count=fixation_count,
            avg_fixation_ms=avg_fixation_ms,
            is_gaze_available=is_available,
            gaze_status_label=gaze_label,
            within_norm=within_norm,
            flagged=flagged,
            started_at=session.started_at,
            ended_at=session.ended_at,
            comparison_json=task_result.comparison_json if task_result else None,
        ))

    tasks_completed = len(completed_by_type)
    status = "completed" if tasks_completed >= 3 and assessment.status == "completed" else "in_progress"
    avg_acc = round(sum(accuracies) / len(accuracies), 1) if accuracies else None

    return schemas.CombinedAssessmentReport(
        assessment_id=assessment.id,
        patient_id=patient.id,
        patient_code=patient.patient_code,
        patient_name=patient.name,
        patient_age=patient.age,
        patient_gender=patient.gender,
        attempt_number=attempt_number,
        status=status,
        started_at=assessment.started_at,
        ended_at=assessment.ended_at,
        tasks_completed=tasks_completed,
        total_tasks=len(TASK_ORDER),
        avg_accuracy=avg_acc,
        any_flagged=any_flagged,
        tasks=task_details,
        disclaimer=DISCLAIMER,
        baseline_assessment=json.loads(assessment.baseline_json) if assessment.baseline_json else None,
    )


@router.get("/assessment/{assessment_id}/pdf")
def export_assessment_pdf(
    assessment_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    """Combined PDF report covering all 3 task modules for one patient visit."""
    assessment = db.get(models.Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    enforce_assessment_access(auth, assessment.id, assessment.patient_id)

    patient = db.get(models.Patient, assessment.patient_id)
    completed_sessions = [s for s in assessment.task_sessions if s.status == "completed"]
    completed_sessions.sort(key=lambda s: s.ended_at or s.started_at or datetime.min, reverse=True)
    completed_by_type = {}
    for s in completed_sessions:
        if s.task_type not in completed_by_type:
            completed_by_type[s.task_type] = s

    if not completed_by_type:
        raise HTTPException(status_code=400, detail="No completed tasks for this assessment")

    task_data = []
    for task_type in TASK_ORDER:
        session = completed_by_type.get(task_type)
        if not session:
            task_data.append({
                "task_type": task_type,
                "session": None,
                "is_gaze_available": False,
                "gaze_status_label": "Unavailable",
            })
            continue

        task_result = session.result
        accuracy = task_result.accuracy_pct if task_result else None
        rt_ms = task_result.rt_ms if task_result else None
        duration_s = None
        if session.ended_at and session.started_at:
            duration_s = round((session.ended_at - session.started_at).total_seconds(), 1)
        gaze_count, fixation_count, avg_fixation_ms, is_available, gaze_label = _gaze_stats(db, session)

        task_data.append({
            "task_type": task_type,
            "session": session,
            "accuracy": accuracy,
            "rt_ms": rt_ms,
            "duration_s": duration_s,
            "gaze_count": gaze_count,
            "fixation_count": fixation_count,
            "avg_fixation_ms": avg_fixation_ms,
            "is_gaze_available": is_available,
            "gaze_status_label": gaze_label,
            "within_norm": _within_norm(task_type, accuracy, rt_ms),
        })

    # Compute attempt number for this patient's assessment history
    attempts = (
        db.query(models.Assessment.id)
        .filter(models.Assessment.patient_id == patient.id)
        .order_by(models.Assessment.started_at.asc())
        .all()
    )
    attempt_ids = [a[0] for a in attempts]
    attempt_number = attempt_ids.index(assessment_id) + 1 if assessment_id in attempt_ids else 1

    pdf_bytes = _build_combined_pdf(
        patient=patient,
        assessment=assessment,
        task_data=task_data,
        attempt_number=attempt_number,
    )

    p_code = patient.patient_code.replace("-", "").strip() or "P001"
    fname = f"VISIONEXIS_{p_code}_Assessment_Report.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


TEAL  = (20, 184, 166)
NAVY  = (15, 27, 45)
SLATE = (100, 116, 139)
GREEN = (16, 185, 129)
AMBER = (245, 158, 11)

DISCLAIMER = (
    "VISIONEXIS Research Prototype Notice: This report is generated automatically by the VISIONEXIS "
    "visual-cognitive research platform. Results represent experimental gaze and motor metrics derived from "
    "webcam eye tracking and response analysis. This prototype is designed for academic and exploratory research "
    "and is NOT a certified medical diagnostic device. Observed metrics must be interpreted within an experimental "
    "context and do not constitute clinical evaluations, diagnostic recommendations, or medical conclusions."
)


def _pdf_new(subtitle: str):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 30, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_xy(20, 8)
    pdf.cell(0, 10, "VISIONEXIS Assessment Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(20, 20)
    pdf.set_text_color(160, 210, 200)
    pdf.cell(0, 6, subtitle)
    pdf.ln(18)
    return pdf


def _pdf_section(pdf, title: str):
    pdf.set_fill_color(*TEAL)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 7, f"  {title}", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.ln(2)
    pdf.set_text_color(*NAVY)


def _pdf_kv(pdf, label: str, value: str):
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 6, label)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, value, new_x="LMARGIN", new_y="NEXT")


def _pdf_footer_line(pdf):
    pdf.set_draw_color(*TEAL)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(2)
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC  |  VISIONEXIS Research Prototype v2.0", align="C")


def _pdf_disclaimer_pinned(pdf):
    """Disclaimer + footer pinned to the bottom of the current page (single-page reports)."""
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, DISCLAIMER)

    pdf.set_y(-18)
    _pdf_footer_line(pdf)


def _pdf_disclaimer_inline(pdf):
    """Disclaimer + footer in normal document flow (multi-page reports)."""
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, DISCLAIMER)
    pdf.ln(2)
    _pdf_footer_line(pdf)


def _build_pdf(patient, session, accuracy, rt_ms, duration_s,
               gaze_count, fixation_count, avg_fixation_ms,
               is_gaze_available, gaze_status_label, within_norm) -> bytes:
    pdf = _pdf_new("Visual-Cognitive Assessment Research Prototype v2.0")

    def section(title: str):
        _pdf_section(pdf, title)

    def kv(label: str, value: str):
        _pdf_kv(pdf, label, value)

    # Patient Information (Anonymized - No PII)
    section("Subject Information")
    kv("Patient ID:", patient.patient_code)
    kv("Age:", f"{patient.age} years" if patient.age else "-")
    kv("Gender:", patient.gender or "-")
    pdf.ln(4)

    # Session Information
    section("Session Information")
    kv("Task:", TASK_LABELS.get(session.task_type, session.task_type))
    kv("Date:", session.started_at.strftime("%Y-%m-%d %H:%M UTC"))
    kv("Duration:", f"{duration_s}s" if duration_s else "-")
    kv("Status:", session.status.capitalize())
    pdf.ln(4)

    # Performance Results
    section("Performance Results")
    kv("Accuracy:", f"{round(accuracy)}%" if accuracy is not None else "-")
    kv("Avg Reaction Time:", f"{round(rt_ms / 1000, 1)}s" if rt_ms else "-")
    pdf.ln(4)

    # Exploratory Benchmark Comparison
    norm = NORMATIVE.get(session.task_type, {})
    section("Exploratory Benchmark Reference  (Adult, 18-65 yrs)")
    if norm:
        kv("Reference Accuracy:", f">= {norm['accuracy_min']}%")
        kv("Reference RT:", f"<= {round(norm['rt_max_ms'] / 1000, 1)}s")
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 6, "Performance Status:")
        if within_norm:
            pdf.set_text_color(*GREEN)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, "Meets exploratory benchmark", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_text_color(*SLATE)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, "Outside exploratory benchmark", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*NAVY)
    pdf.ln(4)

    # Gaze Data Summary
    section("Gaze Tracking Summary")
    if is_gaze_available:
        kv("Total Gaze Events:", str(gaze_count))
        kv("Fixations Detected:", str(fixation_count))
        kv("Avg Fixation Duration:", f"{round(avg_fixation_ms)} ms" if avg_fixation_ms else "-")
    else:
        kv("Gaze Data Status:", gaze_status_label)
        kv("Tracking Details:", "Insufficient eye-tracking samples recorded for this session.")
    pdf.ln(6)

    _pdf_disclaimer_pinned(pdf)

    return bytes(pdf.output())


def _build_combined_pdf(patient, assessment, task_data: list[dict], attempt_number: int = 1) -> bytes:
    """Single PDF combining results from all 3 task modules for one assessment visit."""
    pdf = _pdf_new("Combined Assessment Report  -  All Task Modules  |  v2.0")

    def section(title: str):
        _pdf_section(pdf, title)

    def kv(label: str, value: str):
        _pdf_kv(pdf, label, value)

    # Patient Information (Anonymized - No PII)
    section("Subject Information")
    kv("Patient ID:", patient.patient_code)
    kv("Age:", f"{patient.age} years" if patient.age else "-")
    kv("Gender:", patient.gender or "-")
    pdf.ln(4)

    # Assessment Information
    completed = [t for t in task_data if t.get("session") is not None]
    accuracies = [t["accuracy"] for t in completed if t["accuracy"] is not None]
    section("Assessment Information")
    kv("Attempt Number:", f"Attempt #{attempt_number}")
    kv("Date:", assessment.started_at.strftime("%Y-%m-%d %H:%M UTC"))
    kv("Status:", assessment.status.replace("_", " ").capitalize())
    kv("Tasks Completed:", f"{len(completed)}/{len(TASK_ORDER)}")
    kv("Average Accuracy:", f"{round(sum(accuracies) / len(accuracies))}%" if accuracies else "-")
    pdf.ln(4)

    # Per-task sections
    for data in task_data:
        task_type = data["task_type"]
        section(f"{TASK_LABELS.get(task_type, task_type)} - Results")

        if data.get("session") is None:
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(*SLATE)
            pdf.cell(0, 6, "Not completed in this assessment.", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*NAVY)
            pdf.ln(4)
            continue

        kv("Date:", data["session"].started_at.strftime("%Y-%m-%d %H:%M UTC"))
        kv("Duration:", f"{data['duration_s']}s" if data["duration_s"] else "-")
        kv("Accuracy:", f"{round(data['accuracy'])}%" if data["accuracy"] is not None else "-")
        kv("Avg Reaction Time:", f"{round(data['rt_ms'] / 1000, 1)}s" if data["rt_ms"] else "-")

        norm = NORMATIVE.get(task_type, {})
        if norm:
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(55, 6, "Reference Benchmark:")
            if data["within_norm"]:
                pdf.set_text_color(*GREEN)
                pdf.set_font("Helvetica", "B", 10)
                label = f"Meets exploratory benchmark (>= {norm['accuracy_min']}%, <= {round(norm['rt_max_ms'] / 1000, 1)}s)"
            else:
                pdf.set_text_color(*SLATE)
                pdf.set_font("Helvetica", "", 10)
                label = f"Outside exploratory benchmark (< {norm['accuracy_min']}% or > {round(norm['rt_max_ms'] / 1000, 1)}s)"
            pdf.cell(0, 6, label, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*NAVY)

        if data.get("is_gaze_available"):
            kv("Gaze Tracking:", f"{data['gaze_count']} events ({data['fixation_count']} fixations, avg {round(data['avg_fixation_ms'] or 0)}ms)")
        else:
            kv("Gaze Tracking:", data.get("gaze_status_label", "Unavailable"))
        pdf.ln(4)

    # Overall Summary (Neutral performance summary)
    section("Overall Performance Summary")
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 6, "Battery Status:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{len(completed)} of {len(TASK_ORDER)} task modules completed.", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 6, "Performance Summary:")
    pdf.set_font("Helvetica", "", 10)
    all_within = all(t.get("within_norm", False) for t in completed) if completed else False
    if all_within:
        label = "Performance across all completed modules met exploratory benchmark parameters."
    else:
        label = "Recorded metrics reflect exploratory experimental performance. Results do not constitute a medical diagnosis."
    pdf.cell(0, 6, label, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    _pdf_disclaimer_inline(pdf)

    return bytes(pdf.output())
