const WORD_POOL = [
  "APPLE", "BIRD", "CAMP", "DOOR", "EAGLE", "FROG", "GRID", "HARP",
  "IRIS", "JAZZ", "KITE", "LAMP", "MOON", "NEST", "OAK", "PEAR",
  "QUIZ", "REEF", "SILK", "TOAD", "VINE", "WAVE", "XRAY", "YARN",
  "BARN", "COIN", "DUST", "ELM", "FORK", "GLOW", "HULL", "INK",
  "JADE", "KELP", "LIME", "MOLE", "NEWT", "ORE", "PINE", "ROSE",
  "SALT", "TUFT", "VEIL", "WREN", "YOLK", "ZONE", "ARCH", "BELL",
  "CLAW", "DRUM",
];

export interface MemoryTrial {
  studyItems: string[];
  probeItem: string;
  options: string[];   // 4 shuffled options: 1 target + 3 distractors
  targetIndex: number; // index of the target within options
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMemoryTrials(studyCount: number, trialCount: number): MemoryTrial[] {
  return Array.from({ length: trialCount }, () => {
    const pool = shuffle([...WORD_POOL]);
    const studyItems = pool.slice(0, studyCount);
    const probeItem = studyItems[Math.floor(Math.random() * studyItems.length)];
    const distractors = pool.slice(studyCount, studyCount + 3);
    const rawOptions = shuffle([probeItem, ...distractors]);
    return {
      studyItems,
      probeItem,
      options: rawOptions,
      targetIndex: rawOptions.indexOf(probeItem),
    };
  });
}
