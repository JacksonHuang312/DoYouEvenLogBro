import { describe, expect, it } from "vitest";
import type { RoutineExercise } from "../types";
import { toKg } from "../units";
import { PROGRESSION } from "./config";
import {
  didProgress,
  nextWeightKg,
  progressionHint,
  progressionSets,
  progressionStatus,
  rangeOf,
  repRangeProblem,
  routineWithRange,
  stepKgFor,
  validRepRange,
  withRepRange,
} from "./progression";
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

describe("repRangeProblem", () => {
  it("is fine with both ends empty or a valid range", () => {
    expect(repRangeProblem(null, null)).toBeNull();
    expect(repRangeProblem(undefined, undefined)).toBeNull();
    expect(repRangeProblem(6, 9)).toBeNull();
    expect(repRangeProblem(8, 8)).toBeNull();
  });

  it("asks for both ends when only one is set", () => {
    expect(repRangeProblem(6, null)).toMatch(/both/i);
    expect(repRangeProblem(null, 9)).toMatch(/both/i);
  });

  it("flags a reversed range and out of bounds numbers", () => {
    expect(repRangeProblem(10, 9)).toMatch(/higher than the maximum/i);
    expect(repRangeProblem(0, 9)).toMatch(/1 to 30/);
    expect(repRangeProblem(6, 31)).toMatch(/1 to 30/);
  });
});

describe("withRepRange", () => {
  const base: RoutineExercise = { exerciseId: "x", name: "X", sets: 3, restSec: 90 };

  it("sets a range and a step", () => {
    const e = withRepRange(withRepRange(base, { repMin: 6, repMax: 9 }), { stepKg: 1.25 });
    expect(e).toEqual({ ...base, repMin: 6, repMax: 9, stepKg: 1.25 });
  });

  it("removes cleared values instead of leaving undefined, which Firestore rejects", () => {
    const e = withRepRange({ ...base, repMin: 6, repMax: 9 }, { repMax: null });
    expect(e).toEqual({ ...base, repMin: 6 });
    expect("repMax" in e).toBe(false);
  });

  it("clears the step when the range is cleared", () => {
    const e = withRepRange({ ...base, repMin: 6, repMax: 9, stepKg: 2 }, { repMin: null, repMax: null });
    expect(e).toEqual(base);
  });

  it("leaves other fields alone and doesn't change the original", () => {
    const original = { ...base, repMin: 6, repMax: 9 };
    withRepRange(original, { repMin: 5 });
    expect(original.repMin).toBe(6);
  });
});

describe("progressionHint", () => {
  const hint = (previous: ReturnType<typeof set>[] | null, over: { unit?: "kg" | "lb"; stepKg?: number } = {}) =>
    progressionHint({ range, previous, stepKg: over.stepKg ?? STEP, unit: over.unit ?? "kg" });

  it("has nothing to say without a range or without last time's sets", () => {
    expect(progressionHint({ range: null, previous: [set(60, 9)], stepKg: STEP, unit: "kg" })).toBeNull();
    expect(hint(null)).toBeNull();
    expect(hint([])).toBeNull();
    expect(hint([set(40, 10, "warmup")])).toBeNull();
  });

  it("suggests the next weight when every set reached the top", () => {
    expect(hint([set(60, 9), set(60, 9), set(60, 9)])).toEqual({
      kind: "add-weight",
      text: "Last time: 9, 9, 9 at 60 kg. Try 62.5 kg.",
    });
  });

  it("says to aim for the top in range", () => {
    expect(hint([set(60, 9), set(60, 8), set(60, 7)])).toEqual({
      kind: "in-range",
      text: "Last time: 9, 8, 7 at 60 kg. Aim for 9 on every set.",
    });
  });

  it("suggests a lighter weight below the minimum, never as a failure", () => {
    const h = hint([set(60, 9), set(60, 5)])!;
    expect(h.kind).toBe("lighter");
    expect(h.text).toBe("Last time: 9, 5 at 60 kg. Under your 6-9 range. Try 57.5 kg.");
    expect(h.text).not.toMatch(/fail|plateau|stuck/i);
  });

  it("works in pounds", () => {
    const h = hint([set(toKg("lb", 135), 9), set(toKg("lb", 135), 9)], { unit: "lb", stepKg: stepKgFor("lb") })!;
    expect(h.text).toBe("Last time: 9, 9 at 135 lbs. Try 140 lbs.");
  });

  it("lists each set's weight when they differ, and ignores warm-ups and drop sets", () => {
    const h = hint([set(40, 12, "warmup"), set(62.5, 9), set(60, 8), set(45, 12, "drop")])!;
    expect(h.text).toBe("Last time: 9 × 62.5, 8 × 60 kg. Aim for 9 on every set.");
  });

  it("handles bodyweight: reps only, adding weight from the step, and no lighter suggestion", () => {
    expect(hint([set(null, 9), set(null, 9)])!.text).toBe("Last time: 9, 9 reps. Try adding 2.5 kg.");
    expect(hint([set(null, 9), set(null, 4)])!.text).toBe("Last time: 9, 4 reps. Under your 6-9 range. Try an easier variation.");
  });

  it("uses the exercise's own step", () => {
    expect(hint([set(20, 9)], { stepKg: 1 })!.text).toBe("Last time: 9 at 20 kg. Try 21 kg.");
  });
});

describe("routineWithRange", () => {
  const exercises = [
    { exerciseId: "a", name: "A", sets: 3, restSec: 60 },
    { exerciseId: "b", name: "B", sets: 3, restSec: 60, repMin: 5, repMax: 8, stepKg: 2 },
    { exerciseId: "a", name: "A again", sets: 2, restSec: 60 },
  ];

  it("sets the range on the first exercise with that id only", () => {
    const next = routineWithRange(exercises, "a", { repMin: 6, repMax: 9 })!;
    expect(next[0]).toEqual({ ...exercises[0], repMin: 6, repMax: 9 });
    expect(next[2]).toEqual(exercises[2]);
    expect(exercises[0]).not.toHaveProperty("repMin");
  });

  it("clears the range and step with null", () => {
    const next = routineWithRange(exercises, "b", null)!;
    expect(next[1]).toEqual({ exerciseId: "b", name: "B", sets: 3, restSec: 60 });
  });

  it("is null when the routine has no such exercise", () => {
    expect(routineWithRange(exercises, "zzz", { repMin: 6, repMax: 9 })).toBeNull();
  });
});
