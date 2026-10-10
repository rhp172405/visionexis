/**
 * 9-Point Interactive Webcam Calibration Screen.
 * Guides the user through a 3x3 point grid to build a personalized eye-feature to screen coordinate mapping.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Crosshair, Sparkles, X } from "lucide-react";
import { useGazeStore } from "@/stores/gazeStore";
import {
  CALIBRATION_POINTS_9,
  trainCalibrationModel,
  extractRegressionFeatures,
  type CalibrationPointSample,
  type CalibrationTarget,
} from "@/lib/webcam/calibration";
import { useWebcamTracker } from "@/hooks/useWebcamTracker";

const SAMPLES_PER_POINT = 20;
const POINT_SETTLE_MS = 600; // brief delay so user's eyes saccade and settle on point

type Step = "intro" | "calibrating" | "success" | "failed";

export function WebcamCalibrationModal() {
  const {
    calibrationModalOpen,
    setCalibrationModalOpen,
    setCalibrationModel,
  } = useGazeStore();

  const {
    videoRef,
    isCameraActive,
    isLoadingCamera,
    faceDetected,
    eyesDetected,
    lastFeatures,
    start,
  } = useWebcamTracker();

  const [step, setStep] = useState<Step>("intro");
  const [pointIndex, setPointIndex] = useState(0);
  const [sampleProgress, setSampleProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const samplesRef = useRef<CalibrationPointSample[]>([]);
  const currentTargetRef = useRef<CalibrationTarget>(CALIBRATION_POINTS_9[0]);
  const isCollectingRef = useRef(false);
  const settleTimeoutRef = useRef<number | null>(null);

  // Auto-start camera when calibration modal opens
  useEffect(() => {
    if (calibrationModalOpen) {
      setStep("intro");
      setPointIndex(0);
      setSampleProgress(0);
      samplesRef.current = [];
      if (!isCameraActive && !isLoadingCamera) {
        start();
      }
    }
  }, [calibrationModalOpen, isCameraActive, isLoadingCamera, start]);

  const handleClose = () => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    setCalibrationModalOpen(false);
  };

  const startCalibrationFlow = () => {
    samplesRef.current = [];
    setPointIndex(0);
    setSampleProgress(0);
    setStep("calibrating");
    preparePoint(0);
  };

  const preparePoint = (index: number) => {
    const target = CALIBRATION_POINTS_9[index];
    currentTargetRef.current = target;
    setPointIndex(index);
    setSampleProgress(0);
    isCollectingRef.current = false;

    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = window.setTimeout(() => {
      isCollectingRef.current = true;
    }, POINT_SETTLE_MS);
  };

  // Collect samples on each feature update from useWebcamTracker
  useEffect(() => {
    if (step !== "calibrating" || !isCollectingRef.current || !lastFeatures) return;
    if (lastFeatures.isBlink || !faceDetected) return;

    const target = currentTargetRef.current;
    const { featuresX, featuresY } = extractRegressionFeatures(lastFeatures);
    const meanRelX = (lastFeatures.leftIrisX + lastFeatures.rightIrisX) / 2.0;
    const meanRelY = (lastFeatures.leftIrisY + lastFeatures.rightIrisY) / 2.0;

    samplesRef.current.push({
      targetId: target.id,
      targetX: target.normX,
      targetY: target.normY,
      leftRelativeX: lastFeatures.leftIrisX,
      leftRelativeY: lastFeatures.leftIrisY,
      rightRelativeX: lastFeatures.rightIrisX,
      rightRelativeY: lastFeatures.rightIrisY,
      meanRelativeX: meanRelX,
      meanRelativeY: meanRelY,
      headYaw: lastFeatures.headYaw,
      headPitch: lastFeatures.headPitch,
      faceCenterX: lastFeatures.faceCenterX,
      faceCenterY: lastFeatures.faceCenterY,
      featuresX,
      featuresY,
      timestamp: performance.now(),
    });

    const samplesForCurrentPoint = samplesRef.current.filter((s) => s.targetId === target.id).length;
    const progress = Math.min(100, Math.round((samplesForCurrentPoint / SAMPLES_PER_POINT) * 100));
    setSampleProgress(progress);

    if (samplesForCurrentPoint >= SAMPLES_PER_POINT) {
      isCollectingRef.current = false;

      if (pointIndex + 1 < CALIBRATION_POINTS_9.length) {
        preparePoint(pointIndex + 1);
      } else {
        // Calibration finished, fit model
        finishCalibration();
      }
    }
  }, [lastFeatures, step, pointIndex, faceDetected]);

  const finishCalibration = () => {
    const model = trainCalibrationModel(samplesRef.current);
    if (model) {
      setCalibrationModel(model);
      setQualityScore(model.qualityScore);
      setStep("success");
    } else {
      setStep("failed");
    }
  };

  if (!calibrationModalOpen) return null;

  const currentTarget = CALIBRATION_POINTS_9[pointIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 select-none">
      {/* Hidden/Off-screen video stream required for media inference */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Modal Container */}
      <div className="relative flex flex-col h-[90vh] max-h-[850px] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-eyecog-teal/10 text-eyecog-teal">
              <Crosshair className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">9-Point Webcam Eye Tracking Calibration</h2>
              <p className="text-xs text-slate-500">
                Calibrates gaze estimation to your screen and eye geometry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="relative flex-1 bg-slate-50">
          {/* STEP 1: INTRO */}
          {step === "intro" && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-eyecog-teal/10 text-eyecog-teal">
                <Crosshair className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-800">Ready to Calibrate</h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Look directly at each of the 9 calibration points as they appear on the screen.
                Keep your head steady and follow the dot with your eyes.
              </p>

              {/* Live camera status badge */}
              <div className="mt-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <span>Camera: {isCameraActive ? "Ready" : "Connecting..."}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      faceDetected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                  <span>Face: {faceDetected ? "Centered ✓" : "Looking for face..."}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      eyesDetected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                  <span>Eyes: {eyesDetected ? "Detected ✓" : "Detecting..."}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={startCalibrationFlow}
                disabled={!isCameraActive || !faceDetected}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-eyecog-teal px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Start 9-Point Calibration
              </button>
            </div>
          )}

          {/* STEP 2: ACTIVE CALIBRATION GRID */}
          {step === "calibrating" && currentTarget && (
            <div className="relative h-full w-full">
              {/* HUD / Status Header */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full border border-slate-200 bg-white/90 px-6 py-2 shadow-sm backdrop-blur-sm text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-eyecog-teal">
                  Calibration {pointIndex + 1}/9
                </p>
                <p className="text-xs text-slate-500">
                  Please look steadily at the pulsing target ({currentTarget.label})
                </p>
              </div>

              {/* Background 9-point ghost dots */}
              {CALIBRATION_POINTS_9.map((pt, i) => (
                <div
                  key={pt.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${
                    i < pointIndex
                      ? "h-4 w-4 border-emerald-500 bg-emerald-500/20"
                      : i === pointIndex
                      ? "h-6 w-6 border-eyecog-teal bg-eyecog-teal/10 scale-125"
                      : "h-3 w-3 border-slate-300 bg-slate-200/50"
                  }`}
                  style={{ left: `${pt.normX * 100}%`, top: `${pt.normY * 100}%` }}
                />
              ))}

              {/* Active Target Point */}
              <div
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-500 ease-out"
                style={{
                  left: `${currentTarget.normX * 100}%`,
                  top: `${currentTarget.normY * 100}%`,
                }}
              >
                {/* Outer pulsing ripple */}
                <div className="absolute -inset-4 rounded-full bg-eyecog-teal/20 animate-ping" />

                {/* Progress Ring */}
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border-2 border-eyecog-teal">
                  <div
                    className="absolute inset-0 rounded-full border-4 border-eyecog-orange transition-all"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${sampleProgress > 25 ? "100% 0%," : ""}${
                        sampleProgress > 50 ? "100% 100%," : ""
                      }${sampleProgress > 75 ? "0% 100%," : ""} ${
                        sampleProgress > 0 ? "0% 0%" : "50% 0%"
                      })`,
                    }}
                  />
                  {/* Center Bullseye Dot */}
                  <div className="h-4 w-4 rounded-full bg-eyecog-teal" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === "success" && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="mt-4 text-2xl font-bold text-slate-800">Calibration Completed Successfully!</h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Your webcam eye tracking profile is now active. Estimated gaze coordinates are mapped accurately to the screen.
              </p>

              {qualityScore !== null && (
                <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3">
                  <span className="text-xs font-semibold text-emerald-800">Calibration Quality Score:</span>
                  <span className="text-lg font-bold text-emerald-700">{qualityScore}%</span>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={startCalibrationFlow}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Recalibrate
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl bg-eyecog-teal px-8 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-600 transition-all"
                >
                  Done &amp; Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FAILED */}
          {step === "failed" && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <h3 className="text-lg font-bold text-red-600">Calibration Incomplete</h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Not enough valid eye samples were recorded. Please ensure good lighting and face camera directly.
              </p>
              <button
                type="button"
                onClick={startCalibrationFlow}
                className="mt-6 rounded-xl bg-eyecog-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
