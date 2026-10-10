/**
 * One Euro Filter for low-latency, jitter-free real-time gaze smoothing.
 * Filters noisy webcam gaze coordinates without lag during saccades/rapid movements.
 */

export interface OneEuroConfig {
  minCutoff: number; // Minimum cutoff frequency in Hz (lower = smoother when stationary)
  beta: number;      // Speed coefficient (higher = less lag during rapid movement)
  dCutoff: number;   // Cutoff frequency for derivative
}

export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1.0,
  beta: 0.007,
  dCutoff: 1.0,
};

function smoothingFactor(te: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

function exponentialSmoothing(a: number, x: number, xPrev: number): number {
  return a * x + (1 - a) * xPrev;
}

export class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = exponentialSmoothing(alpha, value, this.s!);
    this.s = this.y;
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private config: OneEuroConfig;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(config: Partial<OneEuroConfig> = {}) {
    this.config = { ...DEFAULT_ONE_EURO_CONFIG, ...config };
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      return this.xFilter.filter(value, 1.0);
    }

    const dt = Math.max((timestampMs - this.lastTime) / 1000.0, 0.001); // in seconds
    this.lastTime = timestampMs;

    const prevX = this.xFilter.hasLast() ? this.xFilter.last() : value;
    const dx = (value - prevX) / dt;
    const edx = this.dxFilter.filter(dx, smoothingFactor(dt, this.config.dCutoff));

    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edx);
    const alpha = smoothingFactor(dt, cutoff);

    return this.xFilter.filter(value, alpha);
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

export class Gaze2DFilter {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(config: Partial<OneEuroConfig> = {}) {
    this.filterX = new OneEuroFilter(config);
    this.filterY = new OneEuroFilter(config);
  }

  filter(x: number, y: number, timestampMs: number): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, timestampMs),
      y: this.filterY.filter(y, timestampMs),
    };
  }

  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
