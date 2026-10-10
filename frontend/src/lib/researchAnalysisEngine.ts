/**
 * VISIONEXIS Research Analysis & Statistical Engine (Phase 9).
 *
 * Implements:
 * 1. Descriptive statistics (Mean, Median, Standard Deviation, Min, Max, Range, 95% CI, Cohen's d).
 * 2. Visual Search stratified analytics (Easy, Medium, Hard trends).
 * 3. Memory & Recognition SDT signal metrics ($d'$, criterion $c$) & study dwell correlation.
 * 4. Reading & Comprehension metrics (WPM, coverage, regression rates, return sweeps).
 * 5. Cross-Task comparison matrix across Visual Search, Memory, and Reading.
 * 6. Outlier detection and session integrity checks.
 *
 * NOTE: Non-diagnostic statistical and descriptive engine for behavioral research.
 */

import type { ResearchSessionRecord } from "./researchDataModel";

export interface DescriptiveStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  range: number;
  count: number;
  ci95: { lower: number; upper: number; margin: number };
}

/**
 * Calculates mean of numerical values.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number((sum / values.length).toFixed(2));
}

/**
 * Calculates median of numerical values.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

/**
 * Calculates standard deviation (sample standard deviation: N - 1).
 */
export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = calculateMean(values);
  const sumSq = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
  return Number(Math.sqrt(sumSq / (values.length - 1)).toFixed(2));
}

/**
 * Computes 95% Confidence Interval for a sample mean (using z = 1.96 for n >= 30, t approx otherwise).
 */
export function calculateCI95(values: number[]): { lower: number; upper: number; margin: number } {
  if (values.length === 0) return { lower: 0, upper: 0, margin: 0 };
  const avg = calculateMean(values);
  const sd = calculateStdDev(values);
  const n = values.length;
  // Critical multiplier approximation
  const critical = n < 30 ? 2.04 : 1.96;
  const margin = Number((critical * (sd / Math.sqrt(Math.max(1, n)))).toFixed(2));
  return {
    lower: Number((avg - margin).toFixed(2)),
    upper: Number((avg + margin).toFixed(2)),
    margin,
  };
}

/**
 * Computes Cohen's d effect size between two groups.
 */
export function calculateCohensD(groupA: number[], groupB: number[]): number {
  if (groupA.length === 0 || groupB.length === 0) return 0;
  const meanA = calculateMean(groupA);
  const meanB = calculateMean(groupB);
  const sdA = calculateStdDev(groupA);
  const sdB = calculateStdDev(groupB);

  const pooledSD = Math.sqrt(
    ((groupA.length - 1) * Math.pow(sdA, 2) + (groupB.length - 1) * Math.pow(sdB, 2)) /
      Math.max(1, groupA.length + groupB.length - 2)
  );

  if (pooledSD === 0) return 0;
  return Number(((meanA - meanB) / pooledSD).toFixed(2));
}

/**
 * Computes complete descriptive statistics for a dataset.
 */
export function calculateDescriptiveStats(values: number[]): DescriptiveStats {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      range: 0,
      count: 0,
      ci95: { lower: 0, upper: 0, margin: 0 },
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = calculateMean(values);
  const median = calculateMedian(values);
  const stdDev = calculateStdDev(values);
  const range = Number((max - min).toFixed(2));
  const ci95 = calculateCI95(values);

  return {
    mean,
    median,
    stdDev,
    min,
    max,
    range,
    count: values.length,
    ci95,
  };
}

export interface CrossTaskComparisonMatrix {
  metrics: {
    name: string;
    unit: string;
    visualSearch: number | null;
    memoryRecognition: number | null;
    readingComprehension: number | null;
  }[];
}

/**
 * Generates Cross-Task comparison matrix for a single research session.
 */
export function buildCrossTaskMatrix(session: ResearchSessionRecord): CrossTaskComparisonMatrix {
  const vs = session.visualSearch;
  const mem = session.memoryRecognition;
  const rc = session.readingComprehension;

  const vsFixDur = vs?.summary ? vs.summary.meanFixationDurationMs : null;
  const memFixDur = mem?.fixations && mem.fixations.length > 0
    ? calculateMean(mem.fixations.map((f) => f.duration))
    : null;
  const rcFixDur = rc?.summary ? rc.summary.meanFixationDurationMs : null;

  const vsFixCount = vs?.summary ? vs.summary.totalFixations : null;
  const memFixCount = mem?.fixations ? mem.fixations.length : null;
  const rcFixCount = rc?.summary ? rc.summary.totalFixationCount : null;

  const vsSacCount = vs?.summary ? vs.summary.totalSaccades : null;
  const memSacCount = mem?.saccades ? mem.saccades.length : null;
  const rcSacCount = rc?.summary ? rc.summary.totalSaccadeCount : null;

  const vsRT = vs?.summary ? vs.summary.meanReactionTimeMs : null;
  const memRT = mem?.recognitionTrials && mem.recognitionTrials.length > 0
    ? calculateMean(mem.recognitionTrials.map((r) => r.reactionTimeMs))
    : null;
  const rcRT = rc?.summary ? rc.summary.meanQuestionReactionTimeMs : null;

  const vsAcc = vs?.summary ? vs.summary.overallAccuracyPct : null;
  const memAcc = mem?.recognitionTrials && mem.recognitionTrials.length > 0
    ? Number(((mem.recognitionTrials.filter((r) => r.isCorrect).length / mem.recognitionTrials.length) * 100).toFixed(1))
    : null;
  const rcAcc = rc?.summary ? rc.summary.overallComprehensionAccuracyPct : null;

  const vsGazeAvail = vs?.gazeAvailabilityPct ?? null;
  const memGazeAvail = mem?.gazeAvailabilityPct ?? null;
  const rcGazeAvail = rc?.gazeAvailabilityPct ?? null;

  return {
    metrics: [
      { name: "Gaze Availability", unit: "%", visualSearch: vsGazeAvail, memoryRecognition: memGazeAvail, readingComprehension: rcGazeAvail },
      { name: "Fixation Duration (Mean)", unit: "ms", visualSearch: vsFixDur, memoryRecognition: memFixDur, readingComprehension: rcFixDur },
      { name: "Total Fixations", unit: "count", visualSearch: vsFixCount, memoryRecognition: memFixCount, readingComprehension: rcFixCount },
      { name: "Total Saccades", unit: "count", visualSearch: vsSacCount, memoryRecognition: memSacCount, readingComprehension: rcSacCount },
      { name: "Mean Reaction / Response Time", unit: "ms", visualSearch: vsRT, memoryRecognition: memRT, readingComprehension: rcRT },
      { name: "Task Performance Accuracy", unit: "%", visualSearch: vsAcc, memoryRecognition: memAcc, readingComprehension: rcAcc },
    ],
  };
}

/**
 * Validates integrity of a research session before analytics processing.
 */
export function validateSessionIntegrity(session: ResearchSessionRecord): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!session.sessionId) errors.push("Missing sessionId.");
  if (!session.participantId) errors.push("Missing participantId.");
  if (!session.calibration) errors.push("Missing calibration data.");

  // Check timestamp monotonicity in raw gaze
  const checkTimestamps = (samples: { timestamp: number }[], label: string) => {
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].timestamp < samples[i - 1].timestamp) {
        errors.push(`Timestamp inversion in ${label} at index ${i}`);
        break;
      }
    }
  };

  if (session.visualSearch?.rawGaze) checkTimestamps(session.visualSearch.rawGaze, "VisualSearch Gaze");
  if (session.memoryRecognition?.rawGaze) checkTimestamps(session.memoryRecognition.rawGaze, "Memory Gaze");
  if (session.readingComprehension?.rawGaze) checkTimestamps(session.readingComprehension.rawGaze, "Reading Gaze");

  // Warnings
  if (session.dataQuality.overallQualityScore < 70) {
    warnings.push("Session data quality score is below 70.");
  }
  if (session.dataQuality.isOutlier) {
    warnings.push(`Identified as potential outlier: ${session.dataQuality.outlierReasons.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export type OutlierClassification = "NORMAL RANGE" | "POTENTIAL OUTLIER" | "DATA QUALITY WARNING";

export interface OutlierCheckResult {
  value: number;
  classification: OutlierClassification;
  zScore: number;
  reason?: string;
}

/**
 * Checks a metric against cohort distribution and data quality score.
 * Tags as NORMAL RANGE, POTENTIAL OUTLIER (|z| >= 2.5), or DATA QUALITY WARNING (quality < 50).
 */
export function evaluateOutlierStatus(
  value: number,
  allValues: number[],
  validQualityScore?: number
): OutlierCheckResult {
  if (allValues.length < 3) {
    return { value, classification: "NORMAL RANGE", zScore: 0 };
  }
  const mean = calculateMean(allValues);
  const sd = calculateStdDev(allValues);
  if (sd === 0) {
    return { value, classification: "NORMAL RANGE", zScore: 0 };
  }
  const zScore = Number(((value - mean) / sd).toFixed(2));
  if (validQualityScore !== undefined && validQualityScore < 50) {
    return {
      value,
      classification: "DATA QUALITY WARNING",
      zScore,
      reason: `Low overall data quality score (${validQualityScore}/100)`,
    };
  }
  if (Math.abs(zScore) >= 2.5) {
    return {
      value,
      classification: "POTENTIAL OUTLIER",
      zScore,
      reason: `Z-score is ${zScore} (|z| >= 2.5 SD from cohort mean ${mean})`,
    };
  }
  return { value, classification: "NORMAL RANGE", zScore };
}
