interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  suffix?: string;
  hint?: string;
}

export function Field({ label, value, onChange, type = "text", placeholder, suffix, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={type === "number" ? "any" : undefined}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-eyecog-teal focus:outline-none focus:ring-1 focus:ring-eyecog-teal"
        />
        {suffix && <span className="whitespace-nowrap text-xs text-slate-400">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
