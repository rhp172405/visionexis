import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPatient, createAssessment } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { FormSection } from "@/components/forms/FormSection";
import { Field } from "@/components/forms/Field";
import { ToggleGroup } from "@/components/forms/ToggleGroup";
import type { RefractiveStatus, ScreenTimeBucket } from "@/types";

interface FormState {
  patientCode: string;
  name: string;
  age: string;
  gender: string[];
  educationLevel: string;
  studyNotes: string;
  refractiveStatus: string[];
  spectacleUse: string[];
  avgScreenTime: string[];
  distanceVaOd: string;
  distanceVaOs: string;
  nearVaOu: string;
  refractiveErrorOd: string;
  refractiveErrorOs: string;
  npcCm: string;
  accommodationAmplitudeOd: string;
  accommodationAmplitudeOs: string;
  accommodativeFacilityOd: string;
  accommodativeFacilityOs: string;
  accommodativeFacilityOu: string;
  vergenceFacility: string;
  acARatio: string;
  positiveFusionalVergence: string;
  negativeFusionalVergence: string;
  examinerName: string;
}

const initialForm: FormState = {
  patientCode: "",
  name: "",
  age: "",
  gender: [],
  educationLevel: "",
  studyNotes: "",
  refractiveStatus: [],
  spectacleUse: [],
  avgScreenTime: [],
  distanceVaOd: "",
  distanceVaOs: "",
  nearVaOu: "",
  refractiveErrorOd: "",
  refractiveErrorOs: "",
  npcCm: "",
  accommodationAmplitudeOd: "",
  accommodationAmplitudeOs: "",
  accommodativeFacilityOd: "",
  accommodativeFacilityOs: "",
  accommodativeFacilityOu: "",
  vergenceFacility: "",
  acARatio: "",
  positiveFusionalVergence: "",
  negativeFusionalVergence: "",
  examinerName: "",
};

const numOrNull = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  const n = Number(value.trim());
  return isNaN(n) ? null : n;
};

const strOrNull = (value: string): string | null => {
  if (!value || value.trim() === "") return null;
  return value.trim();
};

export function NewSessionPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const navigate = useNavigate();
  const { setPatient, setAssessment } = useSessionStore();

  const patientMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: async (patient) => {
      setPatient(patient);
      const assessment = await createAssessment(patient.id);
      setAssessment(assessment);
      navigate("/baseline-assessment");
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const rawFindings = {
      distance_va_od: strOrNull(form.distanceVaOd),
      distance_va_os: strOrNull(form.distanceVaOs),
      near_va_ou: strOrNull(form.nearVaOu),
      refractive_error_od: strOrNull(form.refractiveErrorOd),
      refractive_error_os: strOrNull(form.refractiveErrorOs),
      npc_cm: numOrNull(form.npcCm),
      accommodation_amplitude_od: numOrNull(form.accommodationAmplitudeOd),
      accommodation_amplitude_os: numOrNull(form.accommodationAmplitudeOs),
      accommodative_facility_od: numOrNull(form.accommodativeFacilityOd),
      accommodative_facility_os: numOrNull(form.accommodativeFacilityOs),
      accommodative_facility_ou: numOrNull(form.accommodativeFacilityOu),
      vergence_facility: numOrNull(form.vergenceFacility),
      ac_a_ratio: strOrNull(form.acARatio),
      positive_fusional_vergence: strOrNull(form.positiveFusionalVergence),
      negative_fusional_vergence: strOrNull(form.negativeFusionalVergence),
      examiner_name: strOrNull(form.examinerName),
    };

    const hasAnyFinding = Object.values(rawFindings).some((v) => v !== null);

    const hasVisualHistory =
      form.refractiveStatus.length > 0 ||
      form.spectacleUse.length > 0 ||
      form.avgScreenTime.length > 0;

    const finalName = form.name.trim() || form.patientCode.trim() || "Participant";

    patientMutation.mutate({
      patient_code: strOrNull(form.patientCode) ?? undefined,
      name: finalName,
      age: numOrNull(form.age) ?? undefined,
      gender: form.gender[0] ?? undefined,
      visual_history: hasVisualHistory
        ? {
            refractive_status: form.refractiveStatus as RefractiveStatus[],
            spectacle_use:
              form.spectacleUse[0] === "yes"
                ? true
                : form.spectacleUse[0] === "no"
                ? false
                : null,
            avg_screen_time: (form.avgScreenTime[0] as ScreenTimeBucket | undefined) ?? null,
          }
        : undefined,
      clinical_findings: hasAnyFinding ? rawFindings : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Patient / Research Participant Registration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete demographic details to begin an assessment. Pseudonymous IDs are supported for research protocols.
        </p>
      </div>

      <FormSection title="1. Participant Identification & Demographics">
        <Field label="Participant / Patient ID" value={form.patientCode} onChange={(v) => set("patientCode", v)}
               placeholder="Auto-assigned if left blank (e.g. P-001, PART-101)" hint="Pseudonymous ID for research anonymity" />
        <Field label="Name or Initials (Optional for anonymous research)" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. A.S. or leave blank to use Participant ID" />
        <Field label="Age" type="number" value={form.age} onChange={(v) => set("age", v)} />
        <Field label="Education Level (Optional)" value={form.educationLevel} onChange={(v) => set("educationLevel", v)} placeholder="e.g. Undergraduate, High School" />
        <ToggleGroup
          label="Gender"
          options={[
            { label: "Male", value: "male" },
            { label: "Female", value: "female" },
            { label: "Other / Not Disclosed", value: "other" },
          ]}
          value={form.gender}
          onChange={(v) => set("gender", v)}
        />
        <Field label="Study Protocol Notes" value={form.studyNotes} onChange={(v) => set("studyNotes", v)} placeholder="Optional researcher notes or cohort tag" />
      </FormSection>

      <FormSection title="2. Visual History (Optional)">
        <div className="sm:col-span-2 lg:col-span-3">
          <ToggleGroup
            label="Refractive Status"
            multiple
            options={[
              { label: "Emmetropia", value: "emmetropia" },
              { label: "Myopia", value: "myopia" },
              { label: "Hyperopia", value: "hyperopia" },
              { label: "Astigmatism", value: "astigmatism" },
            ]}
            value={form.refractiveStatus}
            onChange={(v) => set("refractiveStatus", v)}
          />
        </div>
        <ToggleGroup
          label="Spectacle Use"
          options={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          value={form.spectacleUse}
          onChange={(v) => set("spectacleUse", v)}
        />
      </FormSection>

      <FormSection title="3. Digital Device Usage (Optional)">
        <div className="sm:col-span-2 lg:col-span-3">
          <ToggleGroup
            label="Average Screen Time Per Day"
            options={[
              { label: "Less than 2 hours", value: "<2h" },
              { label: "2–4 hours", value: "2-4h" },
              { label: "4–6 hours", value: "4-6h" },
              { label: "More than 6 hours", value: ">6h" },
            ]}
            value={form.avgScreenTime}
            onChange={(v) => set("avgScreenTime", v)}
          />
        </div>
      </FormSection>

      <FormSection
        title="5. Clinical Vision Findings (Optional)"
        description="Optional examiner findings. Leave blank if not available."
      >
        <Field label="Distance VA — OD" value={form.distanceVaOd} onChange={(v) => set("distanceVaOd", v)} placeholder="e.g. 6/6" />
        <Field label="Distance VA — OS" value={form.distanceVaOs} onChange={(v) => set("distanceVaOs", v)} placeholder="e.g. 6/6" />
        <Field label="Near VA — OU" value={form.nearVaOu} onChange={(v) => set("nearVaOu", v)} placeholder="e.g. N6" />

        <Field label="Refractive Error — OD" value={form.refractiveErrorOd} onChange={(v) => set("refractiveErrorOd", v)} placeholder="e.g. -1.00 DS" />
        <Field label="Refractive Error — OS" value={form.refractiveErrorOs} onChange={(v) => set("refractiveErrorOs", v)} placeholder="e.g. -1.00 DS" />
        <Field label="Near Point of Convergence (NPC)" type="number" value={form.npcCm} onChange={(v) => set("npcCm", v)} suffix="cm" hint="Example: NPC = 6 cm" />

        <Field label="Accommodation Amplitude — OD" type="number" value={form.accommodationAmplitudeOd} onChange={(v) => set("accommodationAmplitudeOd", v)} suffix="D" />
        <Field label="Accommodation Amplitude — OS" type="number" value={form.accommodationAmplitudeOs} onChange={(v) => set("accommodationAmplitudeOs", v)} suffix="D" />
        <div />

        <Field label="Accommodative Facility — OD" type="number" value={form.accommodativeFacilityOd} onChange={(v) => set("accommodativeFacilityOd", v)} suffix="cpm" />
        <Field label="Accommodative Facility — OS" type="number" value={form.accommodativeFacilityOs} onChange={(v) => set("accommodativeFacilityOs", v)} suffix="cpm" />
        <Field label="Accommodative Facility — OU" type="number" value={form.accommodativeFacilityOu} onChange={(v) => set("accommodativeFacilityOu", v)} suffix="cpm" />

        <Field label="Vergence Facility" type="number" value={form.vergenceFacility} onChange={(v) => set("vergenceFacility", v)} suffix="cpm" />
        <Field label="AC/A Ratio" value={form.acARatio} onChange={(v) => set("acARatio", v)} placeholder="e.g. 4:1" />
        <div />

        <Field label="Positive Fusional Vergence" value={form.positiveFusionalVergence} onChange={(v) => set("positiveFusionalVergence", v)} placeholder="e.g. 12/18/10" />
        <Field label="Negative Fusional Vergence" value={form.negativeFusionalVergence} onChange={(v) => set("negativeFusionalVergence", v)} placeholder="e.g. 8/14/6" />
        <Field label="Examiner Name" value={form.examinerName} onChange={(v) => set("examinerName", v)} />
      </FormSection>

      {patientMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(patientMutation.error as Error)?.message || "Failed to register patient. Please check the form and try again."}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={(!form.name.trim() && !form.patientCode.trim()) || patientMutation.isPending}
          className="rounded-md bg-eyecog-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {patientMutation.isPending ? "Saving…" : "Register & Proceed to Baseline Visual Assessment"}
        </button>
      </div>
    </form>
  );
}
