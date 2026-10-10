/**
 * VISIONEXIS Dual-Modality Scanpath & Trajectory Viewer.
 * Renders both the Webcam Eye Gaze trajectory (teal) and Mouse Path (purple)
 * with fixation heat spots and click markers.
 */

import { useState } from "react";
import type { GazePoint } from "@/types";

interface ScanPathViewProps {
  points: GazePoint[];
  width: number;
  height: number;
}

export function ScanPathView({ points, width, height }: ScanPathViewProps) {
  const [showGaze, setShowGaze] = useState(true);
  const [showMouse, setShowMouse] = useState(true);

  const rawGaze = points.filter((p) => p.event_type === "raw" || (p.gx != null && p.gy != null));
  const fixations = points.filter((p) => p.event_type === "fixation");
  const clicks = points.filter((p) => p.event_type === "mouse_click" || p.click);
  const mouseSamples = points.filter((p) => p.mx != null && p.my != null);

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        No tracking data recorded for this task.
      </div>
    );
  }

  // Construct Gaze Path
  const gazePointsStr = rawGaze
    .map((p) => {
      const x = p.gx ?? p.x;
      const y = p.gy ?? p.y;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Construct Mouse Path
  const mousePointsStr = mouseSamples
    .map((p) => `${p.mx!.toFixed(1)},${p.my!.toFixed(1)}`)
    .join(" ");

  return (
    <div className="relative h-full w-full">
      {/* Legend & Stream Toggles */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-md bg-white/90 p-1.5 shadow-xs border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setShowGaze(!showGaze)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium transition-colors ${
            showGaze ? "bg-teal-100 text-teal-800" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-eyecog-teal" />
          Eye Gaze
        </button>
        <button
          type="button"
          onClick={() => setShowMouse(!showMouse)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-medium transition-colors ${
            showMouse ? "bg-purple-100 text-purple-800" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Mouse Path
        </button>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full rounded-md border border-slate-200 bg-slate-50"
      >
        {/* Mouse Path (Purple) */}
        {showMouse && mousePointsStr && (
          <polyline
            points={mousePointsStr}
            fill="none"
            stroke="#a855f7"
            strokeWidth={2}
            strokeOpacity={0.45}
            strokeDasharray="4 2"
          />
        )}

        {/* Eye Gaze Path (Teal) */}
        {showGaze && gazePointsStr && (
          <polyline
            points={gazePointsStr}
            fill="none"
            stroke="#14b8a6"
            strokeWidth={2}
            strokeOpacity={0.55}
          />
        )}

        {/* Fixation Spots (Orange circles) */}
        {showGaze &&
          fixations.map((f, i) => (
            <circle
              key={`fix-${i}`}
              cx={f.gx ?? f.x}
              cy={f.gy ?? f.y}
              r={Math.min(4 + (f.duration_ms ?? 0) / 60, 24)}
              fill="#f97316"
              fillOpacity={0.35}
              stroke="#f97316"
              strokeOpacity={0.7}
              strokeWidth={1.5}
            />
          ))}

        {/* Click Target Markers (Red) */}
        {showMouse &&
          clicks.map((c, i) => (
            <g key={`click-${i}`}>
              <circle
                cx={c.mx ?? c.x}
                cy={c.my ?? c.y}
                r={6}
                fill="#ef4444"
                fillOpacity={0.6}
                stroke="#b91c1c"
                strokeWidth={1.5}
              />
              <circle
                cx={c.mx ?? c.x}
                cy={c.my ?? c.y}
                r={12}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1}
                strokeOpacity={0.8}
              />
            </g>
          ))}
      </svg>
    </div>
  );
}
