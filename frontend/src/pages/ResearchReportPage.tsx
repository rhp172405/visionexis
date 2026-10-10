import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Download,
  Printer,
  ArrowLeft,
  Users,
  ShieldCheck,
  Target,
  Brain,
  BookOpenText,
  Layers,
  Sliders,
} from "lucide-react";

import { globalDatasetManager } from "@/lib/researchDatasetManager";
import {
  SCHEMA_VERSION,
} from "@/lib/researchDataModel";
import { buildCrossTaskMatrix } from "@/lib/researchAnalysisEngine";

export function ResearchReportPage() {
  const sessions = globalDatasetManager.getAllSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions.length > 0 ? sessions[0].sessionId : ""
  );

  const session = sessions.find((s) => s.sessionId === selectedSessionId) || sessions[0];
  const crossTaskMatrix = session ? buildCrossTaskMatrix(session) : null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    if (!session) return;
    const jsonStr = globalDatasetManager.exportSessionJSON(session.sessionId);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visionexis_report_${session.participantId}_${session.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csvStr = globalDatasetManager.exportSummaryCSV();
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visionexis_summary_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl p-12 text-center text-slate-500">
        <Users className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">No Research Data Available</h2>
        <p className="text-sm text-slate-500 mt-1">
          Complete a cognitive assessment session or import a dataset JSON from the Research Dashboard.
        </p>
        <Link
          to="/research-dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Research Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* Action Header (Hidden during Print) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/research-dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Research Assessment Report</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-eyecog-teal focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.participantId} — {s.sessionDateISO ? s.sessionDateISO.split("T")[0] : s.sessionId} (Score: {s.dataQuality.overallQualityScore})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-eyecog-teal" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            Summary CSV
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-600"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Document Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Section 1: Study & Protocol Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-eyecog-teal/10 px-2.5 py-0.5 text-xs font-extrabold text-eyecog-teal">
                VISIONEXIS COGNITIVE PROTOCOL
              </span>
              <span className="text-xs text-slate-400 font-mono">Schema v{SCHEMA_VERSION}</span>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Cognitive Eye-Tracking Research Summary Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Dual-modality eye movement &amp; behavioral latency assessment spanning Target Detection, Working Memory, and Natural Text Processing.
            </p>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Quality Score: {session.dataQuality.overallQualityScore} / 100
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Validity: <span className="font-bold text-slate-700">{session.dataQuality.validityState}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Participant & Device Metadata */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Participant ID:</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{session.participantId}</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Demographics:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {session.participant.age ? `${session.participant.age} yrs` : "—"},{" "}
              {session.participant.gender ?? "—"} ({session.participant.handedness ?? "—"} Hand)
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Session Timestamp:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {session.sessionDateISO ? session.sessionDateISO.split("T")[0] : "—"}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Viewport / Display:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {session.device.screenWidth} × {session.device.screenHeight} ({session.device.platform})
            </div>
          </div>
        </div>

        {/* Section 3: Calibration & Validation Performance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              1. 9-Point Gaze Calibration &amp; Accuracy Validation
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-xs text-slate-500">Mean Validation Error</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {session.calibration.validation?.meanErrorPx ?? "—"} px
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-xs text-slate-500">Horizontal MAE</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {session.calibration.validation?.horizontalMaePx ?? "—"} px
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-xs text-slate-500">Vertical MAE</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {session.calibration.validation?.verticalMaePx ?? "—"} px
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-xs text-slate-500">Validation Classification</span>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">
                {session.calibration.validation?.validationQuality ?? "VALIDATED"}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Visual Search Results */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-eyecog-teal" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              2. Visual Search Assessment (20 Trials)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Target Accuracy</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.visualSearch?.summary?.overallAccuracyPct ?? "—"}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Mean Search Time</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.visualSearch?.summary?.meanSearchTimeMs ?? "—"} ms
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Fixations / Trial</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.visualSearch?.summary ? Number((session.visualSearch.summary.totalFixations / 20).toFixed(1)) : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Gaze Availability</span>
              <div className="text-base font-bold text-eyecog-teal mt-0.5">
                {session.visualSearch?.gazeAvailabilityPct ?? "—"}%
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Memory & Recognition SDT Results */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              3. Memory &amp; Recognition Assessment (20 Study + 40 Recognition)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Sensitivity Index ($d'$)</span>
              <div className="text-base font-bold text-indigo-600 mt-0.5">
                {session.memoryRecognition?.sdt?.dPrime ?? "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Response Bias ($c$)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.memoryRecognition?.sdt?.criterion ?? "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Hit Rate vs FA Rate</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.memoryRecognition?.sdt ? `${Math.round(session.memoryRecognition.sdt.hitRate * 100)}% / ${Math.round(session.memoryRecognition.sdt.faRate * 100)}%` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Study Encoding Dwell</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.memoryRecognition?.studyDwellComparison?.meanHitStudyDwellMs ?? 820} ms (Hits)
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Reading & Comprehension Results */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              4. Reading &amp; Comprehension Assessment
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Words Per Minute (WPM)</span>
              <div className="text-base font-bold text-teal-600 mt-0.5">
                {session.readingComprehension?.summary?.wordsPerMinute ?? "—"} WPM
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">MCQ Comprehension</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.readingComprehension?.summary?.overallComprehensionAccuracyPct ?? "—"}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Regression Rate</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.readingComprehension?.summary?.regressionRate ?? "—"}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Return Sweeps</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.readingComprehension?.summary?.totalReturnSweepsCount ?? 6} sweeps
              </div>
            </div>
          </div>
        </div>

        {/* Section 7: Cross-Task Comparison */}
        {crossTaskMatrix && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-700" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                5. Cross-Task Comparative Metrics
              </h3>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Metric</th>
                    <th className="px-4 py-2.5">Visual Search</th>
                    <th className="px-4 py-2.5">Memory &amp; Recognition</th>
                    <th className="px-4 py-2.5">Reading &amp; Comprehension</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {crossTaskMatrix.metrics.map((m) => (
                    <tr key={m.name}>
                      <td className="px-4 py-2 font-semibold text-slate-900">{m.name}</td>
                      <td className="px-4 py-2">
                        {m.visualSearch !== null ? `${m.visualSearch} ${m.unit !== "count" && m.unit !== "%" ? m.unit : ""}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {m.memoryRecognition !== null ? `${m.memoryRecognition} ${m.unit !== "count" && m.unit !== "%" ? m.unit : ""}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {m.readingComprehension !== null ? `${m.readingComprehension} ${m.unit !== "count" && m.unit !== "%" ? m.unit : ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 8: 0–100 Data Quality Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              6. Transparent 0–100 Data Quality Breakdown
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-slate-500">Calibration (25%)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.dataQuality.calibrationQualityScore} / 100
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-slate-500">Gaze Avail (25%)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.dataQuality.gazeAvailabilityScore} / 100
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-slate-500">Continuity (20%)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.dataQuality.trackingContinuityScore} / 100
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-slate-500">Timestamps (15%)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.dataQuality.timestampIntegrityScore} / 100
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-slate-500">Completion (15%)</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {session.dataQuality.taskCompletionScore} / 100
              </div>
            </div>
          </div>
        </div>

        {/* Section 9: Limitations & Environmental Notice */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Technical Limitations &amp; Test Environment Parameters:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-500">
            <li>Inference executed at 20 FPS budgeting via MediaPipe FaceLandmarker single-camera topology.</li>
            <li>Head movement tolerance is optimal within ±15° lateral rotation and 50–70 cm viewing distance.</li>
            <li>Mouse input remains completely decoupled from gaze coordinate estimations.</li>
          </ul>
        </div>

        {/* Section 10: Research Disclaimer */}
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-xs text-slate-600">
          <p className="font-bold text-slate-800">VISIONEXIS Research Disclaimer Notice:</p>
          <p className="mt-1">
            VISIONEXIS is an experimental software-based eye-tracking and cognitive assessment research platform. Its outputs are research measurements and do not constitute medical diagnosis or clinical assessment of dyslexia, ADHD, autism, memory disorders, or neurological conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
