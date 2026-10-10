import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, LogOut, RotateCcw, Target, Brain, BookOpenText } from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { WebcamStatusPanel } from "@/components/webcam/WebcamStatusPanel";
import { createSession, endAssessment, getAssessment } from "@/lib/api";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import { formatAccuracy } from "@/lib/format";
import type { TaskType } from "@/types";

const TASK_OPTIONS: { type: TaskType; label: string; icon: typeof Target; description: string; route: string }[] = [
  { type: "visual_search", label: "Visual Search", icon: Target, description: "Grid-based target detection task", route: "/tasks/visual-search" },
  { type: "memory", label: "Memory & Recognition", icon: Brain, description: "Study-retention-recognition paradigm with webcam gaze & mouse decision", route: "/tasks/memory-recognition" },
  { type: "reading", label: "Reading & Comprehension", icon: BookOpenText, description: "Passage reading gaze dynamics & comprehension questions", route: "/tasks/reading-comprehension" },
];

export function AssessmentHubPage() {
  const { patient, assessment, setSession, reset } = useSessionStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const { data: liveAssessment } = useQuery({
    queryKey: ["assessment", assessment?.id],
    queryFn: () => getAssessment(assessment!.id),
    enabled: !!assessment,
    initialData: assessment ?? undefined,
  });

  const startTaskMutation = useMutation({
    mutationFn: ({ taskType }: { taskType: TaskType }) =>
      createSession(patient!.id, assessment!.id, taskType),
    onSuccess: (session, variables) => {
      setSession(session);
      const target = TASK_OPTIONS.find((t) => t.type === variables.taskType)!;
      navigate(target.route);
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endAssessment(assessment!.id),
    onSuccess: () => {
      globalWebcamManager.stopCamera();
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      reset();
      navigate("/");
    },
  });

  if (!patient || !assessment) {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-eyecog-teal" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">No active session</h2>
        <p className="mt-1 text-sm text-slate-500">
          Register a patient to start an assessment session.
        </p>
        <Link
          to="/new-session"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-eyecog-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600"
        >
          New Session
        </Link>
      </div>
    );
  }

  const tasks = liveAssessment?.tasks ?? [];
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const allDone = completedCount === TASK_OPTIONS.length;

  const handleEndClick = () => {
    if (allDone) {
      endMutation.mutate();
    } else {
      setShowEndConfirm(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-md border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-3 text-sm text-slate-600">
        Session in progress for <span className="font-semibold">{patient.name}</span> ({patient.patient_code})
        {" — "}
        {completedCount}/{TASK_OPTIONS.length} tasks completed
      </div>

      <WebcamStatusPanel />

      <div className="rounded-lg bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Assessment Tasks</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete all 3 tasks to finish this session, or end it early below.
        </p>


        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TASK_OPTIONS.map(({ type, label, icon: Icon, description }) => {
            const taskStatus = tasks.find((t) => t.task_type === type);
            const done = taskStatus?.status === "completed";
            return (
              <div
                key={type}
                className={`flex flex-col items-center gap-2 rounded-md border p-4 text-center ${
                  done ? "border-eyecog-green/40 bg-eyecog-green/5" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-eyecog-green" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300" />
                  )}
                  <Icon className="h-6 w-6 text-eyecog-teal" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
                <span className="text-xs text-slate-400">{description}</span>
                {done && (
                  <span className="text-xs font-medium text-eyecog-green">
                    Completed — {formatAccuracy(taskStatus?.accuracy_pct ?? null)} accuracy
                  </span>
                )}
                <button
                  type="button"
                  disabled={startTaskMutation.isPending}
                  onClick={() => startTaskMutation.mutate({ taskType: type })}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-eyecog-teal px-3 py-1.5 text-xs font-semibold text-eyecog-teal hover:bg-eyecog-teal/5 disabled:opacity-50"
                >
                  {done ? <RotateCcw className="h-3.5 w-3.5" /> : null}
                  {done ? "Run Again" : "Start"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleEndClick}
            disabled={endMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-eyecog-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-eyecog-navy-light disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {allDone ? "Finish Session" : "End Session Early"}
          </button>
        </div>
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">End session early?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Only {completedCount} of {TASK_OPTIONS.length} tasks for {patient.name} have been
              completed. Ending now will leave the remaining task{completedCount === TASK_OPTIONS.length - 1 ? "" : "s"} undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  endMutation.mutate();
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                End Session Early
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
