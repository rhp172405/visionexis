/**
 * VISIONEXIS Shared Coordinate System & Normalization Utilities.
 *
 * Establishes a single, unified coordinate standard:
 * 1. Normalized Gaze (`normX`, `normY`): Always normalized to the browser viewport
 *    `[0.0 .. 1.0]` across `window.innerWidth` and `window.innerHeight`.
 * 2. Container Mapping: Any UI container (Calibration viewport, Visual Search grid,
 *    Memory stimulus, Reading text) converts window-normalized gaze to container-local
 *    pixel coordinates using `windowNormToContainer()`.
 * 3. Calibration Mapping: Targets rendered inside container elements map their
 *    physical screen location back to window-normalized coordinates via `targetToWindowNorm()`.
 */

export interface BoundingBox {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

export function getWindowDimensions(): { width: number; height: number } {
  if (typeof window !== "undefined") {
    return {
      width: Math.max(1, window.innerWidth || 1920),
      height: Math.max(1, window.innerHeight || 1080),
    };
  }
  return { width: 1920, height: 1080 };
}

/**
 * Maps a container-relative pixel point to window-normalized coordinates [0.0 .. 1.0].
 */
export function containerToWindowNorm(
  containerRelX: number,
  containerRelY: number,
  containerRect: BoundingBox,
  winWidth?: number,
  winHeight?: number
): { normX: number; normY: number } {
  const win = getWindowDimensions();
  const w = winWidth ?? win.width;
  const h = winHeight ?? win.height;
  const screenX = containerRect.left + containerRelX;
  const screenY = containerRect.top + containerRelY;

  return {
    normX: Math.max(0, Math.min(1, screenX / (w || 1))),
    normY: Math.max(0, Math.min(1, screenY / (h || 1))),
  };
}

/**
 * Converts a normalized target coordinate [0.0 .. 1.0] inside a container
 * to window-normalized coordinates [0.0 .. 1.0].
 */
export function targetToWindowNorm(
  targetNormX: number,
  targetNormY: number,
  containerRect: { left: number; top: number; width: number; height: number },
  winWidth?: number,
  winHeight?: number
): { normX: number; normY: number } {
  const containerRelX = targetNormX * containerRect.width;
  const containerRelY = targetNormY * containerRect.height;
  return containerToWindowNorm(containerRelX, containerRelY, containerRect, winWidth, winHeight);
}

/**
 * Converts a window-normalized gaze point [0.0 .. 1.0] to container-relative pixel coordinates.
 */
export function windowNormToContainer(
  normX: number,
  normY: number,
  containerRect: BoundingBox,
  winWidth?: number,
  winHeight?: number
): { x: number; y: number } {
  const win = getWindowDimensions();
  const w = winWidth ?? win.width;
  const h = winHeight ?? win.height;
  const screenX = normX * w;
  const screenY = normY * h;

  return {
    x: Math.round(screenX - containerRect.left),
    y: Math.round(screenY - containerRect.top),
  };
}

/**
 * Converts a window-normalized coordinate [0.0 .. 1.0] to screen/viewport pixel coordinates.
 */
export function windowNormToScreenPixels(
  normX: number,
  normY: number,
  winWidth?: number,
  winHeight?: number
): { x: number; y: number } {
  const win = getWindowDimensions();
  const w = winWidth ?? win.width;
  const h = winHeight ?? win.height;

  return {
    x: Math.round(normX * w),
    y: Math.round(normY * h),
  };
}
