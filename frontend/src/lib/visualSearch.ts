// Letter pairs chosen so the target and distractor share a similar shape,
// matching the "feature search" style described in the spec.
const LETTER_PAIRS: [string, string][] = [
  ["F", "E"],
  ["O", "Q"],
  ["P", "R"],
  ["V", "Y"],
  ["C", "G"],
  ["M", "N"],
  ["U", "V"],
  ["B", "D"],
];

export interface Trial {
  size: number;
  cells: string[];
  targetIndex: number;
  target: string;
}

export function generateTrial(size: number): Trial {
  const [distractor, target] = LETTER_PAIRS[Math.floor(Math.random() * LETTER_PAIRS.length)];
  const total = size * size;
  const targetIndex = Math.floor(Math.random() * total);
  const cells = Array.from({ length: total }, (_, i) => (i === targetIndex ? target : distractor));
  return { size, cells, targetIndex, target };
}

export function generateTrials(size: number, count: number): Trial[] {
  return Array.from({ length: count }, () => generateTrial(size));
}
