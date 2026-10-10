import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
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
  Eye,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

import { useSessionStore } from "@/stores/sessionStore";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  generateMemoryTaskProtocols,
  computeStimulusAOI,
  analyzeStudyTrialGaze,
  analyzeRecognitionTrial,
  aggregateMemoryRecognitionSession,
  type StudyItemConfig,
  type RecognitionTrialConfig,
  type StudyTrialRecord,
  type RecognitionTrialRecord,
  type MemoryRecognitionSessionSummary,
  type ItemAOI,
  type MouseEventRecord,
  type RecognitionChoice,
} from "@/lib/memoryRecognitionTask";
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
import { MemoryVisualizer } from "@/components/tasks/MemoryVisualizer";
import { completeSession, createSession, getAssessment } from "@/lib/api";

type Phase = "intro" | "study" | "retention" | "recognition" | "results";

const CONTAINER_WIDTH = 640;
const CONTAINER_HEIGHT = 440;
const STIMULUS_SIZE_PX = 150;
const STUDY_ISI_MS = 350; // Inter-stimulus interval
const RETENTION_DURATION_SEC = 4;
const RECOGNITION_FEEDBACK_DELAY_MS = 350;

export function MemoryRecognitionTaskPage() {
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

  // Protocol configs
  const [studyProtocols, setStudyProtocols] = useState<StudyItemConfig[]>([]);
  const [recognitionProtocols, setRecognitionProtocols] = useState<RecognitionTrialConfig[]>([]);
  const [sessionSeed, setSessionSeed] = useState(0);

  // Active indices
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyBlank, setStudyBlank] = useState(false);
  const [retentionCountdown, setRetentionCountdown] = useState(RETENTION_DURATION_SEC);
  const [recIndex, setRecIndex] = useState(0);
  const [recFeedback, setRecFeedback] = useState<{ choice: RecognitionChoice; isCorrect: boolean } | null>(null);

  // Results & Inspector
  const [sessionSummary, setSessionSummary] = useState<MemoryRecognitionSessionSummary | null>(null);
  const [inspectTab, setInspectTab] = useState<"study" | "recognition">("recognition");
  const [selectedStudyTrial, setSelectedStudyTrial] = useState<StudyTrialRecord | null>(null);
  const [selectedRecTrial, setSelectedRecTrial] = useState<RecognitionTrialRecord | null>(null);
  const [copied, setCopied] = useState(false);

  // Developer Debug HUD State
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [liveMousePos, setLiveMousePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [liveGazePos, setLiveGazePos] = useState({ x: 0, y: 0, timestamp: 0 });
  const [currentAOIId, setCurrentAOIId] = useState<string>("NONE");

  // Recording References
  const containerRef = useRef<HTMLDivElement>(null);
  const trialStartRef = useRef(0);
  const completedStudyRecordsRef = useRef<StudyTrialRecord[]>([]);
  const completedRecRecordsRef = useRef<RecognitionTrialRecord[]>([]);
  const retentionIntervalRef = useRef({ startTime: 0, endTime: 0, durationMs: 0 });

  const studyProtocolsRef = useRef<StudyItemConfig[]>([]);
  const recognitionProtocolsRef = useRef<RecognitionTrialConfig[]>([]);
  const retentionTimerRef = useRef<number | null>(null);
  const activeTimersRef = useRef<number[]>([]);

  const trialGazeSamplesRef = useRef<RawGazeBufferSample[]>([]);
  const trialMouseEventsRef = useRef<MouseEventRecord[]>([]);
  const trialFixationsRef = useRef<FixationEvent[]>([]);
  const trialSaccadesRef = useRef<SaccadeEvent[]>([]);
  const trialBlinksRef = useRef<BlinkEvent[]>([]);
  const activeAOIRef = useRef<ItemAOI | null>(null);

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

    return () => {
      if (retentionTimerRef.current) {
        clearInterval(retentionTimerRef.current);
        retentionTimerRef.current = null;
      }
      activeTimersRef.current.forEach((t) => clearTimeout(t));
      activeTimersRef.current = [];
    };
  }, []);

  // Ensure memory session exists if an assessment is actively running
  useEffect(() => {
    if (
      patient?.id &&
      assessment?.id &&
      assessment.status === "in_progress" &&
      (!session || session.task_type !== "memory")
    ) {
      createSession(patient.id, assessment.id, "memory")
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
            console.error("Failed to refresh assessment on memory completion:", e);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["assessment", assessment?.id] });
      }
    },
  });

  // Ensure webcam is active
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
    completedStudyRecordsRef.current = [];
    completedRecRecordsRef.current = [];
  }, [session?.id, patient?.id, assessment?.id]);

  // Real-time Gaze Stream ingestion
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
    if (activeAOIRef.current) {
      const aoi = activeAOIRef.current;
      const hit = gx >= aoi.x && gx <= aoi.x + aoi.width && gy >= aoi.y && gy <= aoi.y + aoi.height;
      setCurrentAOIId(hit ? `${aoi.aoiId} (INSIDE)` : "OUTSIDE AOI");
    } else {
      setCurrentAOIId("NONE");
    }

    if (phase !== "study" && phase !== "recognition") return;

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
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mx = Math.round(e.clientX - rect.left);
      my = Math.round(e.clientY - rect.top);
    }
    const now = performance.now();
    setLiveMousePos({ x: mx, y: my, timestamp: now });

    if (phase !== "recognition" || !containerRef.current) return;

    trialMouseEventsRef.current.push({
      type: "move",
      x: mx,
      y: my,
      timestamp: now,
    });
  };

  // ---------------------------------------------------------------------------
  // TASK CONTROLLER
  // ---------------------------------------------------------------------------

  const startTask = () => {
    if (retentionTimerRef.current) {
      clearInterval(retentionTimerRef.current);
      retentionTimerRef.current = null;
    }
    activeTimersRef.current.forEach((t) => clearTimeout(t));
    activeTimersRef.current = [];

    const seed = Math.floor(Math.random() * 1000000);
    setSessionSeed(seed);
    const protocols = generateMemoryTaskProtocols(seed, {
      width: CONTAINER_WIDTH,
      height: CONTAINER_HEIGHT,
    });

    studyProtocolsRef.current = protocols.studyTrials;
    recognitionProtocolsRef.current = protocols.recognitionTrials;
    setStudyProtocols(protocols.studyTrials);
    setRecognitionProtocols(protocols.recognitionTrials);

    completedStudyRecordsRef.current = [];
    completedRecRecordsRef.current = [];
    setSessionSummary(null);
    setRecFeedback(null);

    // Reset detectors
    fixationDetectorRef.current?.reset();
    saccadeDetectorRef.current?.reset();
    blinkDetectorRef.current?.reset();

    globalTaskEventManager.markEvent("SESSION_START", { task: "memory_recognition", seed });
    globalTaskEventManager.markEvent("STUDY_START", { totalStudyItems: 20 });

    // Begin Study Phase with Item 1
    setPhase("study");
    setStudyIndex(0);
    runStudyItem(protocols.studyTrials[0], 0, protocols.studyTrials, protocols.recognitionTrials);
  };

  // Study Item Execution
  const runStudyItem = (
    itemConfig: StudyItemConfig,
    idx: number,
    allItems: StudyItemConfig[],
    recItems?: RecognitionTrialConfig[]
  ) => {
    setStudyBlank(false);
    trialGazeSamplesRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];

    const now = performance.now();
    trialStartRef.current = now;

    const aoi = computeStimulusAOI(
      itemConfig.stimulus.id,
      itemConfig.position.x,
      itemConfig.position.y,
      STIMULUS_SIZE_PX,
      { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }
    );
    activeAOIRef.current = aoi;

    globalTaskEventManager.markEvent("STUDY_ITEM_APPEAR", {
      studyIndex: itemConfig.studyIndex,
      itemId: itemConfig.stimulus.id,
      category: itemConfig.stimulus.category,
    });

    // Display for item duration
    const displayTimer = window.setTimeout(() => {
      const endTime = performance.now();
      globalTaskEventManager.markEvent("STUDY_ITEM_END", { studyIndex: itemConfig.studyIndex });
      fixationDetectorRef.current?.flushWindow();

      // Analyze and store study trial gaze
      const record = analyzeStudyTrialGaze(
        itemConfig,
        aoi,
        [...trialGazeSamplesRef.current],
        [...trialFixationsRef.current],
        [...trialSaccadesRef.current],
        trialStartRef.current,
        endTime
      );
      completedStudyRecordsRef.current.push(record);

      // Blank transition
      setStudyBlank(true);
      activeAOIRef.current = null;

      const isiTimer = window.setTimeout(() => {
        if (idx + 1 < allItems.length) {
          const nextIdx = idx + 1;
          setStudyIndex(nextIdx);
          runStudyItem(allItems[nextIdx], nextIdx, allItems, recItems);
        } else {
          // Study Phase Complete -> Enter Retention Interval
          enterRetentionPhase(recItems);
        }
      }, STUDY_ISI_MS);
      activeTimersRef.current.push(isiTimer);
    }, itemConfig.durationMs);
    activeTimersRef.current.push(displayTimer);
  };

  // Retention Interval Execution
  const enterRetentionPhase = (recTrials?: RecognitionTrialConfig[]) => {
    setPhase("retention");
    activeAOIRef.current = null;
    const now = performance.now();
    retentionIntervalRef.current.startTime = now;
    globalTaskEventManager.markEvent("RETENTION_START", { durationSec: RETENTION_DURATION_SEC });

    const trials =
      recTrials && recTrials.length > 0
        ? recTrials
        : recognitionProtocolsRef.current.length > 0
        ? recognitionProtocolsRef.current
        : recognitionProtocols;

    let countdown = RETENTION_DURATION_SEC;
    setRetentionCountdown(countdown);

    if (retentionTimerRef.current) {
      clearInterval(retentionTimerRef.current);
    }

    retentionTimerRef.current = window.setInterval(() => {
      countdown -= 1;
      setRetentionCountdown(countdown);

      if (countdown <= 0) {
        if (retentionTimerRef.current) {
          clearInterval(retentionTimerRef.current);
          retentionTimerRef.current = null;
        }
        finishRetentionPhase(trials);
      }
    }, 1000);
  };

  const finishRetentionPhase = (recTrials?: RecognitionTrialConfig[]) => {
    const trials =
      recTrials && recTrials.length > 0
        ? recTrials
        : recognitionProtocolsRef.current.length > 0
        ? recognitionProtocolsRef.current
        : recognitionProtocols;

    const now = performance.now();
    retentionIntervalRef.current.endTime = now;
    retentionIntervalRef.current.durationMs = Math.round(now - retentionIntervalRef.current.startTime);
    globalTaskEventManager.markEvent("RETENTION_END", { durationMs: retentionIntervalRef.current.durationMs });

    // Begin Recognition Phase
    setPhase("recognition");
    setRecIndex(0);

    if (trials && trials.length > 0) {
      prepareRecognitionTrial(trials[0], 0);
    } else {
      console.error("[MemoryRecognition] Unable to start recognition phase: trials array is empty.");
    }
  };

  // Recognition Trial Setup
  const prepareRecognitionTrial = (trialConfig?: RecognitionTrialConfig, _idx: number = 0) => {
    if (!trialConfig || !trialConfig.stimulus) {
      console.error("[MemoryRecognition] Invalid trial configuration for recognition trial:", trialConfig);
      return;
    }

    setRecFeedback(null);
    trialGazeSamplesRef.current = [];
    trialMouseEventsRef.current = [];
    trialFixationsRef.current = [];
    trialSaccadesRef.current = [];
    trialBlinksRef.current = [];

    const now = performance.now();
    trialStartRef.current = now;

    // Centered stimulus AOI during recognition
    const aoi = computeStimulusAOI(
      trialConfig.stimulus.id,
      CONTAINER_WIDTH / 2,
      CONTAINER_HEIGHT / 2 - 30,
      STIMULUS_SIZE_PX,
      { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }
    );
    activeAOIRef.current = aoi;

    globalTaskEventManager.markEvent("RECOGNITION_ITEM_APPEAR", {
      trialId: trialConfig.trialId,
      itemId: trialConfig.stimulus.id,
      status: trialConfig.status,
    });
  };

  // Participant clicks "SEEN BEFORE" or "NEW"
  const handleRecognitionResponse = (choice: RecognitionChoice, e: React.MouseEvent) => {
    if (recFeedback !== null || phase !== "recognition") return;

    const activeProtocols =
      recognitionProtocolsRef.current.length > 0
        ? recognitionProtocolsRef.current
        : recognitionProtocols;

    const currentConfig = activeProtocols[recIndex];
    if (!currentConfig || !currentConfig.stimulus) {
      console.error("[MemoryRecognition] handleRecognitionResponse called with missing trial config at index", recIndex);
      return;
    }

    const responseTimestamp = performance.now();
    const isCorrect = (currentConfig.status === "OLD" && choice === "SEEN_BEFORE") ||
                      (currentConfig.status === "NEW" && choice === "NEW");

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      trialMouseEventsRef.current.push({
        type: "click",
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
        timestamp: responseTimestamp,
      });
    }

    globalTaskEventManager.markEvent("MOUSE_RESPONSE", {
      trialId: currentConfig.trialId,
      choice,
      isCorrect,
    });

    fixationDetectorRef.current?.flushWindow();

    const aoi =
      activeAOIRef.current ??
      computeStimulusAOI(
        currentConfig.stimulus.id,
        CONTAINER_WIDTH / 2,
        CONTAINER_HEIGHT / 2 - 30,
        STIMULUS_SIZE_PX,
        { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }
      );

    const record = analyzeRecognitionTrial(
      currentConfig,
      aoi,
      choice,
      [...trialGazeSamplesRef.current],
      [...trialMouseEventsRef.current],
      [...trialFixationsRef.current],
      [...trialSaccadesRef.current],
      trialStartRef.current,
      responseTimestamp
    );

    completedRecRecordsRef.current.push(record);
    setRecFeedback({ choice, isCorrect });

    // Transition to next recognition item
    const nextTimer = window.setTimeout(() => {
      if (recIndex + 1 < activeProtocols.length) {
        const nextIdx = recIndex + 1;
        setRecIndex(nextIdx);
        prepareRecognitionTrial(activeProtocols[nextIdx], nextIdx);
      } else {
        finishSession(completedStudyRecordsRef.current, completedRecRecordsRef.current);
      }
    }, RECOGNITION_FEEDBACK_DELAY_MS);
    activeTimersRef.current.push(nextTimer);
  };

  // Complete Session
  const finishSession = (
    studies: StudyTrialRecord[],
    recognitions: RecognitionTrialRecord[]
  ) => {
    globalTaskEventManager.markEvent("RECOGNITION_END", { totalTrials: recognitions.length });
    globalTaskEventManager.markEvent("SESSION_END");

    const summary = aggregateMemoryRecognitionSession(
      session?.id ?? `mem_sess_${Date.now()}`,
      studies,
      retentionIntervalRef.current,
      recognitions,
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

    setSessionSummary(summary);
    setSelectedStudyTrial(studies[0] ?? null);
    setSelectedRecTrial(recognitions[0] ?? null);
    setPhase("results");

    // Push completion to backend (combining study and recognition phase gaze data)
    const allGazeSamples = [
      ...studies.flatMap((t) => t.rawGazeSamples),
      ...recognitions.flatMap((t) => t.rawGazeSamples),
    ];
    const scanPathSamplePoints = allGazeSamples.map((s) => ({
      x: s.gazeX,
      y: s.gazeY,
      t: s.timestamp,
      confidence: s.confidence,
      isBlink: s.blink,
    })).slice(-1000);

    completeMutation.mutate({
      accuracy_pct: summary.metrics.overallAccuracyPct,
      rt_ms: summary.metrics.meanReactionTimeMs,
      scan_path_json: JSON.stringify(scanPathSamplePoints),
      comparison_json: JSON.stringify(summary),
    });
  };

  const handleProceedToReading = async () => {
    if (patient?.id && assessment?.id) {
      try {
        const readSession = await createSession(patient.id, assessment.id, "reading");
        setSession(readSession);
      } catch (err) {
        console.warn("Could not pre-create reading session ahead of navigation:", err);
      }
    }
    navigate("/tasks/reading-comprehension");
  };

  const handleCopyResultsJSON = () => {
    if (!sessionSummary) return;
    navigator.clipboard.writeText(JSON.stringify(sessionSummary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeStudyList = studyProtocolsRef.current.length > 0 ? studyProtocolsRef.current : studyProtocols;
  const activeRecList = recognitionProtocolsRef.current.length > 0 ? recognitionProtocolsRef.current : recognitionProtocols;
  const currentStudyItem = activeStudyList[studyIndex];
  const currentRecItem = activeRecList[recIndex];
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
            <span className="font-semibold text-eyecog-teal">Memory &amp; Recognition Task</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500">VISIONEXIS Memory &amp; Recognition Engine</div>
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
              Memory Task Live Telemetry &amp; Gaze Synchronization HUD
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
              <span className="text-[10px] uppercase text-slate-400">Stimulus AOI</span>
              <p className="mt-0.5 font-bold text-amber-300 truncate" title={currentAOIId}>
                {currentAOIId}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400">Progress</span>
              <p className="mt-0.5 font-bold text-white">
                {phase === "study"
                  ? `Study ${studyIndex + 1}/20`
                  : phase === "recognition"
                  ? `Rec ${recIndex + 1}/40`
                  : phase === "retention"
                  ? `Retention ${retentionCountdown}s`
                  : phase === "results"
                  ? "Completed"
                  : "Ready"}
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
                <h3 className="text-sm font-bold text-amber-900">Calibration Required</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Gaze calibration profile is recommended before starting to ensure accurate visual attention dwell time measurements.
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
              <Brain className="h-8 w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                VISIONEXIS Memory &amp; Recognition Assessment
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 leading-relaxed font-medium">
                Look naturally at the items while they are displayed.
                <br />
                After the study phase, decide whether each item was seen before.
              </p>
            </div>

            {/* Protocol Protocol Badges */}
            <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-4 rounded-xl bg-slate-50 px-6 py-3 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-eyecog-teal" /> 1. Study (20 Items)
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 2. Retention (4s)
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> 3. Recognition (40 Trials)
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
                  Webcam eye-tracking is currently inactive. You may still proceed with task completion; memory accuracy and reaction times will be recorded, while gaze dwell metrics will be labeled as "Unavailable".
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
                Start Memory Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: STUDY PHASE (20 Items)                                          */}
      {/* ========================================================================= */}
      {phase === "study" && currentStudyItem && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white px-6 py-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 uppercase tracking-wider">
                Study Phase
              </span>
              <span className="font-mono text-sm font-bold text-slate-800">
                Item {studyIndex + 1} of {studyProtocols.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isEyeTrackingAvailable ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-500 font-medium">
                {isEyeTrackingAvailable ? "Gaze Encoding Active" : "Tracking Unavailable"}
              </span>
            </div>
          </div>

          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="relative mx-auto overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900 select-none shadow-md flex items-center justify-center"
            style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }}
          >
            {!studyBlank && (
              <div
                className="absolute flex flex-col items-center justify-center rounded-3xl border border-slate-700/80 bg-slate-800/95 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200"
                style={{
                  left: activeAOIRef.current?.x ?? (CONTAINER_WIDTH - STIMULUS_SIZE_PX) / 2,
                  top: activeAOIRef.current?.y ?? (CONTAINER_HEIGHT - STIMULUS_SIZE_PX) / 2,
                  width: STIMULUS_SIZE_PX,
                  height: STIMULUS_SIZE_PX,
                }}
              >
                <span
                  className="text-6xl font-extrabold select-none"
                  style={{ color: currentStudyItem.stimulus.accentColor }}
                >
                  {currentStudyItem.stimulus.symbol}
                </span>
                <span className="mt-2 text-xs font-semibold text-slate-300">
                  {currentStudyItem.stimulus.label}
                </span>
              </div>
            )}

            {!isEyeTrackingAvailable && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-1 text-xs font-bold text-white shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Eye tracking unavailable. Keep face centered.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: SHORT RETENTION INTERVAL (4 Seconds)                            */}
      {/* ========================================================================= */}
      {phase === "retention" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-sm animate-pulse">
              <Clock className="h-10 w-10" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800">Retention Interval</h2>
              <p className="mt-2 text-sm text-slate-500">
                Short delay between study and recognition. Please hold your attention.
              </p>
            </div>

            <div className="font-mono text-5xl font-extrabold text-amber-600">
              {retentionCountdown}
            </div>

            <p className="text-xs text-slate-400">
              Recognition phase will begin automatically...
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 4: RECOGNITION PHASE (40 Trials)                                    */}
      {/* ========================================================================= */}
      {phase === "recognition" && currentRecItem && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white px-6 py-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 uppercase tracking-wider">
                Recognition Phase
              </span>
              <span className="font-mono text-sm font-bold text-slate-800">
                Trial {recIndex + 1} of {activeRecList.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isEyeTrackingAvailable ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-500 font-medium">
                {isEyeTrackingAvailable ? "Gaze Active" : "Tracking Unavailable"}
              </span>
            </div>
          </div>

          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="relative mx-auto overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900 select-none shadow-md flex flex-col items-center justify-center p-6 space-y-6"
            style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }}
          >
            {/* Prompt Instruction */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Was this item shown during the study phase?
            </p>

            {/* Stimulus Card */}
            <div
              className={`flex flex-col items-center justify-center rounded-3xl border-2 transition-all ${
                recFeedback
                  ? recFeedback.isCorrect
                    ? "border-emerald-400 bg-emerald-500/20 scale-105"
                    : "border-rose-400 bg-rose-500/20 scale-95"
                  : "border-slate-700 bg-slate-800/90"
              }`}
              style={{
                width: STIMULUS_SIZE_PX,
                height: STIMULUS_SIZE_PX,
              }}
            >
              <span
                className="text-6xl font-extrabold select-none"
                style={{ color: currentRecItem.stimulus.accentColor }}
              >
                {currentRecItem.stimulus.symbol}
              </span>
              <span className="mt-2 text-xs font-semibold text-slate-300">
                {currentRecItem.stimulus.label}
              </span>
            </div>

            {/* Two Distinct Mouse Decision Buttons */}
            <div className="flex items-center gap-6 pt-2">
              <button
                type="button"
                onClick={(e) => handleRecognitionResponse("SEEN_BEFORE", e)}
                disabled={recFeedback !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-teal-500 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                SEEN BEFORE
              </button>

              <button
                type="button"
                onClick={(e) => handleRecognitionResponse("NEW", e)}
                disabled={recFeedback !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-slate-600 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <HelpCircle className="h-4 w-4" />
                NEW
              </button>
            </div>

            {!isEyeTrackingAvailable && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-1 text-xs font-bold text-white shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Eye tracking unavailable. Keep face centered.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recognition Phase Fallback Alert if item missing */}
      {phase === "recognition" && !currentRecItem && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center space-y-4 shadow-sm">
            <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto" />
            <h2 className="text-lg font-bold text-rose-900">Recognition Phase Error</h2>
            <p className="text-sm text-rose-700">
              Recognition trial data is currently unavailable.
            </p>
            <button
              type="button"
              onClick={startTask}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Restart Assessment
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 5: COMPREHENSIVE MEMORY & RECOGNITION RESULTS                       */}
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
                <h1 className="text-xl font-bold text-slate-800">
                  VISIONEXIS Memory &amp; Recognition Results
                </h1>
                <p className="text-xs text-slate-500">
                  Observed visual encoding dwell time, recognition accuracy, and signal detection metrics.
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
                onClick={handleProceedToReading}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition cursor-pointer shadow-sm"
              >
                Next Task: Reading &amp; Comprehension <ArrowRight className="h-3.5 w-3.5" />
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
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Overall Accuracy</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionSummary.metrics.overallAccuracyPct}%
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionSummary.metrics.correctCount}/{sessionSummary.metrics.totalRecognitionTrials}
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Hit Rate (H)</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">
                {(sessionSummary.metrics.hitRate * 100).toFixed(1)}%
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionSummary.metrics.hits} Hits / 20
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">False Alarm (F)</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-rose-600">
                {(sessionSummary.metrics.falseAlarmRate * 100).toFixed(1)}%
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionSummary.metrics.falseAlarms} FA / 20
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Sensitivity (d')</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-purple-600">
                {sessionSummary.metrics.dPrime}
              </p>
              <p className="text-[9px] text-slate-400">SDT Index</p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Response Bias (c)</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionSummary.metrics.criterionC}
              </p>
              <p className="text-[9px] text-slate-400">
                {sessionSummary.metrics.criterionC < 0 ? "Liberal" : sessionSummary.metrics.criterionC > 0 ? "Conservative" : "Neutral"}
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Mean Rec RT</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">
                {sessionSummary.metrics.meanReactionTimeMs} ms
              </p>
              <p className="text-[9px] text-slate-400">
                Med: {sessionSummary.metrics.medianReactionTimeMs}ms
              </p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Study Dwell Time</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">
                {sessionSummary.metrics.meanStudyDwellTimeMs} ms
              </p>
              <p className="text-[9px] text-slate-400">Per studied item</p>
            </div>

            <div className="rounded-xl bg-white p-3.5 border border-slate-200 shadow-xs">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Study Fixations</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-emerald-600">
                {sessionSummary.metrics.meanStudyFixationCount}
              </p>
              <p className="text-[9px] text-slate-400">
                Dur: {sessionSummary.metrics.meanStudyFixationDurationMs}ms
              </p>
            </div>
          </div>

          {/* Signal Detection Theory Matrix Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-eyecog-teal" />
                Signal Detection Theory 2×2 Decision Matrix
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Hits (Old → Seen)</span>
                  <p className="text-xl font-extrabold text-emerald-950 mt-1">{sessionSummary.metrics.hits}</p>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    Mean RT: {sessionSummary.metrics.meanHitReactionTimeMs} ms
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                  <span className="text-[10px] uppercase font-bold text-rose-800">Misses (Old → New)</span>
                  <p className="text-xl font-extrabold text-rose-950 mt-1">{sessionSummary.metrics.misses}</p>
                  <p className="text-[10px] text-rose-700 mt-0.5">Unrecognized studied items</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <span className="text-[10px] uppercase font-bold text-amber-800">False Alarms (New → Seen)</span>
                  <p className="text-xl font-extrabold text-amber-950 mt-1">{sessionSummary.metrics.falseAlarms}</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">False familiarity errors</p>
                </div>
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
                  <span className="text-[10px] uppercase font-bold text-sky-800">Correct Rejections (New → New)</span>
                  <p className="text-xl font-extrabold text-sky-950 mt-1">{sessionSummary.metrics.correctRejections}</p>
                  <p className="text-[10px] text-sky-700 mt-0.5">
                    Mean RT: {sessionSummary.metrics.meanCorrectRejectionReactionTimeMs} ms
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Attention Encoding vs Recognition Accuracy Insight */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm space-y-2.5">
              <h2 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                <Eye className="h-4 w-4 text-eyecog-teal" />
                Visual Attention (Study Dwell) vs. Recognition Success
              </h2>
              <p className="text-xs text-teal-900 leading-relaxed">
                Items subsequently recognized as <strong>Hits</strong> received an average of{" "}
                <strong>{sessionSummary.metrics.studyGazeByRecognition.hitsMeanDwellMs} ms</strong> study dwell time vs.{" "}
                <strong>{sessionSummary.metrics.studyGazeByRecognition.missesMeanDwellMs} ms</strong> for <strong>Misses</strong>{" "}
                (Difference: <strong>{sessionSummary.metrics.studyGazeByRecognition.dwellDifferenceMs > 0 ? `+${sessionSummary.metrics.studyGazeByRecognition.dwellDifferenceMs}` : sessionSummary.metrics.studyGazeByRecognition.dwellDifferenceMs} ms</strong>).
              </p>
              <div className="rounded-lg bg-white/80 border border-teal-200 p-3 text-xs font-mono flex justify-between items-center text-teal-950">
                <span>Hit Items Fixations: <strong>{sessionSummary.metrics.studyGazeByRecognition.hitsMeanFixationCount}</strong></span>
                <span>Miss Items Fixations: <strong>{sessionSummary.metrics.studyGazeByRecognition.missesMeanFixationCount}</strong></span>
              </div>
              <p className="text-[11px] text-teal-700 italic">
                *Note: Observational correlation between visual encoding duration and recognition retrieval; does not imply medical diagnosis.
              </p>
            </div>
          </div>

          {/* Interactive Gaze Heatmap & Scanpath Inspector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-eyecog-teal" />
                  Trial-by-Trial Gaze Heatmap &amp; Scanpath Inspector
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect webcam gaze density, fixation sequences, and AOI encounters for Study (20) and Recognition (40) trials.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInspectTab("recognition")}
                  className={`rounded-md px-3 py-1 transition cursor-pointer ${
                    inspectTab === "recognition"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Recognition Phase (40 Trials)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectTab("study")}
                  className={`rounded-md px-3 py-1 transition cursor-pointer ${
                    inspectTab === "study"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Study Phase (20 Items)
                </button>
              </div>
            </div>

            {/* Trial Selectors */}
            {inspectTab === "recognition" ? (
              <div className="flex flex-wrap gap-1 max-w-full">
                {sessionSummary.recognitionTrials.map((t) => (
                  <button
                    key={t.trialId}
                    type="button"
                    onClick={() => setSelectedRecTrial(t)}
                    className={`h-7 w-7 rounded-md text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedRecTrial?.trialId === t.trialId
                        ? "bg-eyecog-navy text-white shadow-xs ring-2 ring-teal-400"
                        : t.isCorrect
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                    }`}
                  >
                    {t.trialId}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 max-w-full">
                {sessionSummary.studyTrials.map((t) => (
                  <button
                    key={t.studyIndex}
                    type="button"
                    onClick={() => setSelectedStudyTrial(t)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedStudyTrial?.studyIndex === t.studyIndex
                        ? "bg-eyecog-teal text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Item {t.studyIndex} ({t.stimulus.symbol})
                  </button>
                ))}
              </div>
            )}

            {/* Visualizer Frame */}
            {inspectTab === "recognition" && selectedRecTrial && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                <div className="lg:col-span-8 flex justify-center">
                  <MemoryVisualizer
                    trial={selectedRecTrial}
                    phase="recognition"
                    width={520}
                    height={380}
                  />
                </div>

                <div className="lg:col-span-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs font-mono space-y-2.5">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center font-sans">
                    <span className="font-bold text-slate-800">
                      Rec Trial {selectedRecTrial.trialId}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedRecTrial.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {selectedRecTrial.classification}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Stimulus:</span>
                    <span className="font-bold text-eyecog-teal">{selectedRecTrial.stimulus.symbol} ({selectedRecTrial.stimulus.label})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual Status:</span>
                    <span className="font-bold text-slate-800">{selectedRecTrial.actualStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selected Choice:</span>
                    <span className="font-bold text-slate-800">{selectedRecTrial.selectedChoice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reaction Time:</span>
                    <span className="font-bold text-slate-800">{selectedRecTrial.reactionTimeMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gaze Dwell Time:</span>
                    <span className="font-bold text-eyecog-teal">{selectedRecTrial.gazeMetrics.dwellTimeMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fixations:</span>
                    <span className="font-bold text-slate-800">{selectedRecTrial.gazeMetrics.fixationCount}</span>
                  </div>
                </div>
              </div>
            )}

            {inspectTab === "study" && selectedStudyTrial && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                <div className="lg:col-span-8 flex justify-center">
                  <MemoryVisualizer
                    trial={selectedStudyTrial}
                    phase="study"
                    width={520}
                    height={380}
                  />
                </div>

                <div className="lg:col-span-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs font-mono space-y-2.5">
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center font-sans">
                    <span className="font-bold text-slate-800">
                      Study Item {selectedStudyTrial.studyIndex}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                      ENCODED
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Stimulus:</span>
                    <span className="font-bold text-eyecog-teal">{selectedStudyTrial.stimulus.symbol} ({selectedStudyTrial.stimulus.label})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-bold text-slate-800">{selectedStudyTrial.stimulus.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dwell Time:</span>
                    <span className="font-bold text-eyecog-teal">{selectedStudyTrial.gazeMetrics.dwellTimeMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dwell Percentage:</span>
                    <span className="font-bold text-slate-800">{selectedStudyTrial.gazeMetrics.dwellPercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fixation Count:</span>
                    <span className="font-bold text-slate-800">{selectedStudyTrial.gazeMetrics.fixationCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg Fixation:</span>
                    <span className="font-bold text-slate-800">{selectedStudyTrial.gazeMetrics.avgFixationDuration} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Revisits:</span>
                    <span className="font-bold text-slate-800">{selectedStudyTrial.gazeMetrics.revisitCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Research & Non-Medical Disclaimer Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>VISIONEXIS Research Notice:</strong> This memory and recognition assessment system is an experimental software-based eye-movement and cognitive-task analysis tool for research and behavioral investigation. It does not provide medical or clinical diagnoses for memory disorders, dementia, ADHD, autism, or cognitive impairment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
