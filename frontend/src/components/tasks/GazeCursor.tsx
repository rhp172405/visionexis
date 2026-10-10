interface GazeCursorProps {
  x: number;
  y: number;
  fixationDurationMs: number;
  visible: boolean;
}

const MAX_RING_SCALE = 2.5;
const RING_GROWTH_MS = 500;

export function GazeCursor({ x, y, fixationDurationMs, visible }: GazeCursorProps) {
  if (!visible) return null;

  const ringScale = Math.min(1 + fixationDurationMs / RING_GROWTH_MS, MAX_RING_SCALE);

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <div
        className="h-6 w-6 rounded-full border-2 border-eyecog-orange/60 transition-transform duration-150 ease-out"
        style={{ transform: `scale(${ringScale})` }}
      />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-eyecog-orange" />
    </div>
  );
}
