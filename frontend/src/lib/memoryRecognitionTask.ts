/**
 * VISIONEXIS Memory & Recognition Cognitive Task Engine (Phase 6).
 *
 * Implements:
 * 1. 40-item curated neutral visual stimuli bank across multiple categories.
 * 2. 20-item Study Phase with configurable duration & randomized screen positions.
 * 3. 3-5 second Retention Interval with timestamp markers.
 * 4. 40-item Recognition Phase (20 Old / Studied items + 20 New / Foil items) in balanced randomized order.
 * 5. Independent Webcam Gaze & Mouse Response Tracking.
 * 6. Signal Detection Theory metrics:
 *    - Hits, Misses, False Alarms, Correct Rejections
 *    - Hit Rate, False Alarm Rate, Recognition Accuracy
 *    - d-prime (Sensitivity Index d') with log-linear (Hautus) correction
 *    - Criterion c (Response Bias)
 * 7. Visual Attention vs. Memory Encoding Analysis (Study Dwell Time vs. Hit/Miss).
 * 8. Complete Raw Data & Event Preservation schema.
 *
 * NOTE: Experimental eye-movement & cognitive-task measurement system; NOT intended for medical diagnosis.
 */

import type { RawGazeBufferSample, FixationEvent, SaccadeEvent } from "./webcam/gazeEvents";

export type MemoryCategory = "shapes" | "symbols" | "abstract" | "icons" | "patterns";
export type RecognitionChoice = "SEEN_BEFORE" | "NEW";
export type StimulusStatus = "OLD" | "NEW";

export interface MemoryStimulus {
  id: string;
  symbol: string;
  label: string;
  category: MemoryCategory;
  accentColor: string;
}

// 40 Visually distinguishable, neutral stimuli
export const MEMORY_STIMULI_BANK: MemoryStimulus[] = [
  // 1-8: Geometric / Shapes
  { id: "stim_01", symbol: "⬡", label: "Hexagon", category: "shapes", accentColor: "#0ea5e9" },
  { id: "stim_02", symbol: "◈", label: "Diamond Dot", category: "shapes", accentColor: "#14b8a6" },
  { id: "stim_03", symbol: "▲", label: "Solid Triangle", category: "shapes", accentColor: "#f59e0b" },
  { id: "stim_04", symbol: "◎", label: "Double Circle", category: "shapes", accentColor: "#8b5cf6" },
  { id: "stim_05", symbol: "◩", label: "Quadrant Square", category: "shapes", accentColor: "#ec4899" },
  { id: "stim_06", symbol: "⬟", label: "Pentagon", category: "shapes", accentColor: "#10b981" },
  { id: "stim_07", symbol: "◆", label: "Solid Rhombus", category: "shapes", accentColor: "#6366f1" },
  { id: "stim_08", symbol: "◰", label: "Framed Corner", category: "shapes", accentColor: "#3b82f6" },

  // 9-16: Symbols
  { id: "stim_09", symbol: "⚡", label: "Bolt", category: "symbols", accentColor: "#eab308" },
  { id: "stim_10", symbol: "✦", label: "Four Point Star", category: "symbols", accentColor: "#06b6d4" },
  { id: "stim_11", symbol: "⚑", label: "Flag", category: "symbols", accentColor: "#ef4444" },
  { id: "stim_12", symbol: "⚓", label: "Anchor", category: "symbols", accentColor: "#3b82f6" },
  { id: "stim_13", symbol: "✿", label: "Flower", category: "symbols", accentColor: "#f43f5e" },
  { id: "stim_14", symbol: "☼", label: "Sun Ray", category: "symbols", accentColor: "#f59e0b" },
  { id: "stim_15", symbol: "☾", label: "Crescent", category: "symbols", accentColor: "#a855f7" },
  { id: "stim_16", symbol: "♟", label: "Pawn", category: "symbols", accentColor: "#64748b" },

  // 17-24: Abstract Figures
  { id: "stim_17", symbol: "⌥", label: "Option Key", category: "abstract", accentColor: "#0284c7" },
  { id: "stim_18", symbol: "⌘", label: "Command Key", category: "abstract", accentColor: "#0d9488" },
  { id: "stim_19", symbol: "☍", label: "Opposition", category: "abstract", accentColor: "#d97706" },
  { id: "stim_20", symbol: "☌", label: "Conjunction", category: "abstract", accentColor: "#7c3aed" },
  { id: "stim_21", symbol: "⊞", label: "Squared Plus", category: "abstract", accentColor: "#db2777" },
  { id: "stim_22", symbol: "⊠", label: "Squared Times", category: "abstract", accentColor: "#059669" },
  { id: "stim_23", symbol: "⊛", label: "Circled Asterisk", category: "abstract", accentColor: "#4f46e5" },
  { id: "stim_24", symbol: "⊚", label: "Circled Ring", category: "abstract", accentColor: "#2563eb" },

  // 25-32: Icons & Glyphs
  { id: "stim_25", symbol: "✉", label: "Envelope", category: "icons", accentColor: "#0284c7" },
  { id: "stim_26", symbol: "✂", label: "Scissors", category: "icons", accentColor: "#e11d48" },
  { id: "stim_27", symbol: "✈", label: "Airplane", category: "icons", accentColor: "#2563eb" },
  { id: "stim_28", symbol: "⏳", label: "Hourglass", category: "icons", accentColor: "#d97706" },
  { id: "stim_29", symbol: "⚖", label: "Scales", category: "icons", accentColor: "#475569" },
  { id: "stim_30", symbol: "☘", label: "Shamrock", category: "icons", accentColor: "#16a34a" },
  { id: "stim_31", symbol: "⚙", label: "Gear", category: "icons", accentColor: "#64748b" },
  { id: "stim_32", symbol: "♫", label: "Music Note", category: "icons", accentColor: "#9333ea" },

  // 33-40: Spatial Patterns
  { id: "stim_33", symbol: "◪", label: "Right Half Fill", category: "patterns", accentColor: "#0891b2" },
  { id: "stim_34", symbol: "◩", label: "Left Half Fill", category: "patterns", accentColor: "#059669" },
  { id: "stim_35", symbol: "◒", label: "Bottom Half Fill", category: "patterns", accentColor: "#d97706" },
  { id: "stim_36", symbol: "◓", label: "Top Half Fill", category: "patterns", accentColor: "#7c3aed" },
  { id: "stim_37", symbol: "▦", label: "Square Grid", category: "patterns", accentColor: "#db2777" },
  { id: "stim_38", symbol: "▤", label: "Horizontal Stripe", category: "patterns", accentColor: "#2563eb" },
  { id: "stim_39", symbol: "▥", label: "Vertical Stripe", category: "patterns", accentColor: "#4f46e5" },
  { id: "stim_40", symbol: "▧", label: "Diagonal Stripe", category: "patterns", accentColor: "#0d9488" },
];

export interface ItemAOI {
  aoiId: string;
  itemId: string;
  x: number; // in container px
  y: number;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
}

export interface MouseEventRecord {
  type: "move" | "click";
  x: number;
  y: number;
  timestamp: number; // monotonic performance.now()
}

export interface StudyItemConfig {
  studyIndex: number;
  stimulus: MemoryStimulus;
  position: { x: number; y: number }; // container px position offset
  durationMs: number;
}

export interface StudyTrialRecord {
  studyIndex: number;
  itemId: string;
  stimulus: MemoryStimulus;
  startTime: number;
  endTime: number;
  durationMs: number;
  aoi: ItemAOI;
  rawGazeSamples: RawGazeBufferSample[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
  gazeMetrics: {
    timeToFirstFixation: number;
    fixationCount: number;
    totalFixationDuration: number;
    avgFixationDuration: number;
    revisitCount: number;
    dwellTimeMs: number;
    dwellPercentage: number; // % of presentation time fixating inside AOI
  };
}

export interface RecognitionTrialConfig {
  trialId: number;
  stimulus: MemoryStimulus;
  status: StimulusStatus; // "OLD" (studied) or "NEW" (foil)
  studyIndex?: number; // original index during study if OLD
}

export interface RecognitionTrialRecord {
  trialId: number;
  itemId: string;
  stimulus: MemoryStimulus;
  actualStatus: StimulusStatus;
  selectedChoice: RecognitionChoice; // "SEEN_BEFORE" or "NEW"
  isCorrect: boolean;
  classification: "HIT" | "MISS" | "FALSE_ALARM" | "CORRECT_REJECTION";
  startTime: number;
  responseTimestamp: number;
  reactionTimeMs: number;
  aoi: ItemAOI;
  rawGazeSamples: RawGazeBufferSample[];
  rawMouseEvents: MouseEventRecord[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
  gazeMetrics: {
    timeToFirstFixation: number;
    fixationCount: number;
    totalFixationDuration: number;
    dwellTimeMs: number;
  };
  mouseMetrics: {
    clickX: number;
    clickY: number;
    moveCount: number;
  };
}

export interface MemorySessionMetrics {
  totalStudyItems: number;
  totalRecognitionTrials: number;
  overallAccuracyPct: number;
  correctCount: number;
  incorrectCount: number;

  // Signal Detection Theory
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  hitRate: number; // 0.0 to 1.0
  falseAlarmRate: number; // 0.0 to 1.0
  dPrime: number; // Sensitivity Index
  criterionC: number; // Response Bias (- is liberal, + is conservative)

  // Reaction Times
  meanReactionTimeMs: number;
  medianReactionTimeMs: number;
  meanHitReactionTimeMs: number;
  meanCorrectRejectionReactionTimeMs: number;

  // Old vs New Accuracy
  oldItemAccuracyPct: number;
  newItemAccuracyPct: number;

  // Study Gaze Dynamics
  meanStudyDwellTimeMs: number;
  meanStudyFixationDurationMs: number;
  meanStudyFixationCount: number;
  meanStudyRevisits: number;
  meanStudyTimeToFirstFixationMs: number;

  // Gaze vs Memory Attention Encoding Correlation
  studyGazeByRecognition: {
    hitsMeanDwellMs: number;
    missesMeanDwellMs: number;
    dwellDifferenceMs: number;
    hitsMeanFixationCount: number;
    missesMeanFixationCount: number;
  };
}

export interface MemoryRecognitionSessionSummary {
  sessionId: string;
  participantId?: string;
  task: "memory_recognition";
  taskVersion: string;
  calibrationProfileId?: string;
  viewportWidth: number;
  viewportHeight: number;
  cameraStatus: string;
  validationStatus: string;
  seed: number;
  metrics: MemorySessionMetrics;
  studyTrials: StudyTrialRecord[];
  retentionInterval: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
  recognitionTrials: RecognitionTrialRecord[];
}

/**
 * Deterministic pseudo-random number generator for reproducible trial generation.
 */
export function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Standard Normal Cumulative Distribution Inverse (Probit function).
 * Converts a probability p (0 < p < 1) into a Z-score using Abramowitz & Stegun approximation.
 */
export function normalInverseCDF(p: number): number {
  const clamped = Math.max(0.0001, Math.min(0.9999, p));
  if (clamped === 0.5) return 0;

  if (clamped < 0.5) {
    return -normalInverseCDF(1 - clamped);
  }

  // For clamped > 0.5:
  const t = Math.sqrt(-2.0 * Math.log(1.0 - clamped));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
  return z;
}

/**
 * Calculates Signal Detection Theory metrics (d' and criterion c) with log-linear (Hautus) correction.
 */
export function calculateSignalDetection(
  hits: number,
  totalOld: number,
  falseAlarms: number,
  totalNew: number
): {
  hitRate: number;
  falseAlarmRate: number;
  dPrime: number;
  criterionC: number;
} {
  // Hautus (1995) log-linear correction: add 0.5 to hits & false alarms, add 1 to total counts
  const adjustedHits = hits + 0.5;
  const adjustedTotalOld = totalOld + 1;
  const adjustedFA = falseAlarms + 0.5;
  const adjustedTotalNew = totalNew + 1;

  const adjHitRate = adjustedHits / adjustedTotalOld;
  const adjFARate = adjustedFA / adjustedTotalNew;

  const rawHitRate = totalOld > 0 ? Number((hits / totalOld).toFixed(3)) : 0;
  const rawFARate = totalNew > 0 ? Number((falseAlarms / totalNew).toFixed(3)) : 0;

  const zHit = normalInverseCDF(adjHitRate);
  const zFA = normalInverseCDF(adjFARate);

  const dPrime = Number((zHit - zFA).toFixed(3));
  const criterionC = Number((-0.5 * (zHit + zFA)).toFixed(3));

  return {
    hitRate: rawHitRate,
    falseAlarmRate: rawFARate,
    dPrime: isFinite(dPrime) ? dPrime : 0,
    criterionC: isFinite(criterionC) ? criterionC : 0,
  };
}

/**
 * Generates balanced Study (20) and Recognition (40) trial configurations with randomized spatial locations.
 */
export function generateMemoryTaskProtocols(
  seed: number = Math.floor(Math.random() * 1000000),
  containerDims: { width: number; height: number } = { width: 640, height: 440 }
): {
  seed: number;
  studyTrials: StudyItemConfig[];
  recognitionTrials: RecognitionTrialConfig[];
} {
  const rng = createSeededRandom(seed);

  // Shuffle stimuli bank
  const shuffledStimuli = [...MEMORY_STIMULI_BANK].sort(() => rng() - 0.5);

  // Split into 20 Old (Studied) and 20 New (Foils)
  const oldStimuli = shuffledStimuli.slice(0, 20);
  const newStimuli = shuffledStimuli.slice(20, 40);

  // Define screen location zones to prevent learning/position bias
  // (Center, North, South, East, West, NW, NE, SW, SE)
  const cx = containerDims.width / 2;
  const cy = containerDims.height / 2;
  const jitterRadius = 60;

  const studyTrials: StudyItemConfig[] = oldStimuli.map((stim, idx) => {
    // Generate slight position offsets around center
    const angle = (idx / 20) * 2 * Math.PI + (rng() * 0.4 - 0.2);
    const rad = (idx % 3 === 0 ? 0 : jitterRadius + rng() * 40);
    const px = Math.round(cx + Math.cos(angle) * rad);
    const py = Math.round(cy + Math.sin(angle) * rad);

    return {
      studyIndex: idx + 1,
      stimulus: stim,
      position: { x: px, y: py },
      durationMs: 2400, // 2.4s presentation time
    };
  });

  // Prepare 40 Recognition trials (20 Old + 20 New interleaved)
  const recognitionItems: RecognitionTrialConfig[] = [
    ...oldStimuli.map((stim) => ({
      trialId: 0,
      stimulus: stim,
      status: "OLD" as const,
      studyIndex: studyTrials.find((st) => st.stimulus.id === stim.id)?.studyIndex,
    })),
    ...newStimuli.map((stim) => ({
      trialId: 0,
      stimulus: stim,
      status: "NEW" as const,
    })),
  ];

  // Interleave and randomize with restriction: maximum 3 consecutive same status
  let randomizedRecognition: RecognitionTrialConfig[] = [];
  let attempts = 0;

  while (attempts < 50) {
    attempts++;
    const candidate = [...recognitionItems].sort(() => rng() - 0.5);
    let maxRun = 0;
    let currentRun = 1;
    for (let i = 1; i < candidate.length; i++) {
      if (candidate[i].status === candidate[i - 1].status) {
        currentRun++;
        maxRun = Math.max(maxRun, currentRun);
      } else {
        currentRun = 1;
      }
    }
    if (maxRun <= 3) {
      randomizedRecognition = candidate;
      break;
    }
  }

  if (randomizedRecognition.length === 0) {
    randomizedRecognition = [...recognitionItems].sort(() => rng() - 0.5);
  }

  // Assign sequential 1..40 trial IDs
  randomizedRecognition = randomizedRecognition.map((item, idx) => ({
    ...item,
    trialId: idx + 1,
  }));

  return {
    seed,
    studyTrials,
    recognitionTrials: randomizedRecognition,
  };
}

/**
 * Computes container-relative AOI for a displayed stimulus.
 */
export function computeStimulusAOI(
  itemId: string,
  centerX: number,
  centerY: number,
  itemSizePx: number = 140,
  containerDims: { width: number; height: number } = { width: 640, height: 440 }
): ItemAOI {
  const half = itemSizePx / 2;
  const x = Math.round(Math.max(0, centerX - half));
  const y = Math.round(Math.max(0, centerY - half));

  return {
    aoiId: `aoi_${itemId}`,
    itemId,
    x,
    y,
    width: itemSizePx,
    height: itemSizePx,
    screenWidth: containerDims.width,
    screenHeight: containerDims.height,
  };
}

/**
 * Analyzes gaze behavior on a single study trial.
 */
export function analyzeStudyTrialGaze(
  studyConfig: StudyItemConfig,
  aoi: ItemAOI,
  gazeSamples: RawGazeBufferSample[],
  fixations: FixationEvent[],
  saccades: SaccadeEvent[],
  startTime: number,
  endTime: number
): StudyTrialRecord {
  const durationMs = Math.round(endTime - startTime);

  // Filter fixations that overlap presentation
  const trialFixations = fixations.filter((f) => {
    const fStart = f.startTime ?? f.fixationStart;
    const fEnd = f.endTime ?? f.fixationEnd ?? (fStart + (f.duration || 0));
    return fEnd >= startTime && fStart <= (endTime + 100);
  });
  const trialSaccades = saccades.filter((s) => {
    const sStart = s.startTime ?? 0;
    const sEnd = s.endTime ?? (sStart + (s.duration || 0));
    return sEnd >= startTime && sStart <= (endTime + 100);
  });

  let timeToFirstFixation = 0;
  let totalFixationDuration = 0;
  let aoiFixationCount = 0;
  let dwellTimeMs = 0;

  trialFixations.forEach((fix) => {
    // Check if fixation falls inside AOI
    const insideAOI =
      fix.meanX >= aoi.x &&
      fix.meanX <= aoi.x + aoi.width &&
      fix.meanY >= aoi.y &&
      fix.meanY <= aoi.y + aoi.height;

    if (insideAOI) {
      aoiFixationCount++;
      totalFixationDuration += fix.duration;
      dwellTimeMs += fix.duration;
      fix.aoiId = aoi.aoiId;

      if (timeToFirstFixation === 0) {
        const fStart = fix.startTime ?? fix.fixationStart;
        timeToFirstFixation = Math.max(0, Math.round(fStart - startTime));
      }
    }
  });

  // Calculate raw dwell time from raw gaze samples if fixations are sparse
  const validGazeInAOI = gazeSamples.filter(
    (s) =>
      s.timestamp >= startTime &&
      s.timestamp <= endTime &&
      !s.blink &&
      s.confidence >= 0.4 &&
      s.gazeX >= aoi.x &&
      s.gazeX <= aoi.x + aoi.width &&
      s.gazeY >= aoi.y &&
      s.gazeY <= aoi.y + aoi.height
  );

  if (dwellTimeMs === 0 && validGazeInAOI.length > 0) {
    dwellTimeMs = Math.round(validGazeInAOI.length * 33.3);
  }

  const dwellPercentage = durationMs > 0
    ? Number(Math.min(100, (dwellTimeMs / durationMs) * 100).toFixed(1))
    : 0;

  const avgFixationDuration = aoiFixationCount > 0
    ? Math.round(totalFixationDuration / aoiFixationCount)
    : 0;

  const revisitCount = Math.max(0, aoiFixationCount - 1);

  return {
    studyIndex: studyConfig.studyIndex,
    itemId: studyConfig.stimulus.id,
    stimulus: studyConfig.stimulus,
    startTime,
    endTime,
    durationMs,
    aoi,
    rawGazeSamples: gazeSamples,
    fixations: trialFixations,
    saccades: trialSaccades,
    gazeMetrics: {
      timeToFirstFixation,
      fixationCount: aoiFixationCount,
      totalFixationDuration,
      avgFixationDuration,
      revisitCount,
      dwellTimeMs,
      dwellPercentage,
    },
  };
}

/**
 * Analyzes mouse response & gaze on a recognition trial.
 */
export function analyzeRecognitionTrial(
  config: RecognitionTrialConfig,
  aoi: ItemAOI,
  selectedChoice: RecognitionChoice,
  gazeSamples: RawGazeBufferSample[],
  mouseEvents: MouseEventRecord[],
  fixations: FixationEvent[],
  saccades: SaccadeEvent[],
  startTime: number,
  responseTimestamp: number
): RecognitionTrialRecord {
  const reactionTimeMs = Math.max(0, Math.round(responseTimestamp - startTime));
  const isOld = config.status === "OLD";
  const isSeen = selectedChoice === "SEEN_BEFORE";

  let isCorrect = false;
  let classification: "HIT" | "MISS" | "FALSE_ALARM" | "CORRECT_REJECTION";

  if (isOld && isSeen) {
    isCorrect = true;
    classification = "HIT";
  } else if (isOld && !isSeen) {
    isCorrect = false;
    classification = "MISS";
  } else if (!isOld && isSeen) {
    isCorrect = false;
    classification = "FALSE_ALARM";
  } else {
    isCorrect = true;
    classification = "CORRECT_REJECTION";
  }

  const trialFixations = fixations.filter((f) => {
    const fStart = f.startTime ?? f.fixationStart;
    const fEnd = f.endTime ?? f.fixationEnd ?? (fStart + (f.duration || 0));
    return fEnd >= startTime && fStart <= (responseTimestamp + 100);
  });
  const trialSaccades = saccades.filter((s) => {
    const sStart = s.startTime ?? 0;
    const sEnd = s.endTime ?? (sStart + (s.duration || 0));
    return sEnd >= startTime && sStart <= (responseTimestamp + 100);
  });

  let timeToFirstFixation = 0;
  let fixationCount = 0;
  let totalFixationDuration = 0;

  trialFixations.forEach((fix) => {
    const inside =
      fix.meanX >= aoi.x &&
      fix.meanX <= aoi.x + aoi.width &&
      fix.meanY >= aoi.y &&
      fix.meanY <= aoi.y + aoi.height;
    if (inside) {
      fixationCount++;
      totalFixationDuration += fix.duration;
      if (timeToFirstFixation === 0) {
        const fStart = fix.startTime ?? fix.fixationStart;
        timeToFirstFixation = Math.max(0, Math.round(fStart - startTime));
      }
    }
  });

  const clickEvent = mouseEvents.find((m) => m.type === "click") || {
    x: 0,
    y: 0,
    timestamp: responseTimestamp,
  };
  const moveCount = mouseEvents.filter((m) => m.type === "move").length;

  return {
    trialId: config.trialId,
    itemId: config.stimulus.id,
    stimulus: config.stimulus,
    actualStatus: config.status,
    selectedChoice,
    isCorrect,
    classification,
    startTime,
    responseTimestamp,
    reactionTimeMs,
    aoi,
    rawGazeSamples: gazeSamples,
    rawMouseEvents: mouseEvents,
    fixations: trialFixations,
    saccades: trialSaccades,
    gazeMetrics: {
      timeToFirstFixation,
      fixationCount,
      totalFixationDuration,
      dwellTimeMs: totalFixationDuration,
    },
    mouseMetrics: {
      clickX: clickEvent.x,
      clickY: clickEvent.y,
      moveCount,
    },
  };
}

function computeMedianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Aggregates complete Memory & Recognition session and calculates all cognitive and gaze metrics.
 */
export function aggregateMemoryRecognitionSession(
  sessionId: string,
  studyTrials: StudyTrialRecord[],
  retentionInterval: { startTime: number; endTime: number; durationMs: number },
  recognitionTrials: RecognitionTrialRecord[],
  seed: number,
  participantId?: string,
  metadata?: {
    calibrationProfileId?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    cameraStatus?: string;
    validationStatus?: string;
    taskVersion?: string;
  }
): MemoryRecognitionSessionSummary {
  const totalRecognition = recognitionTrials.length || 1;
  const correctTrials = recognitionTrials.filter((t) => t.isCorrect);
  const correctCount = correctTrials.length;
  const incorrectCount = totalRecognition - correctCount;
  const overallAccuracyPct = Number(((correctCount / totalRecognition) * 100).toFixed(1));

  // Signal Detection Counts
  const hits = recognitionTrials.filter((t) => t.classification === "HIT").length;
  const misses = recognitionTrials.filter((t) => t.classification === "MISS").length;
  const falseAlarms = recognitionTrials.filter((t) => t.classification === "FALSE_ALARM").length;
  const correctRejections = recognitionTrials.filter(
    (t) => t.classification === "CORRECT_REJECTION"
  ).length;

  const totalOld = hits + misses || 20;
  const totalNew = falseAlarms + correctRejections || 20;

  const sdt = calculateSignalDetection(hits, totalOld, falseAlarms, totalNew);

  // Reaction Times
  const rts = recognitionTrials.map((t) => t.reactionTimeMs);
  const meanReactionTimeMs = Math.round(rts.reduce((sum, r) => sum + r, 0) / totalRecognition);
  const medianReactionTimeMs = computeMedianValue(rts);

  const hitRTs = recognitionTrials.filter((t) => t.classification === "HIT").map((t) => t.reactionTimeMs);
  const crRTs = recognitionTrials.filter((t) => t.classification === "CORRECT_REJECTION").map((t) => t.reactionTimeMs);

  const meanHitReactionTimeMs = hitRTs.length > 0
    ? Math.round(hitRTs.reduce((sum, r) => sum + r, 0) / hitRTs.length)
    : meanReactionTimeMs;
  const meanCorrectRejectionReactionTimeMs = crRTs.length > 0
    ? Math.round(crRTs.reduce((sum, r) => sum + r, 0) / crRTs.length)
    : meanReactionTimeMs;

  // Old vs New Accuracy
  const oldItemAccuracyPct = totalOld > 0 ? Number(((hits / totalOld) * 100).toFixed(1)) : 0;
  const newItemAccuracyPct = totalNew > 0 ? Number(((correctRejections / totalNew) * 100).toFixed(1)) : 0;

  // Study Gaze Dynamics
  const totalStudy = studyTrials.length || 1;
  const meanStudyDwellTimeMs = Math.round(
    studyTrials.reduce((sum, t) => sum + t.gazeMetrics.dwellTimeMs, 0) / totalStudy
  );
  const meanStudyFixationDurationMs = Math.round(
    studyTrials.reduce((sum, t) => sum + t.gazeMetrics.totalFixationDuration, 0) / totalStudy
  );
  const meanStudyFixationCount = Number(
    (studyTrials.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0) / totalStudy).toFixed(1)
  );
  const meanStudyRevisits = Number(
    (studyTrials.reduce((sum, t) => sum + t.gazeMetrics.revisitCount, 0) / totalStudy).toFixed(1)
  );
  const meanStudyTimeToFirstFixationMs = Math.round(
    studyTrials.reduce((sum, t) => sum + t.gazeMetrics.timeToFirstFixation, 0) / totalStudy
  );

  // Attention vs Memory Recognition Encoding Analysis
  // Link each studied item with its recognition outcome
  const studiedItemHits: StudyTrialRecord[] = [];
  const studiedItemMisses: StudyTrialRecord[] = [];

  studyTrials.forEach((st) => {
    const rec = recognitionTrials.find((rt) => rt.itemId === st.itemId);
    if (rec?.classification === "HIT") {
      studiedItemHits.push(st);
    } else if (rec?.classification === "MISS") {
      studiedItemMisses.push(st);
    }
  });

  const hitsMeanDwellMs = studiedItemHits.length > 0
    ? Math.round(studiedItemHits.reduce((sum, t) => sum + t.gazeMetrics.dwellTimeMs, 0) / studiedItemHits.length)
    : 0;
  const missesMeanDwellMs = studiedItemMisses.length > 0
    ? Math.round(studiedItemMisses.reduce((sum, t) => sum + t.gazeMetrics.dwellTimeMs, 0) / studiedItemMisses.length)
    : 0;

  const hitsMeanFixationCount = studiedItemHits.length > 0
    ? Number((studiedItemHits.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0) / studiedItemHits.length).toFixed(1))
    : 0;
  const missesMeanFixationCount = studiedItemMisses.length > 0
    ? Number((studiedItemMisses.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0) / studiedItemMisses.length).toFixed(1))
    : 0;

  const dwellDifferenceMs = hitsMeanDwellMs - missesMeanDwellMs;

  const metrics: MemorySessionMetrics = {
    totalStudyItems: studyTrials.length,
    totalRecognitionTrials: recognitionTrials.length,
    overallAccuracyPct,
    correctCount,
    incorrectCount,
    hits,
    misses,
    falseAlarms,
    correctRejections,
    hitRate: sdt.hitRate,
    falseAlarmRate: sdt.falseAlarmRate,
    dPrime: sdt.dPrime,
    criterionC: sdt.criterionC,
    meanReactionTimeMs,
    medianReactionTimeMs,
    meanHitReactionTimeMs,
    meanCorrectRejectionReactionTimeMs,
    oldItemAccuracyPct,
    newItemAccuracyPct,
    meanStudyDwellTimeMs,
    meanStudyFixationDurationMs,
    meanStudyFixationCount,
    meanStudyRevisits,
    meanStudyTimeToFirstFixationMs,
    studyGazeByRecognition: {
      hitsMeanDwellMs,
      missesMeanDwellMs,
      dwellDifferenceMs,
      hitsMeanFixationCount,
      missesMeanFixationCount,
    },
  };

  return {
    sessionId,
    participantId,
    task: "memory_recognition",
    taskVersion: metadata?.taskVersion ?? "1.0.0",
    calibrationProfileId: metadata?.calibrationProfileId ?? "default_v1",
    viewportWidth: metadata?.viewportWidth ?? 640,
    viewportHeight: metadata?.viewportHeight ?? 440,
    cameraStatus: metadata?.cameraStatus ?? "CONNECTED",
    validationStatus: metadata?.validationStatus ?? "VALIDATED",
    seed,
    metrics,
    studyTrials,
    retentionInterval,
    recognitionTrials,
  };
}
