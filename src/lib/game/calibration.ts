import { CALIBRATION, POPULATION_AVERAGE_SCORE, STATS } from "./config";
import type { StatLine } from "./score";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The first CALIBRATION.days days or CALIBRATION.workouts workouts, whichever ends first. Until
 * then stats show population averages, so a beginner never sees them "drop" on day one.
 */
export interface Calibration {
  /** Time of the first counted workout, or null before it. */
  startedAt: number | null;
  /** Counted workouts so far. */
  workouts: number;
  done: boolean;
}

export const NEW_CALIBRATION: Calibration = { startedAt: null, workouts: 0, done: false };

export function calibrationDone(c: Calibration, now: number): boolean {
  return (
    c.done ||
    c.workouts >= CALIBRATION.workouts ||
    (c.startedAt != null && now - c.startedAt >= CALIBRATION.days * DAY_MS)
  );
}

/** Calibration after one more counted workout at `now`. */
export function advanceCalibration(c: Calibration, now: number): Calibration {
  const next = { startedAt: c.startedAt ?? now, workouts: c.workouts + 1, done: c.done };
  return { ...next, done: calibrationDone(next, now) };
}

/** The six stats as shown during calibration. */
export function averageStats(): StatLine {
  return Object.fromEntries(STATS.map((s) => [s, { value: POPULATION_AVERAGE_SCORE, bonus: 0 }])) as StatLine;
}

/** The stats to show: real ones, or the averages while calibrating. */
export function displayStats(real: StatLine, c: Calibration, now: number): StatLine {
  return calibrationDone(c, now) ? real : averageStats();
}
