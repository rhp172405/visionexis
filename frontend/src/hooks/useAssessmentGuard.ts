import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/stores/sessionStore";
import { endAssessment, getAssessment } from "@/lib/api";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";

export const ALLOWED_PATHS = new Set([
  "/assessment",
  "/baseline-assessment",
  "/tasks/visual-search",
  "/tasks/memory-recognition",
  "/tasks/memory",
  "/tasks/reading-comprehension",
  "/tasks/reading",
  "/calibration",
  "/gaze-validation",
  "/webcam-test",
  "/pilot-study",
  "/pilot-report",
]);

/** Keeps a clinician inside the assessment flow until all 3 tasks are done
 * or they explicitly end the session early, regardless of how they try to
 * leave (sidebar click, browser back/forward, or a typed URL). */
export function useAssessmentGuard() {
  const { patient, assessment, setAssessment, reset } = useSessionStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const lastAllowedPath = useRef("/assessment");

  // Sync latest assessment task statuses when navigating during an active assessment
  useEffect(() => {
    if (assessment?.id && assessment.status === "in_progress") {
      getAssessment(assessment.id)
        .then((fresh) => {
          if (JSON.stringify(fresh.tasks) !== JSON.stringify(assessment.tasks)) {
            setAssessment(fresh);
          }
        })
        .catch(() => {});
    }
  }, [location.pathname, assessment?.id]);

  const completedCount = assessment?.tasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalCount = assessment?.tasks?.length ?? 3;
  const allTasksDone = completedCount >= totalCount && totalCount > 0;
  const isActive = assessment?.status === "in_progress" && !allTasksDone;

  useEffect(() => {
    if (!isActive) {
      setPendingPath(null);
      return;
    }

    const isAllowed = ALLOWED_PATHS.has(location.pathname) || location.pathname.startsWith("/reports");
    if (isAllowed) {
      lastAllowedPath.current = location.pathname;
      setPendingPath(null);
    } else {
      setPendingPath(location.pathname);
    }
  }, [location.pathname, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  const stay = useCallback(() => {
    setPendingPath(null);
    if (location.pathname !== lastAllowedPath.current) {
      navigate(lastAllowedPath.current, { replace: true });
    }
  }, [navigate, location.pathname]);

  const endEarly = useCallback(async () => {
    const target = pendingPath ?? "/";
    setPendingPath(null);
    globalWebcamManager.stopCamera();
    if (assessment) {
      await endAssessment(assessment.id);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["assessment", assessment.id] });
    }
    reset();
    navigate(target, { replace: true });
  }, [pendingPath, assessment, reset, navigate, queryClient]);

  return { patient, pendingPath, completedCount, totalCount, stay, endEarly };
}
