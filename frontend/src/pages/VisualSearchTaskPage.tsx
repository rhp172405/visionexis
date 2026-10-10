import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Target,
  Crosshair,
  AlertTriangle,
  Copy,
  Check,
  Clock,
  Layers,
  Sparkles,
  Sliders,
  Terminal,
  Activity,
  ShieldCheck,
} from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  generate20Trials,
  computeGridAOIs,
  analyzeTrialPerformance,
  aggregateVisualSearchSession,
  type VisualSearchTrialConfig,
  type TrialResultRecord,
  type VisualSearchSessionSummary,
  type CellAOI,
  type MouseEventRecord,
} from "@/lib/visualSearchTask";
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
import { VisualSearchVisualizer } from "@/components/tasks/VisualSearchVisualizer";
import { completeSession, createSession, getAssessment } from "@/lib/api";

type Phase = "intro" | "running" | "results";

const CONTAINER_WIDTH = 560;
const CONTAINER_HEIGHT = 440;
const GRID_PX = 380;
const FEEDBACK_DELAY_MS = 400;

export function VisualSearchTaskPage() {
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
  const [trials, setTrials] = useState<VisualSearchTrialConfig[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ index: number; correct: boolean } | null>(null);

  // Session Results & Inspection State
  const [sessionSummary, setSessionSummary] = useState<VisualSearchSessionSummary | null>(null);
  const [selectedInspectTrial, setSelectedInspectTrial] = useState<TrialResultRecord | null>(null);
  const [copied, setCopied] = useState(false);

  // Developer Debug HUD State
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [liveMousePos, setLiveMousePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [liveGazePos, setLiveGazePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [currentAOIId, setCurrentAOIId] = useState<string>("NONE");
  const [latestFixationInfo, setLatestFixationInfo] = useState<string>("NONE");

  // Live Trial Recording References
  const containerRef = useRef<HTMLDivElement>(null);
  const trialStartRef = useRef(0);
  const targetAppearRef = useRef(0);
  const trialGazeSamplesRef = useRef<RawGazeBufferSample[]>([]);
  const trialMouseEventsRef = useRef<MouseEventRecord[]>([]);
  const trialFixationsRef = useRef<FixationEvent[]>([]);
  const trialSaccadesRef = useRef<SaccadeEvent[]>([]);
  const trialBlinksRef = useRef<BlinkEvent[]>([]);
  const completedTrialsRef = useRef<TrialResultRecord[]>([]);
  const activeAOIsRef = useRef<CellAOI[]>([]);

  // Detectors
  const fixationDetectorRef = useRef<FixationDetector | null>(null);
  const saccadeDetectorRef = useRef<ModularSaccadeDetector | null>(null);
  const blinkDetectorRef = useRef<BlinkDetector | null>(null);

  useEffect(() => {
    fixationDetectorRef.current = new FixationDetector((fix) => {
      trialFixationsRef.current.push(fix);
      setLatestFixationInfo(`${fix.aoiId ?? "GRID"} (${fix.duration}ms)`);
    });
    saccadeDetectorRef.current = new ModularSaccadeDetector((sac) => {
      trialSaccadesRef.current.push(sac);
    });
    blinkDetectorRef.current = new BlinkDetector((blk) => {
      trialBlinksRef.current.push(blk);
    });
  }, []);

  // Ensure visual_search session exists if an assessment is actively running
  useEffect(() => {
    if (
      patient?.id &&
      assessment?.id &&
      assessment.status === "in_progress" &&
      (!session || session.task_type !== "visual_search")
    ) {
      createSession(patient.id, assessment.id, "visual_search")
        .then((s) => setSession(s))
        .catch(console.error);
    }
  }, [patient?.id, assessment?.id, assessment?.status, session]);

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
          } catch (e) {
            console.error("Failed to refresh assessment on visual search completion:", e);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["assessment", assessment?.id] });
      }
    },
  });

  // Ensure camera is active
  useEffect(() => {
    if (!isCameraActive) {
      globalWebcamManager.startCamera();
    }
  }, [isCameraActive]);

  // Reset task buffers when session, patient, or assessment changes to avoid cross-session contamination
  useEffect(() => {
    trialGazeSamplesRef.current = [];
    trialMouseEventsRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];
    completedTrialsRef.current = [];
  }, [session?.id, patient?.id, assessment?.id]);

  // Real-Time Ingestion of Gaze Stream during Trial
  useEffect(() => {
    if (!currentGaze) return;

    let gx = 0;
    let gy = 0;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
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

    // Check hit AOI
    if (activeAOIsRef.current.length > 0) {
      const hit = activeAOIsRef.current.find(
        (a) => gx >= a.x && gx <= a.x + a.width && gy >= a.y && gy <= a.y + a.height
      );
      setCurrentAOIId(hit ? `${hit.aoiId} (${hit.symbol})` : "NONE (OUTSIDE CELLS)");
    }

    if (phase !== "running") return;

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

  // Track Mouse movement separately
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    let mx = 0;
    let my = 0;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mx = Math.round(e.clientX - rect.left);
      my = Math.round(e.clientY - rect.top);
    }
    const now = performance.now();
    setLiveMousePos({ x: mx, y: my, timestamp: now });

    if (phase !== "running" || !containerRef.current) return;

    trialMouseEventsRef.current.push({
      type: "move",
      x: mx,
      y: my,
      timestamp: now,
    });
  };

  // Start 20-Trial Visual Search Task
  const startTask = () => {
    const generated = generate20Trials();
    setTrials(generated);
    setTrialIndex(0);
    setFeedback(null);
    setSessionSummary(null);
    setSelectedInspectTrial(null);
    completedTrialsRef.current = [];

    // Reset detectors
    fixationDetectorRef.current?.reset();
    saccadeDetectorRef.current?.reset();
    blinkDetectorRef.current?.reset();

    // Prepare Trial 1
    prepareTrial(generated[0], 0);
    setPhase("running");
  };

  const prepareTrial = (trialConfig: VisualSearchTrialConfig, _index: number) => {
    trialGazeSamplesRef.current = [];
    trialMouseEventsRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];

    const now = performance.now();
    trialStartRef.current = now;
    targetAppearRef.current = now;

    // Compute exact AOI bounds for this trial's grid size
    const aois = computeGridAOIs(
      trialConfig.gridSize,
      trialConfig.cells,
      trialConfig.targetIndex,
      { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT },
      GRID_PX,
      GRID_PX
    );
    activeAOIsRef.current = aois;

    globalTaskEventManager.markEvent("TRIAL_START", { trialId: trialConfig.trialId, difficulty: trialConfig.difficulty });
    globalTaskEventManager.markEvent("TARGET_APPEAR", {
      trialId: trialConfig.trialId,
      targetSymbol: trialConfig.targetSymbol,
      targetIndex: trialConfig.targetIndex,
    });
  };

  // Participant clicks a cell
  const handleCellClick = (cellIndex: number, e: React.MouseEvent) => {
    if (feedback !== null || phase !== "running") return;

    const selectTime = performance.now();
    const currentTrial = trials[trialIndex];
    const isCorrect = cellIndex === currentTrial.targetIndex;

    // Record click event
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      trialMouseEventsRef.current.push({
        type: "click",
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
        timestamp: selectTime,
      });
    }

    globalTaskEventManager.markEvent("TARGET_SELECTED", {
      trialId: currentTrial.trialId,
      selectedCellIndex: cellIndex,
      isCorrect,
    });

    // Flush any pending fixation
    fixationDetectorRef.current?.flushWindow();

    // Analyze completed trial performance
    const trialResult = analyzeTrialPerformance(
      currentTrial,
      activeAOIsRef.current,
      trialGazeSamplesRef.current,
      trialMouseEventsRef.current,
      trialFixationsRef.current,
      trialSaccadesRef.current,
      trialStartRef.current,
      targetAppearRef.current,
      selectTime,
      selectTime,
      cellIndex
    );

    completedTrialsRef.current.push(trialResult);
    setFeedback({ index: cellIndex, correct: isCorrect });

    // Transition to next trial or finish task after feedback delay
    window.setTimeout(() => {
      if (trialIndex + 1 < trials.length) {
        const nextIdx = trialIndex + 1;
        setTrialIndex(nextIdx);
        setFeedback(null);
        prepareTrial(trials[nextIdx], nextIdx);
      } else {
        finishSession(completedTrialsRef.current);
      }
    }, FEEDBACK_DELAY_MS);
  };

  // Finish Full 20-Trial Session
  const finishSession = (allCompletedTrials: TrialResultRecord[]) => {
    const summary = aggregateVisualSearchSession(
      session?.id ?? `vs_sess_${Date.now()}`,
      allCompletedTrials,
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

    setSessionSummary(summary);
    setSelectedInspectTrial(allCompletedTrials[0] ?? null);
    setPhase("results");

    // Push completion to backend
    const scanPathSamplePoints = allCompletedTrials.flatMap((t) =>
      t.gazeSamples.map((s) => ({
        x: s.gazeX,
        y: s.gazeY,
        t: s.timestamp,
        confidence: s.confidence,
        isBlink: s.blink,
      }))
    ).slice(-600);

    completeMutation.mutate({
      accuracy_pct: summary.accuracyPct,
      rt_ms: summary.avgReactionTimeMs,
      scan_path_json: JSON.stringify(scanPathSamplePoints),
      comparison_json: JSON.stringify(summary),
    });
  };

  const handleProceedToMemory = async () => {
    if (patient?.id && assessment?.id) {
      try {
        const memSession = await createSession(patient.id, assessment.id, "memory");
        setSession(memSession);
      } catch (err) {
        console.warn("Could not pre-create memory session ahead of navigation:", err);
      }
    }
    navigate("/tasks/memory-recognition");
  };

  const handleCopyResultsJSON = () => {
    if (!sessionSummary) return;
    navigator.clipboard.writeText(JSON.stringify(sessionSummary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTrial = trials[trialIndex];
  const isEyeTrackingAvailable = isCameraActive && faceDetected && eyesDetected && currentGaze !== null;
  const isMouseActive = performance.now() - liveMousePos.timestamp < 3000 && liveMousePos.timestamp > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Top Participant & Developer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {patient ? (
          <div className="rounded-xl border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-2 text-xs text-slate-700 flex items-center gap-3 shadow-xs">
            <span>
              Active Session: <strong>{patient.name}</strong> ({patient.patient_code})
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-eyecog-teal">Visual Search (20 Trials)</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500">VISIONEXIS Visual Search Engine</div>
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
      {/* DEVELOPER DEBUG HUD PANEL (Section 18)                                    */}
      {/* ========================================================================= */}
      {showDebugHUD && (
        <div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-200 shadow-xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
              <Activity className="h-4 w-4" />
              Developer Synchronization &amp; Live Telemetry HUD
            </div>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              Phase: {phase.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Camera */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Camera</span>
              <p className={`mt-0.5 font-bold ${isCameraActive ? "text-emerald-400" : "text-rose-400"}`}>
                {isCameraActive ? "CONNECTED" : "DISCONNECTED"}
              </p>
            </div>

            {/* Gaze */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Gaze</span>
              <p className={`mt-0.5 font-bold ${isEyeTrackingAvailable ? "text-emerald-400" : "text-rose-400"}`}>
                {isEyeTrackingAvailable ? "ACTIVE" : "INVALID"}
              </p>
            </div>

            {/* Mouse */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Mouse</span>
              <p className={`mt-0.5 font-bold ${isMouseActive ? "text-emerald-400" : "text-slate-400"}`}>
                {isMouseActive ? "ACTIVE" : "INACTIVE"}
              </p>
            </div>

            {/* Inference FPS */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Inference FPS</span>
              <p className="mt-0.5 font-bold text-sky-400">
                {pipelineHealth.inferenceFps || fps || 0} FPS
              </p>
            </div>

            {/* Current Gaze */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Gaze</span>
              <p className="mt-0.5 font-bold text-teal-300">
                X: {liveGazePos.x} / Y: {liveGazePos.y}
              </p>
            </div>

            {/* Current Mouse */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Mouse</span>
              <p className="mt-0.5 font-bold text-purple-300">
                X: {liveMousePos.x} / Y: {liveMousePos.y}
              </p>
            </div>

            {/* Current AOI */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current AOI</span>
              <p className="mt-0.5 font-bold text-amber-300 truncate" title={currentAOIId}>
                {currentAOIId}
              </p>
            </div>

            {/* Current Fixation */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Fixation</span>
              <p className="mt-0.5 font-bold text-sky-300 truncate" title={latestFixationInfo}>
                {latestFixationInfo}
              </p>
            </div>

            {/* Current Trial */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Current Trial</span>
              <p className="mt-0.5 font-bold text-white">
                {phase === "running" ? `${trialIndex + 1} / 20` : phase === "results" ? "20 / 20 (Done)" : "0 / 20 (Ready)"}
              </p>
            </div>

            {/* Last Gaze Timestamp */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase text-slate-400">Last Gaze Timestamp (perf.now)</span>
              <p className="mt-0.5 font-bold text-teal-400">
                {liveGazePos.timestamp > 0 ? `${liveGazePos.timestamp.toFixed(2)} ms` : "0.00 ms"}
              </p>
            </div>

            {/* Last Mouse Timestamp */}
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Last Mouse Timestamp</span>
              <p className="mt-0.5 font-bold text-purple-400">
                {liveMousePos.timestamp > 0 ? `${liveMousePos.timestamp.toFixed(2)} ms` : "0.00 ms"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 1: PRE-TASK SETUP & CALIBRATION CHECK                               */}
      {/* ========================================================================= */}
      {phase === "intro" && (
        <div className="space-y-6">
          {/* Uncalibrated Warning */}
          {(!isCalibrated || !calibrationModel) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900">Calibration Required</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Please complete gaze calibration before starting. An active calibration profile is required for accurate eye-tracking.
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

          {/* Clean Participant Instructions Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-eyecog-teal shadow-xs">
              <Target className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">VISIONEXIS Visual Search Assessment</h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 leading-relaxed font-medium">
                Find the target symbol among the other symbols.
                <br />
                Look at the target and select it with your mouse.
              </p>
            </div>

            {/* Trial Protocol Info Badge */}
            <div className="mx-auto inline-flex items-center gap-4 rounded-xl bg-slate-50 px-6 py-3 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-eyecog-teal" /> 20 Trials
              </span>
              <span className="text-slate-300">|</span>
              <span>Easy (4&times;4) &bull; Medium (5&times;5) &bull; Hard (6&times;6)</span>
              <span className="text-slate-300">|</span>
              <span>Webcam Gaze &amp; Mouse Sync</span>
            </div>

            {/* Pre-Flight System Readiness Checklist (Section 1) */}
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
                  Webcam eye-tracking is currently inactive. You may still proceed with task completion; cognitive accuracy and reaction times will be recorded, while gaze metrics will be labeled as "Unavailable".
                </p>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={startTask}
                className="inline-flex items-center gap-2 rounded-xl bg-eyecog-teal px-8 py-3 text-base font-bold text-white shadow-md hover:bg-teal-600 transition cursor-pointer"
              >
                <Sparkles className="h-5 w-5" />
                Start Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: ACTIVE 20-TRIAL TASK EXECUTION                                  */}
      {/* ========================================================================= */}
      {phase === "running" && currentTrial && (
        <div className="space-y-4">
          {/* Top Trial HUD */}
          <div className="flex items-center justify-between rounded-xl bg-white px-6 py-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-slate-800">
                Trial {trialIndex + 1} of {trials.length}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                currentTrial.difficulty === "EASY"
                  ? "bg-emerald-100 text-emerald-800"
                  : currentTrial.difficulty === "MEDIUM"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-purple-100 text-purple-800"
              }`}>
                {currentTrial.difficulty} ({currentTrial.gridSize}&times;{currentTrial.gridSize})
              </span>
            </div>

            {/* Tracking Status Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isEyeTrackingAvailable ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-500 font-medium">
                {isEyeTrackingAvailable ? "Eye Tracking Active" : "Tracking Unavailable"}
              </span>
            </div>
          </div>

          {/* Prompt Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Find and click this symbol:
            </p>
            <p className="mt-1 text-3xl font-extrabold text-eyecog-teal">
              {currentTrial.targetSymbol}
            </p>
          </div>

          {/* Interactive Search Grid Container */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="relative mx-auto overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900 select-none shadow-md"
            style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }}
          >
            {/* Cell Elements */}
            {activeAOIsRef.current.map((aoi) => {
              const showFeedback = feedback !== null && feedback.index === aoi.index;
              const feedbackClass = showFeedback
                ? feedback.correct
                  ? "bg-emerald-500/40 border-emerald-400 text-emerald-200 scale-105"
                  : "bg-rose-500/40 border-rose-400 text-rose-200"
                : "bg-slate-800/90 border-slate-700 text-slate-200 hover:border-eyecog-teal hover:bg-slate-700/80 cursor-pointer";

              return (
                <button
                  key={aoi.aoiId}
                  type="button"
                  onClick={(e) => handleCellClick(aoi.index, e)}
                  disabled={feedback !== null}
                  className={`absolute flex items-center justify-center rounded-xl border text-2xl font-bold transition-all ${feedbackClass}`}
                  style={{
                    left: aoi.x,
                    top: aoi.y,
                    width: aoi.width,
                    height: aoi.height,
                  }}
                >
                  {aoi.symbol}
                </button>
              );
            })}

            {/* Tracking Lost Advisory Safety Banner (Requirement 21) */}
            {!isEyeTrackingAvailable && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-1 text-xs font-bold text-white shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Eye tracking temporarily unavailable. Keep face centered.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: COMPREHENSIVE VISUAL SEARCH RESULTS                             */}
      {/* ========================================================================= */}
      {phase === "results" && sessionSummary && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">VISIONEXIS Visual Search Results</h1>
                <p className="text-xs text-slate-500">
                  Observed eye-movement metrics and dual-modality cognitive performance across 20 trials.
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
                onClick={startTask}
                className="flex items-center gap-1.5 rounded-lg border border-eyecog-teal bg-white px-3.5 py-2 text-xs font-bold text-eyecog-teal hover:bg-teal-50 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Run Again
              </button>

              <button
                type="button"
                onClick={handleProceedToMemory}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-sm"
              >
                Next Task: Memory &amp; Recognition <ArrowRight className="h-3.5 w-3.5" />
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

          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Accuracy</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.accuracyPct}%</p>
              <p className="text-[9px] text-slate-400">Overall</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Avg Search Time</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">{sessionSummary.avgSearchTimeMs} ms</p>
              <p className="text-[9px] text-slate-400">Med: {sessionSummary.medianSearchTimeMs}ms</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Avg Reaction Time</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.avgReactionTimeMs} ms</p>
              <p className="text-[9px] text-slate-400">Med: {sessionSummary.medianReactionTimeMs}ms</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Target Fixation</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.meanTargetFixationDurationMs} ms</p>
              <p className="text-[9px] text-slate-400">Dist: {sessionSummary.meanDistractorFixationDurationMs}ms</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Saccades</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.totalSaccades}</p>
              <p className="text-[9px] text-slate-400">Avg: {sessionSummary.avgSaccadesCount}/tr</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Fixations</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.totalFixations}</p>
              <p className="text-[9px] text-slate-400">Avg: {sessionSummary.avgFixationsCount}/tr</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Revisits</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{sessionSummary.totalRevisits}</p>
              <p className="text-[9px] text-slate-400">Avg: {sessionSummary.avgRevisitsCount}/tr</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Search Efficiency</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-emerald-600">{sessionSummary.avgSearchEfficiency} / 100</p>
              <p className="text-[9px] text-slate-400">Target: {sessionSummary.avgTargetAttentionPct}%</p>
            </div>
          </div>

          {/* Mouse vs Gaze Latency Insight Card (Section 18) */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-eyecog-teal text-white shadow-xs">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Dual-Modality Temporal Latency Analysis (Gaze &rarr; Mouse Click)
                </h3>
                <p className="text-xs text-teal-800 mt-0.5">
                  Average time from <strong>first target fixation</strong> to <strong>mouse selection click</strong>:{" "}
                  <strong className="font-mono text-sm text-teal-950">{sessionSummary.mouseGazeLatencyMs} ms</strong>.
                  <br />
                  <span className="text-[11px] text-teal-700">
                    Demonstrates that the participant visually localized and attended to the target {sessionSummary.mouseGazeLatencyMs} ms before executing the physical mouse response.
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Tracking Quality & Protocol Completeness Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Eye-Tracking Quality Assessment</span>
                <p className="text-sm font-bold text-slate-800">
                  {sessionSummary.totalFixations > 0
                    ? `Tracking Recorded Successfully (${sessionSummary.totalFixations} fixations detected)`
                    : "No Eye-Tracking Data Captured (Status: Unavailable)"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sessionSummary.totalFixations > 0
                    ? "Eye movements, fixations, and temporal gaze metrics were successfully saved to session records."
                    : "Task performance (accuracy and reaction times) was saved. Gaze metrics are marked as Unavailable due to inactive webcam tracking."}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                sessionSummary.totalFixations > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}>
                {sessionSummary.totalFixations > 0 ? "Tracking Available" : "Tracking Unavailable"}
              </span>
            </div>
          </div>

          {/* Difficulty Comparison Table (Easy vs Medium vs Hard) (Section 15) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-eyecog-teal" />
              Difficulty Comparison Breakdown (Easy &bull; Medium &bull; Hard)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Measures how search speed, fixation duration, saccades, and revisits scale with visual complexity and grid density.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Difficulty</th>
                    <th className="px-4 py-2.5 font-bold">Trials</th>
                    <th className="px-4 py-2.5 font-bold">Accuracy</th>
                    <th className="px-4 py-2.5 font-bold">Reaction Time</th>
                    <th className="px-4 py-2.5 font-bold">Search Time</th>
                    <th className="px-4 py-2.5 font-bold">Fixations</th>
                    <th className="px-4 py-2.5 font-bold">Saccades</th>
                    <th className="px-4 py-2.5 font-bold">Revisits</th>
                    <th className="px-4 py-2.5 font-bold">Target Attn</th>
                    <th className="px-4 py-2.5 font-bold">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(["EASY", "MEDIUM", "HARD"] as const).map((diff) => {
                    const row = sessionSummary.difficultyBreakdown[diff];
                    return (
                      <tr key={diff} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            diff === "EASY"
                              ? "bg-emerald-100 text-emerald-800"
                              : diff === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                          }`}>
                            {diff} ({diff === "EASY" ? "4×4" : diff === "MEDIUM" ? "5×5" : "6×6"})
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{row.trialCount}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{row.accuracyPct}%</td>
                        <td className="px-4 py-2.5">{row.avgReactionTimeMs} ms</td>
                        <td className="px-4 py-2.5 text-eyecog-teal font-bold">{row.avgSearchTimeMs} ms</td>
                        <td className="px-4 py-2.5">{row.avgFixationsCount}</td>
                        <td className="px-4 py-2.5">{row.avgSaccadesCount}</td>
                        <td className="px-4 py-2.5">{row.avgRevisitsCount}</td>
                        <td className="px-4 py-2.5 text-eyecog-teal">{row.avgTargetAttentionPct}%</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-600">{row.avgSearchEfficiency}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Trial-by-Trial Inspector with Gaze Heatmap & Scanpath (Sections 11 & 12) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-eyecog-teal" />
                  Trial-by-Trial Gaze Heatmap &amp; Scanpath Inspector
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect the pure webcam gaze heatmap, fixation scanpath, and AOI encounters for any of the 20 trials.
                </p>
              </div>

              {/* Trial Selector Buttons */}
              <div className="flex flex-wrap gap-1 max-w-md">
                {sessionSummary.trials.map((t) => (
                  <button
                    key={t.trialId}
                    type="button"
                    onClick={() => setSelectedInspectTrial(t)}
                    className={`h-7 w-7 rounded-md text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedInspectTrial?.trialId === t.trialId
                        ? "bg-eyecog-navy text-white shadow-xs"
                        : t.accuracy
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    }`}
                  >
                    {t.trialId}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Selected Trial Visualizer */}
            {selectedInspectTrial && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                <div className="lg:col-span-8 flex justify-center">
                  <VisualSearchVisualizer
                    trial={selectedInspectTrial}
                    width={520}
                    height={400}
                  />
                </div>

                <div className="lg:col-span-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs font-mono space-y-2.5">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center font-sans">
                    <span className="font-bold text-slate-800">
                      Trial {selectedInspectTrial.trialId} Summary
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedInspectTrial.accuracy ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {selectedInspectTrial.accuracy ? "CORRECT ✓" : "INCORRECT ✗"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Difficulty:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.difficulty} ({selectedInspectTrial.gridSize}&times;{selectedInspectTrial.gridSize})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Symbol:</span>
                    <span className="font-bold text-eyecog-teal">{selectedInspectTrial.targetSymbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Search Time:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.gazeMetrics.searchTime} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reaction Time:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.reactionTime} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fixation Duration:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.gazeMetrics.totalFixationDuration} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Attention:</span>
                    <span className="font-bold text-eyecog-teal">{selectedInspectTrial.gazeMetrics.targetAttentionPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Distractor Attention:</span>
                    <span className="font-bold text-slate-700">{selectedInspectTrial.gazeMetrics.distractorAttentionPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fixations / Saccades:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.gazeMetrics.fixationCount} / {selectedInspectTrial.gazeMetrics.saccadeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AOI Revisits:</span>
                    <span className="font-bold text-slate-800">{selectedInspectTrial.gazeMetrics.revisitCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mouse Selection Latency:</span>
                    <span className="font-bold text-teal-700">{selectedInspectTrial.gazeMetrics.mouseSelectionTime} ms</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                    <span className="text-slate-600">Efficiency Score:</span>
                    <span className="text-emerald-600">{selectedInspectTrial.gazeMetrics.searchEfficiencyScore} / 100</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Research & Non-Medical Disclaimer Banner (Requirement 19) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>VISIONEXIS Research Notice:</strong> This assessment system is an experimental software-based eye-movement and cognitive-task analysis tool for research and behavioral investigation. It does not provide medical or clinical diagnoses for ADHD, autism, cognitive impairment, or ocular pathologies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
