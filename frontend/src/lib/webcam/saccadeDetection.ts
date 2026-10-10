/**
 * Saccade Detection using velocity and displacement thresholds.
 * Detects rapid ballistic eye movements between fixations.
 */

import type { GazePoint } from "@/types";

export interface SaccadeEvent {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  amplitudePx: number;
  velocityPxPerSec: number;
}

export interface SaccadeConfig {
  minVelocityPxPerSec: number; // e.g. 250 px/s
  minAmplitudePx: number;      // e.g. 25 px
  minDurationMs: number;       // e.g. 15 ms
  maxDurationMs: number;       // e.g. 150 ms
}

export const DEFAULT_SACCADE_CONFIG: SaccadeConfig = {
  minVelocityPxPerSec: 250,
  minAmplitudePx: 25,
  minDurationMs: 15,
  maxDurationMs: 150,
};

export class SaccadeDetector {
  private config: SaccadeConfig;
  private onSaccade: (event: SaccadeEvent, gazePoint: GazePoint) => void;
  private prevPoint: { x: number; y: number; t: number } | null = null;
  private inSaccade = false;
  private saccadeStart: { x: number; y: number; t: number } | null = null;
  private peakVelocity = 0;

  constructor(
    onSaccade: (event: SaccadeEvent, gazePoint: GazePoint) => void,
    config: Partial<SaccadeConfig> = {}
  ) {
    this.onSaccade = onSaccade;
    this.config = { ...DEFAULT_SACCADE_CONFIG, ...config };
  }

  addPoint(x: number, y: number, t: number): void {
    if (!this.prevPoint) {
      this.prevPoint = { x, y, t };
      return;
    }

    const dt = (t - this.prevPoint.t) / 1000.0; // in seconds
    if (dt <= 0.001) return;

    const dx = x - this.prevPoint.x;
    const dy = y - this.prevPoint.y;
    const dist = Math.hypot(dx, dy);
    const velocity = dist / dt;

    if (velocity >= this.config.minVelocityPxPerSec) {
      if (!this.inSaccade) {
        this.inSaccade = true;
        this.saccadeStart = { ...this.prevPoint };
        this.peakVelocity = velocity;
      } else {
        if (velocity > this.peakVelocity) {
          this.peakVelocity = velocity;
        }
      }
    } else {
      if (this.inSaccade && this.saccadeStart) {
        const duration = t - this.saccadeStart.t;
        const totalDx = x - this.saccadeStart.x;
        const totalDy = y - this.saccadeStart.y;
        const amplitude = Math.hypot(totalDx, totalDy);

        if (
          duration >= this.config.minDurationMs &&
          duration <= this.config.maxDurationMs &&
          amplitude >= this.config.minAmplitudePx
        ) {
          const saccadeEvent: SaccadeEvent = {
            startX: this.saccadeStart.x,
            startY: this.saccadeStart.y,
            endX: x,
            endY: y,
            startTime: this.saccadeStart.t,
            endTime: t,
            durationMs: duration,
            amplitudePx: amplitude,
            velocityPxPerSec: amplitude / (duration / 1000.0),
          };

          const gazePoint: GazePoint = {
            x,
            y,
            t: this.saccadeStart.t,
            event_type: "saccade",
            duration_ms: duration,
          };

          this.onSaccade(saccadeEvent, gazePoint);
        }

        this.inSaccade = false;
        this.saccadeStart = null;
        this.peakVelocity = 0;
      }
    }

    this.prevPoint = { x, y, t };
  }

  reset(): void {
    this.prevPoint = null;
    this.inSaccade = false;
    this.saccadeStart = null;
    this.peakVelocity = 0;
  }
}
