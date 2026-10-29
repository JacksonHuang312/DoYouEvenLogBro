import { describe, expect, it } from "vitest";
import { effortLong, effortOption, effortScaleOf, effortShort, effortValue, isValidRpe, RPE_OPTIONS } from "./effort";

describe("effort (RPE and RIR)", () => {
  it("offers RPE 5 to 10 in half steps", () => {
    expect(RPE_OPTIONS).toEqual([5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
  });

  it("only stores the picker's values", () => {
    expect(isValidRpe(8.5)).toBe(true);
    expect(isValidRpe(10)).toBe(true);
    expect(isValidRpe(4.5)).toBe(false);
    expect(isValidRpe(8.25)).toBe(false);
    expect(isValidRpe(null)).toBe(false);
    expect(isValidRpe("8")).toBe(false);
  });

  it("RIR is 10 − RPE", () => {
    expect(effortValue(8, "rir")).toBe(2);
    expect(effortValue(8, "rpe")).toBe(8);
    expect(effortOption(8.5, "rir")).toBe("1.5");
    expect(effortOption(10, "rir")).toBe("0");
  });

  it("formats short and long forms", () => {
    expect(effortShort(8, "rpe")).toBe("@8");
    expect(effortShort(7.5, "rpe")).toBe("@7.5");
    expect(effortShort(8, "rir")).toBe("2 RIR");
    expect(effortLong(9, "rpe")).toBe("RPE 9");
    expect(effortLong(9, "rir")).toBe("1 rep in reserve");
    expect(effortLong(7, "rir")).toBe("3 reps in reserve");
  });

  it("profiles without the setting use RPE", () => {
    expect(effortScaleOf(null)).toBe("rpe");
    expect(effortScaleOf({})).toBe("rpe");
    expect(effortScaleOf({ effortScale: "rir" })).toBe("rir");
  });
});
