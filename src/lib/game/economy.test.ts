import { describe, expect, test } from "vitest";
import { COINS, XP } from "./config";
import { coinPayout, levelForXp, levelProgress, scheduledBonus, statXp, workoutXp } from "./economy";

describe("scheduledBonus", () => {
  test("full on the day, −20% per day off, 0 beyond 3 days", () => {
    expect(scheduledBonus(0)).toBe(COINS.scheduledBonus);
    expect(scheduledBonus(1)).toBe(Math.round(COINS.scheduledBonus * 0.8));
    expect(scheduledBonus(-2)).toBe(Math.round(COINS.scheduledBonus * 0.6));
    expect(scheduledBonus(3)).toBe(Math.round(COINS.scheduledBonus * 0.4));
    expect(scheduledBonus(4)).toBe(0);
  });

  test("unscheduled workouts get none", () => {
    expect(scheduledBonus(null)).toBe(0);
  });
});

describe("coinPayout", () => {
  test("base + scheduled bonus", () => {
    expect(coinPayout({ daysOff: 0, earnedToday: 0 })).toEqual({
      base: COINS.base,
      scheduledBonus: COINS.scheduledBonus,
      capped: 0,
      total: COINS.base + COINS.scheduledBonus,
    });
    expect(coinPayout({ daysOff: null, earnedToday: 0 }).total).toBe(COINS.base);
  });

  test("the daily cap holds back the rest", () => {
    const nearCap = COINS.dailyCap - 10;
    expect(coinPayout({ daysOff: null, earnedToday: nearCap })).toEqual({
      base: COINS.base,
      scheduledBonus: 0,
      capped: COINS.base - 10,
      total: 10,
    });
    expect(coinPayout({ daysOff: null, earnedToday: COINS.dailyCap }).total).toBe(0);
    expect(coinPayout({ daysOff: null, earnedToday: COINS.dailyCap + 999 }).total).toBe(0);
  });
});

describe("statXp", () => {
  test("pays for power above the previous peak only", () => {
    expect(statXp(110, 100)).toBe(10 * XP.perPowerPoint);
    expect(statXp(90, 100)).toBe(0);
    expect(statXp(100.04, 100)).toBe(Math.round(0.04 * XP.perPowerPoint));
  });
});

describe("workoutXp", () => {
  const HOUR = 60 * 60 * 1000;
  test("pays at most once per cooldown", () => {
    const t = Date.UTC(2026, 9, 14, 12);
    expect(workoutXp(null, t)).toBe(XP.perWorkout);
    expect(workoutXp(t - (XP.workoutCooldownHours * HOUR - 1), t)).toBe(0);
    expect(workoutXp(t - XP.workoutCooldownHours * HOUR, t)).toBe(XP.perWorkout);
  });
});

describe("levels", () => {
  test("start at 1 and are flat", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(XP.perLevel - 1)).toBe(1);
    expect(levelForXp(XP.perLevel)).toBe(2);
    expect(levelForXp(XP.perLevel * 100)).toBe(101);
    expect(levelForXp(-5)).toBe(1);
  });

  test("progress through the current level", () => {
    expect(levelProgress(XP.perLevel + 30)).toEqual({ level: 2, into: 30, needed: XP.perLevel });
  });
});
