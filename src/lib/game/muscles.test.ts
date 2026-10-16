import { describe, expect, test } from "vitest";
import { STATS, SUB_MUSCLES } from "./config";
import { closestMuscle, FALLBACK_MUSCLE, isSubMuscle, MUSCLE_GROUPS, statOf } from "./muscles";

describe("isSubMuscle", () => {
  test("accepts only the 17 values", () => {
    expect(isSubMuscle("middle back")).toBe(true);
    expect(isSubMuscle("Middle Back")).toBe(false);
    expect(isSubMuscle("quads")).toBe(false);
    expect(isSubMuscle(42)).toBe(false);
  });
});

describe("statOf", () => {
  test("finds the stat a sub-muscle belongs to", () => {
    expect(statOf("chest")).toBe("chest");
    expect(statOf("lats")).toBe("back");
    expect(statOf("neck")).toBe("shoulders");
    expect(statOf("forearms")).toBe("arms");
    expect(statOf("abductors")).toBe("legs");
    expect(statOf("abdominals")).toBe("core");
  });
});

describe("MUSCLE_GROUPS", () => {
  test("lists every sub-muscle once, grouped in stat order", () => {
    expect(MUSCLE_GROUPS.map((g) => g.stat)).toEqual([...STATS]);
    expect(MUSCLE_GROUPS.flatMap((g) => g.muscles).sort()).toEqual([...SUB_MUSCLES].sort());
  });
});

describe("closestMuscle", () => {
  test("keeps valid values", () => {
    for (const m of SUB_MUSCLES) expect(closestMuscle(m)).toEqual({ muscle: m, match: "exact" });
    expect(closestMuscle("  Lower-Back ")).toEqual({ muscle: "lower back", match: "exact" });
  });

  test("maps common names", () => {
    expect(closestMuscle("Quads").muscle).toBe("quadriceps");
    expect(closestMuscle("abs").muscle).toBe("abdominals");
    expect(closestMuscle("Delts").muscle).toBe("shoulders");
    expect(closestMuscle("pecs").muscle).toBe("chest");
    expect(closestMuscle("upper back").muscle).toBe("middle back");
    expect(closestMuscle("inner thigh").muscle).toBe("adductors");
    expect(closestMuscle("bicep").match).toBe("alias");
  });

  test("finds a muscle named inside longer text", () => {
    expect(closestMuscle("upper chest")).toEqual({ muscle: "chest", match: "word" });
    expect(closestMuscle("rear delts")).toEqual({ muscle: "shoulders", match: "word" });
    expect(closestMuscle("glutes and hamstrings").muscle).toBe("hamstrings");
  });

  test("corrects near spellings", () => {
    expect(closestMuscle("hamstrngs")).toEqual({ muscle: "hamstrings", match: "fuzzy" });
    expect(closestMuscle("tricepts")).toEqual({ muscle: "triceps", match: "fuzzy" });
  });

  test("falls back when nothing resembles a muscle", () => {
    expect(closestMuscle("full body")).toEqual({ muscle: FALLBACK_MUSCLE, match: "fallback" });
    expect(closestMuscle("")).toEqual({ muscle: FALLBACK_MUSCLE, match: "fallback" });
    expect(closestMuscle("xyz").match).toBe("fallback");
  });
});
