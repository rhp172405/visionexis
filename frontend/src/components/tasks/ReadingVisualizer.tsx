import { useEffect, useRef, useState } from "react";
import type { ReadingSessionRecord } from "@/lib/readingComprehensionTask";
import { Flame, Route, Square, Dot, AlignLeft } from "lucide-react";

interface ReadingVisualizerProps {
  sessionRecord: ReadingSessionRecord;
  width?: number;
  height?: number;
}

export function ReadingVisualizer({
  sessionRecord,
  width = 720,
  height = 480,
}: ReadingVisualizerProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showScanpath, setShowScanpath] = useState(true);
  const [showLineAOIs, setShowLineAOIs] = useState(false);
  const [showWordAOIs, setShowWordAOIs] = useState(false);
  const [showRawPoints, setShowRawPoints] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render pure webcam gaze heatmap onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!showHeatmap || sessionRecord.rawGazeSamples.length === 0) return;

    // Filter valid webcam gaze samples inside reading interval
    const samples = sessionRecord.rawGazeSamples.filter(
      (s) =>
        s.timestamp >= sessionRecord.readingStartTime &&
        s.timestamp <= sessionRecord.readingEndTime &&
        !s.blink &&
        s.confidence >= 0.35
    );

    if (samples.length === 0) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const radius = 28;

    samples.forEach((s) => {
      const grad = tempCtx.createRadialGradient(s.gazeX, s.gazeY, 0, s.gazeX, s.gazeY, radius);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.22)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.09)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      tempCtx.fillStyle = grad;
      tempCtx.beginPath();
      tempCtx.arc(s.gazeX, s.gazeY, radius, 0, Math.PI * 2);
      tempCtx.fill();
    });

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
  }, [sessionRecord, showHeatmap, width, height]);

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
            Reading Heatmap
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
            Fixation Scanpath
          </button>

          <button
            type="button"
            onClick={() => setShowLineAOIs(!showLineAOIs)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showLineAOIs
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <AlignLeft className="h-3.5 w-3.5" />
            Line AOIs
          </button>

          <button
            type="button"
            onClick={() => setShowWordAOIs(!showWordAOIs)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
              showWordAOIs
                ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Square className="h-3.5 w-3.5 text-indigo-600" />
            Word AOIs
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
            Raw Points
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
          <span>WPM: <strong className="text-eyecog-teal">{sessionRecord.derivedMetrics.wordsPerMinute}</strong></span>
          <span>Coverage: <strong className="text-slate-700">{sessionRecord.derivedMetrics.readingCoveragePct}%</strong></span>
          <span>Regressions: <strong className="text-amber-600">{sessionRecord.derivedMetrics.totalRegressionsCount}</strong></span>
          <span>Fixations: <strong className="text-slate-700">{sessionRecord.derivedMetrics.totalFixationCount}</strong></span>
        </div>
      </div>

      {/* Visualizer Display Viewport */}
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-slate-900 select-none shadow-inner p-8 text-slate-200 font-serif leading-relaxed"
        style={{ width, minHeight: height }}
      >
        {/* Title */}
        <h3 className="text-base font-sans font-bold text-white mb-4 border-b border-slate-800 pb-2">
          {sessionRecord.passage.title}
        </h3>

        {/* Passage Paragraphs */}
        <div className="space-y-4 text-sm leading-[1.8] text-slate-300 font-serif">
          {sessionRecord.passage.paragraphs.map((p, pIdx) => (
            <p key={`p_${pIdx}`} className="indent-4">
              {p}
            </p>
          ))}
        </div>

        {/* Line AOIs Overlay */}
        {showLineAOIs && sessionRecord.lineAOIs.map((line) => (
          <div
            key={line.lineId}
            className="absolute border border-dashed border-teal-400/50 bg-teal-500/10 pointer-events-none rounded"
            style={{
              left: line.x,
              top: line.y,
              width: line.width,
              height: line.height,
            }}
          >
            <span className="absolute -top-3 left-1 text-[9px] font-mono text-teal-300 bg-slate-900/80 px-1 rounded">
              L{line.lineIndex + 1}
            </span>
          </div>
        ))}

        {/* Word AOIs Overlay */}
        {showWordAOIs && sessionRecord.wordAOIs.map((word) => (
          <div
            key={word.wordId}
            className="absolute border border-indigo-400/30 bg-indigo-500/5 pointer-events-none rounded-xs"
            style={{
              left: word.x,
              top: word.y,
              width: word.width,
              height: word.height,
            }}
          />
        ))}

        {/* Heatmap Layer Canvas Overlay */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 z-15"
        />

        {/* Raw Gaze Scatter Points */}
        {showRawPoints && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-18">
            {sessionRecord.rawGazeSamples.map((s, idx) => (
              <circle
                key={`raw_${idx}`}
                cx={s.gazeX}
                cy={s.gazeY}
                r="2.5"
                fill={s.blink ? "rgba(239, 68, 68, 0.5)" : "rgba(56, 189, 248, 0.6)"}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
            ))}
          </svg>
        )}

        {/* Scanpath & Saccade Arrows Overlay */}
        {showScanpath && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full z-20">
            <defs>
              <marker
                id="saccade-arrow-prog"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(45, 212, 191, 0.9)" />
              </marker>
              <marker
                id="saccade-arrow-reg"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(244, 63, 94, 0.9)" />
              </marker>
              <marker
                id="saccade-arrow-sweep"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(99, 102, 241, 0.9)" />
              </marker>
            </defs>

            {/* Saccade Connecting Lines */}
            {sessionRecord.saccades.map((sac, idx) => {
              const isReg = sac.classification === "regressive";
              const isSweep = sac.classification === "return_sweep";

              const color = isReg
                ? "rgba(244, 63, 94, 0.85)"
                : isSweep
                ? "rgba(99, 102, 241, 0.75)"
                : "rgba(45, 212, 191, 0.75)";

              const marker = isReg
                ? "url(#saccade-arrow-reg)"
                : isSweep
                ? "url(#saccade-arrow-sweep)"
                : "url(#saccade-arrow-prog)";

              return (
                <line
                  key={`sac_${idx}`}
                  x1={sac.startX}
                  y1={sac.startY}
                  x2={sac.endX}
                  y2={sac.endY}
                  stroke={color}
                  strokeWidth={isReg ? "2.5" : "1.8"}
                  strokeDasharray={isSweep ? "4 3" : undefined}
                  markerEnd={marker}
                />
              );
            })}

            {/* Fixation Circles */}
            {sessionRecord.fixations.map((fix, idx) => {
              const radius = Math.max(6, Math.min(22, Math.round(Math.sqrt(fix.duration) * 1.0)));
              const isFirst = idx === 0;
              const isLast = idx === sessionRecord.fixations.length - 1;

              return (
                <g key={`fix_${idx}`}>
                  <circle
                    cx={fix.meanX}
                    cy={fix.meanY}
                    r={radius}
                    fill={isLast ? "rgba(251, 191, 36, 0.65)" : isFirst ? "rgba(56, 189, 248, 0.65)" : "rgba(45, 212, 191, 0.5)"}
                    stroke={isLast ? "#f59e0b" : isFirst ? "#38bdf8" : "#2dd4bf"}
                    strokeWidth="1.5"
                  />
                  <text
                    x={fix.meanX}
                    y={fix.meanY}
                    textAnchor="middle"
                    dy=".3em"
                    fill="#ffffff"
                    fontSize="9"
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
      </div>
    </div>
  );
}
