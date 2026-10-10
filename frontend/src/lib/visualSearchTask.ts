/**
 * VISIONEXIS Visual Search Cognitive Task Engine (Phase 4).
 * Implements:
 * - 20-trial multi-difficulty generator (EASY 4x4, MEDIUM 5x5, HARD 6x6)
 * - Independent Area of Interest (AOI) bounding geometry
 * - Real-time gaze AOI mapping & fixation sequence extraction
 * - Comprehensive cognitive & eye-movement metrics:
 *   Reaction Time, Search Time, Target Detection Time, Mouse Selection Time,
 *   Target vs. Distractor Fixation Duration, Revisits, Saccades, Search Efficiency Score
 * - Difficulty breakdown (Easy, Medium, Hard)
 * - Complete structured trial and session schema
 *
 * NOTE: Experimental eye-movement metrics for cognitive research; not clinical diagnosis.
 */

import type { RawGazeBufferSample, FixationEvent, SaccadeEvent } from "./webcam/gazeEvents";

export type SearchDifficulty = "EASY" | "MEDIUM" | "HARD";

// Curated symbol pairs designed for distinct feature search difficulty levels
export const SYMBOL_PAIRS_BY_DIFFICULTY: Record<SearchDifficulty, [string, string][]> = {
  EASY: [
    ["△", "○"],
    ["★", "●"],
    ["■", "○"],
    ["▲", "□"],
    ["+", "o"],
    ["◆", "◇"],
  ],
  MEDIUM: [
    ["E", "F"],
    ["O", "C"],
    ["⬡", "□"],
    ["▲", "△"],
    ["X", "K"],
    ["T", "L"],
  ],
  HARD: [
    ["P", "R"],
    ["O", "Q"],
    ["C", "G"],
    ["M", "N"],
    ["V", "Y"],
    ["B", "D"],
  ],
};

export interface VisualSearchTrialConfig {
  trialId: number;
  difficulty: SearchDifficulty;
  gridSize: number; // 4 for Easy, 5 for Medium, 6 for Hard
  targetSymbol: string;
  distractorSymbol: string;
  targetIndex: number;
  cells: string[];
}

export interface CellAOI {
  aoiId: string;
  row: number;
  column: number;
  x: number; // in container px
  y: number;
  width: number;
  height: number;
  isTarget: boolean;
  symbol: string;
  index: number;
}

export interface MouseEventRecord {
  type: "move" | "click";
  x: number;
  y: number;
  timestamp: number; // monotonic performance.now()
}

export interface TrialGazeMetrics {
  firstFixationTime: number; // ms from target appear to first grid fixation
  targetDetectionTime: number; // ms from target appear to first target AOI fixation
  searchTime: number; // ms to locate target
  mouseSelectionTime: number; // ms from first target fixation to mouse click
  targetFixationDuration: number; // total ms fixating on target AOI
  distractorFixationDuration: number; // total ms fixating on distractors
  totalFixationDuration: number;
  targetAttentionPct: number; // % of fixation time on target
  distractorAttentionPct: number; // % of fixation time on distractors
  fixationCount: number;
  saccadeCount: number;
  revisitCount: number;
  distractorFixationsCount: number;
  searchEfficiencyScore: number; // 0 to 100
}

export interface TrialResultRecord {
  trialId: number;
  difficulty: SearchDifficulty;
  gridSize: number;
  targetSymbol: string;
  distractorSymbol: string;
  targetIndex: number;
  selectedCellIndex: number;
  accuracy: boolean; // true if target selected
  reactionTime: number; // ms from appear to selection click

  trialStart: number;
  targetAppear: number;
  targetSelected: number;
  trialEnd: number;

  gazeMetrics: TrialGazeMetrics;
  mouseMetrics: {
    selectionTime: number;
    clickX: number;
    clickY: number;
    mouseMoveCount: number;
  };

  aois: CellAOI[];
  gazeSamples: RawGazeBufferSample[];
  mouseEvents: MouseEventRecord[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
}

export interface DifficultySummary {
  difficulty: SearchDifficulty;
  trialCount: number;
  accuracyPct: number;
  avgReactionTimeMs: number;
  avgSearchTimeMs: number;
  avgFixationDurationMs: number;
  avgFixationsCount: number;
  avgSaccadesCount: number;
  avgRevisitsCount: number;
  avgTargetAttentionPct: number;
  avgDistractorAttentionPct: number;
  avgSearchEfficiency: number;
}

export interface VisualSearchSessionSummary {
  sessionId: string;
  participantId?: string;
  task: "visual_search";
  taskVersion: string;
  calibrationProfileId?: string;
  viewportWidth: number;
  viewportHeight: number;
  cameraStatus: string;
  validationStatus: string;
  totalTrials: number;
  accuracyPct: number;
  avgReactionTimeMs: number;
  medianReactionTimeMs: number;
  avgSearchTimeMs: number;
  medianSearchTimeMs: number;
  avgFixationDurationMs: number;
  meanTargetFixationDurationMs: number;
  meanDistractorFixationDurationMs: number;
  avgFixationsCount: number;
  avgSaccadesCount: number;
  avgRevisitsCount: number;
  totalFixations: number;
  totalSaccades: number;
  totalRevisits: number;
  avgTargetAttentionPct: number;
  avgDistractorAttentionPct: number;
  avgSearchEfficiency: number;
  mouseGazeLatencyMs: number; // avg time from first target fixation to mouse click
  difficultyBreakdown: Record<SearchDifficulty, DifficultySummary>;
  trials: TrialResultRecord[];
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
 * Generates 20 balanced trials across Easy, Medium, and Hard difficulty levels.
 */
export function generate20Trials(): VisualSearchTrialConfig[] {
  // Distribution: 7 Easy (4x4), 7 Medium (5x5), 6 Hard (6x6) = 20 trials
  const plan: { difficulty: SearchDifficulty; gridSize: number }[] = [
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },

    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },

    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
  ];

  // Shuffle order to interleave difficulty while maintaining controlled balance
  const shuffledPlan = [...plan].sort(() => Math.random() - 0.5);

  return shuffledPlan.map((p, idx) => {
    const pairs = SYMBOL_PAIRS_BY_DIFFICULTY[p.difficulty];
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    // Randomly assign which symbol is target and which is distractor
    const isSwapped = Math.random() > 0.5;
    const targetSymbol = isSwapped ? pair[1] : pair[0];
    const distractorSymbol = isSwapped ? pair[0] : pair[1];

    const totalCells = p.gridSize * p.gridSize;
    const targetIndex = Math.floor(Math.random() * totalCells);
    const cells = Array.from({ length: totalCells }, (_, i) =>
      i === targetIndex ? targetSymbol : distractorSymbol
    );

    return {
      trialId: idx + 1,
      difficulty: p.difficulty,
      gridSize: p.gridSize,
      targetSymbol,
      distractorSymbol,
      targetIndex,
      cells,
    };
  });
}

/**
 * Computes exact pixel bounding boxes for each cell Area of Interest (AOI).
 */
export function computeGridAOIs(
  gridSize: number,
  cells: string[],
  targetIndex: number,
  containerRect: { width: number; height: number },
  gridWidthPx: number = 380,
  gridHeightPx: number = 380
): CellAOI[] {
  const offsetX = (containerRect.width - gridWidthPx) / 2;
  const offsetY = (containerRect.height - gridHeightPx) / 2;
  const gap = 8;
  const cellWidth = (gridWidthPx - (gridSize - 1) * gap) / gridSize;
  const cellHeight = (gridHeightPx - (gridSize - 1) * gap) / gridSize;

  const aois: CellAOI[] = [];

  for (let i = 0; i < cells.length; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const x = Math.round(offsetX + col * (cellWidth + gap));
    const y = Math.round(offsetY + row * (cellHeight + gap));

    aois.push({
      aoiId: `cell_r${row}_c${col}`,
      row,
      column: col,
      x,
      y,
      width: Math.round(cellWidth),
      height: Math.round(cellHeight),
      isTarget: i === targetIndex,
      symbol: cells[i],
      index: i,
    });
  }

  return aois;
}

/**
 * Finds which AOI a given gaze coordinate falls into (with optional tolerance padding).
 */
export function getAOIForCoordinate(x: number, y: number, aois: CellAOI[], padding: number = 8): CellAOI | null {
  for (const aoi of aois) {
    if (
      x >= aoi.x - padding &&
      x <= aoi.x + aoi.width + padding &&
      y >= aoi.y - padding &&
      y <= aoi.y + aoi.height + padding
    ) {
      return aoi;
    }
  }
  return null;
}

/**
 * Analyzes a completed trial's gaze samples, mouse events, and AOI encounters.
 */
export function analyzeTrialPerformance(
  trial: VisualSearchTrialConfig,
  aois: CellAOI[],
  gazeSamples: RawGazeBufferSample[],
  mouseEvents: MouseEventRecord[],
  fixations: FixationEvent[],
  saccades: SaccadeEvent[],
  trialStart: number,
  targetAppear: number,
  targetSelected: number,
  trialEnd: number,
  selectedCellIndex: number
): TrialResultRecord {
  const reactionTime = Math.max(10, Math.round(targetSelected - targetAppear));
  const accuracy = selectedCellIndex === trial.targetIndex;

  // Filter valid gaze samples during target presentation
  const validGaze = gazeSamples.filter(
    (s) => s.timestamp >= targetAppear && s.timestamp <= targetSelected && !s.blink && s.confidence >= 0.35
  );

  // Map each sample to an AOI
  let firstFixationTime = reactionTime;
  let targetDetectionTime = reactionTime;
  let targetFixationDuration = 0;
  let distractorFixationDuration = 0;

  // Track AOI sequence to count revisits
  const aoiVisits: string[] = [];
  let lastAOIId: string | null = null;
  let hasHitTarget = false;
  let firstTargetTime: number | null = null;

  // Analyze discrete fixations that overlap target presentation
  const trialFixations = fixations.filter((f) => {
    const fStart = f.startTime ?? f.fixationStart;
    const fEnd = f.endTime ?? f.fixationEnd ?? (fStart + (f.duration || 0));
    return fEnd >= targetAppear && fStart <= (targetSelected + 100);
  });

  trialFixations.forEach((fix, idx) => {
    if (idx === 0) {
      firstFixationTime = Math.max(0, Math.round(fix.fixationStart - targetAppear));
    }

    const aoi = getAOIForCoordinate(fix.meanX, fix.meanY, aois, 12);
    if (aoi) {
      if (aoi.aoiId !== lastAOIId) {
        aoiVisits.push(aoi.aoiId);
        lastAOIId = aoi.aoiId;
      }

      if (aoi.isTarget) {
        targetFixationDuration += fix.duration;
        if (!hasHitTarget) {
          hasHitTarget = true;
          firstTargetTime = fix.fixationStart;
          targetDetectionTime = Math.max(0, Math.round(fix.fixationStart - targetAppear));
        }
      } else {
        distractorFixationDuration += fix.duration;
      }
    }
  });

  // If discrete fixation count was low, approximate duration from sample hits
  if (targetFixationDuration === 0 && distractorFixationDuration === 0 && validGaze.length > 0) {
    const dt = 1000 / 20; // ~50ms per frame
    validGaze.forEach((s, idx) => {
      const aoi = getAOIForCoordinate(s.gazeX, s.gazeY, aois, 10);
      if (aoi) {
        if (aoi.isTarget) {
          targetFixationDuration += dt;
          if (!hasHitTarget) {
            hasHitTarget = true;
            firstTargetTime = s.timestamp;
            targetDetectionTime = Math.max(0, Math.round(s.timestamp - targetAppear));
          }
        } else {
          distractorFixationDuration += dt;
        }

        if (aoi.aoiId !== lastAOIId) {
          aoiVisits.push(aoi.aoiId);
          lastAOIId = aoi.aoiId;
        }
      }
      if (idx === 0) firstFixationTime = Math.max(0, Math.round(s.timestamp - targetAppear));
    });
  }

  // Calculate revisits (number of times an AOI is seen after other AOIs)
  const seenAOIs = new Set<string>();
  let revisitCount = 0;
  aoiVisits.forEach((id) => {
    if (seenAOIs.has(id)) {
      revisitCount++;
    } else {
      seenAOIs.add(id);
    }
  });

  const totalFixationDuration = Math.round(targetFixationDuration + distractorFixationDuration);
  const targetAttentionPct =
    totalFixationDuration > 0
      ? Number(((targetFixationDuration / totalFixationDuration) * 100).toFixed(1))
      : 0;
  const distractorAttentionPct =
    totalFixationDuration > 0
      ? Number(((distractorFixationDuration / totalFixationDuration) * 100).toFixed(1))
      : 0;

  const searchTime = targetDetectionTime > 0 ? targetDetectionTime : reactionTime;
  const mouseSelectionTime = firstTargetTime
    ? Math.max(0, Math.round(targetSelected - firstTargetTime))
    : Math.round(reactionTime * 0.3);

  const trialSaccades = saccades.filter((s) => {
    const sStart = s.startTime ?? 0;
    const sEnd = s.endTime ?? (sStart + (s.duration || 0));
    return sEnd >= targetAppear && sStart <= (targetSelected + 100);
  });

  // Search Efficiency Score (0 to 100)
  // Transparent formula: Accuracy (50pts) + Fast Search (up to 30pts) + Low Revisits (up to 20pts)
  const accuracyScore = accuracy ? 50 : 0;
  const searchSpeedScore = Math.max(0, Math.min(30, Math.round(30 - searchTime / 120)));
  const revisitPenalty = Math.max(0, Math.min(20, Math.round(20 - revisitCount * 4)));
  const searchEfficiencyScore = Math.max(5, Math.min(100, accuracyScore + searchSpeedScore + revisitPenalty));

  const clickEvent = mouseEvents.find((m) => m.type === "click") ?? {
    type: "click",
    x: 0,
    y: 0,
    timestamp: targetSelected,
  };
  const mouseMoves = mouseEvents.filter((m) => m.type === "move").length;

  const gazeMetrics: TrialGazeMetrics = {
    firstFixationTime: Math.round(firstFixationTime),
    targetDetectionTime: Math.round(targetDetectionTime),
    searchTime: Math.round(searchTime),
    mouseSelectionTime: Math.round(mouseSelectionTime),
    targetFixationDuration: Math.round(targetFixationDuration),
    distractorFixationDuration: Math.round(distractorFixationDuration),
    totalFixationDuration,
    targetAttentionPct,
    distractorAttentionPct,
    fixationCount: trialFixations.length,
    saccadeCount: trialSaccades.length,
    revisitCount,
    distractorFixationsCount: Math.max(0, trialFixations.length - (hasHitTarget ? 1 : 0)),
    searchEfficiencyScore,
  };

  return {
    trialId: trial.trialId,
    difficulty: trial.difficulty,
    gridSize: trial.gridSize,
    targetSymbol: trial.targetSymbol,
    distractorSymbol: trial.distractorSymbol,
    targetIndex: trial.targetIndex,
    selectedCellIndex,
    accuracy,
    reactionTime,
    trialStart,
    targetAppear,
    targetSelected,
    trialEnd,
    gazeMetrics,
    mouseMetrics: {
      selectionTime: mouseSelectionTime,
      clickX: clickEvent.x,
      clickY: clickEvent.y,
      mouseMoveCount: mouseMoves,
    },
    aois,
    gazeSamples,
    mouseEvents,
    fixations: trialFixations,
    saccades: trialSaccades,
  };
}

/**
 * Aggregates all 20 trial records into overall and difficulty-stratified session summaries.
 */
export function aggregateVisualSearchSession(
  sessionId: string,
  trials: TrialResultRecord[],
  participantId?: string,
  metadata?: {
    calibrationProfileId?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    cameraStatus?: string;
    validationStatus?: string;
    taskVersion?: string;
  }
): VisualSearchSessionSummary {
  const totalTrials = trials.length || 1;
  const correctTrials = trials.filter((t) => t.accuracy).length;
  const accuracyPct = Number(((correctTrials / totalTrials) * 100).toFixed(1));

  const reactionTimes = trials.map((t) => t.reactionTime);
  const searchTimes = trials.map((t) => t.gazeMetrics.searchTime);

  const avgReactionTimeMs = Math.round(trials.reduce((sum, t) => sum + t.reactionTime, 0) / totalTrials);
  const medianReactionTimeMs = computeMedianValue(reactionTimes);

  const avgSearchTimeMs = Math.round(trials.reduce((sum, t) => sum + t.gazeMetrics.searchTime, 0) / totalTrials);
  const medianSearchTimeMs = computeMedianValue(searchTimes);

  const avgFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.totalFixationDuration, 0) / totalTrials
  );
  const meanTargetFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.targetFixationDuration, 0) / totalTrials
  );
  const meanDistractorFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.distractorFixationDuration, 0) / totalTrials
  );

  const totalFixations = trials.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0);
  const totalSaccades = trials.reduce((sum, t) => sum + t.gazeMetrics.saccadeCount, 0);
  const totalRevisits = trials.reduce((sum, t) => sum + t.gazeMetrics.revisitCount, 0);

  const avgFixationsCount = Number((totalFixations / totalTrials).toFixed(1));
  const avgSaccadesCount = Number((totalSaccades / totalTrials).toFixed(1));
  const avgRevisitsCount = Number((totalRevisits / totalTrials).toFixed(1));

  const avgTargetAttentionPct = Number(
    (trials.reduce((sum, t) => sum + t.gazeMetrics.targetAttentionPct, 0) / totalTrials).toFixed(1)
  );
  const avgDistractorAttentionPct = Number(
    (trials.reduce((sum, t) => sum + t.gazeMetrics.distractorAttentionPct, 0) / totalTrials).toFixed(1)
  );
  const avgSearchEfficiency = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.searchEfficiencyScore, 0) / totalTrials
  );
  const mouseGazeLatencyMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.mouseSelectionTime, 0) / totalTrials
  );

  const calcDiff = (diff: SearchDifficulty): DifficultySummary => {
    const subset = trials.filter((t) => t.difficulty === diff);
    const subN = subset.length || 1;
    const subCorrect = subset.filter((t) => t.accuracy).length;
    return {
      difficulty: diff,
      trialCount: subset.length,
      accuracyPct: Number(((subCorrect / subN) * 100).toFixed(1)),
      avgReactionTimeMs: Math.round(subset.reduce((sum, t) => sum + t.reactionTime, 0) / subN),
      avgSearchTimeMs: Math.round(subset.reduce((sum, t) => sum + t.gazeMetrics.searchTime, 0) / subN),
      avgFixationDurationMs: Math.round(
        subset.reduce((sum, t) => sum + t.gazeMetrics.totalFixationDuration, 0) / subN
      ),
      avgFixationsCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0) / subN).toFixed(1)),
      avgSaccadesCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.saccadeCount, 0) / subN).toFixed(1)),
      avgRevisitsCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.revisitCount, 0) / subN).toFixed(1)),
      avgTargetAttentionPct: Number(
        (subset.reduce((sum, t) => sum + t.gazeMetrics.targetAttentionPct, 0) / subN).toFixed(1)
      ),
      avgDistractorAttentionPct: Number(
        (subset.reduce((sum, t) => sum + t.gazeMetrics.distractorAttentionPct, 0) / subN).toFixed(1)
      ),
      avgSearchEfficiency: Math.round(
        subset.reduce((sum, t) => sum + t.gazeMetrics.searchEfficiencyScore, 0) / subN
      ),
    };
  };

  const difficultyBreakdown: Record<SearchDifficulty, DifficultySummary> = {
    EASY: calcDiff("EASY"),
    MEDIUM: calcDiff("MEDIUM"),
    HARD: calcDiff("HARD"),
  };

  return {
    sessionId,
    participantId,
    task: "visual_search",
    taskVersion: metadata?.taskVersion ?? "1.0.0",
    calibrationProfileId: metadata?.calibrationProfileId ?? "default_v1",
    viewportWidth: metadata?.viewportWidth ?? 560,
    viewportHeight: metadata?.viewportHeight ?? 440,
    cameraStatus: metadata?.cameraStatus ?? "CONNECTED",
    validationStatus: metadata?.validationStatus ?? "VALIDATED",
    totalTrials: trials.length,
    accuracyPct,
    avgReactionTimeMs,
    medianReactionTimeMs,
    avgSearchTimeMs,
    medianSearchTimeMs,
    avgFixationDurationMs,
    meanTargetFixationDurationMs,
    meanDistractorFixationDurationMs,
    avgFixationsCount,
    avgSaccadesCount,
    avgRevisitsCount,
    totalFixations,
    totalSaccades,
    totalRevisits,
    avgTargetAttentionPct,
    avgDistractorAttentionPct,
    avgSearchEfficiency,
    mouseGazeLatencyMs,
    difficultyBreakdown,
    trials,
  };
}
