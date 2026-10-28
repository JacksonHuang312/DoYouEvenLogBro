import { bossTowerDropTier } from "./bosses";
import { BASE_ITEMS } from "./catalog";
import { BOSS_DROPS, BOSS_TOWER, CAMPAIGN, ENDLESS_TOWER, RARITIES, WEEKLY_BOSS, type Rarity } from "./config";

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
  /** The base item that dropped, or null. Its rarity is the base's own (a new copy, +0). */
  baseId: string | null;
  rarity: Rarity | null;
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

/** A random base item that starts at `rarity` (armor or accessory alike). */
export function pickBase(rarity: Rarity, rand: () => number): string | null {
  const bases = BASE_ITEMS.filter((b) => b.rarity === rarity);
  return bases.length ? bases[Math.floor(rand() * bases.length)].id : null;
}

/**
 * Rolls a drop from `table` and applies the guarantees. A guarantee only counts wins whose table
 * could have dropped that rarity, and a forced Mythic also brings a Mythic Core. `coreChance` is an
 * extra, separate chance of a Core.
 */
export function rollDrop({
  table,
  rand,
  pity,
  coreChance = 0,
  usePity = true,
}: {
  table: DropTable;
  rand: () => number;
  pity: Pity;
  coreChance?: number;
  /** False for tables outside the guarantees (Campaign, endless tower). */
  usePity?: boolean;
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
  const baseId = rarity ? pickBase(rarity, rand) : null;
  return { baseId, rarity: baseId ? rarity : null, mythicCore, guaranteed, pity: next };
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
export const weeklyDrop = (tier: number, rand: () => number, pity: Pity): Drop =>
  rollDrop({ table: weeklyTable(tier), rand, pity, coreChance: tier >= BOSS_DROPS.mythicCore.fromTier ? BOSS_DROPS.mythicCore.chance : 0 });

/** A Boss Tower floor: a first clear pays coins and scrap; a reclear pays BOSS_TOWER.reclearCoinShare of the coins, nothing else. */
export function bossTowerPay(floor: number, firstClear: boolean): Pay {
  const coins = BOSS_TOWER.coins.base + BOSS_TOWER.coins.perFloor * floor;
  if (!firstClear) return { coins: round5(coins * BOSS_TOWER.reclearCoinShare), scrap: 0 };
  return { coins, scrap: BOSS_TOWER.scrap.base + BOSS_TOWER.scrap.perFloor * floor };
}

/** A Boss Tower first clear's drop: BOSS_TOWER.gearChance at the floor's tier split, a Core chance every 10th floor. Reclears drop nothing. */
export function bossTowerDrop(floor: number, rand: () => number, pity: Pity): Drop {
  const table = { chance: BOSS_TOWER.gearChance, weights: weeklyTable(bossTowerDropTier(floor)).weights };
  const coreChance = floor % BOSS_TOWER.coreEvery === 0 ? BOSS_TOWER.coreChance : 0;
  return rollDrop({ table, rand, pity, coreChance });
}

/** A Campaign stage's first clear. */
export function campaignPay(stage: number): Pay {
  return {
    coins: CAMPAIGN.coins.base + CAMPAIGN.coins.perStage * stage,
    scrap: CAMPAIGN.scrap.base + Math.floor(stage / 6) * CAMPAIGN.scrap.perSixStages,
  };
}

export const campaignDrop = (rand: () => number): Drop => rollDrop({ table: CAMPAIGN.gear, rand, pity: NO_PITY, usePity: false });

/** An endless tower floor's first clear: base plus one coin per two floors, capped, and more every 10th floor. */
export function towerPay(floor: number): Pay {
  const c = ENDLESS_TOWER.coins;
  const coins = Math.min(c.max, c.base + Math.floor(floor / 2) * c.perTwoFloors) * (floor % 10 === 0 ? c.tenthFloorMultiplier : 1);
  return { coins, scrap: ENDLESS_TOWER.scrap.base + Math.floor(floor / 10) * ENDLESS_TOWER.scrap.perTenFloors };
}

export const towerDrop = (rand: () => number): Drop => rollDrop({ table: ENDLESS_TOWER.gear, rand, pity: NO_PITY, usePity: false });
