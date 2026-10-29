import { describe, expect, test } from "vitest";
import { STAT_POINTS, WEEKS_KEPT } from "./config";
import { beatLastSession, exerciseSessions, mergeFacts, workoutFacts, type MusclesFacts, type PreviousSession } from "./facts";
import { BENCH, CRUNCH, CURL, DAY, lookup, PULLUP, ROW, set, SQUAT, T0, workout } from "./test-helpers";

const none: PreviousSession = () => undefined;
const sessions = (map: Record<string, ReturnType<typeof set>[]>): PreviousSession => (id) => map[id];

describe("exerciseSessions", () => {
  test("groups working sets by exercise, merging an exercise logged twice", () => {
    const w = workout(T0, [
      [BENCH, [set(40, 10, "warmup"), set(80, 8)]],
      [CURL, [set(30, 10)]],
      [BENCH, [set(70, 10)]],
    ]);
    expect(exerciseSessions(w, lookup)).toEqual(
      new Map([
        [BENCH, [set(80, 8), set(70, 10)]],
        [CURL, [set(30, 10)]],
      ]),
    );
  });
});

describe("beatLastSession", () => {
  test("more weight by the step, or more reps at the same weight", () => {
    expect(beatLastSession([set(80, 5)], [set(82.5, 5)])).toBe(true);
    expect(beatLastSession([set(80, 5)], [set(80, 6)])).toBe(true);
    expect(beatLastSession([set(80, 5)], [set(81, 5)])).toBe(false);
    expect(beatLastSession([set(80, 5)], [set(80, 5)])).toBe(false);
  });

  test("bodyweight sets beat it with more reps", () => {
    expect(beatLastSession([set(null, 10)], [set(null, 11)])).toBe(true);
  });

  test("a first session has nothing to beat", () => {
    expect(beatLastSession(undefined, [set(100, 5)])).toBe(false);
  });

  test("uses the fixed stat step, whatever the routine says", () => {
    expect(beatLastSession([set(80, 5)], [set(80 + STAT_POINTS.stepKg, 5)])).toBe(true);
  });
});

describe("workoutFacts", () => {
  test("counts working sets per sub-muscle, with the time and week", () => {
    const w = workout(T0, [
      [BENCH, [set(40, 10, "warmup"), set(80, 8), set(90, 3), set(100, 1)]],
      [CURL, [set(30, 10), set(30, 10, "drop"), set(30, 6, "failure")]],
    ]);
    const facts = workoutFacts(w, lookup, none, "UTC");
    expect(facts.muscles.chest).toEqual({ sets: 3, progressed: 0, lastTrained: T0, weeks: ["2026-10-11"] });
    expect(facts.muscles.biceps).toMatchObject({ sets: 3 });
    expect(facts.muscles.quadriceps).toBeUndefined();
    expect(facts.progressed).toEqual([]);
  });

  test("bodyweight sets count like any other", () => {
    const facts = workoutFacts(workout(T0, [[PULLUP, [set(null, 10)]], [CRUNCH, [set(null, 20)]]]), lookup, none, "UTC");
    expect(facts.muscles.lats?.sets).toBe(1);
    expect(facts.muscles.abdominals?.sets).toBe(1);
  });

  test("every working set of an exercise that beat its last session is progressed", () => {
    const w = workout(T0, [
      [BENCH, [set(82.5, 5), set(82.5, 5), set(80, 5, "drop")]],
      [CURL, [set(30, 10)]],
    ]);
    const facts = workoutFacts(w, lookup, sessions({ [BENCH]: [set(80, 5)], [CURL]: [set(30, 10)] }), "UTC");
    expect(facts.muscles.chest).toMatchObject({ sets: 3, progressed: 3 });
    expect(facts.muscles.biceps).toMatchObject({ sets: 1, progressed: 0 });
    expect(facts.progressed).toEqual([BENCH]);
    expect(facts.progressedStats).toEqual(["chest"]);
  });

  test("at most 8 sets per stat count, progressed ones first; the rest still mark the muscle trained", () => {
    const w = workout(T0, [
      [ROW, Array.from({ length: 6 }, () => set(60, 10))],
      [PULLUP, Array.from({ length: 4 }, () => set(null, 9))],
    ]);
    const facts = workoutFacts(w, lookup, sessions({ [PULLUP]: [set(null, 8)] }), "UTC");
    const max = STAT_POINTS.maxSetsPerStat;
    // Rows (middle back) and pull-ups (lats) are both Back: 4 progressed pull-ups first, then 4 of the 6 rows.
    expect(facts.muscles.lats).toMatchObject({ sets: 4, progressed: 4 });
    expect(facts.muscles["middle back"]).toMatchObject({ sets: max - 4, progressed: 0, lastTrained: T0 });
  });

  test("the cap is per stat, not per workout", () => {
    const eight = Array.from({ length: 8 }, () => set(100, 5));
    const facts = workoutFacts(workout(T0, [[BENCH, eight], [SQUAT, eight]]), lookup, none, "UTC");
    expect(facts.muscles.chest?.sets).toBe(8);
    expect(facts.muscles.quadriceps?.sets).toBe(8);
  });
});

describe("mergeFacts", () => {
  const a: MusclesFacts = {
    chest: { sets: 10, progressed: 2, lastTrained: T0, weeks: ["2026-10-11"] },
  };
  const b: MusclesFacts = {
    chest: { sets: 4, progressed: 4, lastTrained: T0 - 7 * DAY, weeks: ["2026-10-04"] },
    lats: { sets: 3, progressed: 0, lastTrained: T0, weeks: ["2026-10-11"] },
  };

  test("adds the sets, keeps the latest time and the union of weeks", () => {
    expect(mergeFacts(a, b)).toEqual({
      chest: { sets: 14, progressed: 6, lastTrained: T0, weeks: ["2026-10-11", "2026-10-04"] },
      lats: b.lats,
    });
  });

  test("order doesn't matter", () => {
    expect(mergeFacts(a, b)).toEqual(mergeFacts(b, a));
  });

  test("keeps only the newest WEEKS_KEPT weeks", () => {
    let facts: MusclesFacts = {};
    for (let i = 0; i < WEEKS_KEPT + 3; i++) {
      facts = mergeFacts(facts, workoutFacts(workout(T0 - i * 7 * DAY, [[BENCH, [set(60, 5)]]]), lookup, none, "UTC").muscles);
    }
    expect(facts.chest?.weeks).toHaveLength(WEEKS_KEPT);
    expect(facts.chest?.weeks[0]).toBe("2026-10-11");
    expect(facts.chest?.sets).toBe(WEEKS_KEPT + 3);
  });

  test("doesn't mutate its inputs", () => {
    const copy = structuredClone(a);
    mergeFacts(a, b);
    expect(a).toEqual(copy);
  });
});
