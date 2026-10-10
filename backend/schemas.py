from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Visual History (Section 2/3 of intake form)
# ---------------------------------------------------------------------------

class VisualHistoryBase(BaseModel):
    refractive_status: List[str] = []
    spectacle_use: Optional[bool] = None
    avg_screen_time: Optional[str] = None  # "<2h" | "2-4h" | "4-6h" | ">6h"


class VisualHistoryRead(VisualHistoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------------------------------------------------------------------------
# Clinical Findings (Section 5 of intake form, examiner-entered)
# ---------------------------------------------------------------------------

class ClinicalFindingsBase(BaseModel):
    distance_va_od: Optional[str] = None
    distance_va_os: Optional[str] = None
    near_va_ou: Optional[str] = None

    refractive_error_od: Optional[str] = None
    refractive_error_os: Optional[str] = None

    npc_cm: Optional[float] = None

    accommodation_amplitude_od: Optional[float] = None
    accommodation_amplitude_os: Optional[float] = None

    accommodative_facility_od: Optional[float] = None
    accommodative_facility_os: Optional[float] = None
    accommodative_facility_ou: Optional[float] = None

    vergence_facility: Optional[float] = None

    ac_a_ratio: Optional[str] = None

    positive_fusional_vergence: Optional[str] = None
    negative_fusional_vergence: Optional[str] = None

    examiner_name: Optional[str] = None


class ClinicalFindingsRead(ClinicalFindingsBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    recorded_at: datetime


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------

class PatientCreate(BaseModel):
    patient_code: Optional[str] = None
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    visual_diagnosis: Optional[str] = None
    visual_history: Optional[VisualHistoryBase] = None
    clinical_findings: Optional[ClinicalFindingsBase] = None


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_code: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    visual_diagnosis: Optional[str] = None
    created_at: datetime
    visual_history: Optional[VisualHistoryRead] = None
    clinical_findings: Optional[ClinicalFindingsRead] = None


class PatientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_code: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Assessments (one patient visit spanning all 3 task modules)
# ---------------------------------------------------------------------------

class AssessmentCreate(BaseModel):
    patient_id: str
    force_new: bool = False


class AssessmentTaskStatus(BaseModel):
    task_type: str
    status: str  # "pending" | "completed"
    session_id: Optional[str] = None
    accuracy_pct: Optional[float] = None


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    status: str  # "in_progress" | "completed" | "closed_early"
    started_at: datetime
    ended_at: Optional[datetime] = None
    tasks: List[AssessmentTaskStatus] = []


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    patient_id: str
    assessment_id: str
    task_type: str  # "visual_search" | "memory" | "reading"


class TaskResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    accuracy_pct: Optional[float] = None
    rt_ms: Optional[float] = None
    scan_path_json: Optional[str] = None
    comparison_json: Optional[str] = None


class SessionCompleteRequest(BaseModel):
    accuracy_pct: float
    rt_ms: float
    scan_path_json: Optional[str] = None
    comparison_json: Optional[str] = None


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    assessment_id: Optional[str] = None
    task_type: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    result: Optional[TaskResultRead] = None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class KpiSummary(BaseModel):
    sessions_today: int
    avg_accuracy: Optional[float] = None
    flagged_cases: int
    avg_task_time_s: Optional[float] = None


class RecentSessionRow(BaseModel):
    session_id: str
    patient_code: str
    patient_name: str
    task_type: str
    accuracy_pct: Optional[float] = None
    rt_ms: Optional[float] = None
    status: str
    flagged: bool
    started_at: datetime


class PatientAssessmentSummary(BaseModel):
    assessment_id: str
    patient_id: str
    patient_code: str
    patient_name: str
    attempt_number: int = 1
    is_latest: bool = True
    status: str  # "in_progress" | "completed" | "closed_early"
    tasks_completed: int = 0
    total_tasks: int = 3
    avg_accuracy: Optional[float] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    flagged: bool = False


class DashboardResponse(BaseModel):
    kpis: KpiSummary
    recent_sessions: List[RecentSessionRow] = []
    patient_assessments: List[PatientAssessmentSummary] = []


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class ReportSessionRow(BaseModel):
    session_id: str
    patient_code: str
    patient_name: str
    patient_age: Optional[int]
    patient_gender: Optional[str]
    task_type: str
    accuracy_pct: Optional[float]
    rt_ms: Optional[float]
    started_at: datetime
    ended_at: Optional[datetime]
    duration_s: Optional[float]
    flagged: bool
    within_norm: bool


class AssessmentTaskReportRow(BaseModel):
    task_type: str
    session_id: Optional[str] = None
    accuracy_pct: Optional[float] = None
    rt_ms: Optional[float] = None
    within_norm: bool = False
    flagged: bool = False


class AssessmentReportRow(BaseModel):
    assessment_id: str
    patient_code: str
    patient_name: str
    patient_age: Optional[int]
    patient_gender: Optional[str]
    status: str
    started_at: datetime
    ended_at: Optional[datetime]
    tasks_completed: int
    avg_accuracy: Optional[float]
    any_flagged: bool
    tasks: List[AssessmentTaskReportRow] = []


class CombinedTaskDetail(BaseModel):
    task_type: str
    session_id: Optional[str] = None
    status: str
    accuracy_pct: Optional[float] = None
    rt_ms: Optional[float] = None
    duration_s: Optional[float] = None
    gaze_count: int = 0
    fixation_count: int = 0
    avg_fixation_ms: Optional[float] = None
    is_gaze_available: bool = False
    gaze_status_label: str = "Unavailable"
    within_norm: bool = False
    flagged: bool = False
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    comparison_json: Optional[str] = None


class CombinedAssessmentReport(BaseModel):
    assessment_id: str
    patient_id: str
    patient_code: str
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    attempt_number: int = 1
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    tasks_completed: int
    total_tasks: int = 3
    avg_accuracy: Optional[float] = None
    any_flagged: bool = False
    tasks: List[CombinedTaskDetail] = []
    disclaimer: str

