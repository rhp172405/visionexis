interface ReadingPassageProps {
  text: string;
  currentWordIndex: number | null;
  onWordEnter: (index: number) => void;
}

export function ReadingPassage({ text, currentWordIndex, onWordEnter }: ReadingPassageProps) {
  const words = text.trim().split(/\s+/);

  return (
    <p className="select-none text-base leading-8 text-slate-700">
      {words.map((word, idx) => (
        <span key={idx}>
          <span
            onMouseEnter={() => onWordEnter(idx)}
            className={`rounded px-0.5 transition-colors duration-100 ${
              currentWordIndex === idx
                ? "bg-eyecog-teal/25 font-semibold text-eyecog-teal"
                : "hover:bg-slate-100"
            }`}
          >
            {word}
          </span>
          {idx < words.length - 1 && " "}
        </span>
      ))}
    </p>
  );
}
