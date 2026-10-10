import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship

from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    visual_diagnosis = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    visual_history = relationship(
        "VisualHistory", back_populates="patient", uselist=False,
        cascade="all, delete-orphan"
    )
    clinical_findings = relationship(
        "ClinicalFindings", back_populates="patient", uselist=False,
        cascade="all, delete-orphan"
    )
    sessions = relationship(
        "TaskSession", back_populates="patient", cascade="all, delete-orphan"
    )
    assessments = relationship(
        "Assessment", back_populates="patient", cascade="all, delete-orphan"
    )


class VisualHistory(Base):
    """Section 2/3 of the patient intake form: visual history & device usage."""
    __tablename__ = "visual_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False, unique=True)

    # Refractive status: list of selected values
    # ("emmetropia", "myopia", "hyperopia", "astigmatism")
    refractive_status = Column(JSON, default=list)
    spectacle_use = Column(Boolean, nullable=True)

    # "<2h", "2-4h", "4-6h", ">6h"
    avg_screen_time = Column(String(10), nullable=True)

    patient = relationship("Patient", back_populates="visual_history")


class ClinicalFindings(Base):
    """Section 5 of the patient intake form: examiner-entered clinical vision findings."""
    __tablename__ = "clinical_findings"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False, unique=True)

    # Visual Acuity
    distance_va_od = Column(String(20), nullable=True)
    distance_va_os = Column(String(20), nullable=True)
    near_va_ou = Column(String(20), nullable=True)

    # Refractive Error
    refractive_error_od = Column(String(40), nullable=True)
    refractive_error_os = Column(String(40), nullable=True)

    # Near Point of Convergence
    npc_cm = Column(Float, nullable=True)

    # Accommodation Amplitude (Diopters)
    accommodation_amplitude_od = Column(Float, nullable=True)
    accommodation_amplitude_os = Column(Float, nullable=True)

    # Accommodative Facility (cycles per minute)
    accommodative_facility_od = Column(Float, nullable=True)
    accommodative_facility_os = Column(Float, nullable=True)
    accommodative_facility_ou = Column(Float, nullable=True)

    # Vergence Facility (cpm)
    vergence_facility = Column(Float, nullable=True)

    # AC/A Ratio
    ac_a_ratio = Column(String(20), nullable=True)

    # Fusional Vergence (free text, e.g. "x/y/z" blur/break/recovery)
    positive_fusional_vergence = Column(String(40), nullable=True)
    negative_fusional_vergence = Column(String(40), nullable=True)

    examiner_name = Column(String(120), nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="clinical_findings")


class Assessment(Base):
    """A patient visit spanning all 3 task modules; stays open until every
    task type is completed or a clinician explicitly ends it early."""
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)

    # "in_progress" | "completed" | "closed_early"
    status = Column(String(20), default="in_progress")

    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="assessments")
    task_sessions = relationship("TaskSession", back_populates="assessment")


class TaskSession(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    # Nullable: historical rows created before assessments existed have none.
    assessment_id = Column(String(36), ForeignKey("assessments.id"), nullable=True)

    # "visual_search" | "memory" | "reading"
    task_type = Column(String(30), nullable=False)
    # "pending" | "in_progress" | "completed"
    status = Column(String(20), default="pending")

    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="sessions")
    assessment = relationship("Assessment", back_populates="task_sessions")
    gaze_events = relationship(
        "GazeEvent", back_populates="session", cascade="all, delete-orphan"
    )
    result = relationship(
        "TaskResult", back_populates="session", uselist=False,
        cascade="all, delete-orphan"
    )
    report = relationship(
        "Report", back_populates="session", uselist=False,
        cascade="all, delete-orphan"
    )


class GazeEvent(Base):
    __tablename__ = "gaze_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)

    timestamp = Column(Float, nullable=False)  # ms since session start
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    # "raw" | "fixation" | "saccade"
    event_type = Column(String(20), default="raw")
    duration_ms = Column(Float, nullable=True)

    session = relationship("TaskSession", back_populates="gaze_events")


class TaskResult(Base):
    __tablename__ = "task_results"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False, unique=True)

    accuracy_pct = Column(Float, nullable=True)
    rt_ms = Column(Float, nullable=True)
    scan_path_json = Column(Text, nullable=True)
    comparison_json = Column(Text, nullable=True)

    session = relationship("TaskSession", back_populates="result")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False, unique=True)

    pdf_path = Column(String(255), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("TaskSession", back_populates="report")
