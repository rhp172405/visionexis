import type { TaskType } from "@/types";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  visual_search: "Visual Search",
  memory: "Memory Task",
  reading: "Reading Task",
};

export function formatAccuracy(pct: number | null): string {
  return pct === null ? "—" : `${Math.round(pct)}%`;
}

export function formatSeconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

export function accuracyColor(pct: number | null): string {
  if (pct === null) return "bg-slate-100 text-slate-500";
  if (pct < 70) return "bg-red-100 text-red-700";
  if (pct < 80) return "bg-orange-100 text-orange-700";
  return "bg-emerald-100 text-emerald-700";
}
