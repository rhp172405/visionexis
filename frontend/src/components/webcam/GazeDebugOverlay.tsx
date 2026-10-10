/**
 * VISIONEXIS Live Developer / Debug Telemetry Overlay Panel.
 * Provides real-time visibility into webcam camera status, facial landmark features,
 * iris coordinates, estimated gaze vs mouse position, gaze-mouse distance, and fixation metrics.
 */

import { useEffect, useState } from "react";
import { Camera, Eye, X, Terminal, CheckCircle2, AlertCircle } from "lucide-react";
import { useGazeStore } from "@/stores/gazeStore";

export function GazeDebugOverlay() {
  const {
    debugOverlayOpen,
    setDebugOverlayOpen,
    isCameraActive,
    faceDetected,
    eyesDetected,
    lastFeatures,
    currentGaze,
    cameraError,
    blinkCount,
    saccadeCount,
  } = useGazeStore();

  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
  const [windowDim, setWindowDim] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Listen for global mouse movement for debug comparison
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouseCoord({ x: e.clientX, y: e.clientY });
    };
    const handleResize = () => {
      setWindowDim({ w: window.innerWidth, h: window.innerHeight });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!debugOverlayOpen) return null;

  // Compute live gaze pixel coordinates across viewport
  const gazePixelX = currentGaze ? Math.round(currentGaze.normX * windowDim.w) : null;
  const gazePixelY = currentGaze ? Math.round(currentGaze.normY * windowDim.h) : null;

  const liveDistance =
    gazePixelX != null && gazePixelY != null
      ? Math.round(Math.hypot(gazePixelX - mouseCoord.x, gazePixelY - mouseCoord.y))
      : null;

  const [sampleLog, setSampleLog] = useState<
    Array<{ t: number; gx: number; gy: number; normX: number; normY: number; conf: number }>
  >([]);
  const [showSampleLog, setShowSampleLog] = useState(false);

  // Collect rolling buffer of last 20 raw samples
  useEffect(() => {
    if (!currentGaze) return;
    const px = Math.round(currentGaze.normX * windowDim.w);
    const py = Math.round(currentGaze.normY * windowDim.h);

    setSampleLog((prev) => [
      ...prev.slice(-19),
      {
        t: Math.round(currentGaze.timestamp % 100000),
        gx: px,
        gy: py,
        normX: Number(currentGaze.normX.toFixed(3)),
        normY: Number(currentGaze.normY.toFixed(3)),
        conf: Number(currentGaze.confidence.toFixed(2)),
      },
    ]);
  }, [currentGaze, windowDim]);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 rounded-xl border border-slate-700/80 bg-slate-900/95 p-4 text-xs font-mono text-slate-200 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2 text-eyecog-teal font-bold">
          <Terminal className="h-4 w-4" />
          <span>VISIONEXIS Live Telemetry</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSampleLog(!showSampleLog)}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              showSampleLog ? "bg-eyecog-teal text-slate-900" : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            {showSampleLog ? "Hide Log" : "20-Sample Log"}
          </button>
          <button
            type="button"
            onClick={() => setDebugOverlayOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
        {/* Hardware & Detection Status */}
        <div className="rounded-lg bg-slate-800/80 p-2.5 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Camera Status:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                isCameraActive ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <Camera className="h-3 w-3" />
              {isCameraActive ? "ACTIVE (30 FPS)" : "STANDBY"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Face Status:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                faceDetected ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {faceDetected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {faceDetected ? "DETECTED" : "NOT DETECTED"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Eye Status:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                eyesDetected ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <Eye className="h-3 w-3" />
              {lastFeatures?.isBlink ? "BLINKING" : eyesDetected ? "TRACKING" : "OBSCURED"}
            </span>
          </div>

          {cameraError && (
            <div className="text-[11px] text-rose-400 border-t border-rose-900/50 pt-1 mt-1">
              Error: {cameraError.message}
            </div>
          )}
        </div>

        {/* MediaPipe Eye / Iris Feature Landmarks */}
        <div className="rounded-lg bg-slate-800/80 p-2.5 border border-slate-700/50 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-eyecog-teal mb-1">
            MediaPipe Iris Features
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Left Iris X:</span>{" "}
              <span className="text-slate-100 font-bold">
                {lastFeatures ? lastFeatures.leftIrisX.toFixed(3) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Left Iris Y:</span>{" "}
              <span className="text-slate-100 font-bold">
                {lastFeatures ? lastFeatures.leftIrisY.toFixed(3) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Right Iris X:</span>{" "}
              <span className="text-slate-100 font-bold">
                {lastFeatures ? lastFeatures.rightIrisX.toFixed(3) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Right Iris Y:</span>{" "}
              <span className="text-slate-100 font-bold">
                {lastFeatures ? lastFeatures.rightIrisY.toFixed(3) : "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[10px] text-slate-400">
            <span>Mean EAR (Openness): {lastFeatures ? lastFeatures.meanEar.toFixed(2) : "—"}</span>
            <span>Blinks: {blinkCount}</span>
            <span>Saccades: {saccadeCount}</span>
          </div>
        </div>

        {/* Estimated Gaze vs Mouse Comparison */}
        <div className="rounded-lg bg-slate-800/80 p-2.5 border border-slate-700/50 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1">
            Dual-Modality Coordinates
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Est. Gaze (Norm):</span>
              <p className="font-bold text-teal-300">
                {currentGaze
                  ? `(${currentGaze.normX.toFixed(2)}, ${currentGaze.normY.toFixed(2)})`
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Est. Gaze (Px):</span>
              <p className="font-bold text-teal-300">
                {gazePixelX != null ? `(${gazePixelX}, ${gazePixelY})` : "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Mouse (Px):</span>
              <p className="font-bold text-purple-300">({mouseCoord.x}, {mouseCoord.y})</p>
            </div>
            <div>
              <span className="text-slate-400">Gaze Confidence:</span>
              <p className="font-bold text-emerald-400">
                {currentGaze ? `${Math.round(currentGaze.confidence * 100)}%` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between rounded bg-slate-900 px-2 py-1 border border-slate-700/40">
            <span className="text-slate-400 font-medium">Gaze-Mouse Distance:</span>
            <span className="text-amber-400 font-bold text-sm">
              {liveDistance != null ? `${liveDistance} px` : "—"}
            </span>
          </div>
        </div>

        {/* 20-Sample Consecutive Raw Gaze Log */}
        {showSampleLog && (
          <div className="rounded-lg bg-slate-950 p-2 border border-slate-800 space-y-1 text-[10px]">
            <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">
              Last 20 Webcam Gaze Samples:
            </p>
            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-left font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="py-0.5">T(ms)</th>
                    <th>Norm(X,Y)</th>
                    <th>Px(X,Y)</th>
                    <th>Conf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {sampleLog.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-900">
                      <td className="py-0.5 text-slate-500">{s.t}</td>
                      <td className="text-teal-400">({s.normX}, {s.normY})</td>
                      <td className="text-purple-300">({s.gx}, {s.gy})</td>
                      <td className="text-emerald-400">{s.conf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

