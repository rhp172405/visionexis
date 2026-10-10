import { useEffect, useRef, useState } from "react";
import type { StudyTrialRecord, RecognitionTrialRecord } from "@/lib/memoryRecognitionTask";
import { Flame, Route, Square, MousePointer, Dot } from "lucide-react";

interface MemoryVisualizerProps {
  trial: StudyTrialRecord | RecognitionTrialRecord;
  phase: "study" | "recognition";
  width?: number;
  height?: number;
}

export function MemoryVisualizer({
  trial,
  phase,
  width = 560,
  height = 400,
}: MemoryVisualizerProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showScanpath, setShowScanpath] = useState(true);
  const [showRawPoints, setShowRawPoints] = useState(false);
  const [showAOI, setShowAOI] = useState(true);
  const [showMousePath, setShowMousePath] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isRecognition = phase === "recognition";
  const recTrial = isRecognition ? (trial as RecognitionTrialRecord) : null;
  const studyTrial = !isRecognition ? (trial as StudyTrialRecord) : null;

  // Render pure webcam gaze heatmap onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!showHeatmap || trial.rawGazeSamples.length === 0) return;

    // Filter valid webcam gaze samples
    const samples = trial.rawGazeSamples.filter(
      (s) => !s.blink && s.confidence >= 0.35
    );

    if (samples.length === 0) return;

    // 1. Draw radial gradient stamps for spatial density estimation
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const radius = 35;

    samples.forEach((s) => {
      const grad = tempCtx.createRadialGradient(s.gazeX, s.gazeY, 0, s.gazeX, s.gazeY, radius);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.22)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.10)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      tempCtx.fillStyle = grad;
      tempCtx.beginPath();
      tempCtx.arc(s.gazeX, s.gazeY, radius, 0, Math.PI * 2);
      tempCtx.fill();
    });

    // 2. Colorize alpha channel with thermal palette
    const imgData = tempCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const val = alpha / 255;
        let r = 0;
        let g = 0;
        let b = 0;

        if (val < 0.25) {
          b = Math.round(255 * (val / 0.25));
          g = Math.round(180 * (val / 0.25));
        } else if (val < 0.5) {
          g = 255;
          b = Math.round(255 * (1 - (val - 0.25) / 0.25));
          r = Math.round(50 * ((val - 0.25) / 0.25));
        } else if (val < 0.75) {
          r = Math.round(255 * ((val - 0.5) / 0.25));
          g = 255;
          b = 0;
        } else {
          r = 255;
          g = Math.round(255 * (1 - (val - 0.75) / 0.25));
          b = 0;
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = Math.round(alpha * 0.78);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [trial, showHeatmap, width, height]);

  return (
    <div className="space-y-3">
      {/* Layer Toggles Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showHeatmap
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            Gaze Heatmap (Webcam)
          </button>

          <button
            type="button"
            onClick={() => setShowScanpath(!showScanpath)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showScanpath
                ? "bg-teal-100 text-teal-900 border border-teal-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Route className="h-3.5 w-3.5 text-eyecog-teal" />
            Gaze Scanpath
          </button>

          <button
            type="button"
            onClick={() => setShowRawPoints(!showRawPoints)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showRawPoints
                ? "bg-sky-100 text-sky-900 border border-sky-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Dot className="h-3.5 w-3.5 text-sky-500" />
            Raw Gaze Points
          </button>

          <button
            type="button"
            onClick={() => setShowAOI(!showAOI)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showAOI
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Square className="h-3.5 w-3.5" />
            AOI Boundary
          </button>

          {isRecognition && (
            <button
              type="button"
              onClick={() => setShowMousePath(!showMousePath)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                showMousePath
                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <MousePointer className="h-3.5 w-3.5 text-purple-600" />
              Mouse Trajectory
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
          {studyTrial && (
            <>
              <span>Dwell: <strong className="text-eyecog-teal">{studyTrial.gazeMetrics.dwellTimeMs}ms</strong></span>
              <span>Attn: <strong className="text-slate-700">{studyTrial.gazeMetrics.dwellPercentage}%</strong></span>
              <span>Fixations: <strong className="text-slate-700">{studyTrial.gazeMetrics.fixationCount}</strong></span>
            </>
          )}
          {recTrial && (
            <>
              <span>RT: <strong className="text-slate-700">{recTrial.reactionTimeMs}ms</strong></span>
              <span>Choice: <strong className={recTrial.isCorrect ? "text-emerald-600" : "text-rose-600"}>{recTrial.selectedChoice}</strong></span>
              <span>Outcome: <strong className="font-bold text-slate-800">{recTrial.classification}</strong></span>
            </>
          )}
        </div>
      </div>

      {/* Visualizer Display Canvas & Viewport */}
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-slate-900 select-none shadow-inner flex items-center justify-center"
        style={{ width, height }}
      >
        {/* Rendered Stimulus Box & AOI */}
        <div
          className={`absolute flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${
            showAOI
              ? "border-teal-400 bg-slate-800/95 shadow-[0_0_20px_rgba(45,212,191,0.25)]"
              : "border-slate-700 bg-slate-800/90"
          }`}
          style={{
            left: trial.aoi.x,
            top: trial.aoi.y,
            width: trial.aoi.width,
            height: trial.aoi.height,
          }}
        >
          <span
            className="text-5xl font-extrabold"
            style={{ color: trial.stimulus.accentColor }}
          >
            {trial.stimulus.symbol}
          </span>
          <span className="mt-1.5 text-[11px] font-medium tracking-wide text-slate-300">
            {trial.stimulus.label}
          </span>

          {showAOI && (
            <span className="absolute bottom-1 right-2 text-[8px] font-mono text-teal-400">
              {trial.aoi.aoiId}
            </span>
          )}
        </div>

        {/* Heatmap Layer Canvas Overlay (Webcam Only) */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 z-15"
        />

        {/* Raw Gaze Points Scatter Overlay */}
        {showRawPoints && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-18">
            {trial.rawGazeSamples.map((s, idx) => (
              <circle
                key={`raw_${idx}`}
                cx={s.gazeX}
                cy={s.gazeY}
                r="3"
                fill={s.blink ? "rgba(239, 68, 68, 0.6)" : "rgba(56, 189, 248, 0.65)"}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
            ))}
          </svg>
        )}

        {/* SVG Scanpath & Saccade Vectors Layer (Webcam Gaze Only) */}
        {showScanpath && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-20">
            <defs>
              <marker
                id="saccade-arrow-mem"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(45, 212, 191, 0.9)" />
              </marker>
            </defs>

            {/* Saccade Lines */}
            {trial.fixations.map((fix, idx) => {
              if (idx === 0) return null;
              const prev = trial.fixations[idx - 1];
              return (
                <line
                  key={`sac_${idx}`}
                  x1={prev.meanX}
                  y1={prev.meanY}
                  x2={fix.meanX}
                  y2={fix.meanY}
                  stroke="rgba(45, 212, 191, 0.75)"
                  strokeWidth="2"
                  markerEnd="url(#saccade-arrow-mem)"
                />
              );
            })}

            {/* Fixation Circles */}
            {trial.fixations.map((fix, idx) => {
              const radius = Math.max(8, Math.min(24, Math.round(Math.sqrt(fix.duration) * 1.1)));
              const isFirst = idx === 0;
              const isLast = idx === trial.fixations.length - 1;

              return (
                <g key={`fix_${idx}`}>
                  <circle
                    cx={fix.meanX}
                    cy={fix.meanY}
                    r={radius}
                    fill={isLast ? "rgba(251, 191, 36, 0.6)" : isFirst ? "rgba(56, 189, 248, 0.6)" : "rgba(45, 212, 191, 0.45)"}
                    stroke={isLast ? "#f59e0b" : "#2dd4bf"}
                    strokeWidth="2"
                  />
                  <text
                    x={fix.meanX}
                    y={fix.meanY}
                    textAnchor="middle"
                    dy=".3em"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Separate Mouse Trajectory Overlay (Recognition Only) */}
        {isRecognition && showMousePath && recTrial && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-25">
            {recTrial.rawMouseEvents.map((m, idx) => {
              if (idx === 0 || m.type !== "move") return null;
              const prev = recTrial.rawMouseEvents[idx - 1];
              return (
                <line
                  key={`mouse_${idx}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={m.x}
                  y2={m.y}
                  stroke="rgba(192, 132, 252, 0.6)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              );
            })}
            <circle
              cx={recTrial.mouseMetrics.clickX}
              cy={recTrial.mouseMetrics.clickY}
              r="6"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
