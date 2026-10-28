import { baseItem } from "./catalog";
import { ACCESSORY_EFFECTS, COMBAT, MYTHIC_EFFECTS, type AccessoryEffect, type MythicEffect } from "./config";
import { canEquip, effectValue, type Item } from "./items";

/*
 * What equipped gear does beyond its power (GAME_DESIGN.md 10, Phase 5): accessory effects (crit,
 * healing, damage reduction, boss cooldown, salvage yield, shop reroll discount) and the Mythics'
 * unique effects. Duplicates add up to a cap per effect. Nothing here touches coins or XP earned:
 * the reward functions take no effects at all.
 */

export interface GearEffects {
  /** Shares (0.05 = 5%), each already capped. */
  crit: number;
  healing: number;
  damageReduction: number;
  bossCooldown: number;
  salvageYield: number;
  rerollDiscount: number;
  /** The Mythic effects worn, each once. */
  mythic: MythicEffect[];
}

export const NO_EFFECTS: GearEffects = {
  crit: 0,
  healing: 0,
  damageReduction: 0,
  bossCooldown: 0,
  salvageYield: 0,
  rerollDiscount: 0,
  mythic: [],
};

const isAccessoryEffect = (e: string): e is AccessoryEffect => e in ACCESSORY_EFFECTS;
const isMythicEffect = (e: string): e is MythicEffect => e in MYTHIC_EFFECTS;

/** The effects of the worn items. Items above the user's level do nothing, as with battle power. */
export function gearEffects(worn: Pick<Item, "baseId" | "rarity">[], level: number): GearEffects {
  const total: Partial<Record<AccessoryEffect, number>> = {};
  const mythic = new Set<MythicEffect>();
  for (const item of worn) {
    if (!canEquip(item, level)) continue;
    const effect = baseItem(item.baseId)?.effect;
    if (!effect) continue;
    if (isAccessoryEffect(effect)) total[effect] = (total[effect] ?? 0) + effectValue(effect, item.rarity);
    else if (isMythicEffect(effect)) mythic.add(effect);
  }
  const capped = (e: AccessoryEffect) => Math.min(COMBAT.effectCaps[e], total[e] ?? 0);
  return {
    crit: capped("crit"),
    healing: capped("healing"),
    damageReduction: capped("damageReduction"),
    bossCooldown: capped("bossCooldown"),
    salvageYield: capped("salvageYield"),
    rerollDiscount: capped("rerollDiscount"),
    mythic: [...mythic].sort(),
  };
}
