import { describe, expect, test } from "vitest";
import { WEEKS_KEPT } from "./config";
import { mergeFacts, workoutFacts, type MusclesFacts } from "./facts";
import { epley } from "./sets";
import { BENCH, CRUNCH, CURL, DAY, lookup, PULLUP, set, T0, workout } from "./test-helpers";

describe("workoutFacts", () => {
  test("records the best rep estimate, heaviest load, time and week per sub-muscle", () => {
    const w = workout(T0, [
      [BENCH, [set(40, 10, "warmup"), set(80, 8), set(90, 3), set(100, 1)]],
      [CURL, [set(30, 10)]],
    ]);
    const facts = workoutFacts(w, lookup, 80, "UTC");
    expect(facts.chest).toEqual({
      repEst1RMKg: Math.max(epley(80, 8), epley(90, 3)),
      maxLoadKg: 100,
      lastTrained: T0,
      weeks: ["2026-10-11"],
    });
    expect(facts.biceps?.repEst1RMKg).toBeCloseTo(40);
    expect(facts.quadriceps).toBeUndefined();
  });

  test("warm-ups don't count toward any fact", () => {
    const facts = workoutFacts(workout(T0, [[BENCH, [set(200, 5, "warmup"), set(60, 5)]]]), lookup, 80, "UTC");
    expect(facts.chest?.maxLoadKg).toBe(60);
  });

  test("only singles leaves no rep estimate", () => {
    const facts = workoutFacts(workout(T0, [[BENCH, [set(120, 1)]]]), lookup, 80, "UTC");
    expect(facts.chest).toMatchObject({ repEst1RMKg: null, maxLoadKg: 120 });
  });

  test("bodyweight exercises use bodyweight", () => {
    const facts = workoutFacts(workout(T0, [[PULLUP, [set(null, 10)]], [CRUNCH, [set(null, 20)]]]), lookup, 80, "UTC");
    expect(facts.lats?.repEst1RMKg).toBeCloseTo(epley(80, 10));
    expect(facts.abdominals?.maxLoadKg).toBeCloseTo(80 * 0.65);
  });
});

describe("mergeFacts", () => {
  const a: MusclesFacts = {
    chest: { repEst1RMKg: 100, maxLoadKg: 90, lastTrained: T0, weeks: ["2026-10-11"] },
  };
  const b: MusclesFacts = {
    chest: { repEst1RMKg: 95, maxLoadKg: 105, lastTrained: T0 - 7 * DAY, weeks: ["2026-10-04"] },
    lats: { repEst1RMKg: null, maxLoadKg: 60, lastTrained: T0, weeks: ["2026-10-11"] },
  };

  test("keeps maxima, the latest time and the union of weeks", () => {
    expect(mergeFacts(a, b)).toEqual({
      chest: { repEst1RMKg: 100, maxLoadKg: 105, lastTrained: T0, weeks: ["2026-10-11", "2026-10-04"] },
      lats: b.lats,
    });
  });

  test("order doesn't matter", () => {
    expect(mergeFacts(a, b)).toEqual(mergeFacts(b, a));
  });

  test("null never beats a number", () => {
    const merged = mergeFacts(b, { lats: { repEst1RMKg: 70, maxLoadKg: null, lastTrained: null, weeks: [] } });
    expect(merged.lats).toMatchObject({ repEst1RMKg: 70, maxLoadKg: 60, lastTrained: T0 });
  });

  test("keeps only the newest WEEKS_KEPT weeks", () => {
    let facts: MusclesFacts = {};
    for (let i = 0; i < WEEKS_KEPT + 3; i++) {
      facts = mergeFacts(facts, workoutFacts(workout(T0 - i * 7 * DAY, [[BENCH, [set(60, 5)]]]), lookup, 80, "UTC"));
    }
    expect(facts.chest?.weeks).toHaveLength(WEEKS_KEPT);
    expect(facts.chest?.weeks[0]).toBe("2026-10-11");
  });

  test("doesn't mutate its inputs", () => {
    const copy = structuredClone(a);
    mergeFacts(a, b);
    expect(a).toEqual(copy);
  });
});
