/**
 * VISIONEXIS Dual-Modality Task Gaze & Mouse Tracking Hook.
 * Simultaneously records and synchronizes:
 * 1. Webcam Eye Gaze (via MediaPipe Face Landmarker)
 * 2. Mouse Cursor Position & Clicks
 * Computes real-time Gaze-Mouse distance, latency, path lengths, and fixations.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";
import { useFixationDetection } from "@/hooks/useFixationDetection";
import { SaccadeDetector } from "@/lib/webcam/saccadeDetection";
import { windowNormToContainer } from "@/lib/webcam/coordinates";
import type { GazePoint, DualModalityMetrics, SynchronizedSample } from "@/types";

const SAMPLE_INTERVAL_MS = 33; // ~30 Hz synchronization interval

interface UseTaskGazeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isTracking: boolean;
  onGazeSample: (point: GazePoint) => void;
  onFixation: (point: GazePoint) => void;
  onSaccade?: (point: GazePoint) => void;
  taskStartTime: number;
}

export function useTaskGaze({
  containerRef,
  isTracking,
  onGazeSample,
  onFixation,
  onSaccade,
  taskStartTime,
}: UseTaskGazeOptions) {
  const { isCameraActive, showGazeDot, recordSaccade, gazeSource } = useGazeStore();

  // Dual positions
  const [gazePos, setGazePos] = useState({ x: 320, y: 240 });
  const [mousePos, setMousePos] = useState({ x: 320, y: 240 });
  const [isInside, setIsInside] = useState(false);

  // Synchronized dataset
  const synchronizedSamplesRef = useRef<SynchronizedSample[]>([]);
  const lastMousePosRef = useRef({ x: 320, y: 240 });
  const mousePathLengthRef = useRef(0);
  const gazePathLengthRef = useRef(0);
  const lastGazePosRef = useRef({ x: 320, y: 240 });
  const fixationCountRef = useRef(0);
  const lastSampleTimeRef = useRef(0);

  // Saccade Detector
  const saccadeDetectorRef = useRef<SaccadeDetector | null>(null);
  if (!saccadeDetectorRef.current) {
    saccadeDetectorRef.current = new SaccadeDetector((_event, gazePoint) => {
      recordSaccade();
      onSaccade?.(gazePoint);
      onGazeSample(gazePoint);
    });
  }

  // Fixation Detector
  const fixation = useFixationDetection((point) => {
    fixationCountRef.current += 1;
    onFixation(point);
  });

  const resetTracking = useCallback(() => {
    fixation.reset();
    saccadeDetectorRef.current?.reset();
    synchronizedSamplesRef.current = [];
    mousePathLengthRef.current = 0;
    gazePathLengthRef.current = 0;
    fixationCountRef.current = 0;
    lastSampleTimeRef.current = 0;
  }, [fixation]);

  // Auto-start camera if in webcam mode and task starts tracking
  useEffect(() => {
    if (isTracking && gazeSource === "webcam" && !isCameraActive) {
      globalWebcamManager.startCamera();
    }
  }, [isTracking, gazeSource, isCameraActive]);

  // Synchronized ~30 Hz sampling loop combining Webcam Gaze and Mouse Position
  useEffect(() => {
    if (!isTracking) return;

    // Reset initial gaze position to current gaze if available
    const initialGaze = useGazeStore.getState().currentGaze;
    if (initialGaze && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pt = windowNormToContainer(initialGaze.normX, initialGaze.normY, rect);
      const igx = Math.max(0, Math.min(rect.width, pt.x));
      const igy = Math.max(0, Math.min(rect.height, pt.y));
      lastGazePosRef.current = { x: igx, y: igy };
      setGazePos({ x: igx, y: igy });
    }

    const interval = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;

      const now = performance.now();
      const t = Math.max(0, now - taskStartTime);
      const rect = container.getBoundingClientRect();

      // Read current store state directly to avoid interval thrashing
      const storeState = useGazeStore.getState();
      const isCamActive = storeState.isCameraActive;
      const gaze = storeState.currentGaze;

      // 1. Calculate Webcam Gaze (if available)
      let gx = lastGazePosRef.current.x;
      let gy = lastGazePosRef.current.y;
      let confidence = 0.5;
      let isBlink = false;

      if (isCamActive && gaze) {
        const pt = windowNormToContainer(gaze.normX, gaze.normY, rect);
        gx = Math.max(0, Math.min(rect.width, pt.x));
        gy = Math.max(0, Math.min(rect.height, pt.y));
        confidence = gaze.confidence;
        isBlink = gaze.isBlink;

        // Compute gaze trajectory distance from previous gaze sample
        const dGx = gx - lastGazePosRef.current.x;
        const dGy = gy - lastGazePosRef.current.y;
        const stepDist = Math.hypot(dGx, dGy);

        // Only accumulate movement above microscopic sub-pixel noise
        if (stepDist > 0.5) {
          gazePathLengthRef.current += stepDist;
        }

        lastGazePosRef.current = { x: gx, y: gy };
        setGazePos({ x: gx, y: gy });
      }

      // 2. Calculate Mouse Position
      const mx = lastMousePosRef.current.x;
      const my = lastMousePosRef.current.y;

      // 3. Euclidean Distance between Gaze and Mouse
      const distancePx = Math.hypot(gx - mx, gy - my);

      // 4. Record Synchronized Sample
      const sample: SynchronizedSample = {
        t,
        gx,
        gy,
        confidence,
        mx,
        my,
        click: false,
        distance_px: distancePx,
      };
      synchronizedSamplesRef.current.push(sample);

      // 5. Emit unified point to task scan path & WebSocket
      const gazePoint: GazePoint = {
        x: gx,
        y: gy,
        t,
        event_type: "raw",
        source: isCamActive && gaze ? "webcam" : "mouse",
        gx,
        gy,
        mx,
        my,
        confidence,
        isBlink,
        distance_px: distancePx,
      };
      onGazeSample(gazePoint);

      // 6. Process Fixations and Saccades for Gaze
      if (isCamActive && gaze && !isBlink) {
        fixation.addPoint(gx, gy, t);
        saccadeDetectorRef.current?.addPoint(gx, gy, t);
      } else if (!isCamActive) {
        // Fallback: feed mouse coordinates to fixation when webcam is inactive
        fixation.addPoint(mx, my, t);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    isTracking,
    containerRef,
    taskStartTime,
    onGazeSample,
    fixation,
  ]);

  // Handle Mouse movement on container
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      // Update mouse trajectory length
      const dMx = mx - lastMousePosRef.current.x;
      const dMy = my - lastMousePosRef.current.y;
      mousePathLengthRef.current += Math.hypot(dMx, dMy);
      lastMousePosRef.current = { x: mx, y: my };
      setMousePos({ x: mx, y: my });

      if (!isCameraActive) {
        setGazePos({ x: mx, y: my });
      }
    },
    [containerRef, isCameraActive]
  );

  const handleMouseEnter = useCallback(() => setIsInside(true), []);
  const handleMouseLeave = useCallback(() => setIsInside(false), []);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isTracking) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const now = performance.now();
      const t = Math.max(0, now - taskStartTime);

      const gx = lastGazePosRef.current.x;
      const gy = lastGazePosRef.current.y;
      const dist = Math.hypot(gx - mx, gy - my);

      onGazeSample({
        x: mx,
        y: my,
        t,
        event_type: "mouse_click",
        source: "mouse",
        gx,
        gy,
        mx,
        my,
        click: true,
        distance_px: dist,
      });
    },
    [isTracking, containerRef, taskStartTime, onGazeSample]
  );

  // Compute Dual-Modality Comparison Analytics directly from the recorded sample trajectory
  const getDualModalityMetrics = useCallback((): DualModalityMetrics => {
    const samples = synchronizedSamplesRef.current;
    if (samples.length === 0) {
      return {
        avgGazeMouseDistancePx: 0,
        maxGazeMouseDistancePx: 0,
        gazePathLengthPx: 0,
        mousePathLengthPx: 0,
        gazeFixationCount: fixationCountRef.current,
        mousePauseCount: 0,
      };
    }

    let totalGazeDist = 0;
    let totalMouseDist = 0;
    const distances: number[] = [];

    for (let i = 0; i < samples.length; i++) {
      distances.push(samples[i].distance_px);
      if (i > 0) {
        const dGx = samples[i].gx - samples[i - 1].gx;
        const dGy = samples[i].gy - samples[i - 1].gy;
        totalGazeDist += Math.hypot(dGx, dGy);

        const dMx = samples[i].mx - samples[i - 1].mx;
        const dMy = samples[i].my - samples[i - 1].my;
        totalMouseDist += Math.hypot(dMx, dMy);
      }
    }

    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDist = Math.max(...distances);

    return {
      avgGazeMouseDistancePx: Math.round(avgDist),
      maxGazeMouseDistancePx: Math.round(maxDist),
      gazePathLengthPx: Math.round(totalGazeDist),
      mousePathLengthPx: Math.round(totalMouseDist),
      gazeFixationCount: fixationCountRef.current,
      mousePauseCount: Math.max(0, Math.round(samples.length / 30)),
    };
  }, []);

  return {
    gazePos,
    mousePos,
    gazeVisible: showGazeDot && (isCameraActive || isInside),
    fixationDurationMs: fixation.fixationDurationMs,
    isCameraActive,
    gazeSource,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
    handleContainerClick,
    handleMouseClick: handleContainerClick,
    resetTracking,
    resetFixation: resetTracking,
    getDualModalityMetrics,
    synchronizedSamples: synchronizedSamplesRef.current,
  };
}
