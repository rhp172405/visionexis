/**
 * VISIONEXIS Research Data Architecture & Unified Session Model (Phase 9).
 *
 * Provides:
 * 1. Participant identification and anonymous demographic/device metadata.
 * 2. Complete unified ResearchSessionRecord preserving raw data across all 3 tasks:
 *    - Visual Search
 *    - Memory & Recognition
 *    - Reading & Comprehension
 * 3. 0-100 Transparent Data Quality Breakdown (Calibration, Gaze Availability, Continuity, Timestamps, Task Completion).
 * 4. Session Validity Classification (VALID, WARNING, INVALID) with explicit reasons.
 * 5. Outlier detection tagging without raw data loss.
 * 6. Explicit schema & software versioning (schemaVersion, softwareVersion, calibrationVersion, analysisVersion).
 *
 * NOTE: Experimental software-based eye-tracking and cognitive assessment research platform.
 * Measurements are research-oriented and DO NOT constitute clinical or medical diagnoses.
 */

import type { RawGazeBufferSample, FixationEvent, SaccadeEvent, TaskEventRecord } from "./webcam/gazeEvents";
import type { CalibrationModel } from "./webcam/calibration";
import type { ReadingRegression, ReturnSweep, LineReadingMetrics, QuestionResponseRecord, ReadingPassage, WordAOI, LineAOI } from "./readingComprehensionTask";

export const SCHEMA_VERSION = "1.0";
export const SOFTWARE_VERSION = "1.0.0";
export const CALIBRATION_VERSION = "1.0";
export const ANALYSIS_VERSION = "1.0";

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface ParticipantInfo {
  participantId: string; // e.g. "P001", "P002", anonymous code
  age?: number;
  gender?: "M" | "F" | "Non-Binary" | "Prefer not to say" | "Other";
  handedness?: "Right" | "Left" | "Ambidextrous";
  notes?: string;
  createdAt: number;
}

export type SessionValidityState = "VALID" | "WARNING" | "INVALID";

export interface DataQualityScoreBreakdown {
  calibrationQualityScore: number; // 0..100 (based on validation error < 45px)
  gazeAvailabilityScore: number;   // 0..100 (percentage of valid gaze frames)
  trackingContinuityScore: number; // 0..100 (low dropped frames & low stall duration)
  timestampIntegrityScore: number; // 0..100 (strict monotonic timeline & no inversion)
  taskCompletionScore: number;     // 0..100 (percentage of required task trials completed)
  overallQualityScore: number;     // 0..100 weighted formula
  validityState: SessionValidityState;
  reasons: string[];
  isOutlier: boolean;
  outlierReasons: string[];
}

export interface ResearchCalibrationData {
  profileId: string;
  pointsCount: number;
  calibratedAt: number;
  model: CalibrationModel | null;
  validation: {
    meanErrorPx: number;
    medianErrorPx: number;
    maxErrorPx: number;
    horizontalMaePx: number;
    verticalMaePx: number;
    validationQuality: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
    sampleCount: number;
  } | null;
}

export interface VisualSearchTrialSummary {
  trialNumber: number;
  gridSize: number;
  targetPresent: boolean;
  userClickedCorrect: boolean;
  reactionTimeMs: number;
  searchTimeMs: number;
  fixationCount: number;
}

export interface VisualSearchSummaryMetrics {
  totalTrials: number;
  overallAccuracyPct: number;
  meanReactionTimeMs: number;
  medianReactionTimeMs: number;
  meanSearchTimeMs: number;
  medianSearchTimeMs: number;
  totalFixations: number;
  meanFixationDurationMs: number;
  totalSaccades: number;
  meanSaccadeAmplitudePx: number;
  totalRevisits: number;
  difficultyBreakdown: {
    easy: { trialCount: number; accuracyPct: number; meanReactionTimeMs: number; meanSearchTimeMs: number; meanFixationDurationMs: number; meanTargetAttentionPct: number; efficiencyScore: number };
    medium: { trialCount: number; accuracyPct: number; meanReactionTimeMs: number; meanSearchTimeMs: number; meanFixationDurationMs: number; meanTargetAttentionPct: number; efficiencyScore: number };
    hard: { trialCount: number; accuracyPct: number; meanReactionTimeMs: number; meanSearchTimeMs: number; meanFixationDurationMs: number; meanTargetAttentionPct: number; efficiencyScore: number };
  };
}

export interface ResearchVisualSearchData {
  rawGaze: RawGazeBufferSample[];
  mouseEvents: { type: string; x: number; y: number; timestamp: number }[];
  taskEvents: TaskEventRecord[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
  trials: VisualSearchTrialSummary[];
  summary: VisualSearchSummaryMetrics | null;
  gazeAvailabilityPct: number;
}

export interface MemoryRecognitionTrialSummary {
  trialNumber: number;
  itemId: string;
  isOld: boolean;
  presentedAt: number;
  responseTime: number;
  reactionTimeMs: number;
  userJudgedOld: boolean;
  isCorrect: boolean;
}

export interface ResearchMemoryData {
  rawGaze: RawGazeBufferSample[];
  mouseEvents: { type: string; x: number; y: number; timestamp: number }[];
  taskEvents: TaskEventRecord[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
  studyTrials: unknown[];
  recognitionTrials: MemoryRecognitionTrialSummary[];
  sdt: {
    hits: number;
    misses: number;
    falseAlarms: number;
    correctRejections: number;
    hitRate: number;
    faRate: number;
    dPrime: number;
    criterion: number;
  };
  studyDwellComparison: {
    meanHitStudyDwellMs: number;
    meanMissStudyDwellMs: number;
    dwellDifferenceMs: number;
  };
  gazeAvailabilityPct: number;
}

export interface ReadingSummaryMetrics {
  wordsPerMinute: number;
  readingCoveragePct: number;
  totalFixationCount: number;
  meanFixationDurationMs: number;
  medianFixationDurationMs: number;
  maxFixationDurationMs: number;
  minFixationDurationMs: number;
  fixationsPer100Words: number;
  totalSaccadeCount: number;
  progressiveSaccadesCount: number;
  totalRegressionsCount: number;
  regressionsPer100Words: number;
  regressionRate: number;
  totalReturnSweepsCount: number;
  lineTransitionsCount: number;
  totalRevisits: number;
  overallComprehensionAccuracyPct: number;
  correctQuestionsCount: number;
  incorrectQuestionsCount: number;
  meanQuestionReactionTimeMs: number;
  medianQuestionReactionTimeMs: number;
  fastestQuestionReactionTimeMs: number;
  slowestQuestionReactionTimeMs: number;
  accuracyByQuestionType: Record<string, { total: number; correct: number; accuracyPct: number }>;
}

export interface ResearchReadingData {
  rawGaze: RawGazeBufferSample[];
  mouseEvents: { type: string; x: number; y: number; timestamp: number }[];
  taskEvents: TaskEventRecord[];
  fixations: FixationEvent[];
  saccades: SaccadeEvent[];
  regressions: ReadingRegression[];
  returnSweeps: ReturnSweep[];
  lineMetrics: LineReadingMetrics[];
  passage: ReadingPassage | null;
  wordAOIs: WordAOI[];
  lineAOIs: LineAOI[];
  questionResponses: QuestionResponseRecord[];
  summary: ReadingSummaryMetrics | null;
  gazeAvailabilityPct: number;
}

export interface ResearchSessionRecord {
  schemaVersion: string;
  softwareVersion: string;
  calibrationVersion: string;
  analysisVersion: string;

  sessionId: string;
  participantId: string;
  sessionTimestamp: number;
  sessionDateISO: string;

  participant: ParticipantInfo;
  device: DeviceInfo;

  calibration: ResearchCalibrationData;
  visualSearch: ResearchVisualSearchData | null;
  memoryRecognition: ResearchMemoryData | null;
  readingComprehension: ResearchReadingData | null;

  dataQuality: DataQualityScoreBreakdown;
  warnings: string[];
}

/**
 * Computes transparent 0-100 data quality score and session validity.
 *
 * FORMULA:
 * Overall = (0.25 * Calibration) + (0.25 * GazeAvailability) + (0.20 * Continuity) + (0.15 * Timestamps) + (0.15 * Completion)
 */
export function calculateDataQuality(params: {
  validationMeanErrorPx?: number | null;
  gazeAvailabilityPct: number;
  droppedFramesCount?: number;
  totalFramesCount?: number;
  hasMonotonicTimestamps: boolean;
  tasksCompletedFraction: number; // 0.0 to 1.0
}): DataQualityScoreBreakdown {
  const {
    validationMeanErrorPx,
    gazeAvailabilityPct,
    droppedFramesCount = 0,
    totalFramesCount = 100,
    hasMonotonicTimestamps,
    tasksCompletedFraction,
  } = params;

  // 1. Calibration Quality Score (0..100)
  let calibrationQualityScore = 50;
  if (validationMeanErrorPx !== undefined && validationMeanErrorPx !== null) {
    if (validationMeanErrorPx <= 20) calibrationQualityScore = 100;
    else if (validationMeanErrorPx <= 30) calibrationQualityScore = 90;
    else if (validationMeanErrorPx <= 45) calibrationQualityScore = 75;
    else if (validationMeanErrorPx <= 65) calibrationQualityScore = 50;
    else calibrationQualityScore = 25;
  }

  // 2. Gaze Availability Score (0..100)
  const gazeAvailabilityScore = Math.max(0, Math.min(100, Math.round(gazeAvailabilityPct)));

  // 3. Tracking Continuity Score (0..100)
  const dropRatio = totalFramesCount > 0 ? droppedFramesCount / totalFramesCount : 0;
  const trackingContinuityScore = Math.max(0, Math.min(100, Math.round((1 - dropRatio) * 100)));

  // 4. Timestamp Integrity Score (0..100)
  const timestampIntegrityScore = hasMonotonicTimestamps ? 100 : 0;

  // 5. Task Completion Score (0..100)
  const taskCompletionScore = Math.max(0, Math.min(100, Math.round(tasksCompletedFraction * 100)));

  // Overall Weighted Score
  const overallQualityScore = Math.round(
    0.25 * calibrationQualityScore +
    0.25 * gazeAvailabilityScore +
    0.20 * trackingContinuityScore +
    0.15 * timestampIntegrityScore +
    0.15 * taskCompletionScore
  );

  // Validity and Reason Categorization
  const reasons: string[] = [];
  const outlierReasons: string[] = [];
  let validityState: SessionValidityState = "VALID";

  if (!hasMonotonicTimestamps) {
    validityState = "INVALID";
    reasons.push("Fatal timestamp clock inversion detected.");
  }
  if (gazeAvailabilityScore < 40) {
    validityState = "INVALID";
    reasons.push("Critically low gaze availability (< 40%).");
    outlierReasons.push("Severe tracking loss.");
  } else if (gazeAvailabilityScore < 65) {
    if (validityState !== "INVALID") validityState = "WARNING";
    reasons.push("Sub-optimal gaze availability (< 65%).");
    outlierReasons.push("Low gaze availability.");
  }

  if (validationMeanErrorPx && validationMeanErrorPx > 60) {
    if (validityState !== "INVALID") validityState = "WARNING";
    reasons.push("High calibration validation error (> 60px).");
    outlierReasons.push("Elevated calibration error.");
  }

  if (taskCompletionScore < 50) {
    validityState = "INVALID";
    reasons.push("Incomplete task protocol (< 50% tasks finished).");
  } else if (taskCompletionScore < 100) {
    if (validityState !== "INVALID") validityState = "WARNING";
    reasons.push("Partial task completion (< 100%).");
  }

  const isOutlier = outlierReasons.length > 0;

  return {
    calibrationQualityScore,
    gazeAvailabilityScore,
    trackingContinuityScore,
    timestampIntegrityScore,
    taskCompletionScore,
    overallQualityScore,
    validityState,
    reasons,
    isOutlier,
    outlierReasons,
  };
}

/**
 * Creates default anonymous DeviceInfo.
 */
export function getClientDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: "NodeJS/Server",
      platform: "NodeJS",
      language: "en-US",
      devicePixelRatio: 1,
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1280,
      viewportHeight: 720,
    };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    devicePixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
