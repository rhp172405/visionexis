interface Option {
  label: string;
  value: string;
}

interface ToggleGroupProps {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
}

export function ToggleGroup({ label, options, value, onChange, multiple = false }: ToggleGroupProps) {
  const toggle = (optionValue: string) => {
    if (multiple) {
      onChange(
        value.includes(optionValue)
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue],
      );
    } else {
      onChange(value.includes(optionValue) ? [] : [optionValue]);
    }
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-eyecog-teal bg-eyecog-teal/10 text-eyecog-teal"
                  : "border-slate-300 text-slate-600 hover:border-eyecog-teal hover:text-eyecog-teal"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
