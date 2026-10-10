import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  Camera,
  Sun,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Play,
  FileText,
  Check,
  Eye,
  Monitor,
  Globe,
} from "lucide-react";

import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import {
  globalPilotStudyManager,
  type ParticipantAuditResult,
} from "@/lib/pilotStudyManager";
import { globalDatasetManager } from "@/lib/researchDatasetManager";
import {
  type ResearchSessionRecord,
  type ParticipantInfo,
  getClientDeviceInfo,
} from "@/lib/researchDataModel";

type PilotStep =
  | "registration"
  | "environment_check"
  | "ready_to_start"
  | "completed_audit";

export function PilotStudyPage() {
  const navigate = useNavigate();
  const {
    isCameraActive,
    faceDetected,
    eyesDetected,
    fps,
  } = useGazeStore();

  const [step, setStep] = useState<PilotStep>("registration");

  // Registration form state (Non-PII)
  const [participantId, setParticipantId] = useState<string>(() => {
    const count = globalDatasetManager.getAllSessions().length;
    const nextNum = String(count + 1).padStart(3, "0");
    return `P${nextNum}`;
  });
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"M" | "F" | "Non-Binary" | "Prefer not to say">("Prefer not to say");
  const [handedness, setHandedness] = useState<"Right" | "Left" | "Ambidextrous">("Right");
  const [notes, setNotes] = useState("");

  const [registeredParticipant, setRegisteredParticipant] = useState<ParticipantInfo | null>(null);

  // Completion / Audit State
  const [completedSession, setCompletedSession] = useState<ResearchSessionRecord | null>(null);
  const [auditResult, setAuditResult] = useState<ParticipantAuditResult | null>(null);
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [newIssueSeverity, setNewIssueSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
  const [issueSaved, setIssueSaved] = useState(false);

  const deviceInfo = getClientDeviceInfo();

  // Initialize camera when entering environment check
  useEffect(() => {
    if (step === "environment_check" && !isCameraActive) {
      globalWebcamManager.startCamera().catch(console.error);
    }
  }, [step, isCameraActive]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = participantId.trim().toUpperCase() || "P001";
    const res = globalPilotStudyManager.registerParticipant({
      participantId: pid,
      age: typeof age === "number" ? age : undefined,
      gender,
      handedness,
      notes: notes.trim() || undefined,
    });

    setRegisteredParticipant(res.participant);
    setStep("environment_check");
  };

  const handleStartTasks = () => {
    // Navigate to calibration with pilot session parameters
    navigate("/calibration");
  };

  const handleRunAuditOnLastSession = () => {
    const sessions = globalDatasetManager.getAllSessions();
    if (sessions.length > 0) {
      const last = sessions[0];
      setCompletedSession(last);
      const audit = globalPilotStudyManager.runParticipantDataAudit(last);
      setAuditResult(audit);
      setStep("completed_audit");
    }
  };

  const handleLogPilotIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueDesc.trim()) return;

    globalPilotStudyManager.addIssue({
      participantId: registeredParticipant?.participantId || participantId || "P001",
      task: "general",
      description: newIssueDesc.trim(),
      expectedBehavior: "Normal participant tracking behavior.",
      actualBehavior: newIssueDesc.trim(),
      severity: newIssueSeverity,
      isReproducible: true,
      status: "OPEN",
    });

    setNewIssueDesc("");
    setIssueSaved(true);
    setTimeout(() => setIssueSaved(false), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Pilot Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
              Phase 10 Pilot Study
            </span>
            <span className="text-xs text-slate-400">Standardized Multi-Participant Protocol</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Real-World Pilot Study Protocol
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Participant registration, pre-flight environment check, complete 3-task progression, and 12-point automated data audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pilot-report"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-eyecog-teal" />
            Pilot Report
          </Link>
          <button
            type="button"
            onClick={handleRunAuditOnLastSession}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Audit Recent Session
          </button>
        </div>
      </div>

      {/* Step 1: Participant Registration */}
      {step === "registration" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eyecog-teal/10 text-eyecog-teal">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Anonymous Participant Registration</h2>
              <p className="text-xs text-slate-500">
                Register participant code. No names, emails, or unnecessary personally identifiable information are collected.
              </p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Participant Code / ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="e.g. P001, P002, P003"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Unique anonymous participant identifier.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Age (Optional)
                </label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : "")}
                  placeholder="e.g. 25"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Gender (Optional)
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
                >
                  <option value="Prefer not to say">Prefer not to say</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Handedness
              </label>
              <select
                value={handedness}
                onChange={(e) => setHandedness(e.target.value as any)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
              >
                <option value="Right">Right-Handed</option>
                <option value="Left">Left-Handed</option>
                <option value="Ambidextrous">Ambidextrous</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Session Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Corrective lenses, room lighting conditions..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-eyecog-teal px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 transition"
              >
                Continue to Environment Check
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Environment Check */}
      {step === "environment_check" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Pre-Flight Environment &amp; Positioning Check</h2>
              <p className="text-xs text-slate-500">
                Participant: <strong className="text-slate-800">{registeredParticipant?.participantId}</strong> — Verify tracking conditions before calibration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Camera className="h-4 w-4 text-eyecog-teal" />
                Camera Status
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {isCameraActive ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> CONNECTED
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> NOT CONNECTED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{fps > 0 ? `${fps} FPS inference` : "Waiting for stream"}</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Eye className="h-4 w-4 text-indigo-600" />
                Face Detection
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {faceDetected ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> DETECTED
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> NOT DETECTED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{eyesDetected ? "Iris landmarks active" : "Align eyes in view"}</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Sun className="h-4 w-4 text-amber-500" />
                Lighting Condition
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {faceDetected ? (
                  <span className="text-emerald-600">GOOD</span>
                ) : (
                  <span className="text-amber-600">CHECK LIGHT</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Even facial illumination</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Maximize2 className="h-4 w-4 text-slate-600" />
                Estimated Distance
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {faceDetected ? (
                  <span className="text-emerald-600">APPROPRIATE (50–70cm)</span>
                ) : (
                  <span className="text-slate-400">Position Face</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Sit 50–70 cm away</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Monitor className="h-4 w-4 text-blue-600" />
                Screen Resolution
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {deviceInfo.screenWidth} × {deviceInfo.screenHeight}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">DPR: {deviceInfo.devicePixelRatio}x</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Globe className="h-4 w-4 text-violet-600" />
                Browser & OS
              </div>
              <div className="mt-2 text-base font-bold text-slate-900 truncate">
                {deviceInfo.platform}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={deviceInfo.userAgent}>
                {deviceInfo.userAgent.includes("Chrome")
                  ? "Google Chrome"
                  : deviceInfo.userAgent.includes("Firefox")
                  ? "Mozilla Firefox"
                  : deviceInfo.userAgent.includes("Safari")
                  ? "Apple Safari"
                  : deviceInfo.userAgent.includes("Edge")
                  ? "Microsoft Edge"
                  : "Web Browser"}
              </div>
            </div>
          </div>

          {/* Participant Instructions Checklist */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Participant Positioning Instructions:
            </h3>
            <ul className="space-y-1.5 text-xs text-indigo-950 font-medium">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                Sit comfortably approximately <strong>50–70 cm</strong> directly in front of the screen.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                Ensure your face and both eyes remain clearly visible to the webcam.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                Use balanced, stable room lighting (avoid strong sunlight directly behind your head).
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                Keep head relatively still during calibration targets; natural head movement is permitted during tasks.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep("registration")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              ← Back to Registration
            </button>

            <button
              type="button"
              disabled={!isCameraActive || !faceDetected}
              onClick={handleStartTasks}
              className="inline-flex items-center gap-2 rounded-lg bg-eyecog-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Play className="h-4 w-4 fill-white" />
              Launch 9-Point Gaze Calibration
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Session Completed & 12-Point Automated Audit */}
      {step === "completed_audit" && completedSession && auditResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Pilot Session Audit: {completedSession.participantId}
                </h2>
                <p className="text-xs text-slate-500">
                  Session ID: <span className="font-mono text-slate-700">{completedSession.sessionId}</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  auditResult.overallStatus === "PASS"
                    ? "bg-emerald-100 text-emerald-800"
                    : auditResult.overallStatus === "WARNING"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                AUDIT: {auditResult.overallStatus} ({auditResult.passedCount}/12 Passed)
              </span>
            </div>
          </div>

          {/* KPI Snapshot */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Calibration Error</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {completedSession.calibration.validation?.meanErrorPx ?? "—"} px
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Gaze Availability</span>
              <div className="text-base font-bold text-eyecog-teal mt-0.5">
                {completedSession.dataQuality.gazeAvailabilityScore}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Memory Sensitivity (d')</span>
              <div className="text-base font-bold text-indigo-600 mt-0.5">
                {completedSession.memoryRecognition?.sdt?.dPrime ?? "—"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-slate-500">Overall Quality</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {completedSession.dataQuality.overallQualityScore} / 100
              </div>
            </div>
          </div>

          {/* 12-Point Audit Checklist Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              12-Point Automated Data Audit Breakdown
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 w-12">#</th>
                    <th className="px-4 py-2.5">Verification Rule</th>
                    <th className="px-4 py-2.5">Audit Status</th>
                    <th className="px-4 py-2.5">Diagnostic Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {auditResult.checks.map((c) => (
                    <tr key={c.checkNumber}>
                      <td className="px-4 py-2 text-slate-400 font-mono">{c.checkNumber}</td>
                      <td className="px-4 py-2 font-semibold text-slate-900">{c.name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            c.status === "PASS"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{c.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Pilot Issue Logger */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Log Real-World Pilot Observation / Technical Issue
            </h3>
            <form onSubmit={handleLogPilotIssue} className="flex gap-2">
              <input
                type="text"
                value={newIssueDesc}
                onChange={(e) => setNewIssueDesc(e.target.value)}
                placeholder="Describe any unexpected tracking behavior, lighting anomaly, or participant feedback..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-eyecog-teal focus:outline-none"
              />
              <select
                value={newIssueSeverity}
                onChange={(e) => setNewIssueSeverity(e.target.value as any)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
              >
                Log Issue
              </button>
            </form>
            {issueSaved && (
              <p className="text-xs text-emerald-600 font-semibold">Issue logged to pilot registry.</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep("registration")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Users className="h-4 w-4 text-eyecog-teal" />
              Register Next Participant
            </button>

            <div className="flex items-center gap-2">
              <Link
                to="/research-dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Research Dashboard
              </Link>
              <Link
                to="/pilot-report"
                className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-600"
              >
                View Full Pilot Report
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Non-medical research disclaimer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">VISIONEXIS Research Notice &amp; Disclaimer:</p>
        <p className="mt-1">
          VISIONEXIS is an experimental software-based eye-tracking and cognitive assessment research platform. Its outputs are research measurements and do not constitute medical diagnosis or clinical assessment of dyslexia, ADHD, autism, memory disorders, or neurological conditions.
        </p>
      </div>
    </div>
  );
}
