import { describe, expect, test } from "vitest";
import { COMBAT, EFFECT_SCALE } from "./config";
import { gearEffects } from "./effects";

const worn = (baseId: string, rarity: string) => ({ baseId, rarity }) as { baseId: string; rarity: "common" | "rare" | "legendary" | "mythic" };

describe("gearEffects", () => {
  test("nothing worn does nothing", () => {
    expect(gearEffects([], 50)).toMatchObject({ crit: 0, healing: 0, damageReduction: 0, mythic: [] });
  });

  test("an accessory's effect scales with its rarity", () => {
    expect(gearEffects([worn("sunforged-ring", "legendary")], 50).crit).toBeCloseTo(0.05, 6);
    expect(gearEffects([worn("silver-loop", "rare")], 50).crit).toBeCloseTo(0.05 * EFFECT_SCALE.rare, 6);
  });

  test("two rings add up, to the cap", () => {
    const two = gearEffects([worn("sunforged-ring", "legendary"), worn("sunforged-ring", "legendary")], 50);
    expect(two.crit).toBeCloseTo(0.1, 6);
    const many = gearEffects(Array.from({ length: 10 }, () => worn("sunforged-ring", "legendary")), 50);
    expect(many.crit).toBe(COMBAT.effectCaps.crit);
  });

  test("Mythics add their unique effect once, sorted", () => {
    const e = gearEffects([worn("unbroken-boots", "mythic"), worn("unbroken-helmet", "mythic"), worn("unbroken-helmet", "mythic")], 50);
    expect(e.mythic).toEqual(["unbroken-crown", "unbroken-path"]);
  });

  test("gear above the user's level does nothing", () => {
    expect(gearEffects([worn("sunforged-ring", "legendary")], 1).crit).toBe(0);
    expect(gearEffects([worn("unbroken-helmet", "mythic")], 10).mythic).toEqual([]);
  });

  test("effects never include coins or XP", () => {
    expect(Object.keys(gearEffects([], 1)).sort()).toEqual(
      ["bossCooldown", "crit", "damageReduction", "healing", "mythic", "rerollDiscount", "salvageYield"].sort(),
    );
  });
});
