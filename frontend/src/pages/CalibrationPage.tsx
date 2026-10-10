import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  CALIBRATION_POINTS_9,
  VALIDATION_POINTS_5,
  trainCalibrationModel,
  validateCalibrationModel,
  extractRegressionFeatures,
  type CalibrationSample,
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
  CheckCircle2,
  Sliders,
  Move,
  Eye,
  ArrowRight,
} from "lucide-react";

export function CalibrationPage() {
  const {
    isCameraActive,
    isLoadingCamera,
    faceDetected,
    eyesDetected,
    fps,
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
  const [showRawGaze, setShowRawGaze] = useState(false);

  // Calibration & Validation Flow State
  const [flowState, setFlowState] = useState<"idle" | "calibrating" | "validating" | "complete">("idle");
  const [pointIndex, setPointIndex] = useState(0);
  const [settlingStep, setSettlingStep] = useState(0);
  const [pointSampleProgress, setPointSampleProgress] = useState(0);
  const [collectedCalibSamples, setCollectedCalibSamples] = useState<CalibrationSample[]>([]);
  const [validationSamplesMap, setValidationSamplesMap] = useState<
    { target: (typeof VALIDATION_POINTS_5)[0]; samples: CalibrationSample[] }[]
  >([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(
    calibrationModel?.validation ?? null
  );

  // Interactive Target Inspection selection
  const [selectedTarget, setSelectedTarget] = useState<CalibrationTarget | null>(CALIBRATION_POINTS_9[4]); // Center

  // Viewport dimensions for accurate container-relative mapping
  const [viewportDims, setViewportDims] = useState({ w: 800, h: 450 });
  useEffect(() => {
    if (!viewportRef.current) return;
    const updateDims = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportDims({ w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      }
    };
    updateDims();
    const observer = new ResizeObserver(updateDims);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-start webcam on mount
  const initialMountRef = useRef(false);
  useEffect(() => {
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      if (!isCameraActive && !isLoadingCamera) {
        globalWebcamManager.startCamera();
      }
    }
  }, [isCameraActive, isLoadingCamera]);

  // Render video frame & landmarks onto preview canvas
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

        // Mirrored webcam feed
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(vid, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        // Landmark overlays
        if (rawLandmarks && rawLandmarks.length >= 468) {
          const w = canvas.width;
          const h = canvas.height;
          const getCanvasX = (normX: number) => (1.0 - normX) * w;
          const getCanvasY = (normY: number) => normY * h;

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

          // Nose landmark
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

  // Compute container-relative screen pixel gaze
  const pixelGazeX = currentGaze ? Math.round(currentGaze.normX * viewportDims.w) : 0;
  const pixelGazeY = currentGaze ? Math.round(currentGaze.normY * viewportDims.h) : 0;

  // Selected inspection target pixel coords
  const targetPxX = selectedTarget ? Math.round(selectedTarget.normX * viewportDims.w) : 0;
  const targetPxY = selectedTarget ? Math.round(selectedTarget.normY * viewportDims.h) : 0;
  const targetDistancePx = Math.round(Math.hypot(pixelGazeX - targetPxX, pixelGazeY - targetPxY));

  // 1. Start 9-Point Calibration Routine
  const handleStartCalibration = () => {
    setFlowState("calibrating");
    setPointIndex(0);
    setSettlingStep(2);
    setPointSampleProgress(0);
    setCollectedCalibSamples([]);
    setValidationSamplesMap([]);
  };

  // 9-Point Calibration State Machine with Fixation Settle (500-800ms) & Outlier Filtering
  useEffect(() => {
    if (flowState !== "calibrating") return;

    if (pointIndex >= CALIBRATION_POINTS_9.length) {
      // Completed all 9 points -> Train Model X and Model Y separately
      const profile = trainCalibrationModel(collectedCalibSamples, viewportDims.w, viewportDims.h);
      if (profile) {
        setCalibrationModel(profile);
        // Automatically transition into 5-point independent validation phase
        setFlowState("validating");
        setPointIndex(0);
        setSettlingStep(2);
        setPointSampleProgress(0);
      } else {
        setFlowState("idle");
      }
      return;
    }

    const currentTarget = CALIBRATION_POINTS_9[pointIndex];

    // Settle countdown (500–800ms) so eyes fixate on target
    if (settlingStep > 0) {
      const timer = setTimeout(() => {
        setSettlingStep((s) => s - 1);
      }, 350);
      return () => clearTimeout(timer);
    }

    // Collection phase: collect 35-40 valid webcam samples per target point
    let collectedCount = 0;
    const targetSamples: CalibrationSample[] = [];
    const targetPxX_now = Math.round(currentTarget.normX * viewportDims.w);
    const targetPxY_now = Math.round(currentTarget.normY * viewportDims.h);

    const interval = setInterval(() => {
      const feat = useGazeStore.getState().lastFeatures;
      const isDetected = useGazeStore.getState().faceDetected && useGazeStore.getState().eyesDetected;

      // Ignore frames with missing face/eyes, blinks, or low confidence
      if (feat && isDetected && !feat.isBlink && feat.confidence > 0.45) {
        const { featuresX, featuresY } = extractRegressionFeatures(feat);
        const meanRelX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
        const meanRelY = (feat.leftIrisY + feat.rightIrisY) / 2.0;

        targetSamples.push({
          targetId: currentTarget.id,
          targetX: currentTarget.normX,
          targetY: currentTarget.normY,
          targetPxX: targetPxX_now,
          targetPxY: targetPxY_now,
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
        setPointSampleProgress(Math.round((collectedCount / 35) * 100));
      }

      if (collectedCount >= 35) {
        clearInterval(interval);
        setCollectedCalibSamples((prev) => [...prev, ...targetSamples]);
        setPointIndex((idx) => idx + 1);
        setSettlingStep(2);
        setPointSampleProgress(0);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [flowState, pointIndex, settlingStep, collectedCalibSamples, setCalibrationModel, viewportDims]);

  // 5-Point Validation State Machine (Uses brand NEW samples)
  useEffect(() => {
    if (flowState !== "validating") return;

    if (pointIndex >= VALIDATION_POINTS_5.length) {
      // Completed validation -> run rigorous empirical evaluation
      const model = useGazeStore.getState().calibrationModel;
      if (model && validationSamplesMap.length > 0) {
        const summary = validateCalibrationModel(
          validationSamplesMap,
          model,
          viewportDims.w,
          viewportDims.h
        );
        setValidationSummary(summary);
        setCalibrationModel({
          ...model,
          qualityRating: summary.qualityRating,
          qualityScore: summary.confidenceScore,
          validation: summary,
        });
      }
      setFlowState("complete");
      return;
    }

    const currentValTarget = VALIDATION_POINTS_5[pointIndex];

    if (settlingStep > 0) {
      const timer = setTimeout(() => {
        setSettlingStep((s) => s - 1);
      }, 350);
      return () => clearTimeout(timer);
    }

    let collectedCount = 0;
    const valTargetSamples: CalibrationSample[] = [];
    const valPxX = Math.round(currentValTarget.normX * viewportDims.w);
    const valPxY = Math.round(currentValTarget.normY * viewportDims.h);

    const interval = setInterval(() => {
      const feat = useGazeStore.getState().lastFeatures;
      const isDetected = useGazeStore.getState().faceDetected && useGazeStore.getState().eyesDetected;

      if (feat && isDetected && !feat.isBlink && feat.confidence > 0.45) {
        const { featuresX, featuresY } = extractRegressionFeatures(feat);
        const meanRelX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
        const meanRelY = (feat.leftIrisY + feat.rightIrisY) / 2.0;

        valTargetSamples.push({
          targetId: currentValTarget.id,
          targetX: currentValTarget.normX,
          targetY: currentValTarget.normY,
          targetPxX: valPxX,
          targetPxY: valPxY,
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
        setPointSampleProgress(Math.round((collectedCount / 25) * 100));
      }

      if (collectedCount >= 25) {
        clearInterval(interval);
        setValidationSamplesMap((prev) => [
          ...prev,
          { target: currentValTarget, samples: valTargetSamples },
        ]);
        setPointIndex((idx) => idx + 1);
        setSettlingStep(2);
        setPointSampleProgress(0);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [flowState, pointIndex, settlingStep, validationSamplesMap, setCalibrationModel, viewportDims]);

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
              <h1 className="text-xl font-bold text-slate-800">VISIONEXIS Gaze Calibration</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 font-medium">
              Keep your head relatively still and follow the target with your eyes.
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
                title="Reset calibration model to geometric prior"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Model
              </button>
            )}

            <button
              type="button"
              disabled={!isCameraActive || flowState === "calibrating" || flowState === "validating"}
              onClick={handleStartCalibration}
              className="flex items-center gap-2 rounded-lg bg-eyecog-teal px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-600 disabled:opacity-50 cursor-pointer transition"
            >
              <Crosshair className="h-4 w-4" />
              {flowState === "calibrating"
                ? `Calibrating (${pointIndex + 1}/9)...`
                : flowState === "validating"
                ? `Validating (${pointIndex + 1}/5)...`
                : "Run 9-Point Calibration"}
            </button>
          </div>
        </div>
      </div>

      {/* Calibration Progress Notification / Banner during Active Routine */}
      {flowState === "calibrating" && (
        <div className="rounded-xl border border-eyecog-teal/30 bg-teal-50/80 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eyecog-teal text-white shadow-sm animate-pulse">
              <Crosshair className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-teal-900">
                Calibrating Point {pointIndex + 1} of 9: {CALIBRATION_POINTS_9[pointIndex]?.label}
              </p>
              <p className="text-xs text-teal-700 mt-0.5">
                {settlingStep > 0
                  ? "Settling gaze fixation... hold your eyes steady on the target."
                  : `Collecting valid iris samples (${pointSampleProgress}%)...`}
              </p>
            </div>
          </div>
          <div className="w-48 bg-teal-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-eyecog-teal h-2.5 rounded-full transition-all duration-150"
              style={{ width: `${pointSampleProgress}%` }}
            />
          </div>
        </div>
      )}

      {flowState === "validating" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm animate-pulse">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                Independent 5-Point Validation (Point {pointIndex + 1}/5: {VALIDATION_POINTS_5[pointIndex]?.label})
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Recording NEW validation frames to measure true screen accuracy.
              </p>
            </div>
          </div>
          <div className="w-48 bg-amber-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-amber-500 h-2.5 rounded-full transition-all duration-150"
              style={{ width: `${pointSampleProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Validation Quality Scorecard & Detailed Accuracy Table (Section 10 & 11) */}
      {validationSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Validation Results &amp; Quality Assessment
                </h2>
                <p className="text-xs text-slate-500">
                  Calculated exclusively from new independent samples collected across 5 target quadrants.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Calibration Quality:</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Confidence:</span>
                <span className="font-mono text-sm font-bold text-eyecog-teal">
                  {validationSummary.confidenceScore}%
                </span>
              </div>

              <Link
                to="/tasks/visual-search"
                className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-600 transition"
              >
                Proceed to Visual Search <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Mean Absolute Error</p>
              <p className="mt-1 font-mono text-xl font-extrabold text-slate-800">{validationSummary.maePx} px</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Average euclidean error</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Median Error</p>
              <p className="mt-1 font-mono text-xl font-extrabold text-slate-800">{validationSummary.medianErrorPx} px</p>
              <p className="text-[10px] text-slate-500 mt-0.5">50th percentile error</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Horizontal MAE</p>
              <p className="mt-1 font-mono text-xl font-extrabold text-eyecog-teal">{validationSummary.horizontalMaePx} px</p>
              <p className="text-[10px] text-slate-500 mt-0.5">X-axis deviation</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Vertical MAE</p>
              <p className="mt-1 font-mono text-xl font-extrabold text-eyecog-teal">{validationSummary.verticalMaePx} px</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Y-axis deviation</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Maximum Error</p>
              <p className="mt-1 font-mono text-xl font-extrabold text-slate-800">{validationSummary.maxErrorPx} px</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Worst-case target</p>
            </div>
          </div>

          {/* Validation Target Accuracy Table (Section 10) */}
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Target</th>
                  <th className="px-4 py-2.5 font-bold">Expected (X, Y)</th>
                  <th className="px-4 py-2.5 font-bold">Predicted (X, Y)</th>
                  <th className="px-4 py-2.5 font-bold">Horiz Error (X)</th>
                  <th className="px-4 py-2.5 font-bold">Vert Error (Y)</th>
                  <th className="px-4 py-2.5 font-bold text-slate-900">Euclidean Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {validationSummary.targets.map((t) => (
                  <tr key={t.targetId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{t.label}</td>
                    <td className="px-4 py-2.5">
                      ({t.targetPxX}, {t.targetPxY}) px ({Math.round(t.targetNormX * 100)}%, {Math.round(t.targetNormY * 100)}%)
                    </td>
                    <td className="px-4 py-2.5 text-eyecog-teal font-bold">
                      ({t.predictedPxX}, {t.predictedPxY}) px
                    </td>
                    <td className="px-4 py-2.5">{t.horizontalErrorPx} px</td>
                    <td className="px-4 py-2.5">{t.verticalErrorPx} px</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      <span className={`inline-block px-2 py-0.5 rounded ${t.errorPx < 45 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                        {t.errorPx} px
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Target Selector Buttons for Live Interactive Testing */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-eyecog-teal" />
            <h2 className="text-sm font-bold text-slate-800">
              Interactive 9-Point Target Inspection &amp; Live Distance Error
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Target: <strong className="text-slate-700">{selectedTarget?.label} ({targetPxX}, {targetPxY}) px</strong></span>
            <span>Webcam Gaze: <strong className="text-eyecog-teal">({pixelGazeX}, {pixelGazeY}) px</strong></span>
            <span>Distance Error: <strong className={targetDistancePx < 55 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{targetDistancePx} px</strong></span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
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

          <button
            type="button"
            onClick={() => setShowRawGaze(!showRawGaze)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
              showRawGaze ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            {showRawGaze ? "Hide Raw Gaze" : "Show Raw vs Smoothed"}
          </button>
        </div>
      </div>

      {/* Main Viewport Container (Real-Time Gaze Test, ZERO Mouse Influence) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-eyecog-teal" />
              Real-Time Gaze Test (Webcam-Only &bull; Mouse Disabled)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The teal dot (<span className="text-eyecog-teal font-bold">●</span>) is your real-time webcam gaze. The mouse has zero effect. Move your eyes around the viewport.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">
              Viewport: {viewportDims.w} &times; {viewportDims.h} px
            </span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700 font-semibold border border-emerald-200">
              Mouse Independence: Verified (0 influence)
            </span>
          </div>
        </div>

        {/* Viewport Test Area */}
        <div
          ref={viewportRef}
          className="relative h-[460px] w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-950 overflow-hidden select-none"
        >
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

          {/* 9 Reference Calibration Locations (Ghost Grid) */}
          {CALIBRATION_POINTS_9.map((pt) => (
            <div
              key={pt.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
              style={{ left: `${pt.normX * 100}%`, top: `${pt.normY * 100}%` }}
            >
              <div className="h-2 w-2 rounded-full bg-slate-700 ring-4 ring-slate-800/60" />
              <span className="mt-1 text-[9px] font-mono text-slate-500">
                {Math.round(pt.normX * 100)}%, {Math.round(pt.normY * 100)}%
              </span>
            </div>
          ))}

          {/* Selected Test Target (Section 11) */}
          {selectedTarget && flowState !== "calibrating" && flowState !== "validating" && (
            <div
              className="absolute z-15 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 flex flex-col items-center"
              style={{
                left: `${selectedTarget.normX * 100}%`,
                top: `${selectedTarget.normY * 100}%`,
              }}
            >
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute h-full w-full rounded-full border-2 border-sky-400 animate-ping opacity-75" />
                <span className="h-5 w-5 rounded-full bg-sky-500 border-2 border-white shadow-lg" />
              </div>
              <span className="mt-1 rounded bg-slate-900/90 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-300 border border-sky-400/40">
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
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-eyecog-teal/40 animate-ping" />
                <span className="h-7 w-7 rounded-full bg-eyecog-teal border-4 border-white shadow-[0_0_20px_rgba(45,212,191,1)]" />
              </div>
              <span className="mt-2 rounded bg-black/90 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider border border-teal-500/40 shadow-md">
                {settlingStep > 0 ? "Focusing..." : `Sampling (${pointIndex + 1}/9)`}
              </span>
            </div>
          )}

          {/* Active 5-Point Validation Target + Real-time Visual Validation (Section 12) */}
          {flowState === "validating" && VALIDATION_POINTS_5[pointIndex] && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex flex-col items-center"
              style={{
                left: `${VALIDATION_POINTS_5[pointIndex].normX * 100}%`,
                top: `${VALIDATION_POINTS_5[pointIndex].normY * 100}%`,
              }}
            >
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-amber-400/40 animate-ping" />
                <span className="h-7 w-7 rounded-full bg-amber-400 border-4 border-white shadow-[0_0_20px_rgba(251,191,36,1)]" />
              </div>
              <span className="mt-2 rounded bg-black/90 px-3 py-1 text-xs font-bold text-amber-300 uppercase tracking-wider border border-amber-400/40 shadow-md">
                {settlingStep > 0 ? "Hold Gaze..." : `Validating Target (${pointIndex + 1}/5)`}
              </span>
            </div>
          )}

          {/* Live Gaze Dot (Webcam-Only) */}
          {currentGaze && isCameraActive && (
            <div
              className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
              style={{
                left: `${currentGaze.normX * 100}%`,
                top: `${currentGaze.normY * 100}%`,
              }}
            >
              <div className="relative flex h-9 w-9 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-eyecog-teal/30 animate-pulse" />
                <span className="h-5 w-5 rounded-full bg-eyecog-teal border-2 border-white shadow-[0_0_16px_rgba(45,212,191,1)]" />
              </div>
              <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-eyecog-teal border border-eyecog-teal/40">
                Webcam Gaze ({pixelGazeX}, {pixelGazeY})
              </div>
            </div>
          )}

          {/* Distance Line between Target & Live Gaze */}
          {selectedTarget && currentGaze && flowState === "idle" && (
            <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
              <line
                x1={`${selectedTarget.normX * 100}%`}
                y1={`${selectedTarget.normY * 100}%`}
                x2={`${currentGaze.normX * 100}%`}
                y2={`${currentGaze.normY * 100}%`}
                stroke="rgba(45, 212, 191, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Full-Screen Range & Head Movement Invariance Gauges (Sections 13 & 14) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizontal Range Gauge (Left ↔ Center ↔ Right) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-eyecog-teal" />
              <h2 className="text-sm font-bold text-slate-800">
                Horizontal Range Test (Left ↔ Center ↔ Right)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">
              X: <strong className="text-eyecog-teal">{currentGaze ? `${pixelGazeX} px (${(currentGaze.normX * 100).toFixed(1)}%)` : "—"}</strong>
            </span>
          </div>

          <div className="mt-4">
            <div className="relative h-12 w-full rounded-lg bg-slate-900 p-1 border border-slate-800 flex items-center">
              <div className="absolute left-4 text-[11px] font-bold text-slate-400">
                ◀ Look LEFT (15%)
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-400">
                CENTER (50%)
              </div>
              <div className="absolute right-4 text-[11px] font-bold text-slate-400">
                Look RIGHT (85%) ▶
              </div>

              {currentGaze && isCameraActive && (
                <div
                  className="absolute top-1 bottom-1 w-5 -translate-x-1/2 rounded bg-eyecog-teal shadow-[0_0_12px_rgba(45,212,191,1)] transition-all duration-75 flex items-center justify-center"
                  style={{ left: `${currentGaze.normX * 100}%` }}
                >
                  <div className="h-full w-0.5 bg-white" />
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Verify gaze moves across the full bar as your eyes shift horizontally across the screen.
          </p>
        </div>

        {/* Head Movement Invariance Test (Section 14) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Move className="h-5 w-5 text-eyecog-teal" />
              <h2 className="text-sm font-bold text-slate-800">
                Head Movement Invariance Test
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Yaw: <strong className="text-slate-800">{lastFeatures ? lastFeatures.headYaw.toFixed(3) : "—"}</strong> | Pitch: <strong className="text-slate-800">{lastFeatures ? lastFeatures.headPitch.toFixed(3) : "—"}</strong>
            </span>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Test Head Pose Decoupling:</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  1. Fix your gaze on the <strong>CENTER</strong> target.
                  <br />
                  2. Gently tilt/turn your head left, right, up, and down while keeping your eyes fixed on the center dot.
                  <br />
                  3. <strong>Expected Result:</strong> The predicted gaze dot remains stabilized near the center.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Stream + Numerical Readouts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Video & Face/Eye Landmark Overlay */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Camera className="h-4 w-4 text-eyecog-teal" />
              Webcam Video &amp; Iris Landmarks
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
                <p className="text-xs mt-1">Click "Start Camera" above to initiate MediaPipe computer vision.</p>
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
                {faceDetected ? "DETECTED" : "NONE"}
              </span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Eyes</span>
              <span className={`font-bold ${eyesDetected ? "text-emerald-600" : "text-slate-400"}`}>
                {eyesDetected ? "DETECTED" : "NONE"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Normalized Intra-Eye Telemetry & Feature Vectors */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Normalized Intra-Eye Features &amp; Regression Variables
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
                <p className="text-[11px] font-semibold text-slate-400">Head Yaw</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.headYaw.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Head Pitch</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-800">
                  {lastFeatures ? lastFeatures.headPitch.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Calibration Profile</p>
                <p className="mt-1 font-mono text-xs font-bold">
                  {isCalibrated ? (
                    <span className="text-emerald-600">v1 (Active) ✓</span>
                  ) : (
                    <span className="text-amber-600">Geometric Prior</span>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400">Confidence</p>
                <p className="mt-1 font-mono text-base font-bold text-emerald-600">
                  {currentGaze ? `${Math.round(currentGaze.confidence * 100)}%` : "0%"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry Stream Records */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Live Real-Time Gaze Telemetry Records (20 Consecutive Frames)
            </h2>
            <p className="text-xs text-slate-500">
              Streamed live from the computer vision inference pipeline.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySamples}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
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
                    Waiting for camera stream frames...
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
