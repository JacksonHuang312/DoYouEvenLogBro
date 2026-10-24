import { describe, expect, it } from "vitest";
import { draftFromRoutine, setRepRange } from "./draft";
import type { Routine } from "./types";

const routine: Routine = {
  id: "r1",
  name: "Push day",
  updatedAt: 1,
  exercises: [
    { exerciseId: "bench", name: "Bench", sets: 3, restSec: 90, repMin: 6, repMax: 9, stepKg: 1.25 },
    { exerciseId: "dips", name: "Dips", sets: 2, restSec: 60 },
  ],
};

describe("draftFromRoutine and rep ranges", () => {
  it("remembers the routine and copies each exercise's range and step", () => {
    const draft = draftFromRoutine(routine, ["k1", "k2"]);
    expect(draft.routineId).toBe("r1");
    expect(draft.exercises[0]).toMatchObject({ key: "k1", repMin: 6, repMax: 9, stepKg: 1.25 });
  });

  it("leaves exercises without a range free of the fields (no undefined keys)", () => {
    const dips = draftFromRoutine(routine, ["k1", "k2"]).exercises[1];
    expect("repMin" in dips).toBe(false);
    expect("repMax" in dips).toBe(false);
    expect("stepKg" in dips).toBe(false);
  });

  it("ignores a half-set range from an older or broken routine", () => {
    const half: Routine = { ...routine, exercises: [{ exerciseId: "x", name: "X", sets: 1, restSec: 0, repMin: 6, stepKg: 2 }] };
    const ex = draftFromRoutine(half, ["k"]).exercises[0];
    expect("repMin" in ex).toBe(false);
    expect("stepKg" in ex).toBe(false);
  });
});

describe("setRepRange", () => {
  it("sets a range on one exercise and leaves the others alone", () => {
    const draft = draftFromRoutine(routine, ["k1", "k2"]);
    const next = setRepRange(draft, "k2", { repMin: 8, repMax: 12 });
    expect(next.exercises[1]).toMatchObject({ repMin: 8, repMax: 12 });
    expect(next.exercises[0]).toEqual(draft.exercises[0]);
    expect(draft.exercises[1]).not.toHaveProperty("repMin");
  });

  it("clears the range and the step with null", () => {
    const draft = draftFromRoutine(routine, ["k1", "k2"]);
    const next = setRepRange(draft, "k1", null);
    expect("repMin" in next.exercises[0]).toBe(false);
    expect("repMax" in next.exercises[0]).toBe(false);
    expect("stepKg" in next.exercises[0]).toBe(false);
  });

  it("changes nothing for an unknown exercise", () => {
    const draft = draftFromRoutine(routine, ["k1", "k2"]);
    expect(setRepRange(draft, "nope", { repMin: 1, repMax: 2 }).exercises).toEqual(draft.exercises);
  });
});
