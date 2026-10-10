interface VisualSearchGridProps {
  size: number;
  cells: string[];
  onCellClick: (index: number) => void;
  disabled?: boolean;
  feedbackIndex?: number | null;
  feedbackCorrect?: boolean;
}

export function VisualSearchGrid({
  size,
  cells,
  onCellClick,
  disabled = false,
  feedbackIndex = null,
  feedbackCorrect = false,
}: VisualSearchGridProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {cells.map((letter, i) => {
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
            onClick={() => onCellClick(i)}
            disabled={disabled}
            className={`flex aspect-square items-center justify-center rounded-md border text-xl font-semibold transition-colors disabled:cursor-default ${feedbackClass}`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
