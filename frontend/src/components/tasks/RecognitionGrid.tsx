interface RecognitionGridProps {
  options: string[];
  onSelect: (index: number) => void;
  disabled?: boolean;
  feedbackIndex?: number | null;
  feedbackCorrect?: boolean;
  onOptionEnter?: (index: number) => void;
  onOptionLeave?: (index: number) => void;
}

export function RecognitionGrid({
  options,
  onSelect,
  disabled = false,
  feedbackIndex = null,
  feedbackCorrect = false,
  onOptionEnter,
  onOptionLeave,
}: RecognitionGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {options.map((word, i) => {
        const showFeedback = feedbackIndex === i;
        const feedbackClass = showFeedback
          ? feedbackCorrect
            ? "border-eyecog-green bg-eyecog-green/10 text-eyecog-green"
            : "border-red-400 bg-red-50 text-red-500"
          : "border-slate-200 bg-white text-slate-700 hover:border-eyecog-teal hover:bg-eyecog-teal/5";

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            disabled={disabled}
            onMouseEnter={() => onOptionEnter?.(i)}
            onMouseLeave={() => onOptionLeave?.(i)}
            className={`flex h-20 items-center justify-center rounded-lg border-2 text-xl font-bold tracking-wider transition-colors disabled:cursor-default ${feedbackClass}`}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}
