import { describe, expect, test } from "vitest";
import { ACCESSORY_EFFECTS as FX, COMBAT, EFFECT_SCALE, WEAPONS } from "./config";
import { setDef } from "./catalog";
import { gearEffects } from "./effects";

type R = "common" | "rare" | "epic" | "legendary" | "mythic";
const worn = (baseId: string, rarity: string, itemLevel = 1) => ({ baseId, rarity: rarity as R, itemLevel });

describe("gearEffects", () => {
  test("nothing worn does nothing", () => {
    expect(gearEffects([], 100)).toMatchObject({ crit: 0, healing: 0, damageReduction: 0, mythic: [] });
  });

  test("an accessory's effect scales with its rarity", () => {
    expect(gearEffects([worn("sunforged-ring", "legendary")], 100).crit).toBeCloseTo(FX.crit.value, 6);
    expect(gearEffects([worn("silver-loop", "rare")], 100).crit).toBeCloseTo(FX.crit.value * EFFECT_SCALE.rare, 6);
  });

  test("two rings add up, to the cap", () => {
    const two = gearEffects([worn("sunforged-ring", "legendary"), worn("sunforged-ring", "legendary")], 100);
    expect(two.crit).toBeCloseTo(2 * FX.crit.value, 6);
    const many = gearEffects(Array.from({ length: 10 }, () => worn("sunforged-ring", "legendary")), 100);
    expect(many.crit).toBe(COMBAT.effectCaps.crit);
  });

  test("Mythics add their unique effect once, sorted", () => {
    const e = gearEffects([worn("unbroken-boots", "mythic"), worn("unbroken-helmet", "mythic"), worn("unbroken-helmet", "mythic")], 100);
    expect(e.mythic).toEqual(["unbroken-crown", "unbroken-path"]);
  });

  test("gear above the user's level does nothing", () => {
    expect(gearEffects([worn("sunforged-ring", "legendary", 30)], 29).crit).toBe(0);
    expect(gearEffects([worn("sunforged-ring", "legendary", 30)], 30).crit).toBeGreaterThan(0);
    expect(gearEffects([worn("unbroken-helmet", "mythic", 90)], 40).mythic).toEqual([]);
  });

  test("a weapon brings its type's effects at its rarity's strength, and a Mythic weapon its own effect too", () => {
    const staff = gearEffects([worn("willow-staff", "epic")], 100);
    expect(staff.healPower).toBeCloseTo(WEAPONS.staff.effects[0].value * EFFECT_SCALE.epic, 6);
    expect(staff.healing).toBeCloseTo(WEAPONS.staff.effects[1].value * EFFECT_SCALE.epic, 6);
    const shield = gearEffects([worn("tower-shield", "legendary")], 100);
    expect([shield.guardDuration, shield.bastionShield]).toEqual(WEAPONS.shield.effects.map((e) => e.value));
    expect(gearEffects([worn("recruits-blade", "common")], 100).critDamage).toBeCloseTo(0.1 * EFFECT_SCALE.common, 6);
    const kingsbane = gearEffects([worn("kingsbane", "mythic")], 100);
    expect(kingsbane.mythic).toEqual(["kingsbane"]);
    expect(kingsbane.critDamage).toBeCloseTo(0.1 * EFFECT_SCALE.mythic, 6);
  });

  test("effects never include coins or XP", () => {
    for (const key of Object.keys(gearEffects([], 1))) expect(key).not.toMatch(/coin|xp/i);
    expect(Object.keys(gearEffects([], 1))).toContain("haste");
  });

  test("the new accessories carry the new effects", () => {
    expect(gearEffects([worn("phoenix-charm", "legendary")], 100).ultCharge).toBeCloseTo(FX.ultCharge.value, 6);
    expect(gearEffects([worn("chrono-charm", "legendary")], 100).haste).toBeCloseTo(FX.haste.value, 6);
    expect(gearEffects([worn("reapers-coil", "legendary")], 100).finisher).toBeCloseTo(FX.finisher.value, 6);
    expect(gearEffects([worn("thornhide-belt", "legendary")], 100).thorns).toBeCloseTo(FX.thorns.value, 6);
  });

  test("a set adds its effect only with all five pieces, at the strength of its lowest rarity", () => {
    const slots = ["helmet", "chestplate", "gloves", "leggings", "boots"];
    const seraph = slots.map((s) => worn(`seraphs-grace-${s}`, "legendary"));
    expect(gearEffects(seraph, 100).healPower).toBeCloseTo(setDef("seraphs-grace")!.effect.value, 6);
    expect(gearEffects(seraph.slice(0, 4), 100).healPower).toBe(0);
    const mixed = [...seraph.slice(0, 4), worn("seraphs-grace-boots", "rare")];
    expect(gearEffects(mixed, 100).healPower).toBeCloseTo(setDef("seraphs-grace")!.effect.value * EFFECT_SCALE.rare, 6);
    // Set and accessory effects add up, to the cap.
    const halo = Array.from({ length: 4 }, () => worn("halo-pendant", "legendary"));
    expect(gearEffects([...seraph, ...halo], 100).healPower).toBe(COMBAT.effectCaps.healPower);
  });

  test("the new Mythics, accessories included, add their unique effect", () => {
    expect(gearEffects([worn("executioners-ring", "mythic"), worn("dawn-censer", "mythic")], 100).mythic).toEqual(["dawn-censer", "executioners-ring"]);
  });
});
