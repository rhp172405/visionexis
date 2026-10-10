import type { LucideIcon } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { TASK_TYPE_LABELS } from "@/lib/format";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
}

export function PlaceholderPage({ icon: Icon, title, description, features }: PlaceholderPageProps) {
  const { patient, session } = useSessionStore();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {patient && session && (
        <div className="rounded-md border border-eyecog-teal/30 bg-eyecog-teal/5 px-4 py-3 text-sm text-slate-600">
          Active session for <span className="font-semibold">{patient.name}</span> ({patient.patient_code})
          — {TASK_TYPE_LABELS[session.task_type]}
        </div>
      )}

      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <Icon className="mx-auto h-10 w-10 text-eyecog-teal" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>

        <div className="mt-6 rounded-md bg-eyecog-bg p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Planned for this module
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-eyecog-teal">&bull;</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-slate-400">Coming in a future milestone.</p>
      </div>
    </div>
  );
}
