import { describe, expect, test } from "vitest";
import { monthGrid, monthInRange, monthLabel, monthStart, shiftMonth } from "./calendar";

const OPTS = { today: "2026-10-18", min: "2026-10-18", max: "2026-12-13", selected: null };

const real = (grid: ReturnType<typeof monthGrid>) => grid.flat().filter((c) => c != null);

describe("monthGrid", () => {
  test("starts on Sunday: October 2026 begins on a Thursday", () => {
    const grid = monthGrid("2026-10-18", OPTS);
    expect(grid[0].map((c) => c?.date ?? null)).toEqual([null, null, null, null, 1, 2, 3]);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    // 4 blanks + 31 days = 35 cells: 5 full weeks.
    expect(grid).toHaveLength(5);
    expect(grid[4].at(-1)?.date).toBe(31);
  });

  test("pads the last week with blanks", () => {
    const grid = monthGrid("2026-11-01", OPTS);
    expect(grid[0][0]?.date).toBe(1);
    expect(grid.at(-1)?.at(-1)).toBeNull();
    expect(real(grid)).toHaveLength(30);
  });

  test("disables days before min and after max, keeps both ends pickable", () => {
    const oct = real(monthGrid("2026-10-18", OPTS));
    expect(oct.find((c) => c.date === 17)?.disabled).toBe(true);
    expect(oct.find((c) => c.date === 18)?.disabled).toBe(false);
    const dec = real(monthGrid("2026-12-01", OPTS));
    expect(dec.find((c) => c.date === 13)?.disabled).toBe(false);
    expect(dec.find((c) => c.date === 14)?.disabled).toBe(true);
  });

  test("marks today and the selected day", () => {
    const cells = real(monthGrid("2026-10-18", { ...OPTS, selected: "2026-10-25" }));
    expect(cells.filter((c) => c.today).map((c) => c.day)).toEqual(["2026-10-18"]);
    expect(cells.filter((c) => c.selected).map((c) => c.day)).toEqual(["2026-10-25"]);
  });
});

describe("month helpers", () => {
  test("shiftMonth crosses year ends both ways", () => {
    expect(shiftMonth("2026-12-20", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-20", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-10-18", 0)).toBe("2026-10-01");
  });

  test("labels and starts", () => {
    expect(monthLabel("2026-10-18")).toBe("October 2026");
    expect(monthStart("2026-10-18")).toBe("2026-10-01");
  });

  test("monthInRange stops the arrows at the allowed range", () => {
    expect(monthInRange("2026-09-01", "2026-10-18", "2026-12-13")).toBe(false);
    expect(monthInRange("2026-10-01", "2026-10-18", "2026-12-13")).toBe(true);
    expect(monthInRange("2026-12-01", "2026-10-18", "2026-12-13")).toBe(true);
    expect(monthInRange("2027-01-01", "2026-10-18", "2026-12-13")).toBe(false);
  });
});
