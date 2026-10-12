import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  Target,
  Brain,
  BookOpenText,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

import { getCombinedReport, getBaselineAssessment, getApiUrl } from "@/lib/api";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import { formatAccuracy, formatSeconds, accuracyColor } from "@/lib/format";
import { buildIntegratedProfile } from "@/lib/integratedVisualCognitiveAnalysis";
import {
  BaselineVisualFunctionProfileSection,
  IntegratedCrossDomainAnalysisSection,
} from "@/components/analysis/IntegratedAnalysisSection";

export function OverallPatientReportPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { calibrationModel } = useGazeStore();
  const [downloading, setDownloading] = useState(false);

  // Guarantee that webcam hardware and MediaPipe processing are stopped when report is viewed
  useEffect(() => {
    try {
      globalWebcamManager.stopCamera();
    } catch (e) {
      console.warn("Failed to stop camera on report page mount:", e);
    }
  }, []);

  const {
    data: report,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["combined-report", assessmentId],
    queryFn: () => getCombinedReport(assessmentId!),
    enabled: !!assessmentId,
  });

  const { data: baselineData } = useQuery({
    queryKey: ["baseline-assessment", assessmentId],
    queryFn: () => getBaselineAssessment(assessmentId!),
    enabled: !!assessmentId,
  });

  const effectiveBaseline = report?.baseline_assessment || baselineData || null;
  const integratedProfile = report ? buildIntegratedProfile(report, effectiveBaseline) : null;

  const handleDownloadPDF = async () => {
    if (!assessmentId || !report) return;
    setDownloading(true);
    try {
      const pCode = report.patient_code.replace("-", "").trim() || "P001";
      const filename = `VISIONEXIS_${pCode}_Assessment_Report.pdf`;

      const response = await fetch(getApiUrl(`/reports/assessment/${assessmentId}/pdf`));
      if (!response.ok) {
        throw new Error(`Failed to download report (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF download error:", err);
      alert(`Could not download PDF: ${err.message || "Unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportJSON = () => {
    if (!report) return;
    const exportData = {
      ...report,
      baseline_assessment: effectiveBaseline,
      integrated_visual_cognitive_analysis: integratedProfile,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const pCode = report.patient_code.replace("-", "").trim() || "P001";
    a.download = `VISIONEXIS_${pCode}_Assessment_Data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-eyecog-teal border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-600">Generating unified assessment report&hellip;</p>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="text-lg font-bold text-rose-900">Unable to Load Assessment Report</h2>
        <p className="text-xs text-rose-700">
          {(error as any)?.message || "The requested assessment report could not be found or has not been saved yet."}
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-eyecog-navy px-4 py-2 text-xs font-semibold text-white hover:bg-eyecog-navy-light"
          >
            Return to Dashboard
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const vsTask = report.tasks.find((t) => t.task_type === "visual_search");
  const memTask = report.tasks.find((t) => t.task_type === "memory");
  const readTask = report.tasks.find((t) => t.task_type === "reading");

  // Parse comparison_json if available
  let vsMetrics: any = null;
  let memMetrics: any = null;
  let readMetrics: any = null;

  try {
    if (vsTask?.comparison_json) vsMetrics = JSON.parse(vsTask.comparison_json);
  } catch {}
  try {
    if (memTask?.comparison_json) memMetrics = JSON.parse(memTask.comparison_json);
  } catch {}
  try {
    if (readTask?.comparison_json) readMetrics = JSON.parse(readTask.comparison_json);
  } catch {}

  const isFullyCompleted = report.tasks_completed === 3 && report.status === "completed";
  const assessmentDate = new Date(report.started_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20 print:p-0 print:m-0 print:max-w-none">
      {/* Action Header (Hidden during Print) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-xl font-bold text-slate-900">
            Unified Patient Assessment Report
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-600 transition disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {downloading ? "Preparing PDF..." : "Download Overall Report (PDF)"}
          </button>

          <Link
            to="/new-session"
            className="inline-flex items-center gap-1.5 rounded-lg border border-eyecog-navy bg-white px-3 py-1.5 text-xs font-semibold text-eyecog-navy shadow-sm hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Assessment
          </Link>
        </div>
      </div>

      {/* Main Unified Report Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Banner Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-100 px-3 py-0.5 text-xs font-extrabold text-teal-800">
                PROTOTYPE RESEARCH ASSESSMENT
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Attempt #{report.attempt_number}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              VISIONEXIS Multi-Task Cognitive &amp; Oculomotor Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Synchronized webcam eye tracking &amp; motor response metrics across 3 assessment paradigms.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 min-w-[240px] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Anonymous ID:</span>
              <span className="font-mono font-bold text-slate-900">{report.patient_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Assessment ID:</span>
              <span className="font-mono text-slate-700 truncate max-w-[130px]" title={report.assessment_id}>
                {report.assessment_id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Date:</span>
              <span className="text-slate-700">{assessmentDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-500">Status:</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  isFullyCompleted
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isFullyCompleted ? "Completed (3/3)" : `In Progress (${report.tasks_completed}/3)`}
              </span>
            </div>
            {(report.patient_age != null || report.patient_gender) && (
              <div className="flex justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                <span>Demographics:</span>
                <span>
                  {report.patient_age != null ? `${report.patient_age} yrs` : ""}
                  {report.patient_age != null && report.patient_gender ? " • " : ""}
                  {report.patient_gender || ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: BASELINE VISUAL FUNCTION PROFILE (MBT) */}
        {integratedProfile && (
          <BaselineVisualFunctionProfileSection profile={integratedProfile} />
        )}

        {/* SECTION 3: CALIBRATION & DATA QUALITY */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <ShieldCheck className="h-4 w-4 text-eyecog-teal" />
            3. Gaze Calibration and Data Quality
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Quality Rating</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">
                {calibrationModel?.validation?.qualityRating || "Validated Protocol"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Confidence Score</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                {calibrationModel?.validation?.confidenceScore != null ? `${calibrationModel.validation.confidenceScore}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Mean Tracking Error</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                {calibrationModel?.validation?.maePx != null ? `${calibrationModel.validation.maePx} px` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Sensor Modality</p>
              <p className="text-sm font-bold text-eyecog-teal mt-0.5">
                Webcam 468-Mesh + Mouse
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: VISUAL SEARCH RESULTS */}
        <div className="rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-eyecog-teal">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">4. Visual Search Task Results</h3>
                <p className="text-xs text-slate-500">
                  Feature and conjunction target detection across 20 trials.
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                vsTask?.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {vsTask?.status === "completed" ? "Completed ✓" : "Pending"}
            </span>
          </div>

          {vsTask?.status === "completed" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Accuracy</p>
                <p className={`mt-1 font-mono text-lg font-bold ${accuracyColor(vsTask.accuracy_pct)}`}>
                  {formatAccuracy(vsTask.accuracy_pct)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Benchmark: ≥ 85%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Avg Reaction Time</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {formatSeconds(vsTask.rt_ms)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Benchmark: ≤ 2.5s</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gaze Events</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {vsTask.is_gaze_available ? vsTask.gaze_count : (vsTask.gaze_status_label || "Unavailable")}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {vsTask.is_gaze_available ? `Fixations: ${vsTask.fixation_count}` : "Webcam tracking"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Avg Fixation</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {vsTask.is_gaze_available && vsTask.avg_fixation_ms ? `${Math.round(vsTask.avg_fixation_ms)} ms` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Dwell duration</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Search Efficiency</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-600">
                  {vsMetrics?.avgSearchEfficiency != null ? `${vsMetrics.avgSearchEfficiency} / 100` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Exploration index</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gaze→Click Latency</p>
                <p className="mt-1 font-mono text-lg font-bold text-purple-600">
                  {vsMetrics?.mouseGazeLatencyMs != null ? `${vsMetrics.mouseGazeLatencyMs} ms` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Motor execution lag</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">This task was not completed during this assessment attempt.</p>
          )}
        </div>

        {/* SECTION 5: MEMORY & RECOGNITION RESULTS */}
        <div className="rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">5. Memory &amp; Recognition Task Results</h3>
                <p className="text-xs text-slate-500">
                  Study phase (20 items), 4-second retention, recognition phase (40 items) with Signal Detection Theory (SDT).
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                memTask?.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {memTask?.status === "completed" ? "Completed ✓" : "Pending"}
            </span>
          </div>

          {memTask?.status === "completed" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Recognition Accuracy</p>
                <p className={`mt-1 font-mono text-lg font-bold ${accuracyColor(memTask.accuracy_pct)}`}>
                  {formatAccuracy(memTask.accuracy_pct)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Benchmark: ≥ 70%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Sensitivity (d')</p>
                <p className="mt-1 font-mono text-lg font-bold text-purple-600">
                  {memMetrics?.metrics?.dPrime != null ? Number(memMetrics.metrics.dPrime).toFixed(2) : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">SDT Sensitivity Index</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Response Bias (c)</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {memMetrics?.metrics?.criterionC != null ? Number(memMetrics.metrics.criterionC).toFixed(2) : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Decision criterion</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gaze Tracking</p>
                <p className="mt-1 font-mono text-lg font-bold text-eyecog-teal">
                  {memTask.is_gaze_available ? `${memTask.gaze_count} evts` : (memTask.gaze_status_label || "Unavailable")}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {memTask.is_gaze_available ? `Fixations: ${memTask.fixation_count}` : "Webcam tracking"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Hit Rate (H)</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-600">
                  {memMetrics?.metrics?.hitRate != null ? `${(memMetrics.metrics.hitRate * 100).toFixed(0)}%` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Hits on Old items</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Mean Recognition RT</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {formatSeconds(memTask.rt_ms)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Decision latency</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">This task was not completed during this assessment attempt.</p>
          )}
        </div>

        {/* SECTION 6: READING & COMPREHENSION RESULTS */}
        <div className="rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <BookOpenText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">6. Reading &amp; Comprehension Task Results</h3>
                <p className="text-xs text-slate-500">
                  Natural passage reading dynamics, regression saccades, and multiple-choice comprehension questions.
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                readTask?.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {readTask?.status === "completed" ? "Completed ✓" : "Pending"}
            </span>
          </div>

          {readTask?.status === "completed" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Comprehension</p>
                <p className={`mt-1 font-mono text-lg font-bold ${accuracyColor(readTask.accuracy_pct)}`}>
                  {formatAccuracy(readTask.accuracy_pct)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Benchmark: ≥ 67%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Reading Speed</p>
                <p className="mt-1 font-mono text-lg font-bold text-eyecog-teal">
                  {readMetrics?.derivedMetrics?.wordsPerMinute != null ? `${readMetrics.derivedMetrics.wordsPerMinute} WPM` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Words / minute</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Question Avg RT</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {formatSeconds(readTask.rt_ms)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Response latency</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gaze &amp; Fixations</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {readTask.is_gaze_available ? `${readTask.gaze_count} evts` : (readTask.gaze_status_label || "Unavailable")}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {readTask.is_gaze_available ? `Fixations: ${readTask.fixation_count}` : "Webcam tracking"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Regressions</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {readMetrics?.derivedMetrics?.totalRegressionsCount ?? readMetrics?.derivedMetrics?.regressionSaccadeCount ?? "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Backward saccades</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Task Duration</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                  {readTask.duration_s ? `${readTask.duration_s}s` : "—"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Total passage time</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">This task was not completed during this assessment attempt.</p>
          )}
        </div>

        {/* SECTION 7 & 8: INTEGRATED VISUAL–COGNITIVE ANALYSIS & RESEARCH INTERPRETATION */}
        {integratedProfile && (
          <IntegratedCrossDomainAnalysisSection profile={integratedProfile} />
        )}

        {/* SECTION 4: OVERALL SUMMARY & DATA QUALITY WARNINGS */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Overall 3-Task Assessment Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-white p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">Average Battery Accuracy</span>
              <p className="mt-1 font-mono text-2xl font-extrabold text-slate-900">
                {formatAccuracy(report.avg_accuracy)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Across all completed tasks</p>
            </div>
            <div className="rounded-lg bg-white p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">Completion Status</span>
              <p className="mt-1 font-mono text-2xl font-extrabold text-eyecog-teal">
                {report.tasks_completed} / 3 Tasks
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isFullyCompleted ? "Full battery completed" : "Partial battery recorded"}
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">Benchmark Reference Summary</span>
              <p className="mt-1 text-base font-bold text-slate-800">
                {report.any_flagged ? (
                  <span className="text-slate-700 flex items-center gap-1">
                    <Info className="h-4 w-4 text-slate-500" /> Outside Benchmark
                  </span>
                ) : (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Within Benchmark
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Exploratory threshold: 70% accuracy</p>
            </div>
          </div>

          {/* Data Quality Warning Notice if tasks missing */}
          {!isFullyCompleted && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Data Completeness Warning:</strong> Only {report.tasks_completed} of 3 tasks were finished in this attempt.
                A complete assessment requires Visual Search, Memory &amp; Recognition, and Reading &amp; Comprehension.
              </div>
            </div>
          )}
        </div>

        {/* NON-MEDICAL RESEARCH DISCLAIMER */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[11px] text-slate-500 leading-relaxed">
          <p className="font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">
            Research Prototype Notice &bull; Not a Clinical Diagnosis
          </p>
          <p>{report.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
