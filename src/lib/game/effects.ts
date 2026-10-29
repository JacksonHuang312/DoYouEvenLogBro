import { baseItem, setDef } from "./catalog";
import { ACCESSORY_EFFECTS, COMBAT, MYTHIC_EFFECTS, SET_BONUS, type AccessoryEffect, type MythicEffect } from "./config";
import { activeSet, canEquip, effectValue, type Item } from "./items";

/*
 * What equipped gear does beyond its power (GAME_DESIGN.md 10, Phase 5): accessory effects, the
 * 5-piece effect of an Epic or Legendary set, and the Mythics' unique effects. Duplicates add up
 * to a cap per effect. Nothing here touches coins or XP earned: the reward functions take no
 * effects at all.
 */

/** Every accessory effect as a share (0.05 = 5%), each already capped, plus the Mythic effects worn. */
export type GearEffects = Record<AccessoryEffect, number> & {
  /** The Mythic effects worn, each once. */
  mythic: MythicEffect[];
};

const EFFECT_IDS = Object.keys(ACCESSORY_EFFECTS) as AccessoryEffect[];

export const NO_EFFECTS: GearEffects = {
  ...(Object.fromEntries(EFFECT_IDS.map((e) => [e, 0])) as Record<AccessoryEffect, number>),
  mythic: [],
};

const isAccessoryEffect = (e: string): e is AccessoryEffect => e in ACCESSORY_EFFECTS;
const isMythicEffect = (e: string): e is MythicEffect => e in MYTHIC_EFFECTS;

/** The pieces a set needs worn for its effect: the top SET_BONUS tier. */
export const SET_EFFECT_PIECES = SET_BONUS[SET_BONUS.length - 1].pieces;

/** The effects of the worn items. Items above the user's level do nothing, as with battle power. */
export function gearEffects(worn: Pick<Item, "baseId" | "rarity">[], level: number): GearEffects {
  const total: Partial<Record<AccessoryEffect, number>> = {};
  const add = (e: AccessoryEffect, value: number) => (total[e] = (total[e] ?? 0) + value);
  const mythic = new Set<MythicEffect>();
  const usable = worn.filter((item) => canEquip(item, level));
  for (const item of usable) {
    const effect = baseItem(item.baseId)?.effect;
    if (!effect) continue;
    if (isAccessoryEffect(effect)) add(effect, effectValue(effect, item.rarity));
    else if (isMythicEffect(effect)) mythic.add(effect);
  }
  const set = activeSet(usable);
  const setEffect = set && set.pieces >= SET_EFFECT_PIECES ? setDef(set.setId)?.effect : undefined;
  if (setEffect) add(setEffect.id, setEffect.value);

  return {
    ...(Object.fromEntries(EFFECT_IDS.map((e) => [e, Math.min(COMBAT.effectCaps[e], total[e] ?? 0)])) as Record<AccessoryEffect, number>),
    mythic: [...mythic].sort(),
  };
}
