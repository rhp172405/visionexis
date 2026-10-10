import axios from "axios";
import type {
  Assessment,
  AssessmentReportRow,
  CombinedAssessmentReport,
  DashboardResponse,
  Patient,
  PatientCreate,
  PatientSummary,
  ReportSession,
  SessionCompletePayload,
  TaskSession,
  TaskType,
} from "@/types";

const RAW_API_URL = import.meta.env.VITE_API_URL || "";
export const API_BASE_URL = RAW_API_URL ? `${RAW_API_URL.replace(/\/+$/, "")}/api` : "/api";

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (RAW_API_URL) {
    return `${RAW_API_URL.replace(/\/+$/, "")}/api${cleanPath}`;
  }
  return `/api${cleanPath}`;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getDashboardSummary = async (): Promise<DashboardResponse> => {
  const { data } = await api.get<DashboardResponse>("/dashboard/summary");
  return data;
};

export const listPatients = async (): Promise<PatientSummary[]> => {
  const { data } = await api.get<PatientSummary[]>("/patients");
  return data;
};

export const getPatient = async (id: string): Promise<Patient> => {
  const { data } = await api.get<Patient>(`/patients/${id}`);
  return data;
};

export const createPatient = async (payload: PatientCreate): Promise<Patient> => {
  const { data } = await api.post<Patient>("/patients", payload);
  return data;
};

export const createSession = async (
  patientId: string,
  assessmentId: string,
  taskType: TaskType,
): Promise<TaskSession> => {
  const { data } = await api.post<TaskSession>("/sessions/create", {
    patient_id: patientId,
    assessment_id: assessmentId,
    task_type: taskType,
  });
  return data;
};

export const createAssessment = async (patientId: string, forceNew = false): Promise<Assessment> => {
  const { data } = await api.post<Assessment>(`/assessments/create?force_new=${forceNew}`, {
    patient_id: patientId,
  });
  return data;
};

export const getAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await api.get<Assessment>(`/assessments/${id}`);
  return data;
};

export const endAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await api.post<Assessment>(`/assessments/${id}/end`);
  return data;
};

export const getCombinedReport = async (assessmentId: string): Promise<CombinedAssessmentReport> => {
  const { data } = await api.get<CombinedAssessmentReport>(`/reports/assessment/${assessmentId}`);
  return data;
};

export const getReports = async (): Promise<ReportSession[]> => {
  const { data } = await api.get<ReportSession[]>("/reports");
  return data;
};

export const getAssessmentReports = async (): Promise<AssessmentReportRow[]> => {
  const { data } = await api.get<AssessmentReportRow[]>("/reports/assessments");
  return data;
};

export const completeSession = async (
  sessionId: string,
  payload: SessionCompletePayload,
): Promise<TaskSession> => {
  const { data } = await api.post<TaskSession>(`/sessions/${sessionId}/complete`, payload);
  return data;
};
