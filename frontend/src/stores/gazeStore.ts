/**
 * Global Gaze & Eye-Tracking Zustand Store.
 * Manages webcam state, gaze source (Webcam vs Mouse), calibration status, live gaze coordinates,
 * and debug visualization toggles.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CalibrationModel,
  loadCalibrationModel,
  saveCalibrationModel,
  clearCalibrationModel,
} from "@/lib/webcam/calibration";
import type { CameraErrorType } from "@/lib/webcam/faceLandmarker";
import type { EyeLandmarkFeatures, NormalizedLandmark } from "@/lib/webcam/eyeFeatures";

export type GazeSource = "webcam" | "mouse";

export interface LiveGazeState {
  normX: number; // 0.0 to 1.0 (screen proportion)
  normY: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  timestamp: number;
  isBlink: boolean;
}

export interface PipelineHealth {
  cameraStatus: "CONNECTED" | "DISCONNECTED" | "RECOVERING";
  streamStatus: "ACTIVE" | "INACTIVE";
  videoStatus: "PLAYING" | "PAUSED" | "WAITING";
  resolution: string;
  processingStatus: "RUNNING" | "STALLED" | "PAUSED" | "IDLE";
  inferenceFps: number;
  cameraFps: number;
  inferenceTimeMs: number;
  droppedFrames: number;
  lastSuccessfulInferenceTime: number;
  lastFrameAgeSec: number;
}

interface GazeStoreState {
  // Source selection: "webcam" is primary, "mouse" is fallback/demo
  gazeSource: GazeSource;
  showGazeDot: boolean;
  debugOverlayOpen: boolean;

  // Webcam tracking status
  isCameraActive: boolean;
  isLoadingCamera: boolean;
  faceDetected: boolean;
  eyesDetected: boolean;
  fps: number;
  cameraError: { type: CameraErrorType; message: string } | null;
  cameraWarning: string | null;

  // Real-time Pipeline Health Metrics
  pipelineHealth: PipelineHealth;

  // Calibration state
  calibrationModel: CalibrationModel | null;
  isCalibrated: boolean;
  calibrationModalOpen: boolean;

  // Real-time gaze coordinates & extracted features
  currentGaze: LiveGazeState | null;
  lastFeatures: EyeLandmarkFeatures | null;
  rawLandmarks: NormalizedLandmark[] | null;
  gazeHistory: LiveGazeState[];

  // Live session eye metrics
  blinkCount: number;
  saccadeCount: number;
  lastBlinkTime: number;

  // Actions
  setGazeSource: (source: GazeSource) => void;
  setShowGazeDot: (show: boolean) => void;
  setDebugOverlayOpen: (open: boolean) => void;
  setCalibrationModalOpen: (open: boolean) => void;
  setCalibrationModel: (model: CalibrationModel | null) => void;
  setCameraState: (state: Partial<{
    isCameraActive: boolean;
    isLoadingCamera: boolean;
    faceDetected: boolean;
    eyesDetected: boolean;
    fps: number;
    cameraError: { type: CameraErrorType; message: string } | null;
    cameraWarning: string | null;
  }>) => void;
  setPipelineHealth: (health: Partial<PipelineHealth>) => void;
  batchUpdateTracking: (payload: {
    gaze: LiveGazeState | null;
    features: EyeLandmarkFeatures | null;
    rawLandmarks?: NormalizedLandmark[] | null;
    faceDetected: boolean;
    eyesDetected: boolean;
    cameraWarning?: string | null;
    pipelineHealth?: Partial<PipelineHealth>;
  }) => void;
  updateGaze: (gaze: LiveGazeState | null) => void;
  setLastFeatures: (features: EyeLandmarkFeatures | null) => void;
  setRawLandmarks: (landmarks: NormalizedLandmark[] | null) => void;
  recordBlink: (t: number) => void;
  recordSaccade: () => void;
  resetGazeMetrics: () => void;
  clearCalibration: () => void;
}

const DEFAULT_HEALTH: PipelineHealth = {
  cameraStatus: "DISCONNECTED",
  streamStatus: "INACTIVE",
  videoStatus: "WAITING",
  resolution: "—",
  processingStatus: "IDLE",
  inferenceFps: 0,
  cameraFps: 0,
  inferenceTimeMs: 0,
  droppedFrames: 0,
  lastSuccessfulInferenceTime: 0,
  lastFrameAgeSec: 0,
};

const savedModel = loadCalibrationModel();

export const useGazeStore = create<GazeStoreState>()(
  persist(
    (set, get) => ({
      gazeSource: "webcam",
      showGazeDot: true,
      debugOverlayOpen: false,

      isCameraActive: false,
      isLoadingCamera: false,
      faceDetected: false,
      eyesDetected: false,
      fps: 0,
      cameraError: null,
      cameraWarning: null,

      pipelineHealth: DEFAULT_HEALTH,

      calibrationModel: savedModel,
      isCalibrated: savedModel !== null,
      calibrationModalOpen: false,

      currentGaze: null,
      lastFeatures: null,
      rawLandmarks: null,
      gazeHistory: [],

      blinkCount: 0,
      saccadeCount: 0,
      lastBlinkTime: 0,

      setGazeSource: (gazeSource) => set({ gazeSource }),
      setShowGazeDot: (showGazeDot) => set({ showGazeDot }),
      setDebugOverlayOpen: (debugOverlayOpen) => set({ debugOverlayOpen }),
      setCalibrationModalOpen: (calibrationModalOpen) => set({ calibrationModalOpen }),

      setCalibrationModel: (model) => {
        if (model) {
          saveCalibrationModel(model);
          set({ calibrationModel: model, isCalibrated: true });
        } else {
          clearCalibrationModel();
          set({ calibrationModel: null, isCalibrated: false });
        }
      },

      setCameraState: (state) => set((prev) => ({ ...prev, ...state })),

      setPipelineHealth: (health) =>
        set((prev) => ({ pipelineHealth: { ...prev.pipelineHealth, ...health } })),

      batchUpdateTracking: ({ gaze, features, rawLandmarks, faceDetected, eyesDetected, cameraWarning, pipelineHealth }) =>
        set((state) => {
          const nextHealth = pipelineHealth ? { ...state.pipelineHealth, ...pipelineHealth } : state.pipelineHealth;
          const nextHistory = gaze ? [gaze, ...state.gazeHistory].slice(0, 30) : state.gazeHistory;
          return {
            currentGaze: gaze,
            lastFeatures: features,
            rawLandmarks: rawLandmarks !== undefined ? rawLandmarks : state.rawLandmarks,
            faceDetected,
            eyesDetected,
            cameraWarning: cameraWarning !== undefined ? cameraWarning : state.cameraWarning,
            pipelineHealth: nextHealth,
            gazeHistory: nextHistory,
            fps: nextHealth.inferenceFps,
          };
        }),

      updateGaze: (gaze) =>
        set((state) => ({
          currentGaze: gaze,
          gazeHistory: gaze ? [gaze, ...state.gazeHistory].slice(0, 30) : state.gazeHistory,
        })),

      setLastFeatures: (features) => set({ lastFeatures: features }),
      setRawLandmarks: (rawLandmarks) => set({ rawLandmarks }),

      recordBlink: (t) => {
        const last = get().lastBlinkTime;
        // Debounce blinks within 200ms
        if (t - last > 200) {
          set((state) => ({
            blinkCount: state.blinkCount + 1,
            lastBlinkTime: t,
          }));
        }
      },

      recordSaccade: () => {
        set((state) => ({ saccadeCount: state.saccadeCount + 1 }));
      },

      resetGazeMetrics: () => {
        set({ blinkCount: 0, saccadeCount: 0, lastBlinkTime: 0 });
      },

      clearCalibration: () => {
        clearCalibrationModel();
        set({ calibrationModel: null, isCalibrated: false });
      },
    }),
    {
      name: "visionexis_gaze_settings",
      partialize: (state) => ({
        gazeSource: state.gazeSource,
        showGazeDot: state.showGazeDot,
        debugOverlayOpen: state.debugOverlayOpen,
      }),
    }
  )
);

