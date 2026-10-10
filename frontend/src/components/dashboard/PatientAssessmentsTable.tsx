import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  RotateCcw,
  CheckCircle2,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  ArrowRight,
  UserCheck,
} from "lucide-react";

import type { PatientAssessmentSummary } from "@/types";
import { formatAccuracy, accuracyColor } from "@/lib/format";
import { useGazeStore } from "@/stores/gazeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { createAssessment, getPatient, getApiUrl } from "@/lib/api";

interface PatientAssessmentsTableProps {
  assessments: PatientAssessmentSummary[];
  onRefetch?: () => void;
}

export function PatientAssessmentsTable({ assessments, onRefetch }: PatientAssessmentsTableProps) {
  const navigate = useNavigate();
  const { isCameraActive, isCalibrated, calibrationModel } = useGazeStore();
  const { setPatient, setAssessment, setSession } = useSessionStore();

  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [retakeTarget, setRetakeTarget] = useState<PatientAssessmentSummary | null>(null);
  const [isRetaking, setIsRetaking] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
        <UserCheck className="h-10 w-10 text-slate-300 mb-2" />
        <h3 className="text-sm font-bold text-slate-700">No Patient Assessments Found</h3>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">
          Register a patient to begin the visual-cognitive assessment battery.
        </p>
        <Link
          to="/new-session"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-600 transition"
        >
          New Patient Assessment
        </Link>
      </div>
    );
  }

  // Group assessments by patient_id
  const patientGroups = new Map<string, PatientAssessmentSummary[]>();
  assessments.forEach((item) => {
    const list = patientGroups.get(item.patient_id) || [];
    list.push(item);
    patientGroups.set(item.patient_id, list);
  });

  const patientRows = Array.from(patientGroups.entries()).map(([patientId, attempts]) => {
    // Sort attempts by started_at descending so attempts[0] is the latest
    attempts.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    return {
      patientId,
      latest: attempts[0],
      history: attempts.slice(1),
      totalAttempts: attempts.length,
    };
  });

  const handleDownloadPDF = async (assessment: PatientAssessmentSummary) => {
    setDownloadingId(assessment.assessment_id);
    try {
      const pCode = assessment.patient_code.replace("-", "").trim() || "P001";
      const filename = `VISIONEXIS_${pCode}_Assessment_Report.pdf`;

      const response = await fetch(getApiUrl(`/reports/assessment/${assessment.assessment_id}/pdf`));
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
      console.error("PDF download failed:", err);
      alert(`Could not download PDF: ${err.message || "Unknown error"}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmRetake = async (skipCalibration: boolean) => {
    if (!retakeTarget) return;
    setIsRetaking(true);
    try {
      // 1. Fetch patient record
      const fullPatient = await getPatient(retakeTarget.patient_id);
      setPatient(fullPatient);

      // 2. Create new assessment attempt linked to the same patient
      const newAssessment = await createAssessment(retakeTarget.patient_id, true);
      setAssessment(newAssessment);
      setSession(null);

      // Close modal
      setRetakeTarget(null);
      onRefetch?.();

      // 3. Navigate according to calibration choice
      if (skipCalibration && isCalibrated && isCameraActive) {
        navigate("/tasks/visual-search");
      } else {
        navigate("/calibration");
      }
    } catch (err: any) {
      console.error("Retake error:", err);
      alert(`Failed to start retake attempt: ${err.message || "Unknown error"}`);
    } finally {
      setIsRetaking(false);
    }
  };

  const isCalibrationValidForRetake =
    isCameraActive &&
    isCalibrated &&
    calibrationModel !== null &&
    (calibrationModel.validation?.qualityRating === "GOOD" ||
      calibrationModel.validation?.qualityRating === "FAIR");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Patient ID</th>
              <th className="py-3 px-4">Latest Attempt</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Overall Status</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4">Avg Accuracy</th>
              <th className="py-3 px-4 text-right">Assessment Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patientRows.map(({ patientId, latest, history, totalAttempts }) => {
              const isExpanded = expandedPatientId === patientId;
              const isComplete = latest.status === "completed" && latest.tasks_completed === 3;
              const dateStr = new Date(latest.started_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const timeStr = new Date(latest.started_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={patientId} className="contents">
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    {/* Patient ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {latest.patient_code}
                        </span>
                        {totalAttempts > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedPatientId(isExpanded ? null : patientId)}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 transition"
                            title="Toggle attempt history"
                          >
                            <History className="h-2.5 w-2.5" />
                            {totalAttempts} attempts
                            {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Anonymous Cohort</p>
                    </td>

                    {/* Attempt indicator */}
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      <span className="rounded bg-indigo-50 text-indigo-700 px-2 py-0.5 font-bold text-[11px] ring-1 ring-indigo-200">
                        Attempt #{latest.attempt_number}
                        {latest.is_latest && " (Latest)"}
                      </span>
                    </td>

                    {/* Assessment Date */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{dateStr}</div>
                      <div className="text-[10px] text-slate-400">{timeStr}</div>
                    </td>

                    {/* Overall Status */}
                    <td className="py-3.5 px-4">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          In Progress
                        </span>
                      )}
                    </td>

                    {/* Completion progress */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>{latest.tasks_completed}/3 tasks</span>
                          <span>{Math.round((latest.tasks_completed / 3) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isComplete ? "bg-emerald-500" : "bg-eyecog-teal"
                            }`}
                            style={{ width: `${(latest.tasks_completed / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Average Accuracy */}
                    <td className="py-3.5 px-4">
                      <span className={`font-mono text-xs font-bold ${accuracyColor(latest.avg_accuracy)}`}>
                        {formatAccuracy(latest.avg_accuracy)}
                      </span>
                      {latest.flagged && (
                        <span className="ml-1 text-[10px] text-amber-600 font-semibold" title="Below exploratory research benchmark (70%)">
                          ⚠
                        </span>
                      )}
                    </td>

                    {/* Actions: View Overall Report, Download PDF, Retake Assessment */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* 1. View Overall Report */}
                        <Link
                          to={`/reports/assessment/${latest.assessment_id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                          title="View unified patient assessment report"
                        >
                          <Eye className="h-3.5 w-3.5 text-eyecog-teal" />
                          View Report
                        </Link>

                        {/* 2. Download PDF */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(latest)}
                          disabled={downloadingId === latest.assessment_id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                          title="Download combined PDF assessment report"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          {downloadingId === latest.assessment_id ? "..." : "PDF"}
                        </button>

                        {/* 3. Retake Assessment */}
                        <button
                          type="button"
                          onClick={() => setRetakeTarget(latest)}
                          className="inline-flex items-center gap-1 rounded-lg bg-eyecog-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-eyecog-navy-light transition shadow-xs"
                          title="Start a new assessment attempt for this patient"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Retake
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable History Drawer */}
                  {isExpanded && history.length > 0 && (
                    <tr className="bg-slate-50/80 border-t border-slate-100">
                      <td colSpan={7} className="py-3 px-6">
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Previous Attempt History for {latest.patient_code}:
                          </p>
                          <div className="space-y-1.5">
                            {history.map((att) => (
                              <div
                                key={att.assessment_id}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-700">
                                    Attempt #{att.attempt_number}
                                  </span>
                                  <span className="text-slate-400">
                                    {new Date(att.started_at).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                      att.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {att.status === "completed" ? "Completed" : "Closed"} ({att.tasks_completed}/3)
                                  </span>
                                  <span className="font-mono text-slate-600">
                                    Acc: {formatAccuracy(att.avg_accuracy)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/reports/assessment/${att.assessment_id}`}
                                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    <Eye className="h-3 w-3" /> View Report
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPDF(att)}
                                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    <FileText className="h-3 w-3 text-blue-600" /> PDF
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </div>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Retake Assessment Confirmation Modal */}
      {retakeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Retake Assessment — {retakeTarget.patient_code}
                </h3>
                <p className="text-xs text-slate-500">
                  Initiate a new assessment attempt for this patient.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>History Preserved:</strong> Attempt #{retakeTarget.attempt_number} results, metrics, and PDF reports remain permanently saved and accessible.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Attempt Indexing:</strong> The new assessment will be recorded as Attempt #{retakeTarget.attempt_number + 1} under patient ID {retakeTarget.patient_code}.
                </span>
              </div>
            </div>

            {/* Calibration Validity Information */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Crosshair className="h-4 w-4 text-eyecog-teal" />
                Calibration Verification Rule
              </div>
              {isCalibrationValidForRetake ? (
                <div className="text-slate-600">
                  <span className="text-emerald-700 font-bold">✓ Valid Calibration Profile Active</span> (Quality: {calibrationModel?.validation?.qualityRating}).
                  You may proceed directly to Visual Search or perform re-calibration.
                </div>
              ) : (
                <div className="text-amber-800">
                  <span className="font-bold">⚠ Re-Calibration Required:</span> No verified calibration profile detected.
                  The retake will start at Step 1: Calibration &amp; Validation.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRetakeTarget(null)}
                disabled={isRetaking}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              {isCalibrationValidForRetake ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleConfirmRetake(true)}
                    disabled={isRetaking}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 transition shadow-xs disabled:opacity-50"
                  >
                    Use Valid Calibration <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmRetake(false)}
                    disabled={isRetaking}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-eyecog-navy px-4 py-2 text-xs font-bold text-white hover:bg-eyecog-navy-light transition shadow-xs disabled:opacity-50"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Recalibrate Gaze
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConfirmRetake(false)}
                  disabled={isRetaking}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 transition shadow-xs disabled:opacity-50"
                >
                  Confirm &amp; Begin Calibration <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
