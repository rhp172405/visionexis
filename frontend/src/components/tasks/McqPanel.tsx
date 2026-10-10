interface McqPanelProps {
  question: string;
  options: string[];
  onSelect: (index: number) => void;
  disabled?: boolean;
  feedbackIndex?: number | null;
  feedbackCorrect?: boolean;
  questionNumber: number;
  totalQuestions: number;
}

export function McqPanel({
  question,
  options,
  onSelect,
  disabled = false,
  feedbackIndex = null,
  feedbackCorrect = false,
  questionNumber,
  totalQuestions,
}: McqPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-400">
        Question {questionNumber} of {totalQuestions}
      </p>
      <p className="text-base font-semibold text-slate-700">{question}</p>
      <div className="space-y-3">
        {options.map((option, i) => {
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
              className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default ${feedbackClass}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
