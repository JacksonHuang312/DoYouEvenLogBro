import { describe, expect, test } from "vitest";
import library from "../../data/exercises.json";
import {
  POWER_MULTIPLIERS,
  STAT_MUSCLES,
  STATS,
  STAT_POINTS,
  SUB_MUSCLES,
  WEEKS_KEPT,
  COINS,
  ACHIEVEMENTS,
  GEAR,
  POSITIONS,
  RARITIES,
  SCHEDULE,
  SHOP,
  SLOTS,
  TITLES,
  UPGRADE_COSTS,
  positionsOf,
  slotOfPosition,
} from "./config";

describe("config", () => {
  test("the 17 sub-muscles are exactly the library's muscle values", () => {
    const libraryMuscles = [...new Set(library.map((e) => e.muscle))].sort();
    expect(SUB_MUSCLES).toHaveLength(17);
    expect([...SUB_MUSCLES].sort()).toEqual(libraryMuscles);
  });

  test("each sub-muscle belongs to exactly one stat", () => {
    expect(new Set(SUB_MUSCLES).size).toBe(SUB_MUSCLES.length);
  });

  test("each stat's sub-muscle weights sum to 100%", () => {
    for (const stat of STATS) {
      const sum = Object.values(STAT_MUSCLES[stat]).reduce((a, b) => a + b, 0);
      expect(sum, stat).toBeCloseTo(1, 10);
    }
  });

  test("every stat has a power multiplier: Legs and Back 1.2, Core 0.5", () => {
    for (const s of STATS) expect(POWER_MULTIPLIERS[s], s).toBeGreaterThan(0);
    expect([POWER_MULTIPLIERS.legs, POWER_MULTIPLIERS.back, POWER_MULTIPLIERS.core]).toEqual([1.2, 1.2, 0.5]);
  });

  test("a progressed set is worth more than a plain one", () => {
    expect(STAT_POINTS.progressedSet).toBeGreaterThan(STAT_POINTS.perSet);
  });

  test("a single workout fits under the daily cap", () => {
    expect(COINS.base + COINS.scheduledBonus).toBeLessThanOrEqual(COINS.dailyCap);
  });

  test("gear tables cover every rarity, plus level and slot", () => {
    for (const r of RARITIES) expect(UPGRADE_COSTS[r], r).toHaveLength(GEAR.maxPlus);
    for (const r of RARITIES) expect(GEAR.rarityMultiplier[r], r).toBeGreaterThanOrEqual(1);
    for (const slot of SLOTS) {
      const sum = Object.values(GEAR.slotFocus[slot]).reduce((a, b) => a + b, 0);
      expect(sum, slot).toBe(100);
    }
  });

  test("rarity climbs Common 1 to Mythic 2; an accessory is 40% of an armor piece, the weapon twice one", () => {
    const m = RARITIES.map((r) => GEAR.rarityMultiplier[r]);
    expect(m).toEqual([...m].sort((a, b) => a - b));
    expect([m[0], m[m.length - 1]]).toEqual([1, 2]);
    expect(GEAR.accessoryWeight).toBe(0.4);
    expect(GEAR.weaponWeight).toBe(2);
  });

  test("every position belongs to one slot, and rings and charms have two", () => {
    for (const p of POSITIONS) expect(SLOTS).toContain(slotOfPosition(p));
    expect(positionsOf("ring")).toEqual(["ring1", "ring2"]);
    expect(positionsOf("charm")).toEqual(["charm1", "charm2"]);
    expect(positionsOf("helmet")).toEqual(["helmet"]);
    for (const slot of SLOTS) expect(positionsOf(slot).length, slot).toBeGreaterThan(0);
  });

  test("shop rerolls and title slots line up with their limits", () => {
    expect(TITLES.slotCosts).toHaveLength(TITLES.maxSlots - TITLES.defaultSlots);
    expect(SHOP.rerollCosts.length).toBeGreaterThan(0);
  });

  test("achievements only look as far back as the facts are kept", () => {
    expect(ACHIEVEMENTS.ironHabit.outOf).toBeLessThanOrEqual(WEEKS_KEPT);
    expect(ACHIEVEMENTS.unbroken.days).toBeLessThanOrEqual(SCHEDULE.matchedWeeksKept * 7);
  });
});
