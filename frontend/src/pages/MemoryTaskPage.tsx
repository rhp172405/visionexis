import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { ToggleGroup } from "@/components/forms/ToggleGroup";
import { GazeCursor } from "@/components/tasks/GazeCursor";
import { StudyGrid } from "@/components/tasks/StudyGrid";
import { RecognitionGrid } from "@/components/tasks/RecognitionGrid";
import { ScanPathView } from "@/components/tasks/ScanPathView";
import { GazeMouseComparisonView } from "@/components/tasks/GazeMouseComparisonView";
import { WebcamStatusPanel } from "@/components/webcam/WebcamStatusPanel";
import { useGazeStream } from "@/hooks/useGazeStream";
import { useTaskGaze } from "@/hooks/useTaskGaze";
import { generateMemoryTrials, type MemoryTrial } from "@/lib/memoryTask";
import { completeSession } from "@/lib/api";
import { formatAccuracy, formatSeconds, accuracyColor } from "@/lib/format";
import type { GazePoint, DualModalityMetrics } from "@/types";

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 460;
const TRIAL_COUNT = 6;
const STUDY_DURATION_S = 5;
const BLANK_DURATION_S = 2;
const FEEDBACK_DELAY_MS = 500;
const HESITATION_THRESHOLD_MS = 800;
const SCAN_PATH_MAX_POINTS = 600;

const STUDY_COUNT_OPTIONS = [
  { label: "3 items", value: "3" },
  { label: "5 items", value: "5" },
  { label: "7 items", value: "7" },
  { label: "9 items", value: "9" },
];

type Phase = "setup" | "study" | "blank" | "recall" | "results";

interface TrialOutcome {
  correct: boolean;
  rt_ms: number;
  hesitations: number;
}

interface ResultSummary {
  accuracy_pct: number;
  rt_ms: number;
  total_hesitations: number;
}

export function MemoryTaskPage() {
  const { patient, session, setSession } = useSessionStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("setup");
  const [studyCount, setStudyCount] = useState(5);
  const [trials, setTrials] = useState<MemoryTrial[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [studyCountdown, setStudyCountdown] = useState(STUDY_DURATION_S);
  const [blankCountdown, setBlankCountdown] = useState(BLANK_DURATION_S);
  const [feedback, setFeedback] = useState<{ index: number; correct: boolean } | null>(null);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<DualModalityMetrics | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const taskStartRef = useRef(0);
  const trialStartRef = useRef(0);
  const scanPathRef = useRef<GazePoint[]>([]);
  const outcomesRef = useRef<TrialOutcome[]>([]);
  const hoverStartRef = useRef<{ index: number; t: number } | null>(null);
  const trialHesitationsRef = useRef(0);

  const completeMutation = useMutation({
    mutationFn: (payload: { accuracy_pct: number; rt_ms: number; scan_path_json: string }) =>
      completeSession(session!.id, payload),
    onSuccess: (updatedSession) => {
      setSession(updatedSession);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const isTracking = phase === "study" || phase === "recall";
  const gazePush = useGazeStream(isTracking ? (session?.id ?? null) : null);

  const handleGazeSample = useCallback(
    (point: GazePoint) => {
      gazePush(point);
      scanPathRef.current.push(point);
    },
    [gazePush]
  );

  const handleFixation = useCallback(
    (point: GazePoint) => {
      gazePush(point);
      scanPathRef.current.push(point);
    },
    [gazePush]
  );

  const {
    gazePos,
    gazeVisible,
    fixationDurationMs,
    gazeSource,
    isCameraActive,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseClick,
    resetFixation,
    getDualModalityMetrics,
  } = useTaskGaze({
    containerRef,
    isTracking,
    onGazeSample: handleGazeSample,
    onFixation: handleFixation,
    taskStartTime: taskStartRef.current,
  });

  // Study countdown: auto-advance to blank when timer hits 0
  useEffect(() => {
    if (phase !== "study") return;
    setStudyCountdown(STUDY_DURATION_S);
    const interval = setInterval(() => {
      setStudyCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase("blank");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, trialIndex]);

  // Blank countdown: auto-advance to recall when timer hits 0
  useEffect(() => {
    if (phase !== "blank") return;
    setBlankCountdown(BLANK_DURATION_S);
    const interval = setInterval(() => {
      setBlankCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          trialStartRef.current = performance.now();
          trialHesitationsRef.current = 0;
          setPhase("recall");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, trialIndex]);

  if (!session || session.task_type !== "memory") {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <Brain className="mx-auto h-10 w-10 text-eyecog-teal" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">No active Memory session</h2>
        <p className="mt-1 text-sm text-slate-500">
          Register a patient and start a Memory session to begin the task.
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

  const startTask = () => {
    setTrials(generateMemoryTrials(studyCount, TRIAL_COUNT));
    setTrialIndex(0);
    setFeedback(null);
    setResultSummary(null);
    setComparisonMetrics(null);
    outcomesRef.current = [];
    scanPathRef.current = [];
    resetFixation();
    taskStartRef.current = performance.now();
    setPhase("study");
  };

  const finishTask = (outcomes: TrialOutcome[]) => {
    const correctCount = outcomes.filter((o) => o.correct).length;
    const accuracy_pct = (correctCount / outcomes.length) * 100;
    const rt_ms = outcomes.reduce((sum, o) => sum + o.rt_ms, 0) / outcomes.length;
    const total_hesitations = outcomes.reduce((sum, o) => sum + o.hesitations, 0);

    const dualMetrics = getDualModalityMetrics();
    setComparisonMetrics(dualMetrics);

    setResultSummary({ accuracy_pct, rt_ms, total_hesitations });
    setPhase("results");

    const scan_path_json = JSON.stringify(scanPathRef.current.slice(-SCAN_PATH_MAX_POINTS));
    completeMutation.mutate({ accuracy_pct, rt_ms, scan_path_json });
  };

  const handleOptionEnter = (index: number) => {
    hoverStartRef.current = { index, t: performance.now() };
  };

  const handleOptionLeave = (index: number) => {
    if (!hoverStartRef.current || hoverStartRef.current.index !== index) return;
    const duration = performance.now() - hoverStartRef.current.t;
    const trial = trials[trialIndex];
    if (index !== trial.targetIndex && duration >= HESITATION_THRESHOLD_MS) {
      trialHesitationsRef.current += 1;
    }
    hoverStartRef.current = null;
  };

  const handleOptionSelect = (index: number) => {
    if (feedback !== null) return;

    // Count hesitation if still hovering a distractor when clicking
    if (hoverStartRef.current && hoverStartRef.current.index === index) {
      const duration = performance.now() - hoverStartRef.current.t;
      const trial = trials[trialIndex];
      if (index !== trial.targetIndex && duration >= HESITATION_THRESHOLD_MS) {
        trialHesitationsRef.current += 1;
      }
      hoverStartRef.current = null;
    }

    const trial = trials[trialIndex];
    const correct = index === trial.targetIndex;
    const rt_ms = performance.now() - trialStartRef.current;
    outcomesRef.current = [...outcomesRef.current, { correct, rt_ms, hesitations: trialHesitationsRef.current }];
    setFeedback({ index, correct });

    window.setTimeout(() => {
      if (trialIndex + 1 < trials.length) {
        resetFixation();
        setTrialIndex((i) => i + 1);
        setFeedback(null);
        setPhase("study");
      } else {
        finishTask(outcomesRef.current);
      }
    }, FEEDBACK_DELAY_MS);
  };

  const handleContinue = () => {
    navigate("/assessment");
  };

  const trial = trials[trialIndex];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {patient && (
        <div className="rounded-md border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-3 text-sm text-slate-600">
          Active session for <span className="font-semibold">{patient.name}</span> ({patient.patient_code})
          — Memory &amp; Recognition
        </div>
      )}

      {/* ── Setup ── */}
      {phase === "setup" && (
        <div className="space-y-4">
          <WebcamStatusPanel />

          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <Brain className="mx-auto h-10 w-10 text-eyecog-teal" />
            <h2 className="mt-3 text-lg font-semibold text-slate-800">Memory &amp; Recognition Task</h2>
            <p className="mt-1 text-sm text-slate-500">
              {TRIAL_COUNT} trials. Memorize words, then identify the one you studied.
            </p>

            <div className="mt-6 flex justify-center">
              <ToggleGroup
                label="Words to memorize per trial"
                options={STUDY_COUNT_OPTIONS}
                value={[String(studyCount)]}
                onChange={(value) => {
                  if (value.length) setStudyCount(Number(value[0]));
                }}
              />
            </div>

            <button
              type="button"
              onClick={startTask}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-eyecog-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 cursor-pointer"
            >
              Start Task
            </button>
          </div>
        </div>
      )}

      {/* ── Study phase ── */}
      {phase === "study" && trial && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
            <span>
              Trial {trialIndex + 1} of {trials.length} — Study
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 font-medium">
                Tracker: {gazeSource === "webcam" && isCameraActive ? "Webcam" : "Mouse"}
              </span>
              <span className="rounded-full bg-eyecog-bg px-3 py-1 font-bold text-eyecog-teal">
                {studyCountdown}s
              </span>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-md border border-slate-100 bg-slate-50"
            style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleMouseClick}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Memorize these words
              </p>
              <StudyGrid items={trial.studyItems} />
              <div className="w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-eyecog-teal transition-all duration-1000"
                  style={{
                    width: `${((STUDY_DURATION_S - studyCountdown) / STUDY_DURATION_S) * 100}%`,
                  }}
                />
              </div>
            </div>

            <GazeCursor
              x={gazePos.x}
              y={gazePos.y}
              fixationDurationMs={fixationDurationMs}
              visible={gazeVisible}
            />
          </div>
        </div>
      )}

      {/* ── Blank / fixation cross ── */}
      {phase === "blank" && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
            <span>
              Trial {trialIndex + 1} of {trials.length} — Delay
            </span>
            <span className="rounded-full bg-eyecog-bg px-3 py-1 font-bold text-eyecog-teal">
              {blankCountdown}s
            </span>
          </div>

          <div
            className="mx-auto flex items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50"
            style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
          >
            <span className="select-none text-7xl font-thin text-slate-300">+</span>
          </div>
        </div>
      )}

      {/* ── Recall / recognition ── */}
      {phase === "recall" && trial && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
            <span>
              Trial {trialIndex + 1} of {trials.length} — Recall
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 font-medium">
                Tracker: {gazeSource === "webcam" && isCameraActive ? "Webcam" : "Mouse"}
              </span>
              <span className="rounded-full bg-eyecog-bg px-3 py-1 text-eyecog-teal">
                Fixation: {Math.round(fixationDurationMs)} ms
              </span>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-md border border-slate-100 bg-slate-50"
            style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleMouseClick}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Which word did you study?
              </p>
              <div style={{ width: 380 }}>
                <RecognitionGrid
                  options={trial.options}
                  onSelect={handleOptionSelect}
                  disabled={feedback !== null}
                  feedbackIndex={feedback?.index ?? null}
                  feedbackCorrect={feedback?.correct ?? false}
                  onOptionEnter={handleOptionEnter}
                  onOptionLeave={handleOptionLeave}
                />
              </div>
            </div>

            <GazeCursor
              x={gazePos.x}
              y={gazePos.y}
              fixationDurationMs={fixationDurationMs}
              visible={gazeVisible}
            />
          </div>
        </div>
      )}


      {/* ── Results ── */}
      {phase === "results" && resultSummary && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-eyecog-green" />
            <h2 className="mt-3 text-lg font-semibold text-slate-800">Task Complete</h2>

            <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-4">
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Accuracy</p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-lg font-semibold ${accuracyColor(resultSummary.accuracy_pct)}`}
                >
                  {formatAccuracy(resultSummary.accuracy_pct)}
                </span>
              </div>
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Avg Recall RT</p>
                <p className="mt-1 text-lg font-semibold text-slate-700">
                  {formatSeconds(resultSummary.rt_ms)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Hesitations</p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    resultSummary.total_hesitations > 0 ? "text-amber-600" : "text-eyecog-green"
                  }`}
                >
                  {resultSummary.total_hesitations}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={startTask}
                className="inline-flex items-center gap-2 rounded-md border border-eyecog-teal px-4 py-2 text-sm font-semibold text-eyecog-teal hover:bg-eyecog-teal/5"
              >
                <RotateCcw className="h-4 w-4" />
                Run Again
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-md bg-eyecog-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600"
              >
                <ArrowRight className="h-4 w-4" />
                Continue Session
              </button>
            </div>
          </div>

          {/* Dual-Modality Comparison Analytics */}
          {comparisonMetrics && (
            <GazeMouseComparisonView
              metrics={comparisonMetrics}
              points={scanPathRef.current}
            />
          )}

          {/* Dual-Modality Trajectory Map */}
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">VISIONEXIS Trajectory Map</h3>
            <p className="mt-1 text-xs text-slate-400">
              Synchronized visualization of Webcam Eye Gaze trail (teal) and Mouse cursor path (purple dashed line with red clicks).
            </p>
            <div className="mt-3" style={{ height: PANEL_HEIGHT * 0.65 }}>
              <ScanPathView points={scanPathRef.current} width={PANEL_WIDTH} height={PANEL_HEIGHT} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
