import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Assessment, Patient, TaskSession } from "@/types";

interface SessionState {
  patient: Patient | null;
  assessment: Assessment | null;
  session: TaskSession | null;
  setPatient: (patient: Patient | null) => void;
  setAssessment: (assessment: Assessment | null) => void;
  setSession: (session: TaskSession | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      patient: null,
      assessment: null,
      session: null,
      setPatient: (patient) => set({ patient }),
      setAssessment: (assessment) => set({ assessment }),
      setSession: (session) => set({ session }),
      reset: () => set({ patient: null, assessment: null, session: null }),
    }),
    {
      name: "eyecog-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
