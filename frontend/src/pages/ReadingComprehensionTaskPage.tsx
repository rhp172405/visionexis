import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Crosshair,
  AlertTriangle,
  Copy,
  Check,
  Layers,
  Sparkles,
  Sliders,
  Terminal,
  Activity,
  ShieldCheck,
  Eye,
  AlignLeft,
} from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  READING_PASSAGE_BANK,
  aggregateReadingSession,
  type ReadingPassage,
  type ReadingSessionRecord,
  type LineAOI,
  type WordAOI,
  type QuestionResponseRecord,
} from "@/lib/readingComprehensionTask";
import {
  FixationDetector,
  ModularSaccadeDetector,
  BlinkDetector,
  type FixationEvent,
  type SaccadeEvent,
  type BlinkEvent,
  type RawGazeBufferSample,
  globalTaskEventManager,
} from "@/lib/webcam/gazeEvents";
import { ReadingVisualizer } from "@/components/tasks/ReadingVisualizer";
import { completeSession, createSession, endAssessment, getAssessment } from "@/lib/api";

type Phase = "intro" | "reading" | "questions" | "results";

const CONTAINER_WIDTH = 760;
const CONTAINER_HEIGHT = 520;
const QUESTION_FEEDBACK_DELAY_MS = 400;

export function ReadingComprehensionTaskPage() {
  const { patient, session, setSession, assessment, setAssessment } = useSessionStore();
  const {
    isCameraActive,
    isCalibrated,
    faceDetected,
    eyesDetected,
    currentGaze,
    lastFeatures,
    fps,
    pipelineHealth,
    calibrationModel,
  } = useGazeStore();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedPassage, setSelectedPassage] = useState<ReadingPassage>(READING_PASSAGE_BANK[0]);
  const [sessionSeed, setSessionSeed] = useState(0);

  // Questions Phase State
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [questionFeedback, setQuestionFeedback] = useState<{ selected: number; correct: boolean } | null>(null);

  // Results & Inspector
  const [sessionRecord, setSessionRecord] = useState<ReadingSessionRecord | null>(null);
  const [copied, setCopied] = useState(false);

  // Developer Debug HUD State
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [liveMousePos, setLiveMousePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [liveGazePos, setLiveGazePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [currentLineId, setCurrentLineId] = useState<string>("NONE");
  const [currentWordText, setCurrentWordText] = useState<string>("NONE");

  // Recording References
  const textContainerRef = useRef<HTMLDivElement>(null);
  const readingStartRef = useRef(0);
  const readingEndRef = useRef(0);

  const trialGazeSamplesRef = useRef<RawGazeBufferSample[]>([]);
  const trialMouseEventsRef = useRef<{ type: string; x: number; y: number; timestamp: number }[]>([]);
  const trialFixationsRef = useRef<FixationEvent[]>([]);
  const trialSaccadesRef = useRef<SaccadeEvent[]>([]);
  const trialBlinksRef = useRef<BlinkEvent[]>([]);
  const lineAOIsRef = useRef<LineAOI[]>([]);
  const wordAOIsRef = useRef<WordAOI[]>([]);
  const questionResponsesRef = useRef<QuestionResponseRecord[]>([]);

  // Detectors
  const fixationDetectorRef = useRef<FixationDetector | null>(null);
  const saccadeDetectorRef = useRef<ModularSaccadeDetector | null>(null);
  const blinkDetectorRef = useRef<BlinkDetector | null>(null);

  useEffect(() => {
    fixationDetectorRef.current = new FixationDetector((fix) => {
      trialFixationsRef.current.push(fix);
    });
    saccadeDetectorRef.current = new ModularSaccadeDetector((sac) => {
      trialSaccadesRef.current.push(sac);
    });
    blinkDetectorRef.current = new BlinkDetector((blk) => {
      trialBlinksRef.current.push(blk);
    });
  }, []);

  // Ensure reading session exists if an assessment is actively running
  useEffect(() => {
    if (
      patient?.id &&
      assessment?.id &&
      assessment.status === "in_progress" &&
      (!session || session.task_type !== "reading")
    ) {
      createSession(patient.id, assessment.id, "reading")
        .then((s) => setSession(s))
        .catch(console.error);
    }
  }, [patient?.id, assessment?.id, assessment?.status, session]);

  const [completionError, setCompletionError] = useState<string | null>(null);

  // Backend Mutation
  const completeMutation = useMutation({
    mutationFn: (payload: { accuracy_pct: number; rt_ms: number; scan_path_json: string; comparison_json?: string }) => {
      if (!session?.id) return Promise.resolve(null);
      return completeSession(session.id, payload);
    },
    onSuccess: async (updatedSession) => {
      if (updatedSession) {
        setSession(updatedSession);
        if (assessment?.id) {
          try {
            const fresh = await getAssessment(assessment.id);
            setAssessment(fresh);

            // Check if all 3 tasks are completed
            const completedTypes = new Set(
              fresh.tasks.filter((t) => t.status === "completed").map((t) => t.task_type)
            );
            // Reading task session is now completed
            completedTypes.add("reading");

            if (completedTypes.has("visual_search") && completedTypes.has("memory") && completedTypes.has("reading")) {
              try {
                globalWebcamManager.stopCamera();
              } catch (camErr) {
                console.warn("Failed to stop camera on assessment completion:", camErr);
              }
              const ended = await endAssessment(assessment.id);
              setAssessment(ended);
              queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
              queryClient.invalidateQueries({ queryKey: ["assessment", assessment.id] });
              // Automatically navigate to the Overall Patient Report
              setTimeout(() => {
                navigate(`/reports/assessment/${assessment.id}`);
              }, 1200);
            }
          } catch (e: any) {
            console.error("Failed to finalize assessment on reading completion:", e);
            setCompletionError(e?.message || "Failed to finalize overall assessment report");
          }
        }
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["assessment", assessment?.id] });
      }
    },
    onError: (err: any) => {
      setCompletionError(err?.message || "Failed to save reading session results");
    },
  });

  const handleProceedToReport = () => {
    try {
      globalWebcamManager.stopCamera();
    } catch (camErr) {
      console.warn("Failed to stop camera:", camErr);
    }
    if (assessment?.id) {
      navigate(`/reports/assessment/${assessment.id}`);
    } else {
      navigate("/reports");
    }
  };

  // Ensure webcam is active
  useEffect(() => {
    if (!isCameraActive) {
      globalWebcamManager.startCamera();
    }
  }, [isCameraActive]);

  // Reset task buffers when session or patient changes to avoid cross-session contamination
  useEffect(() => {
    trialGazeSamplesRef.current = [];
    trialMouseEventsRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];
    questionResponsesRef.current = [];
  }, [session?.id, patient?.id, assessment?.id]);

  // Real-time Gaze Stream ingestion
  useEffect(() => {
    if (!currentGaze) return;

    let gx = 0;
    let gy = 0;
    if (textContainerRef.current) {
      const rect = textContainerRef.current.getBoundingClientRect();
      const screenX = currentGaze.normX * window.innerWidth;
      const screenY = currentGaze.normY * window.innerHeight;
      gx = Math.round(screenX - rect.left);
      gy = Math.round(screenY - rect.top);
    } else {
      gx = Math.round(currentGaze.normX * CONTAINER_WIDTH);
      gy = Math.round(currentGaze.normY * CONTAINER_HEIGHT);
    }
    const t = currentGaze.timestamp;

    setLiveGazePos({ x: gx, y: gy, timestamp: t });

    // Check current line and word
    if (lineAOIsRef.current.length > 0) {
      const hitLine = lineAOIsRef.current.find(
        (l) => gy >= l.y - 6 && gy <= l.y + l.height + 6 && gx >= l.x - 20 && gx <= l.x + l.width + 20
      );
      setCurrentLineId(hitLine ? `Line ${hitLine.lineIndex + 1}` : "OUTSIDE TEXT");
    }

    if (wordAOIsRef.current.length > 0) {
      const hitWord = wordAOIsRef.current.find(
        (w) => gx >= w.x - 4 && gx <= w.x + w.width + 4 && gy >= w.y - 4 && gy <= w.y + w.height + 4
      );
      setCurrentWordText(hitWord ? `"${hitWord.text}"` : "NONE");
    }

    if (phase !== "reading") return;

    // Ingest into detectors
    fixationDetectorRef.current?.addSample(gx, gy, t, currentGaze.confidence, currentGaze.isBlink);
    saccadeDetectorRef.current?.addSample(gx, gy, t);
    blinkDetectorRef.current?.addSample(currentGaze.isBlink, t);

    // Save sample in trial buffer
    trialGazeSamplesRef.current.push({
      timestamp: t,
      gazeX: gx,
      gazeY: gy,
      normalizedX: currentGaze.normX,
      normalizedY: currentGaze.normY,
      confidence: currentGaze.confidence,
      leftRelativeX: lastFeatures?.leftIrisX ?? 0,
      leftRelativeY: lastFeatures?.leftIrisY ?? 0,
      rightRelativeX: lastFeatures?.rightIrisX ?? 0,
      rightRelativeY: lastFeatures?.rightIrisY ?? 0,
      eyeOpenness: lastFeatures?.meanEar ?? 0.8,
      blink: currentGaze.isBlink,
    });
  }, [phase, currentGaze, lastFeatures]);

  // Mouse move tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    let mx = 0;
    let my = 0;
    if (textContainerRef.current) {
      const rect = textContainerRef.current.getBoundingClientRect();
      mx = Math.round(e.clientX - rect.left);
      my = Math.round(e.clientY - rect.top);
    }
    const now = performance.now();
    setLiveMousePos({ x: mx, y: my, timestamp: now });

    if (phase === "reading" || phase === "questions") {
      trialMouseEventsRef.current.push({
        type: "move",
        x: mx,
        y: my,
        timestamp: now,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // TASK CONTROLLER
  // ---------------------------------------------------------------------------

  const startReading = () => {
    const seed = Math.floor(Math.random() * 1000000);
    setSessionSeed(seed);

    // Randomize passage selection based on seed
    const passage = READING_PASSAGE_BANK[seed % READING_PASSAGE_BANK.length];
    setSelectedPassage(passage);

    trialGazeSamplesRef.current = [];
    trialMouseEventsRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];
    questionResponsesRef.current = [];
    setSessionRecord(null);

    // Reset detectors
    fixationDetectorRef.current?.reset();
    saccadeDetectorRef.current?.reset();
    blinkDetectorRef.current?.reset();

    const now = performance.now();
    readingStartRef.current = now;

    globalTaskEventManager.markEvent("SESSION_START", { task: "reading_comprehension", passageId: passage.passageId });
    globalTaskEventManager.markEvent("READING_START", { wordCount: passage.wordCount });
    globalTaskEventManager.markEvent("PASSAGE_APPEAR", { passageTitle: passage.title });

    setPhase("reading");

    // Extract rendered DOM bounding boxes for Line and Word AOIs
    window.setTimeout(() => {
      extractRenderedAOIs();
    }, 150);
  };

  const extractRenderedAOIs = () => {
    if (!textContainerRef.current) return;
    const containerRect = textContainerRef.current.getBoundingClientRect();

    const lineElements = textContainerRef.current.querySelectorAll<HTMLElement>("[data-line-index]");
    const lines: LineAOI[] = [];

    lineElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const lineIdx = parseInt(el.getAttribute("data-line-index") || "0", 10);
      const pIdx = parseInt(el.getAttribute("data-paragraph-index") || "0", 10);
      lines.push({
        lineId: `line_${lineIdx}`,
        lineIndex: lineIdx,
        paragraphIndex: pIdx,
        x: Math.round(rect.left - containerRect.left),
        y: Math.round(rect.top - containerRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        text: el.innerText || "",
        wordStartIndex: 0,
        wordEndIndex: 0,
      });
    });

    const wordElements = textContainerRef.current.querySelectorAll<HTMLElement>("[data-word-index]");
    const words: WordAOI[] = [];

    wordElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const wordIdx = parseInt(el.getAttribute("data-word-index") || "0", 10);
      const lineIdx = parseInt(el.getAttribute("data-line-index") || "0", 10);
      const pIdx = parseInt(el.getAttribute("data-paragraph-index") || "0", 10);
      words.push({
        wordId: `word_${wordIdx}`,
        wordIndex: wordIdx,
        lineIndex: lineIdx,
        paragraphIndex: pIdx,
        text: el.innerText || "",
        x: Math.round(rect.left - containerRect.left),
        y: Math.round(rect.top - containerRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        screenWidth: CONTAINER_WIDTH,
        screenHeight: CONTAINER_HEIGHT,
      });
    });

    lineAOIsRef.current = lines;
    wordAOIsRef.current = words;
  };

  // Participant finishes reading and advances to comprehension questions
  const finishReading = () => {
    const now = performance.now();
    readingEndRef.current = now;
    globalTaskEventManager.markEvent("READING_END", { readingDurationMs: Math.round(now - readingStartRef.current) });
    fixationDetectorRef.current?.flushWindow();

    setPhase("questions");
    setQuestionIndex(0);
    setQuestionStartTime(now);
    setQuestionFeedback(null);

    globalTaskEventManager.markEvent("QUESTION_START", { totalQuestions: selectedPassage.questions.length });
  };

  // Participant answers a question
  const handleAnswerQuestion = (selectedOptionIndex: number, e: React.MouseEvent) => {
    if (questionFeedback !== null || phase !== "questions") return;

    const responseTime = performance.now();
    const currentQ = selectedPassage.questions[questionIndex];
    const isCorrect = selectedOptionIndex === currentQ.correctOptionIndex;
    const reactionTimeMs = Math.max(0, Math.round(responseTime - questionStartTime));

    if (textContainerRef.current) {
      const rect = textContainerRef.current.getBoundingClientRect();
      trialMouseEventsRef.current.push({
        type: "click",
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
        timestamp: responseTime,
      });
    }

    globalTaskEventManager.markEvent("MOUSE_RESPONSE", {
      questionId: currentQ.questionId,
      selectedOptionIndex,
      isCorrect,
      reactionTimeMs,
    });

    const responseRecord: QuestionResponseRecord = {
      questionId: currentQ.questionId,
      questionType: currentQ.type,
      questionStartTime,
      responseTime,
      reactionTimeMs,
      selectedOptionIndex,
      correctOptionIndex: currentQ.correctOptionIndex,
      isCorrect,
    };

    questionResponsesRef.current.push(responseRecord);
    setQuestionFeedback({ selected: selectedOptionIndex, correct: isCorrect });

    // Transition to next question or complete task
    window.setTimeout(() => {
      if (questionIndex + 1 < selectedPassage.questions.length) {
        const nextIdx = questionIndex + 1;
        setQuestionIndex(nextIdx);
        setQuestionStartTime(performance.now());
        setQuestionFeedback(null);
        globalTaskEventManager.markEvent("QUESTION_APPEAR", { questionIndex: nextIdx });
      } else {
        finishReadingSession();
      }
    }, QUESTION_FEEDBACK_DELAY_MS);
  };

  const finishReadingSession = () => {
    globalTaskEventManager.markEvent("QUESTION_END");
    globalTaskEventManager.markEvent("READING_SESSION_END");

    const record = aggregateReadingSession(
      session?.id ?? `read_sess_${Date.now()}`,
      selectedPassage,
      lineAOIsRef.current,
      wordAOIsRef.current,
      [...trialGazeSamplesRef.current],
      [...trialMouseEventsRef.current],
      [...trialFixationsRef.current],
      [...trialSaccadesRef.current],
      readingStartRef.current,
      readingEndRef.current,
      questionResponsesRef.current,
      sessionSeed,
      patient?.id,
      {
        calibrationProfileId: calibrationModel?.id ?? "v1_user_profile",
        viewportWidth: CONTAINER_WIDTH,
        viewportHeight: CONTAINER_HEIGHT,
        cameraStatus: isCameraActive ? "CONNECTED" : "DISCONNECTED",
        validationStatus: calibrationModel?.validation ? `VALIDATED_${calibrationModel.validation.qualityRating}` : "UNVALIDATED",
        taskVersion: "1.0.0",
      }
    );

    setSessionRecord(record);
    setPhase("results");

    // Push completion to backend
    const scanPathSamplePoints = record.rawGazeSamples.map((s) => ({
      x: s.gazeX,
      y: s.gazeY,
      t: s.timestamp,
      confidence: s.confidence,
      isBlink: s.blink,
    })).slice(-600);

    completeMutation.mutate({
      accuracy_pct: record.derivedMetrics.overallComprehensionAccuracyPct,
      rt_ms: record.derivedMetrics.meanQuestionReactionTimeMs,
      scan_path_json: JSON.stringify(scanPathSamplePoints),
      comparison_json: JSON.stringify(record),
    });
  };

  const handleCopyResultsJSON = () => {
    if (!sessionRecord) return;
    navigator.clipboard.writeText(JSON.stringify(sessionRecord, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentQuestion = selectedPassage.questions[questionIndex];
  const isEyeTrackingAvailable = isCameraActive && faceDetected && eyesDetected && currentGaze !== null;
  const isMouseActive = performance.now() - liveMousePos.timestamp < 3000 && liveMousePos.timestamp > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {patient ? (
          <div className="rounded-xl border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-2 text-xs text-slate-700 flex items-center gap-3 shadow-xs">
            <span>
              Active Session: <strong>{patient.name}</strong> ({patient.patient_code})
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-eyecog-teal">Reading &amp; Comprehension Task</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500">VISIONEXIS Reading Engine</div>
        )}

        <button
          type="button"
          onClick={() => setShowDebugHUD(!showDebugHUD)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer shadow-xs ${
            showDebugHUD
              ? "bg-slate-900 text-emerald-400 border border-slate-700 ring-2 ring-emerald-500/30"
              : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Dev Debug HUD [{showDebugHUD ? "LIVE" : "OFF"}]
        </button>
      </div>

      {/* ========================================================================= */}
      {/* DEVELOPER DEBUG HUD PANEL                                                 */}
      {/* ========================================================================= */}
      {showDebugHUD && (
        <div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 shadow-xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
              <Activity className="h-4 w-4" />
              Reading Eye-Movement Live Telemetry &amp; Line Tracking HUD
            </div>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              Phase: {phase.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Camera</span>
              <p className={`mt-0.5 font-bold ${isCameraActive ? "text-emerald-400" : "text-rose-400"}`}>
                {isCameraActive ? "CONNECTED" : "DISCONNECTED"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Gaze</span>
              <p className={`mt-0.5 font-bold ${isEyeTrackingAvailable ? "text-emerald-400" : "text-rose-400"}`}>
                {isEyeTrackingAvailable ? "ACTIVE" : "INVALID"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Mouse</span>
              <p className={`mt-0.5 font-bold ${isMouseActive ? "text-emerald-400" : "text-slate-400"}`}>
                {isMouseActive ? "ACTIVE" : "INACTIVE"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Inference FPS</span>
              <p className="mt-0.5 font-bold text-sky-400">
                {pipelineHealth.inferenceFps || fps || 0} FPS
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Gaze</span>
              <p className="mt-0.5 font-bold text-teal-300">
                X: {liveGazePos.x} / Y: {liveGazePos.y}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Mouse</span>
              <p className="mt-0.5 font-bold text-purple-300">
                X: {liveMousePos.x} / Y: {liveMousePos.y}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Line</span>
              <p className="mt-0.5 font-bold text-amber-300 truncate" title={currentLineId}>
                {currentLineId}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Word</span>
              <p className="mt-0.5 font-bold text-indigo-300 truncate" title={currentWordText}>
                {currentWordText}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase text-slate-400">Last Gaze Timestamp</span>
              <p className="mt-0.5 font-bold text-teal-400">
                {liveGazePos.timestamp > 0 ? `${liveGazePos.timestamp.toFixed(2)} ms` : "0.00 ms"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase text-slate-400">Last Mouse Timestamp</span>
              <p className="mt-0.5 font-bold text-purple-400">
                {liveMousePos.timestamp > 0 ? `${liveMousePos.timestamp.toFixed(2)} ms` : "0.00 ms"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 1: PRE-TASK SETUP & INSTRUCTIONS                                    */}
      {/* ========================================================================= */}
      {phase === "intro" && (
        <div className="space-y-6">
          {(!isCalibrated || !calibrationModel) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900">Calibration Recommended</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  An accurate gaze calibration profile ensures high precision in line and word-level reading regressions.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/calibration"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-xs"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Go to Gaze Calibration
                  </Link>
                  <Link
                    to="/gaze-validation"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 transition shadow-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Validate Accuracy
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-eyecog-teal shadow-xs">
              <BookOpenText className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                VISIONEXIS Reading &amp; Comprehension Assessment
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 leading-relaxed font-medium">
                Read the passage naturally. Look at the text as you normally would.
                <br />
                After reading, answer the comprehension questions using the mouse.
              </p>
            </div>

            <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-4 rounded-xl bg-slate-50 px-6 py-3 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-eyecog-teal" /> 1. Controlled Reading Passage
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> 2. 5 Comprehension MCQs
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 3. WPM &amp; Regression Analytics
              </span>
            </div>

            {/* Pre-Flight System Readiness Checklist */}
            <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2 text-xs">
              <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-2">
                Pre-Flight System Readiness Check
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Webcam Hardware:</span>
                  <span className={`font-bold ${isCameraActive ? "text-emerald-600" : "text-rose-500"}`}>
                    {isCameraActive ? "CONNECTED ✓" : "DISCONNECTED ✗"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Gaze Tracking:</span>
                  <span className={`font-bold ${isEyeTrackingAvailable ? "text-emerald-600" : "text-amber-500"}`}>
                    {isEyeTrackingAvailable ? "ACTIVE ✓" : "WAITING"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Calibration Profile:</span>
                  <span className={`font-bold ${isCalibrated ? "text-emerald-600" : "text-amber-500"}`}>
                    {isCalibrated ? "EXISTS ✓" : "MISSING ✗"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Validation Status:</span>
                  <span className={`font-bold ${calibrationModel?.validation ? "text-emerald-600" : "text-amber-500"}`}>
                    {calibrationModel?.validation ? `VALIDATED (${calibrationModel.validation.qualityRating})` : "UNVALIDATED"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Mouse Stream:</span>
                  <span className="font-bold text-emerald-600">INDEPENDENT ✓</span>
                </div>
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-500">Monotonic Clock:</span>
                  <span className="font-bold text-emerald-600">SYNCED ✓</span>
                </div>
              </div>
            </div>

            {/* Camera / Tracking Status Warning Banner */}
            {(!isCameraActive || !faceDetected || !isEyeTrackingAvailable) && (
              <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-left text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Tracking Status: {!isCameraActive ? "Camera Disconnected" : !faceDetected ? "Face Not Detected" : "Eye-Tracking Initializing"}</span>
                </div>
                <p className="mt-1 text-amber-800 text-[11px] leading-relaxed">
                  Webcam eye-tracking is currently inactive. You may still proceed with reading comprehension; reading time and questions will be recorded, while gaze dynamics (WPM, fixations) will be labeled as "Unavailable".
                </p>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={startReading}
                className="inline-flex items-center gap-2 rounded-xl bg-eyecog-teal px-8 py-3 text-base font-bold text-white shadow-md hover:bg-teal-600 transition cursor-pointer"
              >
                <Sparkles className="h-5 w-5" />
                Start Reading Passage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: ACTIVE READING PASSAGE                                           */}
      {/* ========================================================================= */}
      {phase === "reading" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white px-6 py-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 uppercase tracking-wider">
                Reading Phase
              </span>
              <span className="font-mono text-sm font-bold text-slate-800">
                {selectedPassage.title} ({selectedPassage.wordCount} words)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isEyeTrackingAvailable ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-500 font-medium">
                {isEyeTrackingAvailable ? "Eye Tracking Active" : "Tracking Unavailable"}
              </span>
            </div>
          </div>

          {/* Controlled Stable Reading Text Viewport */}
          <div
            ref={textContainerRef}
            onMouseMove={handleMouseMove}
            className="relative mx-auto rounded-2xl border-2 border-slate-200 bg-white p-10 select-none shadow-md space-y-6"
            style={{ width: CONTAINER_WIDTH, minHeight: CONTAINER_HEIGHT }}
          >
            <h2 className="text-xl font-serif font-bold text-slate-900 border-b border-slate-100 pb-3">
              {selectedPassage.title}
            </h2>

            {/* Paragraphs with data attributes for AOI extraction */}
            <div className="space-y-5 text-lg leading-[1.8] text-slate-800 font-serif">
              {selectedPassage.paragraphs.map((p, pIdx) => {
                const words = p.split(" ");
                return (
                  <p
                    key={`p_${pIdx}`}
                    data-line-index={pIdx}
                    data-paragraph-index={pIdx}
                    className="indent-6"
                  >
                    {words.map((word, wIdx) => (
                      <span
                        key={`w_${pIdx}_${wIdx}`}
                        data-word-index={wIdx}
                        data-line-index={pIdx}
                        data-paragraph-index={pIdx}
                        className="inline-block mr-1.5"
                      >
                        {word}
                      </span>
                    ))}
                  </p>
                );
              })}
            </div>

            {/* Finish Reading Button */}
            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={finishReading}
                className="inline-flex items-center gap-2 rounded-xl bg-eyecog-teal px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-600 transition cursor-pointer"
              >
                <span>I Have Finished Reading</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {!isEyeTrackingAvailable && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-1 text-xs font-bold text-white shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Eye tracking unavailable. Keep face centered on screen.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: 5 COMPREHENSION QUESTIONS                                        */}
      {/* ========================================================================= */}
      {phase === "questions" && currentQuestion && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white px-6 py-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 uppercase tracking-wider">
                Comprehension Assessment
              </span>
              <span className="font-mono text-sm font-bold text-slate-800">
                Question {questionIndex + 1} of {selectedPassage.questions.length}
              </span>
            </div>

            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 uppercase">
              {currentQuestion.type.replace(/_/g, " ")}
            </span>
          </div>

          <div
            ref={textContainerRef}
            onMouseMove={handleMouseMove}
            className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md space-y-6"
            style={{ width: CONTAINER_WIDTH, minHeight: 380, margin: "0 auto" }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Question {questionIndex + 1}:</p>
              <h3 className="mt-1 text-lg font-bold text-slate-800 leading-snug">
                {currentQuestion.question}
              </h3>
            </div>

            {/* 4 Multiple Choice Options (A, B, C, D) */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {currentQuestion.options.map((optionText, optIdx) => {
                const isSelected = questionFeedback !== null && questionFeedback.selected === optIdx;
                let optClass = "border-slate-200 bg-slate-50 text-slate-700 hover:border-eyecog-teal hover:bg-teal-50/50";

                if (isSelected) {
                  optClass = questionFeedback.correct
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400"
                    : "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-400";
                }

                return (
                  <button
                    key={`opt_${optIdx}`}
                    type="button"
                    onClick={(e) => handleAnswerQuestion(optIdx, e)}
                    disabled={questionFeedback !== null}
                    className={`flex items-center gap-4 rounded-xl border p-4 text-left text-sm font-medium transition-all cursor-pointer ${optClass}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-300 font-mono font-bold text-xs text-slate-700">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1">{optionText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 4: COMPREHENSIVE READING & COMPREHENSION RESULTS                    */}
      {/* ========================================================================= */}
      {phase === "results" && sessionRecord && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  VISIONEXIS Reading &amp; Comprehension Results
                </h1>
                <p className="text-xs text-slate-500">
                  Observed reading eye-movement metrics, words per minute, and comprehension accuracy.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyResultsJSON}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "JSON Copied" : "Export Full JSON"}
              </button>

              <button
                type="button"
                onClick={startReading}
                className="flex items-center gap-1.5 rounded-lg border border-eyecog-teal bg-white px-3.5 py-2 text-xs font-bold text-eyecog-teal hover:bg-teal-50 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Run Again
              </button>

              <button
                type="button"
                onClick={handleProceedToReport}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
              >
                View Overall Patient Report <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/assessment")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              >
                Assessment Hub
              </button>
            </div>
          </div>

          {completionError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{completionError}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (sessionRecord) {
                    completeMutation.mutate({
                      accuracy_pct: sessionRecord.derivedMetrics.overallComprehensionAccuracyPct,
                      rt_ms: sessionRecord.derivedMetrics.meanQuestionReactionTimeMs,
                      scan_path_json: JSON.stringify(sessionRecord.rawGazeSamples.slice(-600)),
                      comparison_json: JSON.stringify(sessionRecord),
                    });
                  }
                }}
                className="rounded bg-rose-600 px-3 py-1 font-bold text-white hover:bg-rose-700 transition"
              >
                Retry Finalizing Report
              </button>
            </div>
          )}

          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Reading Speed</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">
                {sessionRecord.derivedMetrics.wordsPerMinute} WPM
              </p>
              <p className="text-[9px] text-slate-400">Words / minute</p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Comprehension</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionRecord.derivedMetrics.overallComprehensionAccuracyPct}%
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionRecord.derivedMetrics.correctQuestionsCount}/{sessionRecord.passage.questions.length} Correct
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Reading Time</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {(sessionRecord.readingTimeMs / 1000).toFixed(1)}s
              </p>
              <p className="text-[9px] text-slate-400">
                Active: {(sessionRecord.activeReadingTimeMs / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Fixations</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionRecord.derivedMetrics.totalFixationCount}
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionRecord.derivedMetrics.fixationsPer100Words} / 100w
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Fixation Dur</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionRecord.derivedMetrics.meanFixationDurationMs} ms
              </p>
              <p className="text-[9px] text-slate-400">
                Med: {sessionRecord.derivedMetrics.medianFixationDurationMs}ms
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Regressions</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-rose-600">
                {sessionRecord.derivedMetrics.totalRegressionsCount}
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionRecord.derivedMetrics.regressionsPer100Words} / 100w
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Coverage</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-emerald-600">
                {sessionRecord.derivedMetrics.readingCoveragePct}%
              </p>
              <p className="text-[9px] text-slate-400">Lines Visited</p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Data Quality</p>
              <p className={`mt-1 font-mono text-lg font-extrabold ${
                sessionRecord.dataQuality.qualityRating === "GOOD" ? "text-emerald-600" : "text-amber-600"
              }`}>
                {sessionRecord.dataQuality.qualityRating}
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionRecord.dataQuality.gazeAvailabilityPct}% valid
              </p>
            </div>
          </div>

          {/* Line-by-Line Gaze Dwell Time & Revisit Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlignLeft className="h-5 w-5 text-eyecog-teal" />
              Line-by-Line Reading Gaze Dwell Times &amp; Transitions
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Line</th>
                    <th className="px-4 py-2.5 font-bold">Dwell Time</th>
                    <th className="px-4 py-2.5 font-bold">Fixations</th>
                    <th className="px-4 py-2.5 font-bold">Mean Fixation</th>
                    <th className="px-4 py-2.5 font-bold">Revisits</th>
                    <th className="px-4 py-2.5 font-bold">First Fixation</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sessionRecord.lineMetrics.map((l) => (
                    <tr key={`line_row_${l.lineIndex}`} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-slate-900">Line {l.lineIndex + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-eyecog-teal">{l.dwellTimeMs} ms</td>
                      <td className="px-4 py-2.5">{l.fixationCount}</td>
                      <td className="px-4 py-2.5">{l.meanFixationDurationMs} ms</td>
                      <td className="px-4 py-2.5">{l.revisitCount}</td>
                      <td className="px-4 py-2.5">{l.firstFixationTimeMs} ms</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.isVisited ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                        }`}>
                          {l.isVisited ? "VISITED ✓" : "SKIPPED"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comprehension Questions Breakdown by Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-eyecog-teal" />
                Comprehension Accuracy by Question Type
              </h2>
              <div className="space-y-2 text-xs font-mono">
                {Object.entries(sessionRecord.derivedMetrics.accuracyByQuestionType).map(([type, stats]) => (
                  <div key={type} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700 uppercase text-[11px]">
                      {type.replace(/_/g, " ")}
                    </span>
                    <span className="font-bold text-slate-900">
                      {stats.correct}/{stats.total} ({stats.accuracyPct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reading Dynamics Summary Card */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm space-y-2.5">
              <h2 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                <Eye className="h-4 w-4 text-eyecog-teal" />
                Reading Behavior vs. Comprehension Summary
              </h2>
              <p className="text-xs text-teal-900 leading-relaxed">
                The participant completed the passage in <strong>{(sessionRecord.readingTimeMs / 1000).toFixed(1)} seconds</strong> (approx. <strong>{sessionRecord.derivedMetrics.wordsPerMinute} WPM</strong>), exhibiting <strong>{sessionRecord.derivedMetrics.totalRegressionsCount} regressions</strong> ({sessionRecord.derivedMetrics.regressionsPer100Words} per 100 words) and achieving a <strong>{sessionRecord.derivedMetrics.overallComprehensionAccuracyPct}% comprehension score</strong>.
              </p>
              <div className="rounded-lg bg-white/80 border border-teal-200 p-3 text-xs font-mono flex justify-between items-center text-teal-950">
                <span>Progressive Saccades: <strong>{sessionRecord.derivedMetrics.progressiveSaccadesCount}</strong></span>
                <span>Return Sweeps: <strong>{sessionRecord.derivedMetrics.totalReturnSweepsCount}</strong></span>
              </div>
              <p className="text-[11px] text-teal-700 italic">
                *Note: Experimental eye-movement analysis for behavioral observation; does not diagnose dyslexia, reading disorder, or cognitive impairment.
              </p>
            </div>
          </div>

          {/* Interactive Gaze Heatmap & Scanpath Inspector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Layers className="h-5 w-5 text-eyecog-teal" />
                Passage Gaze Heatmap &amp; Saccade Scanpath Inspector
              </h2>
              <p className="text-xs text-slate-500">
                Inspect spatial gaze density, progressive/regressive saccade paths, line transitions, and AOIs.
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <ReadingVisualizer
                sessionRecord={sessionRecord}
                width={720}
                height={480}
              />
            </div>
          </div>

          {/* Research & Non-Medical Disclaimer Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>VISIONEXIS Research Notice:</strong> This reading and comprehension assessment is an experimental software-based eye-movement and cognitive-task analysis tool for research and behavioral investigation. It does not provide medical or clinical diagnosis of dyslexia, ADHD, autism, memory disorders, neurological disorders, or cognitive impairment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
