/**
 * VISIONEXIS Robust Webcam & MediaPipe Inference Manager.
 * Features:
 * - Concurrency processing lock (zero overlapping detect calls)
 * - Controlled 18-20 FPS inference budgeting
 * - Watchdog with automatic stream freeze recovery
 * - Tab visibility lifecycle management
 * - Batched Zustand state dispatching (zero React main-thread saturation)
 * - Comprehensive real-time health telemetry diagnostics
 */

import { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  getFaceLandmarker,
  startCameraStream,
  stopCameraStream,
  processVideoFrame,
  type CameraErrorType,
} from "./faceLandmarker";
import { estimateGazeNorm } from "./calibration";
import { Gaze2DFilter } from "./oneEuroFilter";
import { useGazeStore } from "@/stores/gazeStore";

const TARGET_FPS = 20; // 20 FPS ensures ~50ms frame intervals, avoiding CPU/GPU saturation
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const WATCHDOG_INTERVAL_MS = 1000;
const STALL_TIMEOUT_MS = 2000;
const MAX_RECOVERY_ATTEMPTS = 3;

class WebcamManager {
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private landmarker: FaceLandmarker | null = null;
  private animFrameId: number | null = null;
  private watchdogTimerId: number | null = null;

  // Lifecycle & Concurrency Guards
  private isInitializing: boolean = false;
  private isProcessingFrame: boolean = false;
  private isRecovering: boolean = false;
  private isTabHidden: boolean = false;
  private recoveryAttempts: number = 0;

  // Performance & Timing Metrics
  private lastFrameTime: number = 0;
  private lastSuccessfulInferenceTime: number = 0;
  private lastMonotonicTimestamp: number = 0;
  private frameCount: number = 0;
  private cameraFrameCount: number = 0;
  private droppedFrameCount: number = 0;
  private lastMetricsCalcTime: number = 0;
  private currentInferenceFps: number = 0;
  private currentCameraFps: number = 0;
  private currentInferenceTimeMs: number = 0;
  private lastValidGazeX: number = 0.5;
  private lastValidGazeY: number = 0.5;

  private filter: Gaze2DFilter = new Gaze2DFilter({ minCutoff: 0.8, beta: 0.008 });

  constructor() {
    if (typeof window !== "undefined") {
      const vid = document.createElement("video");
      vid.setAttribute("playsinline", "true");
      vid.setAttribute("muted", "true");
      vid.style.position = "fixed";
      vid.style.top = "-9999px";
      vid.style.left = "-9999px";
      vid.style.width = "640px";
      vid.style.height = "480px";
      vid.style.opacity = "0";
      vid.style.pointerEvents = "none";
      document.body.appendChild(vid);
      this.videoElement = vid;

      // Handle Tab Visibility
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public async startCamera(): Promise<MediaStream | null> {
    if (this.mediaStream && this.mediaStream.active) {
      return this.mediaStream;
    }

    if (this.isInitializing) return null;
    this.isInitializing = true;

    // Clean up any stale state first
    this.stopCamera();

    const store = useGazeStore.getState();
    store.setCameraState({ isLoadingCamera: true, cameraError: null, cameraWarning: null });
    store.setPipelineHealth({
      cameraStatus: "RECOVERING",
      streamStatus: "INACTIVE",
      videoStatus: "WAITING",
      processingStatus: "IDLE",
    });

    try {
      if (!this.videoElement) {
        this.videoElement = document.createElement("video");
        this.videoElement.setAttribute("playsinline", "true");
        this.videoElement.setAttribute("muted", "true");
        document.body.appendChild(this.videoElement);
      }

      // 1. Initialize FaceLandmarker singleton
      this.landmarker = await getFaceLandmarker();

      // 2. Request webcam access
      const stream = await startCameraStream(this.videoElement, (st) => {
        store.setCameraState(st);
      });
      this.mediaStream = stream;

      const resolution =
        this.videoElement.videoWidth > 0
          ? `${this.videoElement.videoWidth} × ${this.videoElement.videoHeight}`
          : "1280 × 720";

      store.setCameraState({
        isCameraActive: true,
        isLoadingCamera: false,
        cameraError: null,
      });
      store.setPipelineHealth({
        cameraStatus: "CONNECTED",
        streamStatus: "ACTIVE",
        videoStatus: "PLAYING",
        resolution,
        processingStatus: "RUNNING",
      });

      // 3. Reset filters & start persistent loops
      this.filter.reset();
      this.frameCount = 0;
      this.cameraFrameCount = 0;
      this.droppedFrameCount = 0;
      this.recoveryAttempts = 0;
      this.lastFrameTime = performance.now();
      this.lastSuccessfulInferenceTime = performance.now();
      this.lastMetricsCalcTime = performance.now();
      this.lastMonotonicTimestamp = 0;

      this.startInferenceLoop();
      this.startWatchdog();

      return stream;
    } catch (err: unknown) {
      this.stopCamera();
      const message = err instanceof Error ? err.message : "Failed to access webcam.";
      store.setCameraState({
        isLoadingCamera: false,
        isCameraActive: false,
        cameraError: { type: "initialization_failed" as CameraErrorType, message },
      });
      store.setPipelineHealth({
        cameraStatus: "DISCONNECTED",
        streamStatus: "INACTIVE",
        videoStatus: "PAUSED",
        processingStatus: "IDLE",
      });
      return null;
    } finally {
      this.isInitializing = false;
    }
  }

  public stopCamera(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.watchdogTimerId !== null) {
      clearInterval(this.watchdogTimerId);
      this.watchdogTimerId = null;
    }

    stopCameraStream(this.videoElement, this.mediaStream);
    this.mediaStream = null;
    this.filter.reset();
    this.lastValidGazeX = 0.5;
    this.lastValidGazeY = 0.5;
    this.isProcessingFrame = false;
    this.isRecovering = false;

    const store = useGazeStore.getState();
    store.setCameraState({
      isCameraActive: false,
      isLoadingCamera: false,
      faceDetected: false,
      eyesDetected: false,
      fps: 0,
      cameraWarning: null,
    });
    store.setPipelineHealth({
      cameraStatus: "DISCONNECTED",
      streamStatus: "INACTIVE",
      videoStatus: "PAUSED",
      processingStatus: "IDLE",
      inferenceFps: 0,
      cameraFps: 0,
      lastFrameAgeSec: 0,
    });
    store.updateGaze(null);
    store.setLastFeatures(null);
    store.setRawLandmarks(null);
  }

  private startInferenceLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }

    const loop = (now: number) => {
      if (!this.mediaStream || !this.mediaStream.active || !this.videoElement || !this.landmarker) {
        return;
      }

      this.cameraFrameCount++;

      // Controlled Frame Rate Throttle (~20 FPS) & Concurrency Lock
      if (now - this.lastFrameTime >= FRAME_INTERVAL_MS) {
        if (!this.isProcessingFrame && !this.isTabHidden) {
          this.isProcessingFrame = true;
          this.lastFrameTime = now;
          this.frameCount++;

          const startTime = performance.now();

          // Calculate Rolling Metrics every 1000ms
          if (now - this.lastMetricsCalcTime >= 1000) {
            const dt = (now - this.lastMetricsCalcTime) / 1000;
            this.currentInferenceFps = Math.round(this.frameCount / dt);
            this.currentCameraFps = Math.round(this.cameraFrameCount / dt);
            this.frameCount = 0;
            this.cameraFrameCount = 0;
            this.lastMetricsCalcTime = now;
          }

          // Verify Video Readiness
          if (
            this.videoElement.readyState >= 2 && // HAVE_CURRENT_DATA
            this.videoElement.videoWidth > 0 &&
            this.videoElement.videoHeight > 0
          ) {
            try {
              // Ensure strictly monotonic timestamp for MediaPipe WASM
              const inferenceTimestamp = Math.max(now, this.lastMonotonicTimestamp + 1);
              this.lastMonotonicTimestamp = inferenceTimestamp;

              const { features, faceDetected, eyesDetected, rawLandmarks } = processVideoFrame(
                this.landmarker,
                this.videoElement,
                inferenceTimestamp
              );

              this.currentInferenceTimeMs = Math.round(performance.now() - startTime);

              if (faceDetected) {
                this.lastSuccessfulInferenceTime = now;
              }

              const store = useGazeStore.getState();
              let gazeResult: { normX: number; normY: number; confidence: number; timestamp: number; isBlink: boolean } | null = null;

              if (features) {
                if (features.isBlink) {
                  store.recordBlink(now);
                }

                // Dual-Axis Ridge Regression Gaze Estimation
                let smoothedNormX = this.lastValidGazeX;
                let smoothedNormY = this.lastValidGazeY;

                if (!features.isBlink) {
                  const rawGaze = estimateGazeNorm(features, store.calibrationModel);
                  const smoothed = this.filter.filter(rawGaze.normX, rawGaze.normY, now);
                  smoothedNormX = smoothed.x;
                  smoothedNormY = smoothed.y;
                  this.lastValidGazeX = smoothedNormX;
                  this.lastValidGazeY = smoothedNormY;
                }

                let dynamicConfidence = features.isBlink ? 0.15 : features.confidence;
                if (store.calibrationModel && !features.isBlink) {
                  dynamicConfidence = (dynamicConfidence + store.calibrationModel.qualityScore / 100) / 2;
                }

                gazeResult = {
                  normX: smoothedNormX,
                  normY: smoothedNormY,
                  confidence: dynamicConfidence,
                  timestamp: now,
                  isBlink: features.isBlink,
                };
              }

              const resolution = `${this.videoElement.videoWidth} × ${this.videoElement.videoHeight}`;
              const lastFrameAgeSec = Number(((now - this.lastSuccessfulInferenceTime) / 1000).toFixed(2));

              // Unified Batched State Update (Zero React UI starvation)
              store.batchUpdateTracking({
                gaze: gazeResult,
                features: features ?? null,
                rawLandmarks: rawLandmarks ?? null,
                faceDetected,
                eyesDetected,
                cameraWarning: !faceDetected
                  ? "Face not detected. Keep your face centered in camera view."
                  : !eyesDetected
                  ? "Eyes obscured or closed. Ensure good lighting."
                  : null,
                pipelineHealth: {
                  cameraStatus: "CONNECTED",
                  streamStatus: "ACTIVE",
                  videoStatus: "PLAYING",
                  resolution,
                  processingStatus: "RUNNING",
                  inferenceFps: this.currentInferenceFps,
                  cameraFps: this.currentCameraFps,
                  inferenceTimeMs: this.currentInferenceTimeMs,
                  droppedFrames: this.droppedFrameCount,
                  lastSuccessfulInferenceTime: this.lastSuccessfulInferenceTime,
                  lastFrameAgeSec,
                },
              });
            } catch (frameErr) {
              this.droppedFrameCount++;
              console.warn("Recoverable frame inference error:", frameErr);
            } finally {
              this.isProcessingFrame = false;
            }
          } else {
            this.droppedFrameCount++;
            this.isProcessingFrame = false;
          }
        } else if (this.isProcessingFrame) {
          this.droppedFrameCount++;
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private startWatchdog(): void {
    if (this.watchdogTimerId !== null) {
      clearInterval(this.watchdogTimerId);
    }

    this.watchdogTimerId = window.setInterval(() => {
      if (!this.mediaStream || !this.mediaStream.active || this.isRecovering || this.isTabHidden) {
        return;
      }

      const now = performance.now();
      const elapsedSinceLastFrame = now - this.lastSuccessfulInferenceTime;

      // Detect Freeze / Stall Condition
      if (elapsedSinceLastFrame > STALL_TIMEOUT_MS) {
        const store = useGazeStore.getState();
        store.setPipelineHealth({
          processingStatus: "STALLED",
          cameraStatus: "RECOVERING",
          lastFrameAgeSec: Number((elapsedSinceLastFrame / 1000).toFixed(1)),
        });

        if (this.recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
          this.recoveryAttempts++;
          console.warn(`Watchdog detected stalled pipeline (${elapsedSinceLastFrame}ms). Initiating auto-recovery attempt ${this.recoveryAttempts}...`);
          this.attemptPipelineRecovery();
        } else {
          console.error("Max recovery attempts reached. Halting automatic recovery.");
          store.setCameraState({
            cameraWarning: "Camera stream stalled. Click Stop Camera and Start Camera to reset.",
          });
        }
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  private async attemptPipelineRecovery(): Promise<void> {
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      // 1. Cancel active animation frame
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      // 2. Re-verify video element & media stream tracks
      if (this.mediaStream) {
        const tracks = this.mediaStream.getVideoTracks();
        const anyDead = tracks.some((t) => t.readyState === "ended" || !t.enabled);
        if (anyDead && this.videoElement) {
          stopCameraStream(this.videoElement, this.mediaStream);
          this.mediaStream = await startCameraStream(this.videoElement);
        } else if (this.videoElement && (this.videoElement.paused || this.videoElement.ended)) {
          await this.videoElement.play().catch(() => {});
        }
      }

      // 3. Reset processing locks and filters
      this.isProcessingFrame = false;
      this.filter.reset();
      this.lastFrameTime = performance.now();
      this.lastSuccessfulInferenceTime = performance.now();

      // 4. Resume inference loop
      this.startInferenceLoop();
    } catch (recErr) {
      console.error("Automatic pipeline recovery failed:", recErr);
    } finally {
      this.isRecovering = false;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.isTabHidden = true;
      const store = useGazeStore.getState();
      store.setPipelineHealth({ processingStatus: "PAUSED" });
    } else {
      this.isTabHidden = false;
      if (this.mediaStream && this.mediaStream.active) {
        this.lastFrameTime = performance.now();
        this.lastSuccessfulInferenceTime = performance.now();
        this.startInferenceLoop();
      }
    }
  };
}

export const globalWebcamManager = new WebcamManager();
