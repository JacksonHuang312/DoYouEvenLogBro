import { battlePower } from "./battle";
import { CLASSES, CLASS_IDS, POWER_MULTIPLIERS, STATS, type ClassId } from "./config";
import { buildFoe, buildHero, simulateFight, type FoeMechanics, type Hero } from "./combat";
import { BOSS_TYPES } from "./bossData";
import { gearEffects, NO_EFFECTS, type GearEffects } from "./effects";
import { baseItem } from "./catalog";
import type { StatLine } from "./score";

/*
 * Helpers for tuning and testing the fight engine: a hero with every stat equal and no gear whose
 * battle power is exactly `power`, and win rates over many seeds. Used by combat.test.ts and
 * scripts/combat-table.ts; nothing in the app runs these.
 */

const POWER_PER_EQUAL_STAT = STATS.reduce((sum, s) => sum + POWER_MULTIPLIERS[s], 0);

/** A hero of battle power `power` with every stat equal and no gear. */
export function balancedHero(power: number, classId: ClassId, effects: GearEffects = NO_EFFECTS): Hero {
  const pool = CLASSES[classId].bucketPct;
  const body = power / (1 + pool);
  const value = body / POWER_PER_EQUAL_STAT;
  const stats = Object.fromEntries(STATS.map((s) => [s, value])) as StatLine;
  const battle = battlePower({ body, equipped: [], level: 50, classPct: pool });
  return buildHero({ stats, battle, classId, effects });
}

/** The share of `runs` fights won by a balanced hero at `ratio` × the foe's power. */
export function winRate({
  classId,
  ratio,
  mechanics = {},
  foePower = 350,
  runs = 400,
  effects = NO_EFFECTS,
}: {
  classId: ClassId;
  ratio: number;
  mechanics?: FoeMechanics;
  foePower?: number;
  runs?: number;
  effects?: GearEffects;
}): number {
  const hero = balancedHero(foePower * ratio, classId, effects);
  const foe = buildFoe("Test", foePower, mechanics);
  let wins = 0;
  for (let i = 0; i < runs; i++) if (simulateFight(hero, foe, `tune-${i}`).won) wins++;
  return wins / runs;
}

const ARMOR = ["helmet", "chestplate", "gloves", "leggings", "boots"];
const set = (id: string) => ARMOR.map((slot) => `${id}-${slot}`);

/**
 * An endgame loadout per class, built from real catalog items: its Legendary set, the Mythic
 * accessory that suits it and the best accessories for it. Used for the win table's "fully
 * geared" rows, so no setup turns a fair fight into a sure win.
 */
export const FULLY_GEARED: Record<ClassId, string[]> = {
  vanguard: [...set("titans-vow"), "oathkeeper-belt", "sunforged-ring", "sunforged-ring", "heartstone-pendant", "chrono-charm", "phoenix-charm"],
  striker: [...set("ashen-covenant"), "executioners-ring", "reapers-coil", "mountainheart-girdle", "heartstone-pendant", "chrono-charm", "phoenix-charm"],
  cleric: [...set("seraphs-grace"), "saints-locket", "dawn-censer", "phoenix-charm", "sunforged-ring", "sunforged-ring", "mountainheart-girdle"],
};

/** The effects of a class's FULLY_GEARED loadout. */
export function fullyGearedEffects(classId: ClassId): GearEffects {
  return gearEffects(
    FULLY_GEARED[classId].map((id) => ({ baseId: id, rarity: baseItem(id)!.rarity })),
    50,
  );
}

/** The boss types the tuning table and tests compare (bossData.ts). */
export const ARCHETYPES = BOSS_TYPES;

export { CLASS_IDS };
