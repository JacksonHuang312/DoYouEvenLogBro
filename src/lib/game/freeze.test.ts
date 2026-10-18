import { describe, expect, test } from "vitest";
import { frozenMs, intervalsFor, NO_FREEZE } from "./freeze";
import { DAY } from "./test-helpers";

describe("frozenMs", () => {
  test("counts only the part inside the range", () => {
    expect(frozenMs([[0, 10 * DAY]], 2 * DAY, 5 * DAY)).toBe(3 * DAY);
    expect(frozenMs([[0, 10 * DAY]], 8 * DAY, 20 * DAY)).toBe(2 * DAY);
    expect(frozenMs([[20 * DAY, 30 * DAY]], 0, 10 * DAY)).toBe(0);
  });

  test("overlapping intervals count once", () => {
    expect(frozenMs([[0, 6 * DAY], [4 * DAY, 10 * DAY], [2 * DAY, 3 * DAY]], 0, 20 * DAY)).toBe(10 * DAY);
  });

  test("an empty or reversed range is 0", () => {
    expect(frozenMs([[0, DAY]], DAY, DAY)).toBe(0);
    expect(frozenMs([[0, DAY]], 2 * DAY, 0)).toBe(0);
    expect(frozenMs([], 0, DAY)).toBe(0);
  });
});

describe("intervalsFor", () => {
  test("a sub-muscle gets every pause plus only its own stat's injuries", () => {
    const freeze = { all: [[0, 1]] as const, byStat: { arms: [[2, 3]] as const } };
    const f = { all: [...freeze.all], byStat: { arms: [...freeze.byStat.arms] } };
    expect(intervalsFor(f, "biceps")).toEqual([[0, 1], [2, 3]]);
    expect(intervalsFor(f, "chest")).toEqual([[0, 1]]);
    expect(intervalsFor(NO_FREEZE, "chest")).toEqual([]);
  });
});
