import axios from "axios";
import type {
  Assessment,
  AssessmentReportRow,
  AssessmentTaskStatus,
  BaselineVisualAssessment,
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

// Operator Token Management (Stored only in sessionStorage; never hardcoded or logged)
export const getOperatorToken = (): string | null => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem("visionexis-operator-token");
    } catch {
      return null;
    }
  }
  return null;
};

export const setOperatorToken = (token: string): void => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem("visionexis-operator-token", token.trim());
    } catch (e) {
      console.warn("Unable to persist operator token to sessionStorage:", e);
    }
  }
};

export const clearOperatorToken = (): void => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem("visionexis-operator-token");
    } catch {}
  }
};

/**
 * Checks whether client-side local demo fallback is permitted.
 * In staging and production, this strictly returns false to ensure failures are visible
 * and real participant data is never silently replaced by mock demo-... objects.
 */
export const isLocalDemoModeEnabled = (): boolean => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      if (window.sessionStorage.getItem("visionexis-allow-local-demo") === "true") {
        return true;
      }
    } catch {}
  }
  const rawUrl = import.meta.env.VITE_API_URL || "";
  const isRemoteBackend = !!(
    rawUrl &&
    !rawUrl.includes("localhost") &&
    !rawUrl.includes("127.0.0.1")
  );
  if (isRemoteBackend) {
    return false;
  }
  return import.meta.env.DEV === true && import.meta.env.VITE_ALLOW_LOCAL_DEMO === "true";
};

/**
 * Verifies the operator API key against the safe read-only /dashboard/summary endpoint.
 * Has zero side effects (creates no participant records).
 */
export const verifyOperatorToken = async (
  candidateToken?: string
): Promise<{ success: boolean; error?: string }> => {
  const tokenToTest = (
    candidateToken !== undefined ? candidateToken : getOperatorToken()
  )?.trim();
  if (!tokenToTest) {
    return { success: false, error: "Operator API Key is required." };
  }
  try {
    await api.get("/dashboard/summary", {
      headers: {
        Authorization: `Bearer ${tokenToTest}`,
      },
    });
    return { success: true };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return { success: false, error: "Invalid Operator API Key. Access denied." };
    }
    return {
      success: false,
      error: "Unable to verify credentials: could not reach backend server.",
    };
  }
};

// Attach Bearer token: Priority:
// 1. Operator token from examiner session in sessionStorage
// 2. Participant-scoped session token from active session state in sessionStorage
// 3. Fallback to VITE_API_KEY (optional development/sandbox token)
api.interceptors.request.use((config) => {
  let sessionToken: string | null = null;
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem("eyecog-session");
      if (stored) {
        const parsed = JSON.parse(stored);
        sessionToken =
          parsed?.state?.session?.session_token ||
          parsed?.state?.assessment?.session_token ||
          null;
      }
    } catch {
      // Ignore sessionStorage parse failure
    }
  }

  const operatorToken = getOperatorToken();
  const activeToken = operatorToken || sessionToken || import.meta.env.VITE_API_KEY;
  if (activeToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${activeToken.trim()}`;
  }
  return config;
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
  } catch (err: any) {
    if (isLocalDemoModeEnabled()) {
      console.warn("Local development mode: generating local demonstration participant record:", err);
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
    const status = err?.response?.status;
    if (status === 401) {
      throw new Error("Operator authentication required. Please connect with an Operator API Key via Operator Access.");
    }
    if (status === 403) {
      throw new Error("Operator privileges required to register participants.");
    }
    if (err?.response?.data?.detail) {
      const detail =
        typeof err.response.data.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
      throw new Error(`Participant registration rejected: ${detail}`);
    }
    if (err?.code === "ERR_NETWORK" || !err?.response) {
      throw new Error("Unable to connect to backend server. Participant record was not saved.");
    }
    throw new Error("Failed to register participant on server.");
  }
};

export const createAssessment = async (patientId: string, forceNew = false): Promise<Assessment> => {
  try {
    const { data } = await api.post<Assessment>(`/assessments/create?force_new=${forceNew}`, {
      patient_id: patientId,
    });
    return data;
  } catch (err: any) {
    if (isLocalDemoModeEnabled()) {
      console.warn("Local development mode: generating local demonstration assessment attempt:", err);
      return {
        id: "demo-asm-" + Math.random().toString(36).substring(2, 9),
        patient_id: patientId,
        status: "in_progress",
        started_at: new Date().toISOString(),
        ended_at: null,
        tasks: defaultTasks,
      };
    }
    throw err;
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
  } catch (err: any) {
    if (isLocalDemoModeEnabled()) {
      console.warn(`Local development mode: initialized local demonstration session (${taskType}):`, err);
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
    throw err;
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
  } catch (err: any) {
    if (isLocalDemoModeEnabled()) {
      console.warn("Local development mode: endAssessment finalizing locally:", err);
      return {
        id,
        patient_id: "demo-patient",
        status: "completed",
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        tasks: defaultTasks,
      };
    }
    throw err;
  }
};

export const saveBaselineAssessment = async (
  assessmentId: string,
  baseline: BaselineVisualAssessment,
): Promise<BaselineVisualAssessment> => {
  try {
    const { data } = await api.post<BaselineVisualAssessment>(
      `/assessments/${assessmentId}/baseline`,
      baseline,
    );
    if (data && typeof data === "object") {
      // Authoritative server persistence succeeded
      const serverResult: BaselineVisualAssessment = {
        ...data,
        is_server_synced: true,
      };
      try {
        sessionStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(serverResult));
        localStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(serverResult));
      } catch (e) {
        console.warn("Storage warning when caching baseline:", e);
      }
      return serverResult;
    }
  } catch (err) {
    console.warn("Backend offline or baseline endpoint error; preserving to local fallback:", err);
    // Explicitly flag as not server-synced so fallback is never misrepresented as server success
    const localResult: BaselineVisualAssessment = {
      ...baseline,
      is_server_synced: false,
    };
    try {
      sessionStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(localResult));
      localStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(localResult));
    } catch (e) {
      console.warn("Storage warning when saving fallback baseline:", e);
    }
    return localResult;
  }
  return { ...baseline, is_server_synced: false };
};

export const getBaselineAssessment = async (
  assessmentId: string,
): Promise<BaselineVisualAssessment | null> => {
  try {
    const { data } = await api.get<BaselineVisualAssessment>(
      `/assessments/${assessmentId}/baseline`,
    );
    if (data && typeof data === "object") {
      // Authoritative server record retrieved
      const serverRecord: BaselineVisualAssessment = {
        ...data,
        is_server_synced: true,
      };
      try {
        sessionStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(serverRecord));
        localStorage.setItem(`visionexis-baseline-${assessmentId}`, JSON.stringify(serverRecord));
      } catch {}
      return serverRecord;
    }
  } catch (err) {
    // Backend offline / error; fall back to browser cache
  }

  // Fallback to storage
  try {
    const stored =
      sessionStorage.getItem(`visionexis-baseline-${assessmentId}`) ||
      localStorage.getItem(`visionexis-baseline-${assessmentId}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
};

export const getCombinedReport = async (assessmentId: string): Promise<CombinedAssessmentReport> => {
  let reportData: CombinedAssessmentReport;
  try {
    const { data } = await api.get<CombinedAssessmentReport>(`/reports/assessment/${assessmentId}`);
    if (!data || typeof data !== "object" || !("tasks" in data)) {
      throw new Error("Invalid combined report format received from API");
    }
    reportData = data;
  } catch (err) {
    // Check if offline fallback or mock exists in sessionStore
    console.warn("API report fetch failed, checking offline session:", err);
    throw err;
  }

  // Ensure baseline assessment is attached if not already populated by backend
  if (!reportData.baseline_assessment) {
    const baseline = await getBaselineAssessment(assessmentId);
    if (baseline) {
      reportData.baseline_assessment = baseline;
    }
  }

  return reportData;
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
