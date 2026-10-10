interface StudyGridProps {
  items: string[];
}

export function StudyGrid({ items }: StudyGridProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {items.map((word, i) => (
        <div
          key={i}
          className="rounded-lg border-2 border-eyecog-teal/30 bg-eyecog-teal/5 px-5 py-4 text-center"
        >
          <span className="text-xl font-bold tracking-wider text-eyecog-teal">{word}</span>
        </div>
      ))}
    </div>
  );
}
