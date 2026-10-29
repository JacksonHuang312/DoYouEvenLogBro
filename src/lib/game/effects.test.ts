import { describe, expect, test } from "vitest";
import { ACCESSORY_EFFECTS as FX, COMBAT, EFFECT_SCALE } from "./config";
import { setDef } from "./catalog";
import { gearEffects } from "./effects";

const worn = (baseId: string, rarity: string) => ({ baseId, rarity }) as { baseId: string; rarity: "common" | "rare" | "legendary" | "mythic" };

describe("gearEffects", () => {
  test("nothing worn does nothing", () => {
    expect(gearEffects([], 50)).toMatchObject({ crit: 0, healing: 0, damageReduction: 0, mythic: [] });
  });

  test("an accessory's effect scales with its rarity", () => {
    expect(gearEffects([worn("sunforged-ring", "legendary")], 50).crit).toBeCloseTo(FX.crit.value, 6);
    expect(gearEffects([worn("silver-loop", "rare")], 50).crit).toBeCloseTo(FX.crit.value * EFFECT_SCALE.rare, 6);
  });

  test("two rings add up, to the cap", () => {
    const two = gearEffects([worn("sunforged-ring", "legendary"), worn("sunforged-ring", "legendary")], 50);
    expect(two.crit).toBeCloseTo(2 * FX.crit.value, 6);
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
    for (const key of Object.keys(gearEffects([], 1))) expect(key).not.toMatch(/coin|xp/i);
    expect(Object.keys(gearEffects([], 1))).toContain("haste");
  });

  test("the new accessories carry the new effects", () => {
    expect(gearEffects([worn("phoenix-charm", "legendary")], 50).ultCharge).toBeCloseTo(FX.ultCharge.value, 6);
    expect(gearEffects([worn("chrono-charm", "legendary")], 50).haste).toBeCloseTo(FX.haste.value, 6);
    expect(gearEffects([worn("reapers-coil", "legendary")], 50).finisher).toBeCloseTo(FX.finisher.value, 6);
    expect(gearEffects([worn("thornhide-belt", "legendary")], 50).thorns).toBeCloseTo(FX.thorns.value, 6);
  });

  test("an Epic or Legendary set adds its effect only with all five pieces", () => {
    const slots = ["helmet", "chestplate", "gloves", "leggings", "boots"];
    const seraph = slots.map((s) => worn(`seraphs-grace-${s}`, "legendary"));
    expect(gearEffects(seraph, 50).healPower).toBeCloseTo(setDef("seraphs-grace")!.effect!.value, 6);
    expect(gearEffects(seraph.slice(0, 4), 50).healPower).toBe(0);
    // Set and accessory effects add up, to the cap.
    const halo = Array.from({ length: 4 }, () => worn("halo-pendant", "legendary"));
    expect(gearEffects([...seraph, ...halo], 50).healPower).toBe(COMBAT.effectCaps.healPower);
    // A Rare set has no effect.
    expect(gearEffects(slots.map((s) => worn(`lightwoven-${s}`, "rare")), 50)).toEqual(gearEffects([], 50));
  });

  test("the new Mythics, accessories included, add their unique effect", () => {
    expect(gearEffects([worn("executioners-ring", "mythic"), worn("dawn-censer", "mythic")], 50).mythic).toEqual(["dawn-censer", "executioners-ring"]);
  });
});
