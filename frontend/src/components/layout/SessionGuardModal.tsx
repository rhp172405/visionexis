import { useAssessmentGuard } from "@/hooks/useAssessmentGuard";

export function SessionGuardModal() {
  const { patient, pendingPath, completedCount, totalCount, stay, endEarly } = useAssessmentGuard();

  if (!pendingPath) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-800">Session in progress</h3>
        <p className="mt-2 text-sm text-slate-500">
          {patient?.name ?? "This patient"} has completed {completedCount} of {totalCount} tasks.
          Leaving now will end the session early.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={stay}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={endEarly}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            End Session Early
          </button>
        </div>
      </div>
    </div>
  );
}
