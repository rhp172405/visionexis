/**
 * Hook to manage Webcam Eye-Tracking lifecycle and continuous landmark inference.
 * Delegates to globalWebcamManager to ensure continuous tracking across page and task transitions.
 */

import { useCallback, useEffect, useRef } from "react";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";

export function useWebcamTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    gazeSource,
    calibrationModel,
    isCameraActive,
    isLoadingCamera,
    cameraError,
    cameraWarning,
    faceDetected,
    eyesDetected,
    lastFeatures,
    currentGaze,
  } = useGazeStore();

  const start = useCallback(async () => {
    const stream = await globalWebcamManager.startCamera();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const stop = useCallback(() => {
    globalWebcamManager.stopCamera();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Sync video element with active stream if videoRef is attached
  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      const stream = globalWebcamManager.getMediaStream();
      if (stream && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isCameraActive]);

  return {
    videoRef,
    isCameraActive,
    isLoadingCamera,
    cameraError,
    cameraWarning,
    faceDetected,
    eyesDetected,
    lastFeatures,
    currentGaze,
    calibrationModel,
    start,
    stop,
    gazeSource,
  };
}

