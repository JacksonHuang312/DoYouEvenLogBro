import { describe, expect, test } from "vitest";
import { buildExerciseLookup, countsAsWorkout, isWorkingSet, workingSets } from "./sets";
import { BENCH, BIKE, CRUNCH, lookup, set, T0, workout } from "./test-helpers";

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
