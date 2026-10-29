import { describe, expect, test } from "vitest";
import { POWER_MULTIPLIERS, RUST, STAT_POINTS, STATS, type Stat } from "./config";
import type { MuscleFacts, MusclesFacts } from "./facts";
import { NO_FREEZE } from "./freeze";
import {
  computeStats,
  musclePoints,
  power,
  rustedStats,
  rustOf,
  statLastTrained,
  statRust,
  subMuscleScores,
  type StatLine,
} from "./score";
import { DAY, T0 } from "./test-helpers";

const facts = (sets: number, progressed = 0, lastTrained: number | null = T0): MuscleFacts => ({
  sets,
  progressed,
  lastTrained,
  weeks: [],
});

const line = (value: number, over: Partial<StatLine> = {}): StatLine =>
  ({ ...Object.fromEntries(STATS.map((s) => [s, value])), ...over }) as StatLine;

describe("points and stats", () => {
  test("a set is worth 1 point, a progressed set 1.25", () => {
    expect(musclePoints(facts(10))).toBe(10 * STAT_POINTS.perSet);
    expect(musclePoints(facts(10, 4))).toBe(6 * STAT_POINTS.perSet + 4 * STAT_POINTS.progressedSet);
    expect(musclePoints(undefined)).toBe(0);
  });

  test("a muscle doc from before the rework counts as nothing", () => {
    expect(musclePoints({ lastTrained: T0, weeks: [] } as unknown as MuscleFacts)).toBe(0);
  });

  test("a sub-muscle scores its points ÷ 10; a stat adds its sub-muscles up", () => {
    const muscles: MusclesFacts = { lats: facts(40), "middle back": facts(30, 8), "lower back": facts(10) };
    const scores = subMuscleScores(muscles);
    expect(scores.lats).toBe(4);
    expect(scores["middle back"]).toBeCloseTo((22 + 8 * 1.25) / 10);
    expect(computeStats(muscles).back).toBeCloseTo(4 + 3.2 + 1);
    expect(computeStats(muscles).chest).toBe(0);
  });

  test("stats have no cap", () => {
    expect(computeStats({ chest: facts(5000) }).chest).toBe(500);
  });
});

describe("power", () => {
  test("is Σ(stat × multiplier): Legs and Back 1.2, Core 0.5", () => {
    expect(power(line(50))).toBeCloseTo(50 * (1 + 1.2 + 1 + 1 + 1.2 + 0.5));
    expect(power(line(0, { legs: 10 }))).toBeCloseTo(10 * POWER_MULTIPLIERS.legs);
  });

  test("an empty profile has no power", () => {
    expect(power(computeStats({}))).toBe(0);
  });
});

describe("rust", () => {
  test("nothing for the first 14 days, then 1% a day up to 30%", () => {
    expect(rustOf(T0, T0 + (RUST.graceDays - 1) * DAY)).toBe(0);
    expect(rustOf(T0, T0 + RUST.graceDays * DAY)).toBeCloseTo(RUST.perDay);
    expect(rustOf(T0, T0 + (RUST.graceDays + 9) * DAY)).toBeCloseTo(10 * RUST.perDay);
    expect(rustOf(T0, T0 + 365 * DAY)).toBe(RUST.max);
  });

  test("a stat never trained has no rust", () => {
    expect(rustOf(null, T0)).toBe(0);
  });

  test("frozen time doesn't count", () => {
    expect(rustOf(T0 - 30 * DAY, T0, 20 * DAY)).toBe(0);
  });

  test("a stat goes by its most recently trained sub-muscle", () => {
    const muscles: MusclesFacts = { lats: facts(10, 0, T0 - 40 * DAY), "lower back": facts(2, 0, T0 - DAY) };
    expect(statLastTrained(muscles, "back")).toBe(T0 - DAY);
    expect(statLastTrained(muscles, "chest")).toBeNull();
    expect(statRust(muscles, T0, NO_FREEZE).back).toBe(0);
  });

  test("a pause freezes every stat; an injury only its own", () => {
    const muscles: MusclesFacts = { chest: facts(10, 0, T0 - 30 * DAY), biceps: facts(10, 0, T0 - 30 * DAY) };
    const rusty = statRust(muscles, T0, NO_FREEZE);
    expect(rusty.chest).toBeGreaterThan(0);
    expect(rusty.arms).toBe(rusty.chest);

    const paused = statRust(muscles, T0, { all: [[T0 - 31 * DAY, T0] as const], byStat: {} });
    expect(paused.chest).toBe(0);

    const armsInjured = statRust(muscles, T0, { all: [], byStat: { arms: [[T0 - 40 * DAY, T0] as const] } });
    expect(armsInjured.arms).toBe(0);
    expect(armsInjured.chest).toBe(rusty.chest);
  });

  test("rusted stats are the stats times (1 − rust); earned stats are untouched", () => {
    const stats = line(50);
    const rust = line(0, { legs: 0.3 } as Partial<Record<Stat, number>>);
    expect(rustedStats(stats, rust)).toEqual(line(50, { legs: 35 }));
    expect(stats.legs).toBe(50);
  });
});
