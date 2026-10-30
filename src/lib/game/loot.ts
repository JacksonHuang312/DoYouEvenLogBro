import { bossTowerDropTier } from "./bosses";
import { basesFor, type BaseKind } from "./catalog";
import { BOSS_DROPS, BOSS_TOWER, CAMPAIGN, ENDLESS_TOWER, ITEM_LEVEL, LOOT, RARITIES, WEEKLY_BOSS, type Rarity } from "./config";

/*
 * What fights pay (GAME_DESIGN.md 10, Phase 5): coins and scrap, gear drops and Mythic Cores, and the
 * Legendary and Mythic guarantees. Pure: the server passes in a seeded random source. These take no
 * gear effects, so nothing a player wears can change the coins earned.
 */

export interface DropTable {
  /** The chance of a gear drop. */
  chance: number;
  /** The rarity when it drops, by relative weight. */
  weights: Partial<Record<Rarity, number>>;
}

/** Wins since the last Legendary (or better) and the last Mythic, counted only on wins that could have dropped one. */
export interface Pity {
  sinceLegendary: number;
  sinceMythic: number;
}

export const NO_PITY: Pity = { sinceLegendary: 0, sinceMythic: 0 };

export interface Drop {
  /** The base item that dropped, or null. A new copy at `rarity` and `itemLevel`, +0. */
  baseId: string | null;
  rarity: Rarity | null;
  /** 0 when nothing dropped. */
  itemLevel: number;
  mythicCore: boolean;
  /** True when a guarantee forced it. */
  guaranteed: boolean;
  pity: Pity;
}

const weeklyTable = (tier: number): DropTable => BOSS_DROPS.tiers[Math.min(Math.max(tier, 1), BOSS_DROPS.tiers.length) - 1];

function pickRarity(weights: Partial<Record<Rarity, number>>, rand: () => number): Rarity {
  const entries = RARITIES.filter((r) => (weights[r] ?? 0) > 0);
  const total = entries.reduce((n, r) => n + weights[r]!, 0);
  let roll = rand() * total;
  for (const r of entries) {
    roll -= weights[r]!;
    if (roll < 0) return r;
  }
  return entries[entries.length - 1];
}

const KINDS = Object.keys(LOOT.kindWeights) as (keyof typeof LOOT.kindWeights)[];

/**
 * A random base for a drop at `rarity` and item level `level` (13.5): a unique Mythic for a Mythic,
 * otherwise a kind by LOOT.kindWeights (set piece, loose armor, accessory or weapon), then a base of
 * that kind that fits the level.
 */
export function pickBase(rarity: Rarity, level: number, rand: () => number): string | null {
  const pick = <T>(list: T[]) => (list.length ? list[Math.floor(rand() * list.length)] : null);
  if (rarity === "mythic") return pick(basesFor("mythic", level))?.id ?? null;
  const open = KINDS.filter((k) => basesFor(k as BaseKind, level).length > 0);
  const total = open.reduce((n, k) => n + LOOT.kindWeights[k], 0);
  let roll = rand() * total;
  const kind = open.find((k) => (roll -= LOOT.kindWeights[k]) < 0) ?? open[open.length - 1];
  return kind ? (pick(basesFor(kind as BaseKind, level))?.id ?? null) : null;
}

/** A drop's item level: up to LOOT.levelsBelow under `maxLevel` (the lower of the player's level and the source's), at least 1. */
export const dropLevel = (maxLevel: number, rand: () => number): number =>
  Math.max(ITEM_LEVEL.min, Math.min(ITEM_LEVEL.max, Math.floor(maxLevel)) - Math.floor(rand() * (LOOT.levelsBelow + 1)));

/** The highest item level each source gives (LOOT.sourceLevel). */
export const SOURCE_LEVEL = {
  campaign: (stage: number) => Math.max(ITEM_LEVEL.min, Math.round(stage * LOOT.sourceLevel.campaignPerStage)),
  endless: (floor: number) => LOOT.sourceLevel.endlessBase + floor,
  weekly: (tier: number) => LOOT.sourceLevel.weeklyTier[Math.min(Math.max(tier, 1), LOOT.sourceLevel.weeklyTier.length) - 1],
  bossTower: (floor: number) => Math.round(LOOT.sourceLevel.bossTowerBase + LOOT.sourceLevel.bossTowerPerFloor * floor),
};

/**
 * Rolls a drop from `table` and applies the guarantees. A guarantee only counts wins whose table
 * could have dropped that rarity, and a forced Mythic also brings a Mythic Core. `coreChance` is an
 * extra, separate chance of a Core. `maxLevel` caps the item level (your level and the source's).
 */
export function rollDrop({
  table,
  rand,
  pity,
  coreChance = 0,
  usePity = true,
  maxLevel = ITEM_LEVEL.max,
}: {
  table: DropTable;
  rand: () => number;
  pity: Pity;
  coreChance?: number;
  /** False for tables outside the guarantees (Campaign, endless tower). */
  usePity?: boolean;
  maxLevel?: number;
}): Drop {
  let rarity: Rarity | null = rand() < table.chance ? pickRarity(table.weights, rand) : null;
  let mythicCore = coreChance > 0 && rand() < coreChance;
  let guaranteed = false;

  const legendaryCounts = usePity && ((table.weights.legendary ?? 0) > 0 || (table.weights.mythic ?? 0) > 0);
  const mythicCounts = usePity && (table.weights.mythic ?? 0) > 0;
  if (mythicCounts && rarity !== "mythic" && pity.sinceMythic + 1 >= BOSS_DROPS.pity.mythic) {
    rarity = "mythic";
    mythicCore = true;
    guaranteed = true;
  } else if (legendaryCounts && rarity !== "legendary" && rarity !== "mythic" && pity.sinceLegendary + 1 >= BOSS_DROPS.pity.legendary) {
    rarity = "legendary";
    guaranteed = true;
  }

  const next: Pity = {
    sinceLegendary: rarity === "legendary" || rarity === "mythic" ? 0 : pity.sinceLegendary + (legendaryCounts ? 1 : 0),
    sinceMythic: rarity === "mythic" ? 0 : pity.sinceMythic + (mythicCounts ? 1 : 0),
  };
  const itemLevel = rarity ? dropLevel(maxLevel, rand) : 0;
  const baseId = rarity ? pickBase(rarity, itemLevel, rand) : null;
  return { baseId, rarity: baseId ? rarity : null, itemLevel: baseId ? itemLevel : 0, mythicCore, guaranteed, pity: next };
}

// ---- What each kind of fight pays ----

export interface Pay {
  coins: number;
  scrap: number;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/** The weekly boss: the week's first win pays in full, later wins pay WEEKLY_BOSS.refightShare. */
export function weeklyPay(tier: number, firstWinThisWeek: boolean): Pay {
  const i = Math.min(Math.max(tier, 1), WEEKLY_BOSS.coins.length) - 1;
  const share = firstWinThisWeek ? 1 : WEEKLY_BOSS.refightShare;
  return { coins: round5(WEEKLY_BOSS.coins[i] * share), scrap: Math.round(WEEKLY_BOSS.scrap[i] * share) };
}

/** A weekly boss win's drop: the tier's table, a Core chance from BOSS_DROPS.mythicCore.fromTier, and the guarantees. */
export const weeklyDrop = (tier: number, rand: () => number, pity: Pity, level: number = ITEM_LEVEL.max): Drop =>
  rollDrop({
    table: weeklyTable(tier),
    rand,
    pity,
    coreChance: tier >= BOSS_DROPS.mythicCore.fromTier ? BOSS_DROPS.mythicCore.chance : 0,
    maxLevel: Math.min(level, SOURCE_LEVEL.weekly(tier)),
  });

/** A Boss Tower floor: a first clear pays coins and scrap; a reclear pays BOSS_TOWER.reclearCoinShare of the coins, nothing else. */
export function bossTowerPay(floor: number, firstClear: boolean): Pay {
  const coins = BOSS_TOWER.coins.base + BOSS_TOWER.coins.perFloor * floor;
  if (!firstClear) return { coins: round5(coins * BOSS_TOWER.reclearCoinShare), scrap: 0 };
  return { coins, scrap: BOSS_TOWER.scrap.base + BOSS_TOWER.scrap.perFloor * floor };
}

/** A Boss Tower first clear's drop: BOSS_TOWER.gearChance at the floor's tier split, a Core chance every 10th floor. Reclears drop nothing. */
export function bossTowerDrop(floor: number, rand: () => number, pity: Pity, level: number = ITEM_LEVEL.max): Drop {
  const table = { chance: BOSS_TOWER.gearChance, weights: weeklyTable(bossTowerDropTier(floor)).weights };
  const coreChance = floor % BOSS_TOWER.coreEvery === 0 ? BOSS_TOWER.coreChance : 0;
  return rollDrop({ table, rand, pity, coreChance, maxLevel: Math.min(level, SOURCE_LEVEL.bossTower(floor)) });
}

/** A Campaign stage's first clear. */
export function campaignPay(stage: number): Pay {
  return {
    coins: CAMPAIGN.coins.base + CAMPAIGN.coins.perStage * stage,
    scrap: CAMPAIGN.scrap.base + Math.floor(stage / 6) * CAMPAIGN.scrap.perSixStages,
  };
}

export const campaignDrop = (rand: () => number, stage = 1, level: number = ITEM_LEVEL.max): Drop =>
  rollDrop({ table: CAMPAIGN.gear, rand, pity: NO_PITY, usePity: false, maxLevel: Math.min(level, SOURCE_LEVEL.campaign(stage)) });

/** An endless tower floor's first clear: base plus one coin per two floors, capped, and more every 10th floor. */
export function towerPay(floor: number): Pay {
  const c = ENDLESS_TOWER.coins;
  const coins = Math.min(c.max, c.base + Math.floor(floor / 2) * c.perTwoFloors) * (floor % 10 === 0 ? c.tenthFloorMultiplier : 1);
  return { coins, scrap: ENDLESS_TOWER.scrap.base + Math.floor(floor / 10) * ENDLESS_TOWER.scrap.perTenFloors };
}

export const towerDrop = (rand: () => number, floor = 1, level: number = ITEM_LEVEL.max): Drop =>
  rollDrop({ table: ENDLESS_TOWER.gear, rand, pity: NO_PITY, usePity: false, maxLevel: Math.min(level, SOURCE_LEVEL.endless(floor)) });
