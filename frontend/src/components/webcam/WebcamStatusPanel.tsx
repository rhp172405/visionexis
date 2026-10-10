/**
 * Webcam Status & Eye-Tracking Control Panel.
 * Provides camera start/stop, gaze source selector, real-time status indicators,
 * 9-point calibration trigger, "Show Gaze" toggle, and privacy notice.
 */

import {
  Camera,
  CameraOff,
  Crosshair,
  Eye,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useGazeStore } from "@/stores/gazeStore";
import { useWebcamTracker } from "@/hooks/useWebcamTracker";

interface WebcamStatusPanelProps {
  showPreview?: boolean;
}

export function WebcamStatusPanel({ showPreview = true }: WebcamStatusPanelProps) {
  const {
    gazeSource,
    setGazeSource,
    showGazeDot,
    setShowGazeDot,
    isCalibrated,
    setCalibrationModalOpen,
    cameraWarning,
    cameraError,
    blinkCount,
    saccadeCount,
  } = useGazeStore();

  const {
    videoRef,
    isCameraActive,
    isLoadingCamera,
    faceDetected,
    eyesDetected,
    start,
    stop,
  } = useWebcamTracker();

  // If user changes gaze source to webcam, automatically attempt to start if not running
  const handleSourceChange = (src: "webcam" | "mouse") => {
    setGazeSource(src);
    if (src === "webcam" && !isCameraActive) {
      start();
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-eyecog-teal" />
          <h3 className="text-sm font-semibold text-slate-800">Gaze Tracking System</h3>
        </div>

        {/* Gaze Source Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Source:</span>
          <div className="inline-flex rounded-md bg-slate-200/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => handleSourceChange("webcam")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                gazeSource === "webcam"
                  ? "bg-white font-semibold text-eyecog-teal shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Webcam (Primary)
            </button>
            <button
              type="button"
              onClick={() => handleSourceChange("mouse")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                gazeSource === "mouse"
                  ? "bg-white font-semibold text-eyecog-teal shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mouse / Demo
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Indicators Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
          {/* 1. Camera */}
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <div>
              <p className="text-slate-400 font-medium">Camera</p>
              <p className="font-semibold text-slate-700">
                {isCameraActive ? "Connected ✓" : "Not connected"}
              </p>
            </div>
          </div>

          {/* 2. Face Detection */}
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                faceDetected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <div>
              <p className="text-slate-400 font-medium">Face</p>
              <p className="font-semibold text-slate-700">
                {faceDetected ? "Detected ✓" : "Not detected"}
              </p>
            </div>
          </div>

          {/* 3. Eyes Detection */}
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                eyesDetected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <div>
              <p className="text-slate-400 font-medium">Eyes</p>
              <p className="font-semibold text-slate-700">
                {eyesDetected ? "Detected ✓" : "Not detected"}
              </p>
            </div>
          </div>

          {/* 4. Calibration */}
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isCalibrated ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <div>
              <p className="text-slate-400 font-medium">Calibration</p>
              <p className="font-semibold text-slate-700">
                {isCalibrated ? "Complete ✓" : "Required"}
              </p>
            </div>
          </div>

          {/* 5. Gaze Tracking */}
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                (gazeSource === "webcam" && isCameraActive) || gazeSource === "mouse"
                  ? "bg-emerald-500"
                  : "bg-slate-300"
              }`}
            />
            <div>
              <p className="text-slate-400 font-medium">Tracking</p>
              <p className="font-semibold text-slate-700">
                {(gazeSource === "webcam" && isCameraActive) || gazeSource === "mouse"
                  ? "Active ✓"
                  : "Standby"}
              </p>
            </div>
          </div>
        </div>

        {/* Camera Error / Warning Messages */}
        {cameraError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{cameraError.message}</span>
          </div>
        )}

        {isCameraActive && cameraWarning && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>{cameraWarning}</span>
          </div>
        )}

        {/* Controls & Camera Preview Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Camera Start / Stop */}
            {gazeSource === "webcam" && (
              <>
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={start}
                    disabled={isLoadingCamera}
                    className="inline-flex items-center gap-1.5 rounded-md bg-eyecog-teal px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-600 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    {isLoadingCamera ? "Connecting..." : "Start Camera"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                  >
                    <CameraOff className="h-4 w-4 text-slate-500" />
                    Stop Camera
                  </button>
                )}

                {/* 9-Point Calibration Button */}
                <button
                  type="button"
                  onClick={() => setCalibrationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-eyecog-teal px-3.5 py-2 text-xs font-semibold text-eyecog-teal hover:bg-eyecog-teal/5"
                >
                  <Crosshair className="h-4 w-4" />
                  {isCalibrated ? "Recalibrate (9-point)" : "Run 9-Point Calibration"}
                </button>
              </>
            )}

            {/* Show Gaze Toggle */}
            <button
              type="button"
              onClick={() => setShowGazeDot(!showGazeDot)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                showGazeDot
                  ? "border-eyecog-orange/50 bg-eyecog-orange/10 text-eyecog-orange"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {showGazeDot ? (
                <ToggleRight className="h-4 w-4 text-eyecog-orange" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              Show Gaze: <span className="font-bold">{showGazeDot ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Eye stats counter during active session */}
          {isCameraActive && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-1">
                Blinks: <strong className="text-slate-700">{blinkCount}</strong>
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                Saccades: <strong className="text-slate-700">{saccadeCount}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Video element (active video feed or preview) */}
        <div className={`relative overflow-hidden rounded-md border border-slate-200 bg-slate-900 ${
          showPreview && isCameraActive ? "block h-32 w-48" : "hidden"
        }`}>
          <video
            ref={videoRef}
            className="h-full w-full object-cover -scale-x-100"
            playsInline
            muted
          />
          <div className="absolute top-1 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            Webcam Feed
          </div>
          {faceDetected && (
            <div className="absolute bottom-1 right-2 rounded bg-emerald-600/80 px-1.5 py-0.5 text-[10px] text-white">
              Face Tracked
            </div>
          )}
        </div>

        {/* Video element anchor when preview is hidden (needed for MediaPipe loop) */}
        {!showPreview && (
          <video ref={videoRef} className="hidden" playsInline muted />
        )}

        {/* Privacy Message */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Camera frames are processed locally for eye tracking. Raw video is not stored or transmitted.</span>
        </div>
      </div>
    </div>
  );
}
