import { useCallback, useEffect, useRef } from "react";
import type { GazePoint } from "@/types";
import { api } from "@/lib/api";

const FLUSH_INTERVAL_MS = 500;

/**
 * Buffers gaze points and streams them to the backend over a WebSocket.
 * Uses a short-lived, session-bound WebSocket ticket to avoid long-lived bearer tokens in query strings.
 * Pass `sessionId = null` to stay disconnected.
 */
export function useGazeStream(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<GazePoint[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let interval: number | null = null;

    const apiUrl = import.meta.env.VITE_API_URL || "";
    let wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = window.location.host;

    if (apiUrl) {
      try {
        const parsed = new URL(apiUrl);
        wsHost = parsed.host;
        wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      } catch {}
    }

    const connect = async () => {
      let queryParam = "";
      try {
        // Request short-lived single-use WebSocket ticket from backend
        const { data } = await api.post<{ ticket: string }>(`/sessions/${sessionId}/ws-ticket`);
        if (data?.ticket) {
          queryParam = `?ticket=${encodeURIComponent(data.ticket)}`;
        }
      } catch {
        // Fallback for offline development or direct unauthenticated local mode
        const apiKey = import.meta.env.VITE_API_KEY || "";
        if (apiKey) {
          queryParam = `?token=${encodeURIComponent(apiKey.trim())}`;
        }
      }

      if (isDisposed) return;

      ws = new WebSocket(`${wsProtocol}//${wsHost}/gaze-stream/${sessionId}${queryParam}`);
      wsRef.current = ws;

      const flush = () => {
        if (bufferRef.current.length && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ points: bufferRef.current }));
          bufferRef.current = [];
        }
      };

      interval = window.setInterval(flush, FLUSH_INTERVAL_MS);
    };

    connect();

    return () => {
      isDisposed = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
      if (ws) {
        if (bufferRef.current.length && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ points: bufferRef.current }));
          bufferRef.current = [];
        }
        ws.close();
      }
      wsRef.current = null;
    };
  }, [sessionId]);

  const push = useCallback((point: GazePoint) => {
    bufferRef.current.push(point);
  }, []);

  return push;
}

