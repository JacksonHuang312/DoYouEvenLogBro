import { describe, expect, test } from "vitest";
import library from "../../data/exercises.json";
import {
  POWER_MULTIPLIERS,
  STAT_MUSCLES,
  STATS,
  STRENGTH_STANDARDS,
  SUB_MUSCLES,
  FREQUENCY_WEEKS,
  WEEKS_KEPT,
  COINS,
} from "./config";

describe("config", () => {
  test("the 17 sub-muscles are exactly the library's muscle values", () => {
    const libraryMuscles = [...new Set(library.map((e) => e.muscle))].sort();
    expect(SUB_MUSCLES).toHaveLength(17);
    expect([...SUB_MUSCLES].sort()).toEqual(libraryMuscles);
  });

  test("each sub-muscle belongs to exactly one stat", () => {
    expect(new Set(SUB_MUSCLES).size).toBe(SUB_MUSCLES.length);
  });

  test("each stat's sub-muscle weights sum to 100%", () => {
    for (const stat of STATS) {
      const sum = Object.values(STAT_MUSCLES[stat]).reduce((a, b) => a + b, 0);
      expect(sum, stat).toBeCloseTo(1, 10);
    }
  });

  test("every sub-muscle has a strength standard and every stat a power multiplier", () => {
    for (const m of SUB_MUSCLES) expect(STRENGTH_STANDARDS[m], m).toBeGreaterThan(0);
    for (const s of STATS) expect(POWER_MULTIPLIERS[s], s).toBeGreaterThan(0);
    expect(POWER_MULTIPLIERS.core).toBe(0.5);
  });

  test("keeps enough weeks of history for the frequency score", () => {
    expect(WEEKS_KEPT).toBeGreaterThanOrEqual(FREQUENCY_WEEKS);
  });

  test("a single workout fits under the daily cap", () => {
    expect(COINS.base + COINS.scheduledBonus).toBeLessThanOrEqual(COINS.dailyCap);
  });
});
