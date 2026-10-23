import { describe, expect, test } from "vitest";
import library from "../../data/exercises.json";
import {
  POWER_MULTIPLIERS,
  STAT_MUSCLES,
  STATS,
  STRENGTH_STANDARDS,
  SUB_MUSCLES,
  FREQUENCY_WEEKS,
  WEEKS_KEPT,
  COINS,
  ACHIEVEMENTS,
  EQUIP_LEVEL,
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

  test("every sub-muscle has a strength standard and every stat a power multiplier", () => {
    for (const m of SUB_MUSCLES) expect(STRENGTH_STANDARDS[m], m).toBeGreaterThan(0);
    for (const s of STATS) expect(POWER_MULTIPLIERS[s], s).toBeGreaterThan(0);
    expect(POWER_MULTIPLIERS.core).toBe(0.5);
  });

  test("keeps enough weeks of history for the frequency score", () => {
    expect(WEEKS_KEPT).toBeGreaterThanOrEqual(FREQUENCY_WEEKS);
  });

  test("a single workout fits under the daily cap", () => {
    expect(COINS.base + COINS.scheduledBonus).toBeLessThanOrEqual(COINS.dailyCap);
  });

  test("level gates to equip: Epic 8, Legendary 15, Mythic 25", () => {
    expect([EQUIP_LEVEL.epic, EQUIP_LEVEL.legendary, EQUIP_LEVEL.mythic]).toEqual([8, 15, 25]);
  });

  test("gear tables cover every rarity, plus level and slot", () => {
    expect(GEAR.ascendedFactor).toHaveLength(GEAR.maxPlus + 1);
    for (const r of RARITIES) expect(UPGRADE_COSTS[r], r).toHaveLength(GEAR.maxPlus + 1);
    for (const slot of SLOTS) {
      const sum = Object.values(GEAR.slotFocus[slot]).reduce((a, b) => a + b, 0);
      expect(sum, slot).toBe(100);
    }
  });

  test("a Mythic armor piece is 30 base power; an accessory is about 40% of an armor piece", () => {
    expect(GEAR.basePower.mythic).toBe(30);
    for (const r of RARITIES) {
      const share = GEAR.accessoryPower[r] / GEAR.basePower[r];
      expect(share, r).toBeGreaterThan(0.3);
      expect(share, r).toBeLessThan(0.45);
    }
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
