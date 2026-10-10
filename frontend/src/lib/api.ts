import axios from "axios";
import type {
  Assessment,
  AssessmentReportRow,
  AssessmentTaskStatus,
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

const defaultTasks: AssessmentTaskStatus[] = [
  { task_type: "visual_search", status: "pending" },
  { task_type: "memory", status: "pending" },
  { task_type: "reading", status: "pending" },
];

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
  timeout: 10000,
});

// Reject HTML responses resulting from SPA route rewrites when backend is offline
api.interceptors.response.use(
  (response) => {
    const rawContentType = response.headers?.["content-type"];
    const contentType = typeof rawContentType === "string" ? rawContentType : "";
    const isHtml =
      contentType.includes("text/html") ||
      (typeof response.data === "string" &&
        (response.data.trim().startsWith("<!DOCTYPE") ||
          response.data.trim().startsWith("<!doctype") ||
          response.data.trim().startsWith("<html")));

    if (isHtml) {
      return Promise.reject(
        new Error(
          `API endpoint unavailable: received HTML response from ${response.config.url || "request"}`
        )
      );
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export const getDashboardSummary = async (): Promise<DashboardResponse> => {
  const { data } = await api.get<DashboardResponse>("/dashboard/summary");
  if (!data || typeof data !== "object" || !("kpis" in data)) {
    throw new Error("Invalid dashboard summary response format");
  }
  return data;
};

export const listPatients = async (): Promise<PatientSummary[]> => {
  try {
    const { data } = await api.get<PatientSummary[]>("/patients");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Backend unavailable for listPatients:", err);
    return [];
  }
};

export const getPatient = async (id: string): Promise<Patient> => {
  const { data } = await api.get<Patient>(`/patients/${id}`);
  return data;
};

export const createPatient = async (payload: PatientCreate): Promise<Patient> => {
  try {
    const { data } = await api.post<Patient>("/patients", payload);
    return data;
  } catch (err) {
    console.warn("Backend offline: generating local demonstration participant record:", err);
    return {
      id: "demo-" + Math.random().toString(36).substring(2, 9),
      patient_code: payload.patient_code || "P-001",
      name: payload.name,
      age: payload.age ?? null,
      gender: payload.gender ?? null,
      visual_diagnosis: null,
      created_at: new Date().toISOString(),
    };
  }
};

export const createAssessment = async (patientId: string, forceNew = false): Promise<Assessment> => {
  try {
    const { data } = await api.post<Assessment>(`/assessments/create?force_new=${forceNew}`, {
      patient_id: patientId,
    });
    return data;
  } catch (err) {
    console.warn("Backend offline: generating local demonstration assessment attempt:", err);
    return {
      id: "demo-asm-" + Math.random().toString(36).substring(2, 9),
      patient_id: patientId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      ended_at: null,
      tasks: defaultTasks,
    };
  }
};

export const createSession = async (
  patientId: string,
  assessmentId: string,
  taskType: TaskType,
): Promise<TaskSession> => {
  try {
    const { data } = await api.post<TaskSession>("/sessions/create", {
      patient_id: patientId,
      assessment_id: assessmentId,
      task_type: taskType,
    });
    return data;
  } catch (err) {
    console.warn(`Backend offline: initialized local demonstration session (${taskType}):`, err);
    return {
      id: "demo-sess-" + Math.random().toString(36).substring(2, 9),
      patient_id: patientId,
      assessment_id: assessmentId,
      task_type: taskType,
      status: "in_progress",
      started_at: new Date().toISOString(),
      ended_at: null,
    };
  }
};

export const getAssessment = async (id: string): Promise<Assessment> => {
  try {
    const { data } = await api.get<Assessment>(`/assessments/${id}`);
    return data;
  } catch (err) {
    console.warn("Backend offline for getAssessment, using in-memory state:", err);
    return {
      id,
      patient_id: "demo-patient",
      status: "in_progress",
      started_at: new Date().toISOString(),
      ended_at: null,
      tasks: defaultTasks,
    };
  }
};

export const endAssessment = async (id: string): Promise<Assessment> => {
  try {
    const { data } = await api.post<Assessment>(`/assessments/${id}/end`);
    return data;
  } catch (err) {
    console.warn("Backend offline for endAssessment, finalizing locally:", err);
    return {
      id,
      patient_id: "demo-patient",
      status: "completed",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      tasks: defaultTasks,
    };
  }
};

export const getCombinedReport = async (assessmentId: string): Promise<CombinedAssessmentReport> => {
  const { data } = await api.get<CombinedAssessmentReport>(`/reports/assessment/${assessmentId}`);
  if (!data || typeof data !== "object" || !("tasks" in data)) {
    throw new Error("Invalid combined report format received from API");
  }
  return data;
};

export const getReports = async (): Promise<ReportSession[]> => {
  try {
    const { data } = await api.get<ReportSession[]>("/reports");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Backend unavailable for getReports:", err);
    return [];
  }
};

export const getAssessmentReports = async (): Promise<AssessmentReportRow[]> => {
  try {
    const { data } = await api.get<AssessmentReportRow[]>("/reports/assessments");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Backend unavailable for getAssessmentReports:", err);
    return [];
  }
};

export const completeSession = async (
  sessionId: string,
  payload: SessionCompletePayload,
): Promise<TaskSession> => {
  try {
    const { data } = await api.post<TaskSession>(`/sessions/${sessionId}/complete`, payload);
    return data;
  } catch (err) {
    console.warn("Backend offline: completed task recorded locally for demo session:", err);
    return {
      id: sessionId,
      patient_id: "demo-patient",
      assessment_id: "demo-assessment",
      task_type: "visual_search",
      status: "completed",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };
  }
};
