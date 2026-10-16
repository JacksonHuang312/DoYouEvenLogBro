import { describe, expect, test } from "vitest";
import {
  advanceCalibration,
  averageStats,
  calibrationDone,
  displayStats,
  NEW_CALIBRATION,
  type Calibration,
} from "./calibration";
import { CALIBRATION, POPULATION_AVERAGE_SCORE } from "./config";
import type { StatLine } from "./score";
import { DAY, T0 } from "./test-helpers";

describe("calibration", () => {
  test("starts at the first counted workout", () => {
    expect(advanceCalibration(NEW_CALIBRATION, T0)).toEqual({ startedAt: T0, workouts: 1, done: false });
  });

  test("ends after 6 workouts", () => {
    let c: Calibration = NEW_CALIBRATION;
    for (let i = 0; i < CALIBRATION.workouts - 1; i++) c = advanceCalibration(c, T0 + i * DAY);
    expect(c.done).toBe(false);
    c = advanceCalibration(c, T0 + 6 * DAY);
    expect(c.done).toBe(true);
  });

  test("or after 2 weeks", () => {
    const c = advanceCalibration(NEW_CALIBRATION, T0);
    expect(calibrationDone(c, T0 + (CALIBRATION.days - 1) * DAY)).toBe(false);
    expect(calibrationDone(c, T0 + CALIBRATION.days * DAY)).toBe(true);
    expect(advanceCalibration(c, T0 + CALIBRATION.days * DAY).done).toBe(true);
  });

  test("never restarts once done", () => {
    expect(calibrationDone({ startedAt: T0, workouts: 1, done: true }, T0)).toBe(true);
  });

  test("a new account is calibrating", () => {
    expect(calibrationDone(NEW_CALIBRATION, T0)).toBe(false);
  });
});

describe("displayStats", () => {
  const real = { ...averageStats(), chest: { value: 5, bonus: 0 } } as StatLine;

  test("shows population averages while calibrating", () => {
    const shown = displayStats(real, NEW_CALIBRATION, T0);
    expect(shown.chest).toEqual({ value: POPULATION_AVERAGE_SCORE, bonus: 0 });
    expect(shown).toEqual(averageStats());
  });

  test("shows real stats after", () => {
    expect(displayStats(real, { startedAt: T0, workouts: 6, done: true }, T0)).toBe(real);
  });
});
