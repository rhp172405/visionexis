import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: "blue" | "teal" | "orange" | "green";
}

const ACCENT_BORDER: Record<KpiCardProps["accent"], string> = {
  blue: "border-t-blue-700",
  teal: "border-t-eyecog-teal",
  orange: "border-t-eyecog-orange",
  green: "border-t-eyecog-green",
};

const ACCENT_ICON: Record<KpiCardProps["accent"], string> = {
  blue: "text-blue-700",
  teal: "text-eyecog-teal",
  orange: "text-eyecog-orange",
  green: "text-eyecog-green",
};

export function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border-t-4 bg-white p-5 shadow-sm ${ACCENT_BORDER[accent]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl font-bold text-slate-800">{value}</span>
        <Icon className={`h-6 w-6 ${ACCENT_ICON[accent]}`} />
      </div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}
