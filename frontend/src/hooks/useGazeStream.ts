import { useCallback, useEffect, useRef } from "react";
import type { GazePoint } from "@/types";

const FLUSH_INTERVAL_MS = 500;

/**
 * Buffers gaze points and streams them to the backend over a WebSocket.
 * Pass `sessionId = null` to stay disconnected.
 */
export function useGazeStream(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<GazePoint[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/gaze-stream/${sessionId}`);
    wsRef.current = ws;

    const flush = () => {
      if (bufferRef.current.length && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ points: bufferRef.current }));
        bufferRef.current = [];
      }
    };

    const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      flush();
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const push = useCallback((point: GazePoint) => {
    bufferRef.current.push(point);
  }, []);

  return push;
}
