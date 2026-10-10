/**
 * VISIONEXIS Gaze Event Infrastructure.
 * Provides modular event detectors for:
 * - Fixations (spatial dispersion & duration thresholds)
 * - Saccades (ballistic velocity & amplitude thresholds)
 * - Blinks (eye aspect ratio / openness drops)
 * - Raw Gaze Data Buffer with monotonic performance.now() timestamps
 * - Generic Task Event Markers system for synchronized experiment tracking
 *
 * NOTE: These are experimental eye-movement metrics and gaze-event infrastructure,
 * NOT intended as clinical or medical diagnostic indicators.
 */

export interface RawGazeBufferSample {
  timestamp: number; // high-resolution monotonic performance.now()
  gazeX: number; // in viewport px
  gazeY: number; // in viewport px
  normalizedX: number; // 0.0 to 1.0
  normalizedY: number; // 0.0 to 1.0
  confidence: number;
  leftRelativeX: number;
  leftRelativeY: number;
  rightRelativeX: number;
  rightRelativeY: number;
  eyeOpenness: number; // mean EAR
  blink: boolean;
}

export interface FixationEvent {
  id: string;
  fixationStart: number;
  fixationEnd: number;
  startTime?: number;
  endTime?: number;
  duration: number; // in ms
  meanX: number; // in px
  meanY: number; // in px
  dispersion: number; // max euclidean distance in px
  confidence: number;
  aoiId?: string;
}

export interface SaccadeEvent {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  endTime: number;
  duration: number; // in ms
  amplitude: number; // in px
  direction: number; // in radians (-PI to PI)
  velocity: number; // in px/sec
}

export interface BlinkEvent {
  id: string;
  blinkStart: number;
  blinkEnd: number;
  blinkDuration: number; // in ms
}

export type TaskEventType =
  | "TASK_START"
  | "TASK_END"
  | "TRIAL_START"
  | "TRIAL_END"
  | "TARGET_APPEAR"
  | "TARGET_DISAPPEAR"
  | "TARGET_CLICK"
  | "TARGET_SELECTED"
  | "FIRST_GAZE_ON_GRID"
  | "FIRST_FIXATION"
  | "TARGET_FIXATION"
  | "QUESTION_START"
  | "QUESTION_END"
  | "RESPONSE_START"
  | "RESPONSE_END"
  | "SESSION_START"
  | "STUDY_START"
  | "STUDY_ITEM_APPEAR"
  | "STUDY_ITEM_END"
  | "RETENTION_START"
  | "RETENTION_END"
  | "RECOGNITION_START"
  | "RECOGNITION_ITEM_APPEAR"
  | "FIRST_GAZE_ON_AOI"
  | "MOUSE_RESPONSE"
  | "RECOGNITION_ITEM_END"
  | "RECOGNITION_END"
  | "SESSION_END"
  | "READING_START"
  | "PASSAGE_APPEAR"
  | "FIRST_GAZE_ON_PASSAGE"
  | "LINE_ENTER"
  | "LINE_EXIT"
  | "WORD_ENTER"
  | "WORD_EXIT"
  | "FIXATION_START"
  | "FIXATION_END"
  | "SACCADE"
  | "READING_END"
  | "QUESTION_APPEAR"
  | "READING_SESSION_END"
  | "CUSTOM";

export interface TaskEventRecord {
  id: string;
  eventType: TaskEventType;
  timestamp: number; // monotonic performance.now()
  targetId?: string | number;
  targetX?: number;
  targetY?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Fixation Detector (Dispersion-Threshold Identification)
// ---------------------------------------------------------------------------

export interface FixationDetectorConfig {
  maxDispersionPx: number; // max radius/dispersion allowed within fixation (default: 40px)
  minDurationMs: number; // minimum duration to qualify as fixation (default: 100ms)
  minConfidence: number; // minimum confidence threshold (default: 0.40)
}

export const DEFAULT_FIXATION_CONFIG: FixationDetectorConfig = {
  maxDispersionPx: 40,
  minDurationMs: 100,
  minConfidence: 0.40,
};

export class FixationDetector {
  private config: FixationDetectorConfig;
  private windowSamples: { x: number; y: number; t: number; conf: number }[] = [];
  private onFixation?: (fixation: FixationEvent) => void;
  private fixationCounter = 0;

  constructor(
    onFixation?: (fixation: FixationEvent) => void,
    config?: Partial<FixationDetectorConfig>
  ) {
    this.onFixation = onFixation;
    this.config = { ...DEFAULT_FIXATION_CONFIG, ...config };
  }

  public addSample(x: number, y: number, timestamp: number, confidence: number, isBlink: boolean): FixationEvent | null {
    if (isBlink || confidence < this.config.minConfidence) {
      return this.flushWindow();
    }

    this.windowSamples.push({ x, y, t: timestamp, conf: confidence });

    // Check dispersion of current window
    const xs = this.windowSamples.map((s) => s.x);
    const ys = this.windowSamples.map((s) => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dispersion = Math.hypot(maxX - minX, maxY - minY);

    if (dispersion > this.config.maxDispersionPx) {
      // Window broke dispersion threshold -> emit previous candidate if valid
      const event = this.flushWindow();
      // Start new window with the latest sample
      this.windowSamples = [{ x, y, t: timestamp, conf: confidence }];
      return event;
    }

    return null;
  }

  public flushWindow(): FixationEvent | null {
    if (this.windowSamples.length < 2) {
      this.windowSamples = [];
      return null;
    }

    const startTime = this.windowSamples[0].t;
    const endTime = this.windowSamples[this.windowSamples.length - 1].t;
    const duration = endTime - startTime;

    if (duration >= this.config.minDurationMs) {
      const sumX = this.windowSamples.reduce((acc, s) => acc + s.x, 0);
      const sumY = this.windowSamples.reduce((acc, s) => acc + s.y, 0);
      const sumConf = this.windowSamples.reduce((acc, s) => acc + s.conf, 0);
      const n = this.windowSamples.length;

      const xs = this.windowSamples.map((s) => s.x);
      const ys = this.windowSamples.map((s) => s.y);
      const dispersion = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

      this.fixationCounter++;
      const fixation: FixationEvent = {
        id: `fix_${this.fixationCounter}_${Math.round(startTime)}`,
        fixationStart: startTime,
        fixationEnd: endTime,
        startTime,
        endTime,
        duration: Math.round(duration),
        meanX: Math.round(sumX / n),
        meanY: Math.round(sumY / n),
        dispersion: Math.round(dispersion),
        confidence: Number((sumConf / n).toFixed(2)),
      };

      if (this.onFixation) {
        this.onFixation(fixation);
      }
      this.windowSamples = [];
      return fixation;
    }

    this.windowSamples = [];
    return null;
  }

  public reset(): void {
    this.windowSamples = [];
  }
}

// ---------------------------------------------------------------------------
// Saccade Detector (Velocity & Amplitude Identification)
// ---------------------------------------------------------------------------

export interface SaccadeDetectorConfig {
  minVelocityPxPerSec: number; // velocity threshold to initiate saccade (default: 220 px/s)
  minAmplitudePx: number; // minimum distance (default: 20 px)
  minDurationMs: number; // minimum duration (default: 15 ms)
  maxDurationMs: number; // maximum duration (default: 180 ms)
}

export const DEFAULT_SACCADE_DETECTOR_CONFIG: SaccadeDetectorConfig = {
  minVelocityPxPerSec: 220,
  minAmplitudePx: 20,
  minDurationMs: 15,
  maxDurationMs: 180,
};

export class ModularSaccadeDetector {
  private config: SaccadeDetectorConfig;
  private onSaccade?: (saccade: SaccadeEvent) => void;
  private prevPoint: { x: number; y: number; t: number } | null = null;
  private inSaccade = false;
  private saccadeStart: { x: number; y: number; t: number } | null = null;
  private saccadeCounter = 0;

  constructor(
    onSaccade?: (saccade: SaccadeEvent) => void,
    config?: Partial<SaccadeDetectorConfig>
  ) {
    this.onSaccade = onSaccade;
    this.config = { ...DEFAULT_SACCADE_DETECTOR_CONFIG, ...config };
  }

  public addSample(x: number, y: number, timestamp: number): SaccadeEvent | null {
    if (!this.prevPoint) {
      this.prevPoint = { x, y, t: timestamp };
      return null;
    }

    const dt = (timestamp - this.prevPoint.t) / 1000.0;
    if (dt <= 0.001) return null;

    const dx = x - this.prevPoint.x;
    const dy = y - this.prevPoint.y;
    const dist = Math.hypot(dx, dy);
    const velocity = dist / dt;

    let emittedEvent: SaccadeEvent | null = null;

    if (velocity >= this.config.minVelocityPxPerSec) {
      if (!this.inSaccade) {
        this.inSaccade = true;
        this.saccadeStart = { ...this.prevPoint };
      }
    } else {
      if (this.inSaccade && this.saccadeStart) {
        const duration = timestamp - this.saccadeStart.t;
        const totalDx = x - this.saccadeStart.x;
        const totalDy = y - this.saccadeStart.y;
        const amplitude = Math.hypot(totalDx, totalDy);

        if (
          duration >= this.config.minDurationMs &&
          duration <= this.config.maxDurationMs &&
          amplitude >= this.config.minAmplitudePx
        ) {
          this.saccadeCounter++;
          const saccade: SaccadeEvent = {
            id: `sac_${this.saccadeCounter}_${Math.round(this.saccadeStart.t)}`,
            startX: Math.round(this.saccadeStart.x),
            startY: Math.round(this.saccadeStart.y),
            endX: Math.round(x),
            endY: Math.round(y),
            startTime: this.saccadeStart.t,
            endTime: timestamp,
            duration: Math.round(duration),
            amplitude: Math.round(amplitude),
            direction: Number(Math.atan2(totalDy, totalDx).toFixed(3)),
            velocity: Math.round(amplitude / (duration / 1000.0)),
          };

          if (this.onSaccade) {
            this.onSaccade(saccade);
          }
          emittedEvent = saccade;
        }

        this.inSaccade = false;
        this.saccadeStart = null;
      }
    }

    this.prevPoint = { x, y, t: timestamp };
    return emittedEvent;
  }

  public reset(): void {
    this.prevPoint = null;
    this.inSaccade = false;
    this.saccadeStart = null;
  }
}

// ---------------------------------------------------------------------------
// Blink Event Detector
// ---------------------------------------------------------------------------

export class BlinkDetector {
  private onBlink?: (blink: BlinkEvent) => void;
  private inBlink = false;
  private blinkStartTime: number | null = null;
  private blinkCounter = 0;

  constructor(onBlink?: (blink: BlinkEvent) => void) {
    this.onBlink = onBlink;
  }

  public addSample(isBlink: boolean, timestamp: number): BlinkEvent | null {
    if (isBlink && !this.inBlink) {
      this.inBlink = true;
      this.blinkStartTime = timestamp;
      return null;
    } else if (!isBlink && this.inBlink && this.blinkStartTime !== null) {
      const duration = timestamp - this.blinkStartTime;
      this.inBlink = false;

      // Filter micro-blinks (< 50ms) or ultra-long occlusions (> 2000ms)
      if (duration >= 50 && duration <= 2000) {
        this.blinkCounter++;
        const blinkEvent: BlinkEvent = {
          id: `blk_${this.blinkCounter}_${Math.round(this.blinkStartTime)}`,
          blinkStart: this.blinkStartTime,
          blinkEnd: timestamp,
          blinkDuration: Math.round(duration),
        };

        if (this.onBlink) {
          this.onBlink(blinkEvent);
        }
        this.blinkStartTime = null;
        return blinkEvent;
      }

      this.blinkStartTime = null;
    }
    return null;
  }

  public reset(): void {
    this.inBlink = false;
    this.blinkStartTime = null;
  }
}

// ---------------------------------------------------------------------------
// Generic Task Event Manager (Synchronized Experiment Timeline)
// ---------------------------------------------------------------------------

export class TaskEventManager {
  private events: TaskEventRecord[] = [];
  private eventCounter = 0;

  public markEvent(
    eventType: TaskEventType,
    metadata?: Record<string, unknown>,
    targetCoords?: { id?: string | number; x?: number; y?: number }
  ): TaskEventRecord {
    this.eventCounter++;
    const record: TaskEventRecord = {
      id: `evt_${this.eventCounter}_${Date.now()}`,
      eventType,
      timestamp: performance.now(),
      targetId: targetCoords?.id,
      targetX: targetCoords?.x,
      targetY: targetCoords?.y,
      metadata,
    };
    this.events.push(record);
    return record;
  }

  public getEvents(): TaskEventRecord[] {
    return [...this.events];
  }

  public getEventsInRange(startTime: number, endTime: number): TaskEventRecord[] {
    return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  public clear(): void {
    this.events = [];
    this.eventCounter = 0;
  }
}

export const globalTaskEventManager = new TaskEventManager();
