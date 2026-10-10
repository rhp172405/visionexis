/**
 * MediaPipe FaceLandmarker Manager.
 * Initializes and manages camera stream and browser-side computer vision inference.
 * Raw video frames are processed transiently in memory and never stored or uploaded.
 */

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { extractEyeFeatures, type EyeLandmarkFeatures } from "./eyeFeatures";

export type CameraErrorType =
  | "permission_denied"
  | "not_found"
  | "in_use"
  | "unsupported"
  | "initialization_failed"
  | "unknown";

export interface CameraState {
  isStreaming: boolean;
  isLoading: boolean;
  faceDetected: boolean;
  eyesDetected: boolean;
  error: { type: CameraErrorType; message: string } | null;
  warning: string | null;
}

let landmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_ASSET = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Get or initialize the singleton FaceLandmarker model.
 */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerInstance) return landmarkerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET,
          delegate: "GPU",
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      landmarkerInstance = landmarker;
      return landmarker;
    } catch (err) {
      console.warn("GPU delegate failed, falling back to CPU delegate for FaceLandmarker", err);
      // Fallback to CPU delegate if GPU fails on older laptops
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET,
          delegate: "CPU",
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
      landmarkerInstance = landmarker;
      return landmarker;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Open laptop camera stream.
 */
export async function startCameraStream(
  videoElement: HTMLVideoElement,
  onStateChange?: (state: Partial<CameraState>) => void
): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const err = { type: "unsupported" as CameraErrorType, message: "Camera API is not supported in this browser." };
    onStateChange?.({ error: err, isStreaming: false, isLoading: false });
    throw new Error(err.message);
  }

  onStateChange?.({ isLoading: true, error: null, warning: null });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: "user",
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });

    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.muted = true;

    await new Promise<void>((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(() => resolve()).catch(() => resolve());
      };
    });

    onStateChange?.({ isStreaming: true, isLoading: false, error: null });
    return stream;
  } catch (err: unknown) {
    let errorType: CameraErrorType = "unknown";
    let message = "Unable to access laptop webcam.";

    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorType = "permission_denied";
        message = "Please allow camera access in your browser settings to use webcam eye tracking.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorType = "not_found";
        message = "No webcam found. Please connect or enable your laptop camera.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorType = "in_use";
        message = "Webcam is already in use by another application or tab.";
      }
    }

    onStateChange?.({ isStreaming: false, isLoading: false, error: { type: errorType, message } });
    throw new Error(message);
  }
}

/**
 * Stop camera stream and release all video tracks.
 */
export function stopCameraStream(
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null
): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (videoElement) {
    if (videoElement.srcObject) {
      const srcStream = videoElement.srcObject as MediaStream;
      srcStream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
  }
}

/**
 * Process a single video frame with FaceLandmarker and extract eye features.
 */
export function processVideoFrame(
  landmarker: FaceLandmarker,
  videoElement: HTMLVideoElement,
  timestampMs: number = performance.now()
): {
  features: EyeLandmarkFeatures | null;
  faceDetected: boolean;
  eyesDetected: boolean;
  rawLandmarks: import("./eyeFeatures").NormalizedLandmark[] | null;
} {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { features: null, faceDetected: false, eyesDetected: false, rawLandmarks: null };
  }

  try {
    const result = landmarker.detectForVideo(videoElement, timestampMs);
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return { features: null, faceDetected: false, eyesDetected: false, rawLandmarks: null };
    }

    const landmarks = result.faceLandmarks[0];
    const features = extractEyeFeatures(landmarks, timestampMs);

    return {
      features,
      faceDetected: true,
      eyesDetected: features !== null && !features.isBlink,
      rawLandmarks: landmarks,
    };
  } catch (err) {
    console.warn("Error processing video frame:", err);
    return { features: null, faceDetected: false, eyesDetected: false, rawLandmarks: null };
  }
}
