import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Assessment, BaselineVisualAssessment, Patient, TaskSession } from "@/types";

interface SessionState {
  patient: Patient | null;
  assessment: Assessment | null;
  session: TaskSession | null;
  baselineAssessment: BaselineVisualAssessment | null;
  setPatient: (patient: Patient | null) => void;
  setAssessment: (assessment: Assessment | null) => void;
  setSession: (session: TaskSession | null) => void;
  setBaselineAssessment: (baseline: BaselineVisualAssessment | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      patient: null,
      assessment: null,
      session: null,
      baselineAssessment: null,
      setPatient: (patient) => set({ patient }),
      setAssessment: (assessment) => set({ assessment }),
      setSession: (session) => set({ session }),
      setBaselineAssessment: (baselineAssessment) => set({ baselineAssessment }),
      reset: () => set({ patient: null, assessment: null, session: null, baselineAssessment: null }),
    }),
    {
      name: "eyecog-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
