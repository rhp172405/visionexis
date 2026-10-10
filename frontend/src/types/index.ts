export type TaskType = "visual_search" | "memory" | "reading";

export type ScreenTimeBucket = "<2h" | "2-4h" | "4-6h" | ">6h";

export type RefractiveStatus =
  | "emmetropia"
  | "myopia"
  | "hyperopia"
  | "astigmatism";

export interface VisualHistory {
  id?: string;
  refractive_status: RefractiveStatus[];
  spectacle_use: boolean | null;
  avg_screen_time: ScreenTimeBucket | null;
}

export interface ClinicalFindings {
  id?: string;
  recorded_at?: string;
  distance_va_od?: string | null;
  distance_va_os?: string | null;
  near_va_ou?: string | null;
  refractive_error_od?: string | null;
  refractive_error_os?: string | null;
  npc_cm?: number | null;
  accommodation_amplitude_od?: number | null;
  accommodation_amplitude_os?: number | null;
  accommodative_facility_od?: number | null;
  accommodative_facility_os?: number | null;
  accommodative_facility_ou?: number | null;
  vergence_facility?: number | null;
  ac_a_ratio?: string | null;
  positive_fusional_vergence?: string | null;
  negative_fusional_vergence?: string | null;
  examiner_name?: string | null;
}

export interface PatientCreate {
  patient_code?: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  visual_diagnosis?: string | null;
  visual_history?: VisualHistory;
  clinical_findings?: ClinicalFindings;
}

export interface Patient extends PatientCreate {
  id: string;
  patient_code: string;
  created_at: string;
}

export interface PatientSummary {
  id: string;
  patient_code: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  created_at: string;
}

export interface TaskResult {
  accuracy_pct: number | null;
  rt_ms: number | null;
  scan_path_json?: string | null;
}

export interface TaskSession {
  id: string;
  patient_id: string;
  assessment_id?: string | null;
  task_type: TaskType;
  status: "pending" | "in_progress" | "completed";
  started_at: string;
  ended_at?: string | null;
  result?: TaskResult | null;
}

export interface AssessmentTaskStatus {
  task_type: TaskType;
  status: "pending" | "completed";
  session_id?: string | null;
  accuracy_pct?: number | null;
}

export interface Assessment {
  id: string;
  patient_id: string;
  status: "in_progress" | "completed" | "closed_early";
  started_at: string;
  ended_at?: string | null;
  tasks: AssessmentTaskStatus[];
}

export interface SessionCompletePayload {
  accuracy_pct: number;
  rt_ms: number;
  scan_path_json?: string;
  comparison_json?: string;
}

export interface GazePoint {
  x: number;
  y: number;
  t: number;
  event_type?: "raw" | "fixation" | "saccade" | "mouse_move" | "mouse_click";
  duration_ms?: number;
  // Dual-modality simultaneous recording fields
  source?: "webcam" | "mouse" | "synced";
  gx?: number;
  gy?: number;
  mx?: number;
  my?: number;
  confidence?: number;
  isBlink?: boolean;
  click?: boolean;
  distance_px?: number;
}

export interface SynchronizedSample {
  t: number; // Synchronized timestamp (ms)
  gx: number; // Webcam gaze X
  gy: number; // Webcam gaze Y
  confidence: number;
  mx: number; // Mouse X
  my: number; // Mouse Y
  click: boolean;
  distance_px: number; // Euclidean distance between gaze and mouse
}

export interface DualModalityMetrics {
  avgGazeMouseDistancePx: number;
  maxGazeMouseDistancePx: number;
  gazePathLengthPx: number;
  mousePathLengthPx: number;
  gazeFixationCount: number;
  mousePauseCount: number;
  gazeToClickLatencyMs?: number | null;
  eyeToTargetMs?: number | null;
  mouseToTargetMs?: number | null;
}

export interface KpiSummary {
  sessions_today: number;
  avg_accuracy: number | null;
  flagged_cases: number;
  avg_task_time_s: number | null;
}

export interface RecentSessionRow {
  session_id: string;
  patient_code: string;
  patient_name: string;
  task_type: TaskType;
  accuracy_pct: number | null;
  rt_ms: number | null;
  status: string;
  flagged: boolean;
  started_at: string;
}

export interface PatientAssessmentSummary {
  assessment_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  attempt_number: number;
  is_latest: boolean;
  status: "in_progress" | "completed" | "closed_early";
  tasks_completed: number;
  total_tasks: number;
  avg_accuracy: number | null;
  started_at: string;
  ended_at: string | null;
  flagged: boolean;
}

export interface DashboardResponse {
  kpis: KpiSummary;
  recent_sessions: RecentSessionRow[];
  patient_assessments: PatientAssessmentSummary[];
}

export interface ReportSession {
  session_id: string;
  patient_code: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  task_type: TaskType;
  accuracy_pct: number | null;
  rt_ms: number | null;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  flagged: boolean;
  within_norm: boolean;
}

export interface AssessmentTaskReportRow {
  task_type: TaskType;
  session_id: string | null;
  accuracy_pct: number | null;
  rt_ms: number | null;
  within_norm: boolean;
  flagged: boolean;
}

export interface AssessmentReportRow {
  assessment_id: string;
  patient_code: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  status: "in_progress" | "completed" | "closed_early";
  started_at: string;
  ended_at: string | null;
  tasks_completed: number;
  avg_accuracy: number | null;
  any_flagged: boolean;
  tasks: AssessmentTaskReportRow[];
}

export interface CombinedTaskDetail {
  task_type: TaskType;
  session_id: string | null;
  status: "pending" | "in_progress" | "completed";
  accuracy_pct: number | null;
  rt_ms: number | null;
  duration_s: number | null;
  gaze_count: number;
  fixation_count: number;
  avg_fixation_ms: number | null;
  is_gaze_available?: boolean;
  gaze_status_label?: string;
  within_norm: boolean;
  flagged: boolean;
  started_at: string | null;
  ended_at: string | null;
  comparison_json?: string | null;
}

export interface CombinedAssessmentReport {
  assessment_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  attempt_number: number;
  status: "in_progress" | "completed" | "closed_early";
  started_at: string;
  ended_at: string | null;
  tasks_completed: number;
  total_tasks: number;
  avg_accuracy: number | null;
  any_flagged: boolean;
  tasks: CombinedTaskDetail[];
  disclaimer: string;
}

