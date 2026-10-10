import { useCallback, useRef, useState } from "react";
import type { GazePoint } from "@/types";

const DISPERSION_PX = 45; // Spatial dispersion threshold in pixels
const MIN_FIXATION_MS = 100; // Minimum duration to qualify as fixation

interface SamplePoint {
  x: number;
  y: number;
  t: number;
}

/**
 * Standard I-DT (Identification by Dispersion-Threshold) fixation detector.
 * Identifies stable eye fixations and emits a single fixation event upon completion.
 */
export function useFixationDetection(onFixation: (point: GazePoint) => void) {
  const windowRef = useRef<SamplePoint[]>([]);
  const isFixatingRef = useRef(false);
  const fixationStartRef = useRef<SamplePoint | null>(null);
  const [fixationDurationMs, setFixationDurationMs] = useState(0);

  const addPoint = useCallback(
    (x: number, y: number, t: number) => {
      const win = windowRef.current;
      win.push({ x, y, t });

      const winDuration = t - win[0].t;
      if (winDuration < MIN_FIXATION_MS) {
        return;
      }

      const xs = win.map((p) => p.x);
      const ys = win.map((p) => p.y);
      const dispersion = Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys));

      if (dispersion <= DISPERSION_PX) {
        // Gaze is stable within dispersion threshold
        if (!isFixatingRef.current) {
          isFixatingRef.current = true;
          fixationStartRef.current = win[0];
        }
        const dur = t - fixationStartRef.current!.t;
        setFixationDurationMs(dur);
      } else {
        // Gaze shifted outside dispersion boundary -> end ongoing fixation
        if (isFixatingRef.current && fixationStartRef.current) {
          const fixationPoints = win.slice(0, win.length - 1);
          if (fixationPoints.length > 0) {
            const dur = win[win.length - 2].t - fixationStartRef.current.t;
            if (dur >= MIN_FIXATION_MS) {
              const fxs = fixationPoints.map((p) => p.x);
              const fys = fixationPoints.map((p) => p.y);
              const cx = fxs.reduce((a, b) => a + b, 0) / fxs.length;
              const cy = fys.reduce((a, b) => a + b, 0) / fys.length;
              onFixation({
                x: cx,
                y: cy,
                t: fixationStartRef.current.t,
                event_type: "fixation",
                duration_ms: Math.round(dur),
              });
            }
          }
        }
        isFixatingRef.current = false;
        fixationStartRef.current = null;
        setFixationDurationMs(0);

        // Slide window forward
        while (win.length > 1 && t - win[0].t > MIN_FIXATION_MS) {
          win.shift();
        }
      }
    },
    [onFixation]
  );

  const reset = useCallback(() => {
    windowRef.current = [];
    isFixatingRef.current = false;
    fixationStartRef.current = null;
    setFixationDurationMs(0);
  }, []);

  return { addPoint, fixationDurationMs, reset };
}

