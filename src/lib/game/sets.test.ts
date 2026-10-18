import { describe, expect, test } from "vitest";
import { BODYWEIGHT_FACTOR, EPLEY_MAX_REPS } from "./config";
import { buildExerciseLookup, countsAsWorkout, epley, isWorkingSet, setLoadKg, workingSets } from "./sets";
import { BENCH, BIKE, CRUNCH, lookup, PULLUP, set, T0, workout } from "./test-helpers";

describe("epley", () => {
  test("weight × (1 + reps/30)", () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley(60, 5)).toBeCloseTo(70, 10);
  });

  test("a single is its own weight", () => {
    expect(epley(140, 1)).toBe(140);
  });

  test("reps past the cap add nothing", () => {
    expect(epley(50, 40)).toBe(epley(50, EPLEY_MAX_REPS));
    expect(EPLEY_MAX_REPS).toBe(12);
  });
});

describe("isWorkingSet", () => {
  test("excludes warm-ups and sets without reps", () => {
    expect(isWorkingSet(set(60, 10))).toBe(true);
    expect(isWorkingSet(set(60, 10, "drop"))).toBe(true);
    expect(isWorkingSet(set(60, 10, "failure"))).toBe(true);
    expect(isWorkingSet(set(60, 10, "warmup"))).toBe(false);
    expect(isWorkingSet(set(60, 0))).toBe(false);
  });

  test("bodyweight sets count", () => {
    expect(isWorkingSet(set(null, 12))).toBe(true);
  });

  test("ignores obvious typos", () => {
    expect(isWorkingSet(set(6000, 5))).toBe(false);
    expect(isWorkingSet(set(60, 500))).toBe(false);
    expect(isWorkingSet(set(-5, 5))).toBe(false);
  });
});

describe("setLoadKg", () => {
  const barbell = { muscle: "chest" as const, category: "strength", equipment: "barbell" };
  const bodyOnly = { muscle: "lats" as const, category: "strength", equipment: "body only" };

  test("a weighted set is its weight", () => {
    expect(setLoadKg(set(100, 5), BENCH, barbell, 80)).toBe(100);
  });

  test("no weight means bodyweight × the default factor", () => {
    expect(setLoadKg(set(null, 5), "Anything", bodyOnly, 80)).toBeCloseTo(80 * BODYWEIGHT_FACTOR.default);
  });

  test("uses the exercise's own factor, with added weight on top", () => {
    expect(setLoadKg(set(null, 5), PULLUP, bodyOnly, 80)).toBe(80);
    expect(setLoadKg(set(20, 5), PULLUP, bodyOnly, 80)).toBe(100);
  });
});

describe("buildExerciseLookup", () => {
  test("finds library and custom exercises", () => {
    expect(lookup(BENCH)).toEqual({ muscle: "chest", category: "strength", equipment: "barbell" });
    expect(lookup("c_ok")?.muscle).toBe("chest");
    expect(lookup("nope")).toBeUndefined();
  });

  test("maps free-text custom muscles to the closest sub-muscle", () => {
    expect(lookup("c_hack")?.muscle).toBe("quadriceps");
  });

  test("a custom exercise with a library id overrides it", () => {
    const l = buildExerciseLookup([{ id: BENCH, muscle: "triceps", category: "strength", equipment: "barbell" }]);
    expect(l(BENCH)?.muscle).toBe("triceps");
  });
});

describe("workingSets / countsAsWorkout", () => {
  test("keep working sets on known non-cardio exercises", () => {
    const w = workout(T0, [
      [BENCH, [set(40, 10, "warmup"), set(80, 5), set(80, 5)]],
      [BIKE, [set(null, 20), set(null, 20)]],
      ["deleted_exercise", [set(50, 5)]],
      [CRUNCH, [set(null, 20)]],
    ]);
    expect(workingSets(w, lookup).map((s) => s.exerciseId)).toEqual([BENCH, BENCH, CRUNCH]);
  });

  test("a workout needs 4 working sets", () => {
    const three = workout(T0, [[BENCH, [set(80, 5), set(80, 5), set(80, 5)]]]);
    const fourWithWarmup = workout(T0, [[BENCH, [set(40, 5, "warmup"), set(80, 5), set(80, 5), set(80, 5)]]]);
    const four = workout(T0, [[BENCH, [set(80, 5), set(80, 5)]], [CRUNCH, [set(null, 20), set(null, 20)]]]);
    const cardio = workout(T0, [[BIKE, [set(null, 1), set(null, 1), set(null, 1), set(null, 1)]]]);
    expect(countsAsWorkout(three, lookup)).toBe(false);
    expect(countsAsWorkout(fourWithWarmup, lookup)).toBe(false);
    expect(countsAsWorkout(cardio, lookup)).toBe(false);
    expect(countsAsWorkout(four, lookup)).toBe(true);
  });
});
