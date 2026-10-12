/**
 * Eye and facial landmark feature extraction for webcam gaze estimation.
 * Calculates normalized eye features, Eye Aspect Ratio (EAR), head pose proxies, and blink metrics.
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface EyeLandmarkFeatures {
  // Left eye normalized features (0..1)
  leftIrisX: number;
  leftIrisY: number;
  leftEar: number; // Eye Aspect Ratio (openness)
  leftWidth: number;
  leftHeight: number;

  // Right eye normalized features (0..1)
  rightIrisX: number;
  rightIrisY: number;
  rightEar: number; // Eye Aspect Ratio (openness)
  rightWidth: number;
  rightHeight: number;

  // Combined eye metrics
  meanEar: number;
  isBlink: boolean;

  // Head / Face geometry
  faceCenterX: number;
  faceCenterY: number;
  faceSize: number;
  headYaw: number;
  headPitch: number;

  // Quality & confidence
  confidence: number;
  timestamp: number;

  // Raw feature array for polynomial regression mapping
  featureVector: number[];
}

// MediaPipe 468/478 Face Mesh landmark indices
export const LANDMARK_INDEX = {
  // Left eye
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  LEFT_EYE_TOP_2: 160,
  LEFT_EYE_BOTTOM_2: 144,
  LEFT_EYE_TOP_3: 158,
  LEFT_EYE_BOTTOM_3: 153,
  LEFT_IRIS_CENTER: 468,

  // Right eye
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  RIGHT_EYE_TOP_2: 385,
  RIGHT_EYE_BOTTOM_2: 373,
  RIGHT_EYE_TOP_3: 387,
  RIGHT_EYE_BOTTOM_3: 380,
  RIGHT_IRIS_CENTER: 473,

  // Head reference
  NOSE_TIP: 1,
  CHIN: 152,
  FOREHEAD: 10,
  LEFT_TEMPLE: 234,
  RIGHT_TEMPLE: 454,
  BETWEEN_EYES: 168,
};

const BLINK_EAR_THRESHOLD = 0.18;

function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

/**
 * Compute Eye Aspect Ratio (EAR) using standard 6-point eyelid formula.
 */
function computeEar(
  outer: NormalizedLandmark,
  inner: NormalizedLandmark,
  top1: NormalizedLandmark,
  bot1: NormalizedLandmark,
  top2: NormalizedLandmark,
  bot2: NormalizedLandmark
): number {
  const horizontal = distance(outer, inner);
  if (horizontal < 1e-6) return 0.25;
  const v1 = distance(top1, bot1);
  const v2 = distance(top2, bot2);
  return (v1 + v2) / (2.0 * horizontal);
}

/**
 * Extract normalized eye and face features from MediaPipe face landmarks.
 */
export function extractEyeFeatures(
  landmarks: NormalizedLandmark[],
  timestamp: number = performance.now()
): EyeLandmarkFeatures | null {
  if (!landmarks || landmarks.length < 468) {
    return null;
  }

  const getLm = (idx: number): NormalizedLandmark => {
    return landmarks[idx] ?? { x: 0.5, y: 0.5, z: 0 };
  };

  const leftOuter = getLm(LANDMARK_INDEX.LEFT_EYE_OUTER);
  const leftInner = getLm(LANDMARK_INDEX.LEFT_EYE_INNER);
  const leftTop = getLm(LANDMARK_INDEX.LEFT_EYE_TOP);
  const leftBottom = getLm(LANDMARK_INDEX.LEFT_EYE_BOTTOM);
  const leftTop2 = getLm(LANDMARK_INDEX.LEFT_EYE_TOP_2);
  const leftBottom2 = getLm(LANDMARK_INDEX.LEFT_EYE_BOTTOM_2);
  const leftTop3 = getLm(LANDMARK_INDEX.LEFT_EYE_TOP_3);
  const leftBottom3 = getLm(LANDMARK_INDEX.LEFT_EYE_BOTTOM_3);
  
  // Iris landmark fallback if only 468 points are available
  const leftIris = landmarks.length > 468 ? getLm(LANDMARK_INDEX.LEFT_IRIS_CENTER) : {
    x: (leftOuter.x + leftInner.x) / 2,
    y: (leftTop.y + leftBottom.y) / 2,
  };

  const rightInner = getLm(LANDMARK_INDEX.RIGHT_EYE_INNER);
  const rightOuter = getLm(LANDMARK_INDEX.RIGHT_EYE_OUTER);
  const rightTop = getLm(LANDMARK_INDEX.RIGHT_EYE_TOP);
  const rightBottom = getLm(LANDMARK_INDEX.RIGHT_EYE_BOTTOM);
  const rightTop2 = getLm(LANDMARK_INDEX.RIGHT_EYE_TOP_2);
  const rightBottom2 = getLm(LANDMARK_INDEX.RIGHT_EYE_BOTTOM_2);
  const rightTop3 = getLm(LANDMARK_INDEX.RIGHT_EYE_TOP_3);
  const rightBottom3 = getLm(LANDMARK_INDEX.RIGHT_EYE_BOTTOM_3);

  const rightIris = landmarks.length > 473 ? getLm(LANDMARK_INDEX.RIGHT_IRIS_CENTER) : {
    x: (rightOuter.x + rightInner.x) / 2,
    y: (rightTop.y + rightBottom.y) / 2,
  };

  const nose = getLm(LANDMARK_INDEX.NOSE_TIP);
  const chin = getLm(LANDMARK_INDEX.CHIN);
  const forehead = getLm(LANDMARK_INDEX.FOREHEAD);
  const leftTemple = getLm(LANDMARK_INDEX.LEFT_TEMPLE);
  const rightTemple = getLm(LANDMARK_INDEX.RIGHT_TEMPLE);
  const betweenEyes = getLm(LANDMARK_INDEX.BETWEEN_EYES);

  // Left eye geometry & normalized boundaries
  const minLeftX = Math.min(leftOuter.x, leftInner.x);
  const maxLeftX = Math.max(leftOuter.x, leftInner.x);
  const minLeftY = Math.min(leftTop.y, leftTop2.y, leftTop3.y);
  const maxLeftY = Math.max(leftBottom.y, leftBottom2.y, leftBottom3.y);
  const leftEyeWidth = Math.max(maxLeftX - minLeftX, 1e-4);
  const leftEyeHeight = Math.max(maxLeftY - minLeftY, 1e-4);

  // Robust normalized vertical iris position:
  // The canthal axis (eye corners) normalized by constant eye width is the primary skull-fixed reference.
  // In anatomical primary gaze, the iris center is naturally ~0.06 * eyeWidth above the intercanthal line.
  // Centering around this neutral baseline gives a symmetric, linear vertical signal (~0.5 at rest)
  // that is not compromised by physiological eyelid drop (ptosis) during downgaze.
  const leftCanthusY = (leftOuter.y + leftInner.y) / 2.0;
  const leftIrisX = clamp((leftIris.x - minLeftX) / leftEyeWidth, 0.0, 1.0);
  const leftIrisY = clamp(0.5 + ((leftIris.y - leftCanthusY) / leftEyeWidth + 0.06) * 3.6, 0.0, 1.0);
  const leftEar = computeEar(leftOuter, leftInner, leftTop2, leftBottom2, leftTop3, leftBottom3);

  // Right eye geometry & normalized boundaries
  const minRightX = Math.min(rightOuter.x, rightInner.x);
  const maxRightX = Math.max(rightOuter.x, rightInner.x);
  const minRightY = Math.min(rightTop.y, rightTop2.y, rightTop3.y);
  const maxRightY = Math.max(rightBottom.y, rightBottom2.y, rightBottom3.y);
  const rightEyeWidth = Math.max(maxRightX - minRightX, 1e-4);
  const rightEyeHeight = Math.max(maxRightY - minRightY, 1e-4);

  const rightCanthusY = (rightOuter.y + rightInner.y) / 2.0;
  const rightIrisX = clamp((rightIris.x - minRightX) / rightEyeWidth, 0.0, 1.0);
  const rightIrisY = clamp(0.5 + ((rightIris.y - rightCanthusY) / rightEyeWidth + 0.06) * 3.6, 0.0, 1.0);
  const rightEar = computeEar(rightOuter, rightInner, rightTop2, rightBottom2, rightTop3, rightBottom3);

  const meanEar = (leftEar + rightEar) / 2.0;
  const isBlink = meanEar < BLINK_EAR_THRESHOLD;

  // Head center and scale
  const faceCenterX = nose.x;
  const faceCenterY = nose.y;
  const faceWidth = distance(leftTemple, rightTemple);
  const faceHeight = distance(forehead, chin);
  const faceSize = (faceWidth + faceHeight) / 2.0;

  // Head orientation proxies (both centered at 0 in neutral posture)
  const headYaw = (faceWidth > 1e-4) ? (nose.x - betweenEyes.x) / faceWidth : 0;
  const rawPitch = (faceHeight > 1e-4) ? (nose.y - betweenEyes.y) / faceHeight : 0;
  const headPitch = rawPitch - 0.15; // Centered around neutral glabella-to-nose anatomical ratio

  // Relative mean iris position
  const meanRelX = (leftIrisX + rightIrisX) / 2.0;
  const meanRelY = (leftIrisY + rightIrisY) / 2.0;

  // Centered feature vector for stable, well-conditioned regression mapping
  const cx = meanRelX - 0.5;
  const cy = meanRelY - 0.5;
  const clx = leftIrisX - 0.5;
  const crx = rightIrisX - 0.5;
  const cly = leftIrisY - 0.5;
  const cry = rightIrisY - 0.5;

  const featureVector = [
    1.0,               // 0: Bias term
    cx,                // 1: Primary horizontal relative iris shift
    cy,                // 2: Primary vertical relative iris shift
    headYaw,           // 3: Head yaw compensation
    headPitch,         // 4: Head pitch compensation
    clx,               // 5: Left eye horizontal shift
    crx,               // 6: Right eye horizontal shift
    cly,               // 7: Left eye vertical shift
    cry,               // 8: Right eye vertical shift
    cx * cx,           // 9: Quadratic horizontal
    cy * cy,           // 10: Quadratic vertical
    cx * cy,           // 11: Cross interaction
    faceCenterX - 0.5, // 12: Lateral face position
    faceCenterY - 0.5, // 13: Vertical face position
    meanRelX,          // 14: Absolute mean rel X
    meanRelY,          // 15: Absolute mean rel Y
  ];

  // Quality confidence heuristic (0.0 to 1.0)
  let confidence = 0.95;
  if (isBlink) confidence *= 0.2;
  if (faceSize < 0.12 || faceSize > 0.85) confidence *= 0.7; // Face too small / too close
  if (Math.abs(headYaw) > 0.20 || Math.abs(headPitch) > 0.20) confidence *= 0.8; // High head turn
  confidence = clamp(confidence, 0.05, 1.0);

  return {
    leftIrisX,
    leftIrisY,
    leftEar,
    leftWidth: leftEyeWidth,
    leftHeight: leftEyeHeight,
    rightIrisX,
    rightIrisY,
    rightEar,
    rightWidth: rightEyeWidth,
    rightHeight: rightEyeHeight,
    meanEar,
    isBlink,
    faceCenterX,
    faceCenterY,
    faceSize,
    headYaw,
    headPitch,
    confidence,
    timestamp,
    featureVector,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
