import { AlertTriangle } from "lucide-react";
import type { RecentSessionRow } from "@/types";
import { TASK_TYPE_LABELS, accuracyColor, formatAccuracy, formatSeconds } from "@/lib/format";

interface SessionsTableProps {
  sessions: RecentSessionRow[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        No sessions recorded yet. Start a new session to see results here.
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4 font-medium">Patient</th>
          <th className="py-2 pr-4 font-medium">Task</th>
          <th className="py-2 pr-4 font-medium">Accuracy</th>
          <th className="py-2 pr-4 font-medium">Time</th>
          <th className="py-2 pr-4 font-medium">Flag</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((row) => (
          <tr key={row.session_id} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4">
              <div className="font-semibold text-slate-700">{row.patient_code}</div>
              <div className="text-xs text-slate-400">{row.patient_name}</div>
            </td>
            <td className="py-3 pr-4 text-slate-600">{TASK_TYPE_LABELS[row.task_type]}</td>
            <td className="py-3 pr-4">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${accuracyColor(row.accuracy_pct)}`}>
                {formatAccuracy(row.accuracy_pct)}
              </span>
            </td>
            <td className="py-3 pr-4 text-slate-600">{formatSeconds(row.rt_ms)}</td>
            <td className="py-3 pr-4">
              {row.flagged && <AlertTriangle className="h-4 w-4 text-eyecog-orange" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
