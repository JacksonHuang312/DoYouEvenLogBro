import { describe, expect, it } from "vitest";
import { toKg } from "../units";
import { PROGRESSION } from "./config";
import { didProgress, nextWeightKg, progressionSets, progressionStatus, rangeOf, stepKgFor, validRepRange } from "./progression";
import { set } from "./test-helpers";

const range = { repMin: 6, repMax: 9 };
const STEP = PROGRESSION.defaultStep.kg;

describe("validRepRange and rangeOf", () => {
  it("accepts whole numbers in bounds with min at most max", () => {
    expect(validRepRange(6, 9)).toBe(true);
    expect(validRepRange(8, 8)).toBe(true);
    expect(validRepRange(PROGRESSION.minReps, PROGRESSION.maxReps)).toBe(true);
  });

  it("rejects out of bounds, non-whole, reversed and missing values", () => {
    expect(validRepRange(0, 9)).toBe(false);
    expect(validRepRange(6, PROGRESSION.maxReps + 1)).toBe(false);
    expect(validRepRange(6.5, 9)).toBe(false);
    expect(validRepRange(10, 9)).toBe(false);
    expect(validRepRange(undefined, 9)).toBe(false);
    expect(validRepRange("6", "9")).toBe(false);
  });

  it("gives the range, or null for none or a broken one", () => {
    expect(rangeOf({ repMin: 6, repMax: 9 })).toEqual(range);
    expect(rangeOf({ repMin: 6 })).toBeNull();
    expect(rangeOf({ repMin: 12, repMax: 8 })).toBeNull();
    expect(rangeOf(undefined)).toBeNull();
  });
});

describe("stepKgFor", () => {
  it("uses the exercise's own step, else the default for the unit", () => {
    expect(stepKgFor("kg", 1.25)).toBe(1.25);
    expect(stepKgFor("kg")).toBe(2.5);
    expect(stepKgFor("lb")).toBeCloseTo(toKg("lb", 5), 6);
    expect(stepKgFor("lb", null)).toBeCloseTo(2.268, 3);
  });

  it("ignores a step that isn't positive", () => {
    expect(stepKgFor("kg", 0)).toBe(2.5);
    expect(stepKgFor("kg", -2)).toBe(2.5);
  });
});

describe("progressionSets", () => {
  it("drops warm-ups, drop sets and sets with no reps; keeps normal and failure sets", () => {
    const sets = [set(40, 10, "warmup"), set(60, 8), set(50, 12, "drop"), set(60, 0), set(60, 6, "failure")];
    expect(progressionSets(sets)).toEqual([set(60, 8), set(60, 6, "failure")]);
  });
});

describe("progressionStatus", () => {
  it("says there is no range or no sets", () => {
    expect(progressionStatus(null, [set(60, 9)])).toBe("no-range");
    expect(progressionStatus(range, [])).toBe("no-sets");
    expect(progressionStatus(range, [set(40, 10, "warmup")])).toBe("no-sets");
  });

  it("says add weight when every working set reached the top", () => {
    expect(progressionStatus(range, [set(60, 9), set(60, 9), set(60, 10)])).toBe("add-weight");
  });

  it("says in range when some set is short of the top but none is under the minimum", () => {
    expect(progressionStatus(range, [set(60, 9), set(60, 8), set(60, 6)])).toBe("in-range");
  });

  it("says below range when any working set is under the minimum, even with others at the top", () => {
    expect(progressionStatus(range, [set(60, 9), set(60, 5)])).toBe("below-range");
  });

  it("ignores warm-ups and drop sets", () => {
    const sets = [set(30, 15, "warmup"), set(60, 9), set(60, 9), set(45, 4, "drop")];
    expect(progressionStatus(range, sets)).toBe("add-weight");
  });

  it("works for a single-value range", () => {
    expect(progressionStatus({ repMin: 5, repMax: 5 }, [set(100, 5)])).toBe("add-weight");
    expect(progressionStatus({ repMin: 5, repMax: 5 }, [set(100, 4)])).toBe("below-range");
  });
});

describe("didProgress: more weight", () => {
  const previous = [set(60, 8), set(60, 8), set(60, 8)];

  it("counts a step heavier with every working set at the minimum or better", () => {
    const current = [set(62.5, 6), set(62.5, 6), set(62.5, 6)];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 })).toEqual({ progressed: true, how: "weight" });
  });

  it("does not count heavier weight when a set misses the minimum", () => {
    const current = [set(62.5, 6), set(62.5, 5)];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 }).progressed).toBe(false);
  });

  it("does not count a jump smaller than the step", () => {
    const current = [set(60.25, 8), set(60.25, 8)];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 }).progressed).toBe(false);
  });

  it("counts a jump of exactly the step, in pounds too", () => {
    const lbStep = stepKgFor("lb");
    const prev = [set(toKg("lb", 135), 8)];
    const cur = [set(toKg("lb", 140), 8)];
    expect(didProgress({ previous: prev, current: cur, stepKg: lbStep, repMin: 6 })).toEqual({ progressed: true, how: "weight" });
  });

  it("without a range any reps count (minimum 1)", () => {
    const current = [set(65, 1)];
    expect(didProgress({ previous, current, stepKg: STEP }).how).toBe("weight");
  });

  it("uses the heaviest working set, so a lighter back-off set doesn't hide it", () => {
    const current = [set(65, 8), set(60, 8), set(60, 8)];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 }).how).toBe("weight");
  });

  it("ignores warm-ups and drop sets when finding the top weight", () => {
    const current = [set(100, 5, "warmup"), set(60, 8), set(80, 4, "drop")];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 }).progressed).toBe(false);
  });
});

describe("didProgress: more reps at the same weight", () => {
  it("counts more total reps at the top weight", () => {
    const previous = [set(60, 8), set(60, 7)];
    const current = [set(60, 8), set(60, 8)];
    expect(didProgress({ previous, current, stepKg: STEP, repMin: 6 })).toEqual({ progressed: true, how: "reps" });
  });

  it("counts an extra set at the same weight as more reps", () => {
    expect(didProgress({ previous: [set(60, 8), set(60, 8)], current: [set(60, 8), set(60, 8), set(60, 8)], stepKg: STEP }).how).toBe("reps");
  });

  it("does not count the same reps, or fewer", () => {
    const previous = [set(60, 8), set(60, 8)];
    expect(didProgress({ previous, current: [set(60, 8), set(60, 8)], stepKg: STEP }).progressed).toBe(false);
    expect(didProgress({ previous, current: [set(60, 8), set(60, 7)], stepKg: STEP }).progressed).toBe(false);
  });

  it("treats loads a hair apart as the same weight", () => {
    const previous = [set(60, 8)];
    const current = [set(60.004, 9)];
    expect(didProgress({ previous, current, stepKg: STEP }).how).toBe("reps");
  });

  it("does not count going lighter for more reps", () => {
    expect(didProgress({ previous: [set(60, 8)], current: [set(50, 15)], stepKg: STEP }).progressed).toBe(false);
  });
});

describe("didProgress: bodyweight and edge cases", () => {
  it("bodyweight (no weight logged) progresses only by reps", () => {
    expect(didProgress({ previous: [set(null, 8)], current: [set(null, 10)], stepKg: STEP })).toEqual({ progressed: true, how: "reps" });
    expect(didProgress({ previous: [set(null, 8)], current: [set(null, 8)], stepKg: STEP }).progressed).toBe(false);
  });

  it("added weight on a bodyweight lift counts as more weight once it reaches a step", () => {
    expect(didProgress({ previous: [set(null, 8)], current: [set(2.5, 8)], stepKg: STEP }).how).toBe("weight");
    expect(didProgress({ previous: [set(null, 8)], current: [set(1, 8)], stepKg: STEP }).progressed).toBe(false);
  });

  it("has nothing to compare without working sets on both sides", () => {
    expect(didProgress({ previous: [], current: [set(60, 8)], stepKg: STEP }).progressed).toBe(false);
    expect(didProgress({ previous: [set(60, 8)], current: [set(60, 8, "warmup")], stepKg: STEP }).progressed).toBe(false);
  });

  it("weight progress wins when both weight and reps went up", () => {
    expect(didProgress({ previous: [set(60, 8)], current: [set(65, 10)], stepKg: STEP }).how).toBe("weight");
  });
});

describe("nextWeightKg", () => {
  it("suggests one step heavier or lighter", () => {
    expect(nextWeightKg({ lastWeightKg: 60, stepKg: 2.5, unit: "kg", direction: "heavier" })).toBe(62.5);
    expect(nextWeightKg({ lastWeightKg: 60, stepKg: 2.5, unit: "kg", direction: "lighter" })).toBe(57.5);
  });

  it("rounds in the display unit, so pounds come out clean", () => {
    const heavier = nextWeightKg({ lastWeightKg: toKg("lb", 135), stepKg: stepKgFor("lb"), unit: "lb", direction: "heavier" });
    expect(heavier).toBeCloseTo(toKg("lb", 140), 6);
    const lighter = nextWeightKg({ lastWeightKg: toKg("lb", 135), stepKg: stepKgFor("lb"), unit: "lb", direction: "lighter" });
    expect(lighter).toBeCloseTo(toKg("lb", 130), 6);
  });

  it("uses a custom step", () => {
    expect(nextWeightKg({ lastWeightKg: 20, stepKg: 1, unit: "kg", direction: "heavier" })).toBe(21);
  });

  it("suggests added weight from bodyweight, and nothing lighter than nothing", () => {
    expect(nextWeightKg({ lastWeightKg: null, stepKg: 2.5, unit: "kg", direction: "heavier" })).toBe(2.5);
    expect(nextWeightKg({ lastWeightKg: null, stepKg: 2.5, unit: "kg", direction: "lighter" })).toBeNull();
    expect(nextWeightKg({ lastWeightKg: 2.5, stepKg: 2.5, unit: "kg", direction: "lighter" })).toBeNull();
  });
});
