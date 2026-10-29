import { describe, expect, test } from "vitest";
import { PACING, XP } from "./config";
import { assumedGear, battleFrom, milestones, simulatePacing, suggestedPerLevel } from "./pacing";

describe("pacing model", () => {
  const run = simulatePacing(52 * 3);
  const at = (months: number) => run[Math.round((months * 52) / 12) - 1];

  test("gear follows the assumed curve between its points", () => {
    expect(assumedGear(0)).toBe(0);
    expect(assumedGear(12)).toBe(75);
    expect(assumedGear(9)).toBeCloseTo(60);
    expect(assumedGear(100)).toBe(150);
  });

  test("gear never counts past its share of battle power", () => {
    expect(battleFrom(70, 1000, 0)).toBeCloseTo(100);
    expect(battleFrom(100, 10, 0.1)).toBeCloseTo(121);
  });

  test("stats and power only grow", () => {
    for (let i = 1; i < run.length; i++) {
      expect(run[i].body).toBeGreaterThan(run[i - 1].body);
      expect(run[i].xp).toBeGreaterThan(run[i - 1].xp);
    }
  });

  test("the stat curve is close to the doc's: about 28 at 6 months, 55 at a year, 110 at two", () => {
    const avg = (months: number) => Object.values(at(months).stats).reduce((a, b) => a + b, 0) / 6;
    expect(avg(6)).toBeGreaterThan(24);
    expect(avg(6)).toBeLessThan(34);
    expect(avg(12)).toBeGreaterThan(48);
    expect(avg(12)).toBeLessThan(66);
    expect(avg(24)).toBeGreaterThan(100);
    expect(avg(24)).toBeLessThan(130);
  });

  test("level 35, the endgame tier, comes at about two years", () => {
    const level35 = milestones(run).find((m) => m.name === "Level 35")!;
    expect(level35.months).toBeGreaterThan(PACING.targets.level35 - 1.5);
    expect(level35.months).toBeLessThan(PACING.targets.level35 + 1.5);
    expect(Math.abs(suggestedPerLevel() - XP.perLevel)).toBeLessThanOrEqual(50);
  });
});
