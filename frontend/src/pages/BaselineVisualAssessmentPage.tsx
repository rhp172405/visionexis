import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  ShieldCheck,
  Scale,
  Sparkles,
} from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { saveBaselineAssessment, getBaselineAssessment } from "@/lib/api";
import type { BaselineVisualAssessment } from "@/types";

export function BaselineVisualAssessmentPage() {
  const navigate = useNavigate();
  const { patient, assessment, setBaselineAssessment } = useSessionStore();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [examinerName, setExaminerName] = useState("");
  const [vaCorrectionStatus, setVaCorrectionStatus] = useState<"uncorrected" | "habitual_correction" | "best_corrected">("habitual_correction");
  const [distanceVaOd, setDistanceVaOd] = useState("6/6");
  const [distanceVaOs, setDistanceVaOs] = useState("6/6");
  const [nearVaOu, setNearVaOu] = useState("N6");
  const [refractiveErrorOd, setRefractiveErrorOd] = useState("");
  const [refractiveErrorOs, setRefractiveErrorOs] = useState("");

  // NFB: Negative Fusional Break (Base-In vergence test)
  const [nfbDistanceBreakPd, setNfbDistanceBreakPd] = useState<string>("");
  const [nfbDistanceRecPd, setNfbDistanceRecPd] = useState<string>("");
  const [nfbNearBlurPd, setNfbNearBlurPd] = useState<string>("");
  const [nfbNearBreakPd, setNfbNearBreakPd] = useState<string>("");
  const [nfbNearRecPd, setNfbNearRecPd] = useState<string>("");

  // PFV: Positive Fusional Vergence (Base-Out vergence test)
  const [pfvDistanceBlurPd, setPfvDistanceBlurPd] = useState<string>("");
  const [pfvDistanceBreakPd, setPfvDistanceBreakPd] = useState<string>("");
  const [pfvDistanceRecPd, setPfvDistanceRecPd] = useState<string>("");
  const [pfvNearBlurPd, setPfvNearBlurPd] = useState<string>("");
  const [pfvNearBreakPd, setPfvNearBreakPd] = useState<string>("");
  const [pfvNearRecPd, setPfvNearRecPd] = useState<string>("");

  // NPC: Near Point of Convergence (cm)
  const [npcBreakCm, setNpcBreakCm] = useState<string>("6");
  const [npcRecoveryCm, setNpcRecoveryCm] = useState<string>("8");
  const [npcTarget, setNpcTarget] = useState<"accommodative_target" | "penlight_red_glass">("accommodative_target");

  // NPA: Near Point of Accommodation (Diopters)
  const [npaAmplitudeOdD, setNpaAmplitudeOdD] = useState<string>("");
  const [npaAmplitudeOsD, setNpaAmplitudeOsD] = useState<string>("");
  const [npaAmplitudeOuD, setNpaAmplitudeOuD] = useState<string>("");
  const [npaMethod, setNpaMethod] = useState<"push_up" | "minus_lens">("push_up");

  // AC/A Ratio
  const [acARatio, setAcARatio] = useState<string>("4:1");
  const [acAMethod, setAcAMethod] = useState<"gradient" | "calculated_heterophoria">("calculated_heterophoria");

  // Phoria (Modified Thorington / MBT)
  const [phoriaDistancePd, setPhoriaDistancePd] = useState<string>("");
  const [phoriaDistanceDirection, setPhoriaDistanceDirection] = useState<"ortho" | "exo" | "eso" | "hyper">("ortho");
  const [phoriaNearPd, setPhoriaNearPd] = useState<string>("");
  const [phoriaNearDirection, setPhoriaNearDirection] = useState<"ortho" | "exo" | "eso" | "hyper">("exo");
  const [phoriaMethod, setPhoriaMethod] = useState<"modified_thorington" | "cover_test" | "von_graefe">("modified_thorington");

  // Facility (Optional)
  const [vergenceFacilityCpm, setVergenceFacilityCpm] = useState<string>("");
  const [accommodativeFacilityOuCpm, setAccommodativeFacilityOuCpm] = useState<string>("");

  // Study Notes
  const [clinicianNotes, setClinicianNotes] = useState<string>("");

  // Load existing baseline data if previously recorded for this assessment
  useEffect(() => {
    if (!assessment?.id) return;
    getBaselineAssessment(assessment.id).then((saved) => {
      if (saved) {
        if (saved.examiner_name) setExaminerName(saved.examiner_name);
        if (saved.va_correction_status) setVaCorrectionStatus(saved.va_correction_status);
        if (saved.distance_va_od) setDistanceVaOd(saved.distance_va_od);
        if (saved.distance_va_os) setDistanceVaOs(saved.distance_va_os);
        if (saved.near_va_ou) setNearVaOu(saved.near_va_ou);
        if (saved.refractive_error_od) setRefractiveErrorOd(saved.refractive_error_od);
        if (saved.refractive_error_os) setRefractiveErrorOs(saved.refractive_error_os);

        if (saved.nfb_distance_break_pd != null) setNfbDistanceBreakPd(String(saved.nfb_distance_break_pd));
        if (saved.nfv_distance_triad?.recovery != null) setNfbDistanceRecPd(String(saved.nfv_distance_triad.recovery));
        if (saved.nfv_near_triad?.blur != null) setNfbNearBlurPd(String(saved.nfv_near_triad.blur));
        if (saved.nfb_near_break_pd != null) setNfbNearBreakPd(String(saved.nfb_near_break_pd));
        if (saved.nfv_near_triad?.recovery != null) setNfbNearRecPd(String(saved.nfv_near_triad.recovery));

        if (saved.pfv_distance_triad?.blur != null) setPfvDistanceBlurPd(String(saved.pfv_distance_triad.blur));
        if (saved.pfv_distance_break_pd != null) setPfvDistanceBreakPd(String(saved.pfv_distance_break_pd));
        if (saved.pfv_distance_triad?.recovery != null) setPfvDistanceRecPd(String(saved.pfv_distance_triad.recovery));
        if (saved.pfv_near_triad?.blur != null) setPfvNearBlurPd(String(saved.pfv_near_triad.blur));
        if (saved.pfv_near_break_pd != null) setPfvNearBreakPd(String(saved.pfv_near_break_pd));
        if (saved.pfv_near_triad?.recovery != null) setPfvNearRecPd(String(saved.pfv_near_triad.recovery));

        if (saved.npc_break_cm != null) setNpcBreakCm(String(saved.npc_break_cm));
        if (saved.npc_recovery_cm != null) setNpcRecoveryCm(String(saved.npc_recovery_cm));
        if (saved.npc_target) setNpcTarget(saved.npc_target);

        if (saved.npa_amplitude_od_d != null) setNpaAmplitudeOdD(String(saved.npa_amplitude_od_d));
        if (saved.npa_amplitude_os_d != null) setNpaAmplitudeOsD(String(saved.npa_amplitude_os_d));
        if (saved.npa_amplitude_ou_d != null) setNpaAmplitudeOuD(String(saved.npa_amplitude_ou_d));
        if (saved.npa_method) setNpaMethod(saved.npa_method);

        if (saved.ac_a_ratio) setAcARatio(saved.ac_a_ratio);
        if (saved.ac_a_method) setAcAMethod(saved.ac_a_method);

        if (saved.phoria_distance_pd != null) setPhoriaDistancePd(String(saved.phoria_distance_pd));
        if (saved.phoria_distance_direction) setPhoriaDistanceDirection(saved.phoria_distance_direction);
        if (saved.phoria_near_pd != null) setPhoriaNearPd(String(saved.phoria_near_pd));
        if (saved.phoria_near_direction) setPhoriaNearDirection(saved.phoria_near_direction);
        if (saved.phoria_method) setPhoriaMethod(saved.phoria_method);

        if (saved.vergence_facility_cpm != null) setVergenceFacilityCpm(String(saved.vergence_facility_cpm));
        if (saved.accommodative_facility_ou_cpm != null) setAccommodativeFacilityOuCpm(String(saved.accommodative_facility_ou_cpm));
        if (saved.clinician_notes) setClinicianNotes(saved.clinician_notes);
      }
    });
  }, [assessment?.id]);

  const parseNumOrNull = (val: string): number | null => {
    if (!val || val.trim() === "") return null;
    const n = Number(val.trim());
    return isNaN(n) ? null : n;
  };

  const parseStrOrNull = (val: string): string | null => {
    if (!val || val.trim() === "") return null;
    return val.trim();
  };

  const buildBaselinePayload = (): BaselineVisualAssessment => {
    const unmeasured: string[] = [];

    const distBreak = parseNumOrNull(nfbDistanceBreakPd);
    const distRec = parseNumOrNull(nfbDistanceRecPd);
    const nearBlur = parseNumOrNull(nfbNearBlurPd);
    const nearBreak = parseNumOrNull(nfbNearBreakPd);
    const nearRec = parseNumOrNull(nfbNearRecPd);

    if (distBreak === null) unmeasured.push("NFB Distance Break");
    if (nearBreak === null) unmeasured.push("NFB Near Break");

    const pfvDistBlur = parseNumOrNull(pfvDistanceBlurPd);
    const pfvDistBreak = parseNumOrNull(pfvDistanceBreakPd);
    const pfvDistRec = parseNumOrNull(pfvDistanceRecPd);
    const pfvNrBlur = parseNumOrNull(pfvNearBlurPd);
    const pfvNrBreak = parseNumOrNull(pfvNearBreakPd);
    const pfvNrRec = parseNumOrNull(pfvNearRecPd);

    if (pfvDistBreak === null) unmeasured.push("PFV Distance Break");
    if (pfvNrBreak === null) unmeasured.push("PFV Near Break");

    const npcBrk = parseNumOrNull(npcBreakCm);
    const npcRec = parseNumOrNull(npcRecoveryCm);
    if (npcBrk === null) unmeasured.push("NPC Break");

    const npaOd = parseNumOrNull(npaAmplitudeOdD);
    const npaOs = parseNumOrNull(npaAmplitudeOsD);
    const npaOu = parseNumOrNull(npaAmplitudeOuD);
    if (npaOu === null && npaOd === null) unmeasured.push("NPA Amplitude");

    const phDist = parseNumOrNull(phoriaDistancePd);
    const phNear = parseNumOrNull(phoriaNearPd);
    if (phNear === null) unmeasured.push("Phoria Near");

    return {
      assessment_id: assessment?.id || "demo-assessment",
      patient_id: patient?.id || "demo-patient",
      recorded_at: new Date().toISOString(),
      examiner_name: parseStrOrNull(examinerName),
      va_correction_status: vaCorrectionStatus,
      distance_va_od: parseStrOrNull(distanceVaOd),
      distance_va_os: parseStrOrNull(distanceVaOs),
      near_va_ou: parseStrOrNull(nearVaOu),
      va_notation: "Snellen_fraction",
      refractive_error_od: parseStrOrNull(refractiveErrorOd),
      refractive_error_os: parseStrOrNull(refractiveErrorOs),

      // NFB: Negative Fusional Break (NFV Base-In Break Point in Prism Diopters Δ)
      nfb_distance_break_pd: distBreak,
      nfb_near_break_pd: nearBreak,
      nfv_distance_triad: {
        blur: null,
        break: distBreak,
        recovery: distRec,
      },
      nfv_near_triad: {
        blur: nearBlur,
        break: nearBreak,
        recovery: nearRec,
      },

      // PFV: Positive Fusional Vergence
      pfv_distance_break_pd: pfvDistBreak,
      pfv_near_break_pd: pfvNrBreak,
      pfv_distance_triad: {
        blur: pfvDistBlur,
        break: pfvDistBreak,
        recovery: pfvDistRec,
      },
      pfv_near_triad: {
        blur: pfvNrBlur,
        break: pfvNrBreak,
        recovery: pfvNrRec,
      },

      // NPC
      npc_break_cm: npcBrk,
      npc_recovery_cm: npcRec,
      npc_target: npcTarget,

      // NPA
      npa_amplitude_od_d: npaOd,
      npa_amplitude_os_d: npaOs,
      npa_amplitude_ou_d: npaOu,
      npa_method: npaMethod,

      // AC/A Ratio
      ac_a_ratio: parseStrOrNull(acARatio),
      ac_a_method: acAMethod,

      // Phoria (MBT)
      phoria_distance_pd: phDist,
      phoria_distance_direction: phoriaDistanceDirection,
      phoria_near_pd: phNear,
      phoria_near_direction: phoriaNearDirection,
      phoria_method: phoriaMethod,

      // Facility
      vergence_facility_cpm: parseNumOrNull(vergenceFacilityCpm),
      accommodative_facility_ou_cpm: parseNumOrNull(accommodativeFacilityOuCpm),

      // Notes
      clinician_notes: parseStrOrNull(clinicianNotes),
      unmeasured_fields: unmeasured,
    };
  };

  const handleSaveAndProceed = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const payload = buildBaselinePayload();
      const assessmentId = assessment?.id || "demo-assessment";
      const saved = await saveBaselineAssessment(assessmentId, payload);
      setBaselineAssessment(saved);
      if (saved.is_server_synced) {
        setSaveSuccess(true);
        setTimeout(() => {
          navigate("/calibration");
        }, 400);
      } else {
        setErrorMessage("Notice: Backend server offline. Baseline measurements preserved locally in browser session only.");
        setTimeout(() => {
          navigate("/calibration");
        }, 1200);
      }
    } catch (err: any) {
      console.error("Save baseline error:", err);
      setErrorMessage("Could not save baseline visual assessment. Please review fields and retry.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipToCalibration = () => {
    // Record baseline as omitted / skipped for this session
    const payload = buildBaselinePayload();
    payload.clinician_notes = (payload.clinician_notes ? payload.clinician_notes + " " : "") + "[Baseline MBT skipped by researcher/participant]";
    if (assessment?.id) {
      saveBaselineAssessment(assessment.id, payload).catch(() => {});
      setBaselineAssessment(payload);
    }
    navigate("/calibration");
  };

  if (!assessment && !patient) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">No Active Participant Session</h2>
        <p className="text-sm text-slate-500">
          Please register or select a participant before recording baseline visual function (MBT) measurements.
        </p>
        <div className="pt-2">
          <Link
            to="/new-session"
            className="inline-flex items-center gap-2 rounded-lg bg-eyecog-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-eyecog-navy-light transition"
          >
            <ArrowRight className="h-4 w-4" />
            Go to Participant Registration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-100 px-3 py-0.5 text-xs font-extrabold text-teal-800">
                STEP 2 OF ASSESSMENT WORKFLOW
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Participant: {patient?.patient_code || "Anonymous"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              Baseline Visual &amp; Binocular Assessment (MBT)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record baseline visual acuity, Modified Thorington phoria, vergence limits (PFV, NFB), convergence (NPC), and accommodation (NPA).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkipToCalibration}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              title="Skip baseline entry and continue with gaze calibration"
            >
              Skip Baseline &rarr;
            </button>
            <button
              type="button"
              onClick={() => handleSaveAndProceed()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-600 transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save & Continue"}
            </button>
          </div>
        </div>

        {/* Guidance notice */}
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 flex items-start gap-2.5">
          <InfoIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Research Protocol Notice:</span> Measured clinical values are linked strictly to this assessment session.
            Values outside reference criteria reflect empirical observations for research association and do <em>not</em> constitute an automated diagnosis.
          </div>
        </div>
      </div>

      {/* Main Entry Form */}
      <form onSubmit={handleSaveAndProceed} className="space-y-6">
        {/* Section 1: Visual Acuity & Correction Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-eyecog-teal" />
              <h2 className="text-base font-bold text-slate-900">
                1. Visual Acuity &amp; Refractive Correction
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Visual Function
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Correction Status</label>
              <select
                value={vaCorrectionStatus}
                onChange={(e) => setVaCorrectionStatus(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              >
                <option value="habitual_correction">Habitual Correction (Glasses/Lenses)</option>
                <option value="uncorrected">Uncorrected (Unaided)</option>
                <option value="best_corrected">Best Corrected Visual Acuity (BCVA)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Distance VA — OD (Right Eye)</label>
              <input
                type="text"
                value={distanceVaOd}
                onChange={(e) => setDistanceVaOd(e.target.value)}
                placeholder="e.g. 6/6, 20/20, 0.0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">Standard test distance 6m</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Distance VA — OS (Left Eye)</label>
              <input
                type="text"
                value={distanceVaOs}
                onChange={(e) => setDistanceVaOs(e.target.value)}
                placeholder="e.g. 6/6, 20/20, 0.0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">Standard test distance 6m</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Near VA — OU (Both Eyes)</label>
              <input
                type="text"
                value={nearVaOu}
                onChange={(e) => setNearVaOu(e.target.value)}
                placeholder="e.g. N6, 20/20, M0.5"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">Standard test distance 40cm</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Refractive Error OD</label>
              <input
                type="text"
                value={refractiveErrorOd}
                onChange={(e) => setRefractiveErrorOd(e.target.value)}
                placeholder="e.g. -1.50 DS / -0.50 DC x 180"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Refractive Error OS</label>
              <input
                type="text"
                value={refractiveErrorOs}
                onChange={(e) => setRefractiveErrorOs(e.target.value)}
                placeholder="e.g. -1.50 DS / -0.50 DC x 180"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Binocular Vergence Assessment (NFB & PFV) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">
                2. Fusional Vergence &amp; Reserve Assessment (NFB &amp; PFV)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">
              Prism Diopters (Δ)
            </span>
          </div>

          {/* NFB Definition Banner */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              NFB: Negative Fusional Break (Base-In Divergence Limit)
            </div>
            <p className="text-[11px] text-slate-600">
              Measured via Base-In (BI) prism vergence testing. Morgan's normative criteria:
              Distance BI Break: 7Δ (&plusmn;2); Near BI Blur/Break/Rec: 13 / 21 / 13Δ.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NFB Distance */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                NFB at Distance (6m Base-In)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Break Point (NFB) *</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={nfbDistanceBreakPd}
                      onChange={(e) => setNfbDistanceBreakPd(e.target.value)}
                      placeholder="e.g. 7"
                      className="w-full rounded-lg border border-slate-300 pr-7 pl-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">&Delta;</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Norm: 7 &plusmn; 2 &Delta;</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Recovery Point</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={nfbDistanceRecPd}
                      onChange={(e) => setNfbDistanceRecPd(e.target.value)}
                      placeholder="e.g. 4"
                      className="w-full rounded-lg border border-slate-300 pr-7 pl-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">&Delta;</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Norm: 4 &plusmn; 2 &Delta;</span>
                </div>
              </div>
            </div>

            {/* NFB Near */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                NFB at Near (40cm Base-In)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Blur</label>
                  <input
                    type="number"
                    step="any"
                    value={nfbNearBlurPd}
                    onChange={(e) => setNfbNearBlurPd(e.target.value)}
                    placeholder="13"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400">Norm: 13&Delta;</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Break *</label>
                  <input
                    type="number"
                    step="any"
                    value={nfbNearBreakPd}
                    onChange={(e) => setNfbNearBreakPd(e.target.value)}
                    placeholder="21"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none font-bold"
                  />
                  <span className="text-[9px] text-slate-400">Norm: 21&Delta;</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Recovery</label>
                  <input
                    type="number"
                    step="any"
                    value={nfbNearRecPd}
                    onChange={(e) => setNfbNearRecPd(e.target.value)}
                    placeholder="13"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400">Norm: 13&Delta;</span>
                </div>
              </div>
            </div>
          </div>

          {/* PFV Positive Fusional Vergence */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              PFV: Positive Fusional Vergence (Base-Out Convergence Reserve)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-800">Distance PFV (6m Base-Out)</span>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500">Blur</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvDistanceBlurPd}
                      onChange={(e) => setPfvDistanceBlurPd(e.target.value)}
                      placeholder="9"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 9&Delta;</span>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Break *</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvDistanceBreakPd}
                      onChange={(e) => setPfvDistanceBreakPd(e.target.value)}
                      placeholder="19"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 19&Delta;</span>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Recovery</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvDistanceRecPd}
                      onChange={(e) => setPfvDistanceRecPd(e.target.value)}
                      placeholder="10"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 10&Delta;</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-800">Near PFV (40cm Base-Out)</span>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500">Blur</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvNearBlurPd}
                      onChange={(e) => setPfvNearBlurPd(e.target.value)}
                      placeholder="17"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 17&Delta;</span>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Break *</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvNearBreakPd}
                      onChange={(e) => setPfvNearBreakPd(e.target.value)}
                      placeholder="21"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 21&Delta;</span>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Recovery</label>
                    <input
                      type="number"
                      step="any"
                      value={pfvNearRecPd}
                      onChange={(e) => setPfvNearRecPd(e.target.value)}
                      placeholder="11"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span className="text-[9px] text-slate-400">Norm: 11&Delta;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Near Point Convergence (NPC) & Near Point Accommodation (NPA) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-eyecog-teal" />
              <h2 className="text-base font-bold text-slate-900">
                3. Near Point Convergence (NPC) &amp; Accommodation (NPA)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Near Function
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NPC */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Near Point of Convergence (NPC)
                </h3>
                <span className="text-[10px] text-slate-400">Norm: Break &le; 5–6 cm (Scheiman &amp; Wick)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Break Point</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={npcBreakCm}
                      onChange={(e) => setNpcBreakCm(e.target.value)}
                      placeholder="e.g. 6"
                      className="w-full rounded-lg border border-slate-300 pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">cm</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Normal &le; 6 cm</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Recovery Point</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={npcRecoveryCm}
                      onChange={(e) => setNpcRecoveryCm(e.target.value)}
                      placeholder="e.g. 8"
                      className="w-full rounded-lg border border-slate-300 pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">cm</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Normal &le; 10 cm</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Test Target</label>
                <select
                  value={npcTarget}
                  onChange={(e) => setNpcTarget(e.target.value as any)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="accommodative_target">Accommodative Target (Fine letter/line)</option>
                  <option value="penlight_red_glass">Penlight with Red-Glass</option>
                </select>
              </div>
            </div>

            {/* NPA */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Near Point of Accommodation (NPA) — Amplitude
                </h3>
                <span className="text-[10px] text-slate-400">Unit: Diopters (D)</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Authoritative unit is <strong>Amplitude in Diopters (D)</strong>. If measured with RAF ruler push-up in cm: 
                <span className="font-mono text-eyecog-navy font-semibold"> D = 100 / cm</span> (e.g. 8 cm = 12.5 D, 10 cm = 10.0 D).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">OD Amplitude (Right)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={npaAmplitudeOdD}
                      onChange={(e) => setNpaAmplitudeOdD(e.target.value)}
                      placeholder="e.g. 10.0"
                      className="w-full rounded border border-slate-300 pr-6 pl-2 py-1 text-xs"
                    />
                    <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400 font-bold">D</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Diopters (D)</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">OS Amplitude (Left)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={npaAmplitudeOsD}
                      onChange={(e) => setNpaAmplitudeOsD(e.target.value)}
                      placeholder="e.g. 10.0"
                      className="w-full rounded border border-slate-300 pr-6 pl-2 py-1 text-xs"
                    />
                    <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400 font-bold">D</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Diopters (D)</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">OU Amplitude (Both)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={npaAmplitudeOuD}
                      onChange={(e) => setNpaAmplitudeOuD(e.target.value)}
                      placeholder="e.g. 11.0"
                      className="w-full rounded border border-slate-300 pr-6 pl-2 py-1 text-xs font-bold"
                    />
                    <span className="absolute right-1.5 top-1.5 text-[9px] text-slate-400 font-bold">D</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Diopters (D)</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Measurement Method</label>
                <select
                  value={npaMethod}
                  onChange={(e) => setNpaMethod(e.target.value as any)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="push_up">Push-Up Method (RAF Ruler, D = 100/cm)</option>
                  <option value="minus_lens">Minus-to-Blur Lens Method (Direct D)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: AC/A Ratio & Modified Thorington Phoria (MBT) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                4. AC/A Ratio &amp; Modified Thorington Phoria (MBT)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              Alignment &amp; AC/A
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phoria (MBT) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Heterophoria (Modified Thorington)
                </h3>
                <span className="text-[10px] text-slate-400">Method: MBT</span>
              </div>

              {/* Distance Phoria */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Distance Phoria (6m)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={phoriaDistancePd}
                      onChange={(e) => setPhoriaDistancePd(e.target.value)}
                      placeholder="1"
                      className="w-full rounded border border-slate-300 pr-7 pl-2 py-1 text-xs"
                    />
                    <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-bold">&Delta;</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Norm: 1&Delta; Exo &plusmn; 2</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Direction</label>
                  <select
                    value={phoriaDistanceDirection}
                    onChange={(e) => setPhoriaDistanceDirection(e.target.value as any)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="ortho">Orthophoria</option>
                    <option value="exo">Exophoria (Exo)</option>
                    <option value="eso">Esophoria (Eso)</option>
                    <option value="hyper">Hyperphoria</option>
                  </select>
                </div>
              </div>

              {/* Near Phoria */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Near Phoria (40cm)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      value={phoriaNearPd}
                      onChange={(e) => setPhoriaNearPd(e.target.value)}
                      placeholder="3"
                      className="w-full rounded border border-slate-300 pr-7 pl-2 py-1 text-xs font-bold"
                    />
                    <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-bold">&Delta;</span>
                  </div>
                  <span className="text-[9px] text-slate-400">Norm: 3&Delta; Exo &plusmn; 3</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Direction</label>
                  <select
                    value={phoriaNearDirection}
                    onChange={(e) => setPhoriaNearDirection(e.target.value as any)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="exo">Exophoria (Exo)</option>
                    <option value="ortho">Orthophoria</option>
                    <option value="eso">Esophoria (Eso)</option>
                    <option value="hyper">Hyperphoria</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AC/A Ratio */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Accommodative Convergence / Accommodation (AC/A)
                </h3>
                <span className="text-[10px] text-slate-400">Norm: 4:1 (&plusmn;2)</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600">AC/A Ratio (Δ / D)</label>
                <input
                  type="text"
                  value={acARatio}
                  onChange={(e) => setAcARatio(e.target.value)}
                  placeholder="e.g. 4:1"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-bold focus:border-eyecog-teal focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">Standard normal range: 4:1 &plusmn; 2 &Delta;/D</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Calculation Method</label>
                <select
                  value={acAMethod}
                  onChange={(e) => setAcAMethod(e.target.value as any)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="calculated_heterophoria">Calculated Heterophoria Method (PD + 0.4(Pn - Pd))</option>
                  <option value="gradient">Gradient Method (+1.00 / -1.00 lens)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-500">Vergence Facility</label>
                  <input
                    type="number"
                    step="any"
                    value={vergenceFacilityCpm}
                    onChange={(e) => setVergenceFacilityCpm(e.target.value)}
                    placeholder="15"
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <span className="text-[9px] text-slate-400">cpm (Norm &ge; 12)</span>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Accommodative Facility OU</label>
                  <input
                    type="number"
                    step="any"
                    value={accommodativeFacilityOuCpm}
                    onChange={(e) => setAccommodativeFacilityOuCpm(e.target.value)}
                    placeholder="10"
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <span className="text-[9px] text-slate-400">cpm (Norm &ge; 8)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Examiner & Study Protocol Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800">
            5. Examiner Name &amp; Study Notes (Optional)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Examiner / Researcher Name</label>
              <input
                type="text"
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="e.g. Dr. A. Smith, COVD"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Test Observation Notes</label>
              <input
                type="text"
                value={clinicianNotes}
                onChange={(e) => setClinicianNotes(e.target.value)}
                placeholder="e.g. Participant wore habitual progressive lenses; ambient illumination normal"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-eyecog-teal focus:outline-none"
              />
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Baseline visual assessment saved successfully. Redirecting to gaze calibration...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link
            to="/new-session"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Demographics
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkipToCalibration}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Skip Baseline Assessment
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-eyecog-teal px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-600 transition disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving…" : "Save Baseline & Proceed to Gaze Calibration"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function InfoIcon(props: any) {
  return <HelpCircle {...props} />;
}
