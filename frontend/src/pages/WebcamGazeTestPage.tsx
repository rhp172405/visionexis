import { useEffect, useRef, useState } from "react";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  CALIBRATION_POINTS_9,
  VALIDATION_POINTS_5,
  trainCalibrationModel,
  validateCalibrationModel,
  extractRegressionFeatures,
  type CalibrationPointSample,
  type CalibrationTarget,
  type ValidationSummary,
} from "@/lib/webcam/calibration";
import {
  Camera,
  Crosshair,
  Copy,
  Check,
  RefreshCw,
  ArrowLeftRight,
  ShieldCheck,
  Target,
  Activity,
} from "lucide-react";

export function WebcamGazeTestPage() {
  const {
    isCameraActive,
    isLoadingCamera,
    faceDetected,
    eyesDetected,
    fps,
    pipelineHealth,
    currentGaze,
    lastFeatures,
    rawLandmarks,
    gazeHistory,
    calibrationModel,
    isCalibrated,
    setCalibrationModel,
    clearCalibration,
  } = useGazeStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  // Calibration & Validation State
  const [flowState, setFlowState] = useState<"idle" | "calibrating" | "validating" | "complete">("idle");
  const [pointIndex, setPointIndex] = useState(0);
  const [settlingSeconds, setSettlingSeconds] = useState(0);
  const [collectedCalibSamples, setCollectedCalibSamples] = useState<CalibrationPointSample[]>([]);
  const [validationSamplesMap, setValidationSamplesMap] = useState<
    { target: (typeof VALIDATION_POINTS_5)[0]; samples: CalibrationPointSample[] }[]
  >([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(
    calibrationModel?.validation ?? null
  );

  // Interactive Target Inspection selection
  const [selectedTarget, setSelectedTarget] = useState<CalibrationTarget | null>(CALIBRATION_POINTS_9[4]); // Center

  // Auto-start webcam ONLY on initial component mount
  const initialMountRef = useRef(false);
  useEffect(() => {
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      if (!isCameraActive && !isLoadingCamera) {
        globalWebcamManager.startCamera();
      }
    }
  }, []);

  // Teardown camera stream on unmount
  useEffect(() => {
    return () => {
      globalWebcamManager.stopCamera();
    };
  }, []);

  // Render video frame and landmarks on the preview canvas
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (!isCameraActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const vid = globalWebcamManager.getVideoElement();
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;

        // Draw webcam video mirrored horizontally for natural user interaction
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(vid, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        // Overlay raw MediaPipe facial and iris landmarks if available
        if (rawLandmarks && rawLandmarks.length >= 468) {
          const w = canvas.width;
          const h = canvas.height;

          const getCanvasX = (normX: number) => (1.0 - normX) * w;
          const getCanvasY = (normY: number) => normY * h;

          // Eye contour indices
          const leftEyeIndices = [33, 160, 158, 133, 153, 144];
          const rightEyeIndices = [362, 385, 387, 263, 373, 380];

          ctx.strokeStyle = "rgba(45, 212, 191, 0.85)";
          ctx.lineWidth = 1.8;

          // Left eye contour
          ctx.beginPath();
          leftEyeIndices.forEach((idx, i) => {
            const lm = rawLandmarks[idx];
            if (!lm) return;
            const px = getCanvasX(lm.x);
            const py = getCanvasY(lm.y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.stroke();

          // Right eye contour
          ctx.beginPath();
          rightEyeIndices.forEach((idx, i) => {
            const lm = rawLandmarks[idx];
            if (!lm) return;
            const px = getCanvasX(lm.x);
            const py = getCanvasY(lm.y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.stroke();

          // Left Iris Center (468)
          if (rawLandmarks.length > 468 && rawLandmarks[468]) {
            const leftIris = rawLandmarks[468];
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(getCanvasX(leftIris.x), getCanvasY(leftIris.y), 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Right Iris Center (473)
          if (rawLandmarks.length > 473 && rawLandmarks[473]) {
            const rightIris = rawLandmarks[473];
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(getCanvasX(rightIris.x), getCanvasY(rightIris.y), 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Nose center (1)
          if (rawLandmarks[1]) {
            const nose = rawLandmarks[1];
            ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
            ctx.beginPath();
            ctx.arc(getCanvasX(nose.x), getCanvasY(nose.y), 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isCameraActive, rawLandmarks]);

  // Viewport dimensions for pixel calculations
  const [viewportDims, setViewportDims] = useState({ w: 800, h: 450 });
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportDims({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute screen pixel coordinates relative to the bounded test viewport container
  const pixelGazeX = currentGaze ? Math.round(currentGaze.normX * viewportDims.w) : 0;
  const pixelGazeY = currentGaze ? Math.round(currentGaze.normY * viewportDims.h) : 0;

  // Compute distance from currently selected test target
  const targetPxX = selectedTarget ? Math.round(selectedTarget.normX * viewportDims.w) : 0;
  const targetPxY = selectedTarget ? Math.round(selectedTarget.normY * viewportDims.h) : 0;
  const targetDistancePx = Math.round(Math.hypot(pixelGazeX - targetPxX, pixelGazeY - targetPxY));

  // 1. Start Calibration Routine
  const handleStartCalibration = () => {
    setFlowState("calibrating");
    setPointIndex(0);
    setSettlingSeconds(2);
    setCollectedCalibSamples([]);
    setValidationSamplesMap([]);
  };

  // 9-Point Calibration State Machine with Settling Phase
  useEffect(() => {
    if (flowState !== "calibrating") return;

    if (pointIndex >= CALIBRATION_POINTS_9.length) {
      // Finished 9 calibration points -> train Model X & Model Y
      const model = trainCalibrationModel(collectedCalibSamples);
      if (model) {
        setCalibrationModel(model);
        // Transition to 5-point validation phase
        setFlowState("validating");
        setPointIndex(0);
        setSettlingSeconds(2);
      } else {
        setFlowState("idle");
      }
      return;
    }

    const currentTarget = CALIBRATION_POINTS_9[pointIndex];

    // Settling countdown (user focuses on point)
    if (settlingSeconds > 0) {
      const timer = setTimeout(() => {
        setSettlingSeconds((s) => s - 1);
      }, 350);
      return () => clearTimeout(timer);
    }

    // Collection phase (35 valid frames per target)
    let collectedCount = 0;
    const targetSamples: CalibrationPointSample[] = [];

    const interval = setInterval(() => {
      const feat = useGazeStore.getState().lastFeatures;
      if (feat && !feat.isBlink && feat.confidence > 0.45) {
        const { featuresX, featuresY } = extractRegressionFeatures(feat);
        const meanRelX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
        const meanRelY = (feat.leftIrisY + feat.rightIrisY) / 2.0;
        targetSamples.push({
          targetId: currentTarget.id,
          targetX: currentTarget.normX,
          targetY: currentTarget.normY,
          leftRelativeX: feat.leftIrisX,
          leftRelativeY: feat.leftIrisY,
          rightRelativeX: feat.rightIrisX,
          rightRelativeY: feat.rightIrisY,
          meanRelativeX: meanRelX,
          meanRelativeY: meanRelY,
          headYaw: feat.headYaw,
          headPitch: feat.headPitch,
          faceCenterX: feat.faceCenterX,
          faceCenterY: feat.faceCenterY,
          featuresX,
          featuresY,
          timestamp: performance.now(),
        });
        collectedCount++;
      }

      if (collectedCount >= 35) {
        clearInterval(interval);
        setCollectedCalibSamples((prev) => [...prev, ...targetSamples]);
        setPointIndex((idx) => idx + 1);
        setSettlingSeconds(2); // Reset settling timer for next point
      }
    }, 30);

    return () => clearInterval(interval);
  }, [flowState, pointIndex, settlingSeconds, collectedCalibSamples, setCalibrationModel]);

  // 5-Point Validation State Machine
  useEffect(() => {
    if (flowState !== "validating") return;

    if (pointIndex >= VALIDATION_POINTS_5.length) {
      // Completed validation -> run statistical validation
      const model = useGazeStore.getState().calibrationModel;
      if (model && validationSamplesMap.length > 0) {
        const summary = validateCalibrationModel(
          validationSamplesMap,
          model,
          viewportDims.w,
          viewportDims.h
        );
        setValidationSummary(summary);
        setCalibrationModel({ ...model, validation: summary });
      }
      setFlowState("complete");
      return;
    }

    const currentValTarget = VALIDATION_POINTS_5[pointIndex];

    if (settlingSeconds > 0) {
      const timer = setTimeout(() => {
        setSettlingSeconds((s) => s - 1);
      }, 350);
      return () => clearTimeout(timer);
    }

    let collectedCount = 0;
    const valTargetSamples: CalibrationPointSample[] = [];

    const interval = setInterval(() => {
      const feat = useGazeStore.getState().lastFeatures;
      if (feat && !feat.isBlink && feat.confidence > 0.45) {
        const { featuresX, featuresY } = extractRegressionFeatures(feat);
        const meanRelX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
        const meanRelY = (feat.leftIrisY + feat.rightIrisY) / 2.0;
        valTargetSamples.push({
          targetId: currentValTarget.id,
          targetX: currentValTarget.normX,
          targetY: currentValTarget.normY,
          leftRelativeX: feat.leftIrisX,
          leftRelativeY: feat.leftIrisY,
          rightRelativeX: feat.rightIrisX,
          rightRelativeY: feat.rightIrisY,
          meanRelativeX: meanRelX,
          meanRelativeY: meanRelY,
          headYaw: feat.headYaw,
          headPitch: feat.headPitch,
          faceCenterX: feat.faceCenterX,
          faceCenterY: feat.faceCenterY,
          featuresX,
          featuresY,
          timestamp: performance.now(),
        });
        collectedCount++;
      }

      if (collectedCount >= 25) {
        clearInterval(interval);
        setValidationSamplesMap((prev) => [
          ...prev,
          { target: currentValTarget, samples: valTargetSamples },
        ]);
        setPointIndex((idx) => idx + 1);
        setSettlingSeconds(2);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [flowState, pointIndex, settlingSeconds, validationSamplesMap, setCalibrationModel, viewportDims]);

  // Copy 20 real samples
  const handleCopySamples = () => {
    const recent20 = gazeHistory.slice(0, 20).map((s, idx) => ({
      sample: idx + 1,
      timestamp: Math.round(s.timestamp),
      normX: Number(s.normX.toFixed(4)),
      normY: Number(s.normY.toFixed(4)),
      pixelGazeX: Math.round(s.normX * viewportDims.w),
      pixelGazeY: Math.round(s.normY * viewportDims.h),
      confidence: Number(s.confidence.toFixed(2)),
      isBlink: s.isBlink,
    }));
    navigator.clipboard.writeText(JSON.stringify(recent20, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const meanRelX = lastFeatures ? (lastFeatures.leftIrisX + lastFeatures.rightIrisX) / 2.0 : 0.5;
  const meanRelY = lastFeatures ? (lastFeatures.leftIrisY + lastFeatures.rightIrisY) / 2.0 : 0.5;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-3 w-3 rounded-full ${isCameraActive ? "bg-eyecog-teal animate-pulse" : "bg-slate-300"}`} />
              <h1 className="text-xl font-bold text-slate-800">VISIONEXIS Dual-Axis Webcam Gaze Diagnostics</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Decoupled horizontal/vertical ridge regression models, intra-eye ratios, multi-sample outlier rejection, and independent 5-point validation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isCameraActive) {
                  globalWebcamManager.stopCamera();
                } else {
                  globalWebcamManager.startCamera();
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                isCameraActive
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  : "bg-eyecog-navy text-white hover:bg-eyecog-navy/90 shadow-sm"
              }`}
            >
              <Camera className="h-4 w-4" />
              {isCameraActive ? "Stop Camera" : "Start Camera"}
            </button>

            {isCalibrated && (
              <button
                type="button"
                onClick={() => {
                  clearCalibration();
                  setValidationSummary(null);
                  setFlowState("idle");
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Reset calibration model to geometric defaults"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Model
              </button>
            )}

            <button
              type="button"
              disabled={!isCameraActive || flowState === "calibrating" || flowState === "validating"}
              onClick={handleStartCalibration}
              className="flex items-center gap-2 rounded-lg bg-eyecog-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-eyecog-teal/90 disabled:opacity-50 cursor-pointer"
            >
              <Crosshair className="h-4 w-4" />
              {flowState === "calibrating"
                ? `Calibrating (${pointIndex + 1}/9)...`
                : flowState === "validating"
                ? `Validating (${pointIndex + 1}/5)...`
                : "Run 9-Pt Calibration & Validation"}
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Health & Performance Diagnostics Telemetry Monitor (Sections 17 & 20) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-eyecog-teal" />
            <h2 className="text-sm font-bold text-slate-800">
              Webcam Pipeline Health &amp; Computer Vision Engine Telemetry
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
                pipelineHealth.processingStatus === "RUNNING"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : pipelineHealth.processingStatus === "STALLED"
                  ? "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
                  : pipelineHealth.processingStatus === "PAUSED"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  pipelineHealth.processingStatus === "RUNNING"
                    ? "bg-emerald-500 animate-ping"
                    : pipelineHealth.processingStatus === "STALLED"
                    ? "bg-rose-500"
                    : "bg-slate-400"
                }`}
              />
              ENGINE: {pipelineHealth.processingStatus}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Camera Status */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Camera</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                pipelineHealth.cameraStatus === "CONNECTED"
                  ? "text-emerald-600"
                  : pipelineHealth.cameraStatus === "RECOVERING"
                  ? "text-amber-600 animate-pulse"
                  : "text-rose-600"
              }`}
            >
              {pipelineHealth.cameraStatus}
            </p>
          </div>

          {/* Stream Status */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Stream</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                pipelineHealth.streamStatus === "ACTIVE" ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {pipelineHealth.streamStatus}
            </p>
          </div>

          {/* Video Element */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Video</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                pipelineHealth.videoStatus === "PLAYING" ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {pipelineHealth.videoStatus}
            </p>
          </div>

          {/* Resolution */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Resolution</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-slate-800">
              {pipelineHealth.resolution || "—"}
            </p>
          </div>

          {/* Camera Hardware FPS */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Camera FPS</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-slate-800">
              {pipelineHealth.cameraFps} FPS
            </p>
          </div>

          {/* Inference / Processing FPS */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Inference FPS</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-eyecog-teal">
              {pipelineHealth.inferenceFps} FPS
            </p>
          </div>

          {/* Inference Time (ms) */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Inference Time</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-slate-800">
              {pipelineHealth.inferenceTimeMs} ms
            </p>
          </div>

          {/* Dropped Frames */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Dropped Frames</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                pipelineHealth.droppedFrames > 0 ? "text-amber-600" : "text-slate-800"
              }`}
            >
              {pipelineHealth.droppedFrames}
            </p>
          </div>

          {/* Last Frame Age */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Last Frame</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                pipelineHealth.lastFrameAgeSec > 1.5 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {pipelineHealth.lastFrameAgeSec.toFixed(2)}s ago
            </p>
          </div>

          {/* Face Detection */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Face</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                faceDetected ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {faceDetected ? "DETECTED" : "NONE"}
            </p>
          </div>

          {/* Eyes & Iris Tracking */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Iris Tracking</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                lastFeatures && !lastFeatures.isBlink ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {lastFeatures && !lastFeatures.isBlink ? "TRACKING" : lastFeatures?.isBlink ? "BLINK" : "NONE"}
            </p>
          </div>

          {/* Gaze Pipeline Status */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Gaze Pipeline</p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${
                currentGaze ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {currentGaze ? "UPDATING" : "IDLE"}
            </p>
          </div>
        </div>
      </div>

      {/* Validation Quality Scorecard (When Calibrated & Validated) */}
      {validationSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-eyecog-teal" />
              <h2 className="text-sm font-bold text-slate-800">5-Point Independent Validation Results</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Calibration Quality:</span>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  validationSummary.qualityRating === "GOOD"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : validationSummary.qualityRating === "FAIR"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                {validationSummary.qualityRating}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400">Mean Absolute Error (MAE)</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{validationSummary.maePx} px</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400">Median Error</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{validationSummary.medianErrorPx} px</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400">Horizontal MAE</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">{validationSummary.horizontalMaePx} px</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400">Vertical MAE</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-eyecog-teal">{validationSummary.verticalMaePx} px</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400">Max Error</p>
              <p className="mt-1 font-mono text-lg font-extrabold text-slate-800">{validationSummary.maxErrorPx} px</p>
            </div>
          </div>

          {/* Validation Target Accuracy Table */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Target (X, Y)</th>
                  <th className="px-3 py-2">Predicted (X, Y)</th>
                  <th className="px-3 py-2">Horiz Error</th>
                  <th className="px-3 py-2">Vert Error</th>
                  <th className="px-3 py-2">Euclidean Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {validationSummary.targets.map((t) => (
                  <tr key={t.targetId}>
                    <td className="px-3 py-2 font-semibold text-slate-800">{t.label}</td>
                    <td className="px-3 py-2">({t.targetPxX}, {t.targetPxY}) px ({Math.round(t.targetNormX * 100)}%, {Math.round(t.targetNormY * 100)}%)</td>
                    <td className="px-3 py-2 text-eyecog-teal font-bold">({t.predictedPxX}, {t.predictedPxY}) px</td>
                    <td className="px-3 py-2">{t.horizontalErrorPx} px</td>
                    <td className="px-3 py-2">{t.verticalErrorPx} px</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{t.errorPx} px</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Target Inspection Grid Buttons (Section 3 & 11) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-eyecog-teal" />
            <h2 className="text-sm font-bold text-slate-800">
              Interactive Viewport Target Tester &amp; Live Error Visualizer
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span>Target: <strong className="text-slate-700">{selectedTarget?.label} ({targetPxX}, {targetPxY})</strong></span>
            <span>Live Gaze: <strong className="text-eyecog-teal">({pixelGazeX}, {pixelGazeY})</strong></span>
            <span>Distance / Error: <strong className={targetDistancePx < 50 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{targetDistancePx} px</strong></span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {CALIBRATION_POINTS_9.map((point) => (
            <button
              key={point.id}
              type="button"
              onClick={() => setSelectedTarget(point)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedTarget?.id === point.id
                  ? "bg-eyecog-navy text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {point.label} ({Math.round(point.normX * 100)}%, {Math.round(point.normY * 100)}%)
            </button>
          ))}
        </div>
      </div>

      {/* Main Viewport with Target & Live Gaze Dot (Mouse-Independent) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-eyecog-teal" />
              Live Viewport Webcam Gaze Field (Mouse-Independent)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The blue ring (<span className="text-sky-400 font-bold">◎</span>) is your selected target. The teal dot (<span className="text-eyecog-teal font-bold">●</span>) is your real-time webcam gaze. The mouse is completely disabled.
            </p>
          </div>
        </div>

        {/* Viewport Test Area */}
        <div
          ref={viewportRef}
          className="relative h-[440px] w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-900 overflow-hidden select-none"
        >
          {/* Target Zones Background Grid */}
          <div className="absolute top-4 left-4 rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-[10px] font-mono text-slate-400">
            Top-Left (15%, 15%)
          </div>
          <div className="absolute top-4 right-4 rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-[10px] font-mono text-slate-400">
            Top-Right (85%, 15%)
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-[10px] font-mono text-slate-400">
            Center (50%, 50%)
          </div>
          <div className="absolute bottom-4 left-4 rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-[10px] font-mono text-slate-400">
            Bottom-Left (15%, 85%)
          </div>
          <div className="absolute bottom-4 right-4 rounded-lg bg-slate-800/80 px-2.5 py-1 border border-slate-700 text-[10px] font-mono text-slate-400">
            Bottom-Right (85%, 85%)
          </div>

          {/* Selected Test Target (Section 11 Target Marker) */}
          {selectedTarget && flowState !== "calibrating" && flowState !== "validating" && (
            <div
              className="absolute z-15 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 flex flex-col items-center"
              style={{
                left: `${selectedTarget.normX * 100}%`,
                top: `${selectedTarget.normY * 100}%`,
              }}
            >
              <div className="relative flex h-9 w-9 items-center justify-center">
                <span className="absolute h-full w-full rounded-full border-2 border-sky-400 animate-ping opacity-75" />
                <span className="h-4 w-4 rounded-full bg-sky-500 border-2 border-white shadow-lg" />
              </div>
              <span className="mt-0.5 rounded bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-sky-300 border border-sky-400/40">
                Target ({targetPxX}, {targetPxY})
              </span>
            </div>
          )}

          {/* Active 9-Point Calibration Target */}
          {flowState === "calibrating" && CALIBRATION_POINTS_9[pointIndex] && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex flex-col items-center"
              style={{
                left: `${CALIBRATION_POINTS_9[pointIndex].normX * 100}%`,
                top: `${CALIBRATION_POINTS_9[pointIndex].normY * 100}%`,
              }}
            >
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-eyecog-teal/40 animate-ping" />
                <span className="h-5 w-5 rounded-full bg-eyecog-teal border-2 border-white shadow-lg" />
              </div>
              <span className="mt-1 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                {settlingSeconds > 0 ? `Focusing... ${settlingSeconds}` : `Sampling (${pointIndex + 1}/9)`}
              </span>
            </div>
          )}

          {/* Active 5-Point Validation Target */}
          {flowState === "validating" && VALIDATION_POINTS_5[pointIndex] && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex flex-col items-center"
              style={{
                left: `${VALIDATION_POINTS_5[pointIndex].normX * 100}%`,
                top: `${VALIDATION_POINTS_5[pointIndex].normY * 100}%`,
              }}
            >
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-amber-400/40 animate-ping" />
                <span className="h-5 w-5 rounded-full bg-amber-400 border-2 border-white shadow-lg" />
              </div>
              <span className="mt-1 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                {settlingSeconds > 0 ? `Hold gaze... ${settlingSeconds}` : `Validating (${pointIndex + 1}/5)`}
              </span>
            </div>
          )}

          {/* Live Gaze Position Dot (Driven solely by webcam) */}
          {currentGaze && isCameraActive && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
              style={{
                left: `${currentGaze.normX * 100}%`,
                top: `${currentGaze.normY * 100}%`,
              }}
            >
              <div className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-eyecog-teal/30 animate-pulse" />
                <span className="h-4 w-4 rounded-full bg-eyecog-teal border-2 border-white shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
              </div>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-eyecog-teal border border-eyecog-teal/40">
                Gaze ({pixelGazeX}, {pixelGazeY})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Gaze Test Gauge */}
      <div className="rounded-xl border-2 border-eyecog-teal/40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-eyecog-teal" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-eyecog-teal">
              Horizontal Gaze Validation Gauge (Left ↔ Right)
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Raw Relative X: <strong className="text-cyan-300">{lastFeatures ? meanRelX.toFixed(4) : "—"}</strong></span>
            <span>Estimated Gaze X: <strong className="text-eyecog-teal">{currentGaze ? `${pixelGazeX} px (${(currentGaze.normX * 100).toFixed(1)}%)` : "—"}</strong></span>
            <span>Confidence: <strong className="text-emerald-400">{currentGaze ? `${Math.round(currentGaze.confidence * 100)}%` : "0%"}</strong></span>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative h-10 w-full rounded-lg bg-slate-950/80 p-1 border border-slate-700 flex items-center">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 uppercase">
              ◀ Look LEFT
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 uppercase">
              CENTER (50%)
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 uppercase">
              Look RIGHT ▶
            </div>

            {currentGaze && isCameraActive && (
              <div
                className="absolute top-1 bottom-1 w-4 -translate-x-1/2 rounded bg-eyecog-teal shadow-[0_0_12px_rgba(45,212,191,1)] transition-all duration-75 flex items-center justify-center"
                style={{ left: `${currentGaze.normX * 100}%` }}
              >
                <div className="h-full w-0.5 bg-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Video + Telemetry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Video & Face/Eye Landmark Overlay */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Camera className="h-4 w-4 text-eyecog-teal" />
              Webcam Video + Facial Mesh &amp; Iris Landmarks
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-600">
              {fps} FPS
            </span>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-900 aspect-4/3 flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-cover" />
            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 text-center">
                <Camera className="h-10 w-10 text-slate-600 mb-2" />
                <p className="font-semibold text-white">Camera Disconnected</p>
                <p className="text-xs mt-1">Click "Start Camera" above to initiate MediaPipe computer vision inference.</p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Camera</span>
              <span className={`font-bold ${isCameraActive ? "text-emerald-600" : "text-rose-600"}`}>
                {isCameraActive ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Face</span>
              <span className={`font-bold ${faceDetected ? "text-emerald-600" : "text-slate-400"}`}>
                {faceDetected ? "DETECTED" : "NOT DETECTED"}
              </span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Eyes</span>
              <span className={`font-bold ${eyesDetected ? "text-emerald-600" : "text-slate-400"}`}>
                {eyesDetected ? "DETECTED" : "NOT DETECTED"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Numerical Readouts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Normalized Intra-Eye Iris Telemetry &amp; Coordinates
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Left Iris Rel X</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.leftIrisX.toFixed(4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Left Iris Rel Y</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.leftIrisY.toFixed(4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Right Iris Rel X</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.rightIrisX.toFixed(4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Right Iris Rel Y</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.rightIrisY.toFixed(4) : "—"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Mean Relative X</p>
                <p className="mt-1 font-mono text-base font-bold text-eyecog-teal">
                  {lastFeatures ? meanRelX.toFixed(4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Mean Relative Y</p>
                <p className="mt-1 font-mono text-base font-bold text-eyecog-teal">
                  {lastFeatures ? meanRelY.toFixed(4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Estimated Gaze X</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {currentGaze ? `${pixelGazeX} px (${currentGaze.normX.toFixed(3)})` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Estimated Gaze Y</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {currentGaze ? `${pixelGazeY} px (${currentGaze.normY.toFixed(3)})` : "—"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Head Yaw Proxy</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.headYaw.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Head Pitch Proxy</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.headPitch.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Confidence Score</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {currentGaze ? `${Math.round(currentGaze.confidence * 100)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Calibration State</p>
                <p className="mt-1 font-mono text-xs font-bold">
                  {isCalibrated ? (
                    <span className="text-emerald-600">Dual-Model Fitted ✓</span>
                  ) : (
                    <span className="text-amber-600">Full-Span Prior</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time 20 Consecutive Real Webcam Gaze Samples Log Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Live 20 Consecutive Real Webcam Gaze Telemetry Records
            </h2>
            <p className="text-xs text-slate-500">
              Real timestamps, raw intra-eye ratios, predicted coordinates, and state flags streamed from the computer vision loop.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySamples}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied JSON" : "Copy 20 Samples JSON"}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Timestamp (ms)</th>
                <th className="px-4 py-2.5">Predicted X (px)</th>
                <th className="px-4 py-2.5">Predicted Y (px)</th>
                <th className="px-4 py-2.5">Norm X</th>
                <th className="px-4 py-2.5">Norm Y</th>
                <th className="px-4 py-2.5">Confidence</th>
                <th className="px-4 py-2.5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {gazeHistory.slice(0, 20).map((sample, idx) => (
                <tr key={idx} className={idx === 0 ? "bg-eyecog-teal/5 font-semibold" : "hover:bg-slate-50"}>
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2">{Math.round(sample.timestamp)}</td>
                  <td className="px-4 py-2 text-eyecog-teal font-bold">
                    {Math.round(sample.normX * viewportDims.w)}
                  </td>
                  <td className="px-4 py-2 text-eyecog-teal font-bold">
                    {Math.round(sample.normY * viewportDims.h)}
                  </td>
                  <td className="px-4 py-2">{sample.normX.toFixed(4)}</td>
                  <td className="px-4 py-2">{sample.normY.toFixed(4)}</td>
                  <td className="px-4 py-2">{(sample.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2">
                    {sample.isBlink ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 font-sans font-semibold">
                        Blink
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 font-sans font-semibold">
                        Valid Gaze
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {gazeHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400 font-sans">
                    Waiting for camera stream samples... Click "Start Camera" above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
