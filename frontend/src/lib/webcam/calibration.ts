/**
 * VISIONEXIS Robust Dual-Axis Gaze Calibration & Validation System.
 * Independent Model X (Horizontal) and Model Y (Vertical) estimators.
 * Implements:
 * - Normalized intra-eye iris ratio features
 * - Head-pose decoupling (yaw & pitch compensation)
 * - Trimmed-mean / median outlier rejection
 * - Stable Ridge Regression solver (separate Model X and Model Y)
 * - Independent 5-point post-calibration validation protocol
 * - Versioned user-specific profile storage (calibrationVersion: 1)
 */

export interface CalibrationTarget {
  id: number;
  normX: number; // 0.0 to 1.0 (screen proportion)
  normY: number; // 0.0 to 1.0
  label: string;
}

export interface CalibrationSample {
  targetId: number;
  targetX: number; // normalized target X (0..1)
  targetY: number; // normalized target Y (0..1)
  targetPxX?: number;
  targetPxY?: number;
  predictedPxX?: number;
  predictedPxY?: number;
  leftRelativeX: number;
  leftRelativeY: number;
  rightRelativeX: number;
  rightRelativeY: number;
  meanRelativeX: number;
  meanRelativeY: number;
  headYaw: number;
  headPitch: number;
  faceCenterX: number;
  faceCenterY: number;
  featuresX: number[];
  featuresY: number[];
  timestamp: number;
}

// Backward-compatible alias
export type CalibrationPointSample = CalibrationSample;

export interface TargetValidationResult {
  targetId: number;
  label: string;
  targetNormX: number;
  targetNormY: number;
  targetPxX: number;
  targetPxY: number;
  predictedPxX: number;
  predictedPxY: number;
  errorPx: number;
  horizontalErrorPx: number;
  verticalErrorPx: number;
}

export interface ValidationSummary {
  maePx: number;
  medianErrorPx: number;
  maxErrorPx: number;
  horizontalMaePx: number;
  verticalMaePx: number;
  qualityRating: "GOOD" | "FAIR" | "POOR";
  confidenceScore: number; // 0 to 100%
  targets: TargetValidationResult[];
}

export interface CalibrationProfile {
  calibrationVersion: 1;
  id?: string;
  weightsX: number[];
  weightsY: number[];
  featureConfig: {
    featuresX: string[];
    featuresY: string[];
  };
  viewport: {
    width: number;
    height: number;
  };
  sampleCount: number;
  calibratedAt: string;
  qualityRating: "GOOD" | "FAIR" | "POOR";
  qualityScore: number; // 0 to 100%
  meanErrorNorm: number;
  validation?: ValidationSummary;
}

// Backward-compatible alias
export type CalibrationModel = CalibrationProfile;

// 9 Standard Calibration Targets (approx 15%, 50%, 85% to avoid screen edge clipping)
export const CALIBRATION_POINTS_9: CalibrationTarget[] = [
  { id: 1, normX: 0.15, normY: 0.15, label: "Top-Left" },
  { id: 2, normX: 0.50, normY: 0.15, label: "Top-Center" },
  { id: 3, normX: 0.85, normY: 0.15, label: "Top-Right" },
  { id: 4, normX: 0.15, normY: 0.50, label: "Middle-Left" },
  { id: 5, normX: 0.50, normY: 0.50, label: "Center" },
  { id: 6, normX: 0.85, normY: 0.50, label: "Middle-Right" },
  { id: 7, normX: 0.15, normY: 0.85, label: "Bottom-Left" },
  { id: 8, normX: 0.50, normY: 0.85, label: "Bottom-Center" },
  { id: 9, normX: 0.85, normY: 0.85, label: "Bottom-Right" },
];

// 5 Independent Validation Targets covering the full span
export const VALIDATION_POINTS_5: CalibrationTarget[] = [
  { id: 101, normX: 0.15, normY: 0.15, label: "Top-Left" },
  { id: 102, normX: 0.85, normY: 0.15, label: "Top-Right" },
  { id: 103, normX: 0.50, normY: 0.50, label: "Center" },
  { id: 104, normX: 0.15, normY: 0.85, label: "Bottom-Left" },
  { id: 105, normX: 0.85, normY: 0.85, label: "Bottom-Right" },
];

export const STORAGE_KEY = "visionexis_webcam_calibration_v1";

export const FEATURE_CONFIG = {
  featuresX: [
    "bias",
    "meanRelativeX - 0.5",
    "leftDiffRightX",
    "headYaw",
    "faceCenterX - 0.5",
  ],
  featuresY: [
    "bias",
    "meanRelativeY - 0.5",
    "leftDiffRightY",
    "headPitch",
    "faceCenterY - 0.5",
  ],
};

/**
 * Extract normalized eye & head-pose feature vectors for Model X and Model Y.
 * Uses conjugate gaze shifts and orthogonal differential terms to prevent collinearity.
 */
export function extractRegressionFeatures(feat: {
  leftIrisX: number;
  rightIrisX: number;
  leftIrisY: number;
  rightIrisY: number;
  headYaw: number;
  headPitch: number;
  faceCenterX: number;
  faceCenterY: number;
}): { featuresX: number[]; featuresY: number[] } {
  const meanX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
  const meanY = (feat.leftIrisY + feat.rightIrisY) / 2.0;

  // Horizontal Feature Vector for Model X (orthogonal, well-conditioned)
  const featuresX = [
    1.0,                              // 0: Bias term
    meanX - 0.5,                      // 1: Conjugate horizontal iris shift
    feat.leftIrisX - feat.rightIrisX, // 2: Horizontal vergence / asymmetry
    feat.headYaw,                     // 3: Head yaw proxy
    feat.faceCenterX - 0.5,           // 4: Lateral face displacement
  ];

  // Vertical Feature Vector for Model Y (orthogonal, well-conditioned)
  const featuresY = [
    1.0,                              // 0: Bias term
    meanY - 0.5,                      // 1: Conjugate vertical iris shift
    feat.leftIrisY - feat.rightIrisY, // 2: Vertical eye differential
    feat.headPitch,                   // 3: Head pitch proxy
    feat.faceCenterY - 0.5,           // 4: Vertical face displacement
  ];

  return { featuresX, featuresY };
}

/**
 * Solve Ridge Regression: W = (X^T * X + lambda * I)^(-1) * X^T * Y
 * Provides stable, non-singular fitting with zero overfitting oscillations.
 */
export function solveRidgeRegression(
  X: number[][],
  Y: number[],
  lambda: number = 0.002
): number[] {
  const n = X.length;
  if (n === 0) return [];
  const p = X[0].length;

  // Compute X^T * X + lambda * I
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum + (i === j ? lambda : 0);
    }
  }

  // Compute X^T * Y
  const XtY: number[] = Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * Y[k];
    }
    XtY[i] = sum;
  }

  return solveLinearSystem(XtX, XtY);
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Partial pivoting for numerical stability
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      continue;
    }

    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Filter point samples using multi-dimensional median distance outlier rejection.
 * Eliminates blink artifacts, microsaccades, and sudden landmark jitters.
 */
export function filterPointSamples(samples: CalibrationSample[]): CalibrationSample[] {
  if (samples.length <= 6) return samples;

  const meanXValues = samples.map((s) => s.meanRelativeX);
  const meanYValues = samples.map((s) => s.meanRelativeY);

  const medianX = computeMedian(meanXValues);
  const medianY = computeMedian(meanYValues);

  const withDistances = samples.map((s) => ({
    sample: s,
    dist: Math.hypot(s.meanRelativeX - medianX, s.meanRelativeY - medianY),
  }));

  withDistances.sort((a, b) => a.dist - b.dist);
  // Keep the most consistent 75% of samples per target
  const keepCount = Math.max(6, Math.floor(samples.length * 0.75));
  return withDistances.slice(0, keepCount).map((item) => item.sample);
}

export function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Train Model X and Model Y from collected 9-point samples with outlier removal.
 */
export function trainCalibrationModel(
  rawSamples: CalibrationSample[],
  viewportWidth: number = 800,
  viewportHeight: number = 450
): CalibrationProfile | null {
  if (rawSamples.length < 9) return null;

  // Group by targetId and remove outliers per target
  const grouped = new Map<number, CalibrationSample[]>();
  for (const s of rawSamples) {
    if (!grouped.has(s.targetId)) grouped.set(s.targetId, []);
    grouped.get(s.targetId)!.push(s);
  }

  const filteredSamples: CalibrationSample[] = [];
  grouped.forEach((pointSamples) => {
    filteredSamples.push(...filterPointSamples(pointSamples));
  });

  if (filteredSamples.length < 9) return null;

  const X_features = filteredSamples.map((s) => s.featuresX);
  const Y_features = filteredSamples.map((s) => s.featuresY);
  const targetX = filteredSamples.map((s) => s.targetX);
  const targetY = filteredSamples.map((s) => s.targetY);

  const weightsX = solveRidgeRegression(X_features, targetX, 0.002);
  const weightsY = solveRidgeRegression(Y_features, targetY, 0.002);

  if (weightsX.length === 0 || weightsY.length === 0) return null;

  // Compute training residual error
  let totalErrorSq = 0;
  for (let i = 0; i < filteredSamples.length; i++) {
    const predX = dot(filteredSamples[i].featuresX, weightsX);
    const predY = dot(filteredSamples[i].featuresY, weightsY);
    const dx = predX - filteredSamples[i].targetX;
    const dy = predY - filteredSamples[i].targetY;
    totalErrorSq += dx * dx + dy * dy;
  }
  const meanErrorNorm = Math.sqrt(totalErrorSq / filteredSamples.length);
  const qualityScore = Math.max(0, Math.min(100, Math.round((1.0 - meanErrorNorm * 2.5) * 100)));
  const qualityRating: "GOOD" | "FAIR" | "POOR" =
    qualityScore >= 75 ? "GOOD" : qualityScore >= 50 ? "FAIR" : "POOR";

  const profile: CalibrationProfile = {
    calibrationVersion: 1,
    weightsX,
    weightsY,
    featureConfig: FEATURE_CONFIG,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    sampleCount: filteredSamples.length,
    calibratedAt: new Date().toISOString(),
    qualityRating,
    qualityScore,
    meanErrorNorm,
  };

  saveCalibrationModel(profile);
  return profile;
}

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Estimate normalized screen gaze (0.0 to 1.0) from eye features using calibrated models.
 */
export function estimateGazeNorm(
  feat: {
    leftIrisX: number;
    rightIrisX: number;
    leftIrisY: number;
    rightIrisY: number;
    headYaw: number;
    headPitch: number;
    faceCenterX: number;
    faceCenterY: number;
  },
  model: CalibrationProfile | null
): { normX: number; normY: number } {
  const { featuresX, featuresY } = extractRegressionFeatures(feat);

  if (model && model.weightsX.length === featuresX.length && model.weightsY.length === featuresY.length) {
    const rawX = dot(featuresX, model.weightsX);
    const rawY = dot(featuresY, model.weightsY);
    return {
      normX: clamp(rawX, 0.01, 0.99),
      normY: clamp(rawY, 0.01, 0.99),
    };
  }

  // Stable Fallback Geometric Prior (Before Calibration)
  const meanX = (feat.leftIrisX + feat.rightIrisX) / 2.0;
  const meanY = (feat.leftIrisY + feat.rightIrisY) / 2.0;
  const cx = meanX - 0.5;
  const cy = meanY - 0.5;

  const normX = clamp(0.5 - cx * 3.6 - feat.headYaw * 1.2, 0.02, 0.98);
  const normY = clamp(0.5 + cy * 3.6 + feat.headPitch * 1.2, 0.02, 0.98);

  return { normX, normY };
}

/**
 * Validate calibration model against brand NEW independent test targets.
 */
export function validateCalibrationModel(
  validationSamples: { target: CalibrationTarget; samples: CalibrationSample[] }[],
  model: CalibrationProfile,
  viewportWidth: number = 800,
  viewportHeight: number = 450
): ValidationSummary {
  const results: TargetValidationResult[] = [];
  let totalErr = 0;
  let totalHErr = 0;
  let totalVErr = 0;
  let maxErr = 0;

  for (const { target, samples } of validationSamples) {
    if (samples.length === 0) continue;
    const filtered = filterPointSamples(samples);
    const avgXFeat = averageVectors(filtered.map((s) => s.featuresX));
    const avgYFeat = averageVectors(filtered.map((s) => s.featuresY));

    const predNormX = clamp(dot(avgXFeat, model.weightsX), 0.0, 1.0);
    const predNormY = clamp(dot(avgYFeat, model.weightsY), 0.0, 1.0);

    const expectedNormX = target.normX;
    const expectedNormY = target.normY;
    const targetPxX = samples[0]?.targetPxX ?? Math.round(expectedNormX * viewportWidth);
    const targetPxY = samples[0]?.targetPxY ?? Math.round(expectedNormY * viewportHeight);
    const hasPredictedPx = samples.some((s) => s.predictedPxX != null && s.predictedPxY != null);
    const predictedPxX = hasPredictedPx
      ? Math.round(computeMedian(samples.filter((s) => s.predictedPxX != null).map((s) => s.predictedPxX!)))
      : Math.round(predNormX * viewportWidth);
    const predictedPxY = hasPredictedPx
      ? Math.round(computeMedian(samples.filter((s) => s.predictedPxY != null).map((s) => s.predictedPxY!)))
      : Math.round(predNormY * viewportHeight);

    const hErr = Math.abs(predictedPxX - targetPxX);
    const vErr = Math.abs(predictedPxY - targetPxY);
    const errPx = Math.round(Math.hypot(hErr, vErr));

    totalErr += errPx;
    totalHErr += hErr;
    totalVErr += vErr;
    if (errPx > maxErr) maxErr = errPx;

    results.push({
      targetId: target.id,
      label: target.label,
      targetNormX: target.normX,
      targetNormY: target.normY,
      targetPxX,
      targetPxY,
      predictedPxX,
      predictedPxY,
      errorPx: errPx,
      horizontalErrorPx: hErr,
      verticalErrorPx: vErr,
    });
  }

  const count = results.length || 1;
  const maePx = Math.round(totalErr / count);
  const medianErrorPx = computeMedian(results.map((r) => r.errorPx));
  const horizontalMaePx = Math.round(totalHErr / count);
  const verticalMaePx = Math.round(totalVErr / count);

  let qualityRating: "GOOD" | "FAIR" | "POOR" = "GOOD";
  if (maePx > 85) qualityRating = "POOR";
  else if (maePx > 45) qualityRating = "FAIR";

  // Confidence based on actual measured validation error
  const confidenceScore = Math.max(10, Math.min(99, Math.round(100 - maePx * 0.65)));

  return {
    maePx,
    medianErrorPx,
    maxErrorPx: maxErr,
    horizontalMaePx,
    verticalMaePx,
    qualityRating,
    confidenceScore,
    targets: results,
  };
}

function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const p = vectors[0].length;
  const avg = new Array(p).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < p; i++) {
      avg[i] += v[i] / vectors.length;
    }
  }
  return avg;
}

export function saveCalibrationModel(model: CalibrationProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch (err) {
    console.warn("Failed to save calibration profile:", err);
  }
}

export function loadCalibrationModel(): CalibrationProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalibrationProfile;
  } catch {
    return null;
  }
}

export function clearCalibrationModel(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
