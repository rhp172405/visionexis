/**
 * Real-Time Gaze Debug Dot.
 * Displays a visual indicator on screen representing estimated eye gaze when "Show Gaze" toggle is active.
 */

import { useGazeStore } from "@/stores/gazeStore";

export function GazeDebugDot() {
  const { showGazeDot, currentGaze, gazeSource, isCameraActive } = useGazeStore();

  if (!showGazeDot || gazeSource !== "webcam" || !isCameraActive || !currentGaze) {
    return null;
  }

  const { normX, normY, confidence, isBlink } = currentGaze;

  if (isBlink) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
      style={{
        left: `${normX * 100}vw`,
        top: `${normY * 100}vh`,
      }}
    >
      {/* Outer glow ring */}
      <div
        className="h-8 w-8 rounded-full border-2 border-eyecog-orange/70 bg-eyecog-orange/15 animate-pulse shadow-sm"
        style={{
          transform: `scale(${0.8 + confidence * 0.4})`,
        }}
      />
      {/* Center gaze dot */}
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-eyecog-orange shadow-md" />
      {/* Label tooltip */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-xs">
        Gaze ({(normX * 100).toFixed(0)}%, {(normY * 100).toFixed(0)}%)
      </div>
    </div>
  );
}
