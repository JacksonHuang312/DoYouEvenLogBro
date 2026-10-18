import { describe, expect, test } from "vitest";
import { DECAY, ONE_RM_BONUS_CAP, STRENGTH_STANDARDS, SUB_MUSCLES, type SubMuscle } from "./config";
import type { MuscleFacts } from "./facts";
import { NO_FREEZE } from "./freeze";
import {
  ageFactor,
  calculated1RM,
  computeStats,
  decayFactor,
  frequencyScore,
  oneRMBonusRatio,
  power,
  statBonus,
  statScore,
  strengthScore,
  subMuscleScore,
  subMuscleScores,
  type BodyProfile,
  type StatLine,
  type SubMuscleScores,
} from "./score";
import { DAY, T0 } from "./test-helpers";

const male80: BodyProfile = { bodyweightKg: 80, age: 30, sex: "male" };
const facts = (f: Partial<MuscleFacts>): MuscleFacts => ({
  repEst1RMKg: null,
  maxLoadKg: null,
  lastTrained: T0,
  weeks: ["2026-10-11"],
  ...f,
});
const allScores = (score: number, overrides: Partial<SubMuscleScores> = {}) =>
  ({ ...Object.fromEntries(SUB_MUSCLES.map((m) => [m, score])), ...overrides }) as SubMuscleScores;

describe("ageFactor", () => {
  test("1 for prime-age adults and unknown age, lower for teens and older lifters", () => {
    expect(ageFactor(null)).toBe(1);
    expect(ageFactor(25)).toBe(1);
    expect(ageFactor(39)).toBe(1);
    expect(ageFactor(16)).toBe(0.9);
    expect(ageFactor(49)).toBeCloseTo(0.9);
    expect(ageFactor(120)).toBe(0.6);
  });
});

describe("strengthScore", () => {
  test("hitting the standard scores 100, half of it 50", () => {
    const standard = STRENGTH_STANDARDS.chest * 80;
    expect(strengthScore("chest", standard, male80)).toBeCloseTo(100);
    expect(strengthScore("chest", standard / 2, male80)).toBeCloseTo(50);
  });

  test("keeps scaling past 100 and is 0 with no lifts", () => {
    const standard = STRENGTH_STANDARDS.chest * 80;
    expect(strengthScore("chest", standard * 1.5, male80)).toBeCloseTo(150);
    expect(strengthScore("chest", null, male80)).toBe(0);
  });

  test("is relative to bodyweight", () => {
    expect(strengthScore("chest", 70, { ...male80, bodyweightKg: 70 })).toBeGreaterThan(
      strengthScore("chest", 70, { ...male80, bodyweightKg: 100 }),
    );
  });

  test("standards adjust for sex and age", () => {
    const lift = 60;
    const male = strengthScore("chest", lift, male80);
    const female = strengthScore("chest", lift, { ...male80, sex: "female" });
    const unknown = strengthScore("chest", lift, { ...male80, sex: null });
    expect(female).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(male);
    expect(strengthScore("chest", lift, { ...male80, age: 60 })).toBeGreaterThan(male);
  });

  test("defaults bodyweight when unknown", () => {
    expect(strengthScore("chest", 100, { bodyweightKg: null, age: null, sex: "male" })).toBeCloseTo(
      strengthScore("chest", 100, { bodyweightKg: 75, age: null, sex: "male" }),
    );
  });
});

describe("frequencyScore", () => {
  test("is the share of the last 4 weeks trained", () => {
    expect(frequencyScore([], T0, "UTC")).toBe(0);
    expect(frequencyScore(["2026-10-11"], T0, "UTC")).toBe(25);
    expect(frequencyScore(["2026-10-11", "2026-10-04", "2026-09-27", "2026-09-20"], T0, "UTC")).toBe(100);
    // Older weeks don't count.
    expect(frequencyScore(["2026-09-13", "2026-09-06"], T0, "UTC")).toBe(0);
  });
});

describe("decayFactor", () => {
  test("no decay for the first 7 days", () => {
    expect(decayFactor(T0, T0)).toBe(1);
    expect(decayFactor(T0, T0 + DECAY.graceDays * DAY)).toBe(1);
    expect(decayFactor(null, T0)).toBe(1);
  });

  test("then compounds slowly", () => {
    expect(decayFactor(T0, T0 + (DECAY.graceDays + 1) * DAY)).toBeCloseTo(1 - DECAY.perDay);
    expect(decayFactor(T0, T0 + (DECAY.graceDays + 10) * DAY)).toBeCloseTo((1 - DECAY.perDay) ** 10);
  });

  test("never below the floor", () => {
    expect(decayFactor(T0, T0 + 5000 * DAY)).toBe(DECAY.floor);
  });
});

describe("calculated1RM", () => {
  test("prefers the rep estimate, falls back to the heaviest single", () => {
    expect(calculated1RM(facts({ repEst1RMKg: 100, maxLoadKg: 110 }))).toBe(100);
    expect(calculated1RM(facts({ maxLoadKg: 110 }))).toBe(110);
  });
});

describe("subMuscleScore", () => {
  const standard = STRENGTH_STANDARDS.chest * 80;

  test("is 80% strength + 20% frequency", () => {
    const f = facts({ repEst1RMKg: standard / 2 }); // strength 50, 1 of 4 weeks = 25
    expect(subMuscleScore("chest", f, male80, T0, "UTC", NO_FREEZE)).toBeCloseTo(0.8 * 50 + 0.2 * 25);
  });

  test("untrained is 0", () => {
    expect(subMuscleScore("chest", undefined, male80, T0, "UTC", NO_FREEZE)).toBe(0);
  });

  test("decay applies to the strength part only", () => {
    const f = facts({ repEst1RMKg: standard, lastTrained: T0 - 30 * DAY, weeks: [] });
    expect(subMuscleScore("chest", f, male80, T0, "UTC", NO_FREEZE)).toBeCloseTo(0.8 * 100 * decayFactor(T0 - 30 * DAY, T0));
  });
});

describe("statScore", () => {
  test("is the weighted average of sub-muscles", () => {
    // The design doc's example: quads 90, all other leg muscles 20 → 44.5.
    expect(statScore("legs", allScores(20, { quadriceps: 90 }))).toBeCloseTo(44.5);
    expect(statScore("chest", allScores(0, { chest: 62 }))).toBe(62);
  });
});

describe("1RM bonus", () => {
  test("is how far the actual lift beat the calculated 1RM", () => {
    expect(oneRMBonusRatio(facts({ repEst1RMKg: 100, maxLoadKg: 103 }))).toBeCloseTo(0.03);
    expect(oneRMBonusRatio(facts({ repEst1RMKg: 100, maxLoadKg: 90 }))).toBe(0);
    expect(oneRMBonusRatio(facts({ maxLoadKg: 120 }))).toBe(0); // never tested against a rep estimate
    expect(oneRMBonusRatio(undefined)).toBe(0);
  });

  test("scales with the stat and is capped at 5% of it", () => {
    const scores = allScores(0, { chest: 60 });
    expect(statBonus("chest", scores, { chest: facts({ repEst1RMKg: 100, maxLoadKg: 102 }) })).toBeCloseTo(1.2);
    expect(statBonus("chest", scores, { chest: facts({ repEst1RMKg: 100, maxLoadKg: 150 }) })).toBeCloseTo(
      ONE_RM_BONUS_CAP * 60,
    );
    expect(statBonus("chest", scores, {})).toBe(0);
  });
});

describe("computeStats", () => {
  test("produces all six stats from facts", () => {
    const muscles = { chest: facts({ repEst1RMKg: STRENGTH_STANDARDS.chest * 80 }) };
    const stats = computeStats(muscles, male80, T0, "UTC", NO_FREEZE);
    expect(Object.keys(stats)).toEqual(["chest", "back", "shoulders", "arms", "legs", "core"]);
    expect(stats.chest.value).toBeCloseTo(0.8 * 100 + 0.2 * 25);
    expect(stats.back).toEqual({ value: 0, bonus: 0 });
  });

  test("matches subMuscleScores + statScore", () => {
    const muscles = { lats: facts({ repEst1RMKg: 90 }), "middle back": facts({ repEst1RMKg: 100 }) };
    const scores = subMuscleScores(muscles, male80, T0, "UTC", NO_FREEZE);
    expect(computeStats(muscles, male80, T0, "UTC", NO_FREEZE).back.value).toBeCloseTo(statScore("back", scores));
  });
});

describe("power", () => {
  const line = (value: number, bonus = 0) =>
    Object.fromEntries(["chest", "back", "shoulders", "arms", "legs", "core"].map((s) => [s, { value, bonus }])) as StatLine;

  test("is Σ(stat × multiplier), with core at half", () => {
    expect(power(line(50))).toBe(5 * 50 + 0.5 * 50);
  });

  test("includes the 1RM bonus", () => {
    expect(power(line(50, 2))).toBe(5 * 52 + 0.5 * 52);
  });

  test("an empty profile has no power", () => {
    const empty = {} as Partial<Record<SubMuscle, MuscleFacts>>;
    expect(power(computeStats(empty, male80, T0, "UTC", NO_FREEZE))).toBe(0);
  });
});

describe("freeze (pauses and injuries)", () => {
  const standard = STRENGTH_STANDARDS.chest * 80;

  test("frozen days don't count toward decay", () => {
    const f = facts({ repEst1RMKg: standard, lastTrained: T0 - 30 * DAY, weeks: [] });
    const frozen = { all: [[T0 - 25 * DAY, T0 - 5 * DAY] as const], byStat: {} };
    const expected = 0.8 * 100 * decayFactor(T0 - 30 * DAY, T0, 20 * DAY);
    expect(subMuscleScore("chest", f, male80, T0, "UTC", frozen)).toBeCloseTo(expected);
    expect(expected).toBeGreaterThan(subMuscleScore("chest", f, male80, T0, "UTC", NO_FREEZE));
  });

  test("a pause covering everything since the last workout means no decay", () => {
    const f = facts({ repEst1RMKg: standard, lastTrained: T0 - 30 * DAY, weeks: [] });
    const frozen = { all: [[T0 - 31 * DAY, T0 + DAY] as const], byStat: {} };
    expect(subMuscleScore("chest", f, male80, T0, "UTC", frozen)).toBeCloseTo(80);
  });

  test("an injury only freezes its own stat", () => {
    const f = facts({ repEst1RMKg: standard, lastTrained: T0 - 30 * DAY, weeks: [] });
    const armsInjured = { all: [], byStat: { arms: [[T0 - 40 * DAY, T0] as const] } };
    expect(subMuscleScore("chest", f, male80, T0, "UTC", armsInjured)).toBeCloseTo(
      subMuscleScore("chest", f, male80, T0, "UTC", NO_FREEZE),
    );
    expect(subMuscleScore("biceps", f, male80, T0, "UTC", armsInjured)).toBeGreaterThan(
      subMuscleScore("biceps", f, male80, T0, "UTC", NO_FREEZE),
    );
  });

  test("weeks mostly frozen are skipped when counting frequency", () => {
    const weeks = ["2026-09-20", "2026-09-13"];
    expect(frequencyScore(weeks, T0, "UTC")).toBe(25);
    const pause = [[Date.UTC(2026, 8, 27), T0] as const];
    // 10-11, 10-04 and 09-27 are skipped, so the window is 09-20, 09-13, 09-06 and 08-30: 2 of 4.
    expect(frequencyScore(weeks, T0, "UTC", pause)).toBe(50);
  });

  test("a week with under 4 frozen days still counts", () => {
    const pause = [[Date.UTC(2026, 9, 11), Date.UTC(2026, 9, 13)] as const];
    expect(frequencyScore(["2026-10-11"], T0, "UTC", pause)).toBe(25);
  });
});
