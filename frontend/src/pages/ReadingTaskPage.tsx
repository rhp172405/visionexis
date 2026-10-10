import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { ToggleGroup } from "@/components/forms/ToggleGroup";
import { GazeCursor } from "@/components/tasks/GazeCursor";
import { ReadingPassage } from "@/components/tasks/ReadingPassage";
import { McqPanel } from "@/components/tasks/McqPanel";
import { ScanPathView } from "@/components/tasks/ScanPathView";
import { GazeMouseComparisonView } from "@/components/tasks/GazeMouseComparisonView";
import { WebcamStatusPanel } from "@/components/webcam/WebcamStatusPanel";
import { useGazeStream } from "@/hooks/useGazeStream";
import { useTaskGaze } from "@/hooks/useTaskGaze";
import {
  getPassage,
  getWordCount,
  computeCognitiveLoadIndex,
  cognitiveLoadLabel,
  cognitiveLoadColor,
  type Difficulty,
} from "@/lib/readingTask";
import { completeSession } from "@/lib/api";
import { formatAccuracy, formatSeconds, accuracyColor } from "@/lib/format";
import type { GazePoint, DualModalityMetrics } from "@/types";

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 480;
const FEEDBACK_DELAY_MS = 600;
const SCAN_PATH_MAX_POINTS = 600;
const REGRESSION_WORD_GAP = 3;

const DIFFICULTY_OPTIONS = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];

type Phase = "setup" | "reading" | "mcq" | "results";

interface McqOutcome {
  correct: boolean;
  rt_ms: number;
}

interface ResultSummary {
  accuracy_pct: number;
  rt_ms: number;
  wpm: number;
  regressions: number;
  cognitiveLoadIndex: number;
}

export function ReadingTaskPage() {
  const { patient, session, setSession } = useSessionStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ index: number; correct: boolean } | null>(null);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<DualModalityMetrics | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const taskStartRef = useRef(0);
  const mcqStartRef = useRef(0);
  const scanPathRef = useRef<GazePoint[]>([]);
  const mcqOutcomesRef = useRef<McqOutcome[]>([]);
  const peakWordRef = useRef(0);
  const regressionCountRef = useRef(0);
  const readingWpmRef = useRef(0);

  const completeMutation = useMutation({
    mutationFn: (payload: { accuracy_pct: number; rt_ms: number; scan_path_json: string }) =>
      completeSession(session!.id, payload),
    onSuccess: (updatedSession) => {
      setSession(updatedSession);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const gazePush = useGazeStream(phase === "reading" ? (session?.id ?? null) : null);

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
    isTracking: phase === "reading",
    onGazeSample: handleGazeSample,
    onFixation: handleFixation,
    taskStartTime: taskStartRef.current,
  });

  // Live WPM counter updated each second during reading
  useEffect(() => {
    if (phase !== "reading") return;
    const interval = setInterval(() => {
      const elapsed = performance.now() - taskStartRef.current;
      const minutes = elapsed / 60000;
      setWpm(Math.round(peakWordRef.current / Math.max(minutes, 1 / 60)));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  if (!session || session.task_type !== "reading") {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <BookOpenText className="mx-auto h-10 w-10 text-eyecog-teal" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">No active Reading session</h2>
        <p className="mt-1 text-sm text-slate-500">
          Register a patient and start a Reading session to begin the task.
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

  const passage = getPassage(difficulty);

  const startTask = () => {
    setCurrentWordIndex(null);
    setWpm(0);
    setMcqIndex(0);
    setFeedback(null);
    setResultSummary(null);
    setComparisonMetrics(null);
    mcqOutcomesRef.current = [];
    scanPathRef.current = [];
    peakWordRef.current = 0;
    regressionCountRef.current = 0;
    resetFixation();
    taskStartRef.current = performance.now();
    setPhase("reading");
  };

  const handleDoneReading = () => {
    const elapsed = performance.now() - taskStartRef.current;
    const wordCount = getWordCount(passage.text);
    readingWpmRef.current = Math.round(wordCount / Math.max(elapsed / 60000, 1 / 60));
    mcqStartRef.current = performance.now();
    setPhase("mcq");
  };

  const handleWordEnter = (idx: number) => {
    setCurrentWordIndex(idx);
    if (idx > peakWordRef.current) {
      peakWordRef.current = idx;
    } else if (idx < peakWordRef.current - REGRESSION_WORD_GAP) {
      regressionCountRef.current += 1;
    }
  };

  const handleMcqSelect = (index: number) => {
    if (feedback !== null) return;

    const q = passage.questions[mcqIndex];
    const correct = index === q.answerIndex;
    const rt_ms = performance.now() - mcqStartRef.current;
    mcqOutcomesRef.current = [...mcqOutcomesRef.current, { correct, rt_ms }];
    setFeedback({ index, correct });

    window.setTimeout(() => {
      if (mcqIndex + 1 < passage.questions.length) {
        setMcqIndex((i) => i + 1);
        setFeedback(null);
        mcqStartRef.current = performance.now();
      } else {
        finishTask(mcqOutcomesRef.current);
      }
    }, FEEDBACK_DELAY_MS);
  };

  const finishTask = (outcomes: McqOutcome[]) => {
    const correctCount = outcomes.filter((o) => o.correct).length;
    const accuracy_pct = (correctCount / outcomes.length) * 100;
    const rt_ms = outcomes.reduce((s, o) => s + o.rt_ms, 0) / outcomes.length;

    const fixations = scanPathRef.current.filter(
      (p) => p.event_type === "fixation" && p.duration_ms != null,
    );
    const avgFixationMs =
      fixations.length > 0
        ? fixations.reduce((s, p) => s + (p.duration_ms ?? 0), 0) / fixations.length
        : 200;

    const cognitiveLoadIndex = computeCognitiveLoadIndex(regressionCountRef.current, avgFixationMs);

    const dualMetrics = getDualModalityMetrics();
    setComparisonMetrics(dualMetrics);

    setResultSummary({
      accuracy_pct,
      rt_ms,
      wpm: readingWpmRef.current,
      regressions: regressionCountRef.current,
      cognitiveLoadIndex,
    });
    setPhase("results");

    const scan_path_json = JSON.stringify(scanPathRef.current.slice(-SCAN_PATH_MAX_POINTS));
    completeMutation.mutate({ accuracy_pct, rt_ms, scan_path_json });
  };

  const handleContinue = () => {
    navigate("/assessment");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {patient && (
        <div className="rounded-md border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-3 text-sm text-slate-600">
          Active session for <span className="font-semibold">{patient.name}</span> ({patient.patient_code})
          — Reading Task
        </div>
      )}

      {/* ── Setup ── */}
      {phase === "setup" && (
        <div className="space-y-4">
          <WebcamStatusPanel />

          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <BookOpenText className="mx-auto h-10 w-10 text-eyecog-teal" />
            <h2 className="mt-3 text-lg font-semibold text-slate-800">Reading Task</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read the passage, then answer comprehension questions.
            </p>

            <div className="mt-6 flex justify-center">
              <ToggleGroup
                label="Passage difficulty"
                options={DIFFICULTY_OPTIONS}
                value={[difficulty]}
                onChange={(value) => {
                  if (value.length) setDifficulty(value[0] as Difficulty);
                }}
              />
            </div>

            <p className="mt-3 text-xs text-slate-400">
              &ldquo;{getPassage(difficulty).title}&rdquo; &mdash; {getWordCount(getPassage(difficulty).text)} words
            </p>

            <button
              type="button"
              onClick={startTask}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-eyecog-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 cursor-pointer"
            >
              Start Reading
            </button>
          </div>
        </div>
      )}

      {/* ── Reading phase ── */}
      {phase === "reading" && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {/* HUD */}
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="font-semibold text-slate-600">{passage.title}</span>
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600 font-medium">
                Tracker: {gazeSource === "webcam" && isCameraActive ? "Webcam" : "Mouse"}
              </span>
              <span className="rounded-full bg-eyecog-bg px-3 py-1 text-eyecog-teal">
                WPM: {wpm}
              </span>
              <span className="rounded-full bg-eyecog-bg px-3 py-1 text-eyecog-teal">
                Fixation: {Math.round(fixationDurationMs)} ms
              </span>
              <span className="rounded-full bg-eyecog-bg px-3 py-1 text-slate-500">
                Regressions: {regressionCountRef.current}
              </span>
            </span>
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
            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <div className="overflow-y-auto">
                <ReadingPassage
                  text={passage.text}
                  currentWordIndex={currentWordIndex}
                  onWordEnter={handleWordEnter}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleDoneReading}
                  className="rounded-md bg-eyecog-teal px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600"
                >
                  Done Reading →
                </button>
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


      {/* ── MCQ phase ── */}
      {phase === "mcq" && (
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500">
            <BookOpenText className="h-4 w-4 text-eyecog-teal" />
            Comprehension Questions
          </div>
          <McqPanel
            question={passage.questions[mcqIndex].question}
            options={passage.questions[mcqIndex].options}
            onSelect={handleMcqSelect}
            disabled={feedback !== null}
            feedbackIndex={feedback?.index ?? null}
            feedbackCorrect={feedback?.correct ?? false}
            questionNumber={mcqIndex + 1}
            totalQuestions={passage.questions.length}
          />
        </div>
      )}

      {/* ── Results ── */}
      {phase === "results" && resultSummary && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-eyecog-green" />
            <h2 className="mt-3 text-lg font-semibold text-slate-800">Task Complete</h2>

            {/* Row 1: comprehension metrics */}
            <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-4">
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Comprehension
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-lg font-semibold ${accuracyColor(resultSummary.accuracy_pct)}`}
                >
                  {formatAccuracy(resultSummary.accuracy_pct)}
                </span>
              </div>
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reading Speed
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-700">
                  {resultSummary.wpm} wpm
                </p>
              </div>
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Avg Question RT
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-700">
                  {formatSeconds(resultSummary.rt_ms)}
                </p>
              </div>
            </div>

            {/* Row 2: eye-tracking metrics */}
            <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-4">
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Regressions
                </p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    resultSummary.regressions > 5 ? "text-amber-600" : "text-eyecog-green"
                  }`}
                >
                  {resultSummary.regressions}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cognitive Load
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-lg font-semibold ${cognitiveLoadColor(resultSummary.cognitiveLoadIndex)}`}
                >
                  {cognitiveLoadLabel(resultSummary.cognitiveLoadIndex)} ({resultSummary.cognitiveLoadIndex})
                </span>
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
