/**
 * VISIONEXIS Dual-Modality Comparison Analytics View.
 * Displays comparative analysis between Webcam Eye Gaze and Mouse Tracking.
 */

import { Eye, MousePointer, Activity, Gauge, Layers } from "lucide-react";
import type { DualModalityMetrics, GazePoint } from "@/types";

interface GazeMouseComparisonViewProps {
  metrics: DualModalityMetrics;
  points?: GazePoint[];
}

export function GazeMouseComparisonView({ metrics, points = [] }: GazeMouseComparisonViewProps) {
  // Compute time-series distance samples if points are provided
  const validDistances = points
    .filter((p) => p.distance_px != null)
    .map((p) => p.distance_px as number);

  const avgDist = metrics.avgGazeMouseDistancePx;
  const maxDist = metrics.maxGazeMouseDistancePx;
  const gazePath = metrics.gazePathLengthPx;
  const mousePath = metrics.mousePathLengthPx;

  // Path efficiency ratio (gaze exploration vs direct mouse path)
  const pathRatio = mousePath > 0 ? (gazePath / mousePath).toFixed(1) : "1.0";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-eyecog-teal" />
          <h3 className="text-sm font-bold text-slate-800">
            VISIONEXIS Dual-Stream Analysis (Webcam Gaze vs. Mouse Tracking)
          </h3>
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-eyecog-teal border border-teal-200">
          Synchronized Data
        </span>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* 1. Gaze-Mouse Distance */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Gaze-Mouse Dist.</span>
            <Activity className="h-4 w-4 text-eyecog-teal" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-800">{avgDist} px</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Peak: {maxDist} px</p>
        </div>

        {/* 2. Gaze Path Length */}
        <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-700">Eye Gaze Path</span>
            <Eye className="h-4 w-4 text-eyecog-teal" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-teal-900">{gazePath} px</p>
          <p className="mt-0.5 text-[10px] text-teal-600 font-medium">
            Fixations: {metrics.gazeFixationCount}
          </p>
        </div>

        {/* 3. Mouse Path Length */}
        <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">Mouse Path</span>
            <MousePointer className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-purple-900">{mousePath} px</p>
          <p className="mt-0.5 text-[10px] text-purple-600 font-medium">
            Cursor movement length
          </p>
        </div>

        {/* 4. Visual Exploration Ratio */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Exploration Ratio</span>
            <Gauge className="h-4 w-4 text-eyecog-orange" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-800">{pathRatio}×</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Gaze to Mouse Path ratio</p>
        </div>
      </div>

      {/* Visual Distance Stream Bar */}
      {validDistances.length > 0 && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Gaze vs. Mouse Spatial Offset Over Timeline</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {validDistances.length} synchronized samples
            </span>
          </div>
          {/* Mini Sparkline Bar representation */}
          <div className="flex h-12 items-end gap-1 overflow-hidden rounded bg-white p-1 border border-slate-100">
            {validDistances.slice(-50).map((d, i) => {
              const heightPct = Math.min(100, Math.max(8, (d / Math.max(maxDist, 1)) * 100));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all bg-gradient-to-t from-eyecog-teal to-purple-500 hover:opacity-80"
                  style={{ height: `${heightPct}%` }}
                  title={`Sample ${i + 1}: ${Math.round(d)}px distance`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-eyecog-teal" /> Webcam Gaze Stream
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Mouse Cursor Stream
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
