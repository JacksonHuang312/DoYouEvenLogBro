import { BOSS_TYPES, CAMPAIGN_CHAPTERS, TOWER_BOSSES, WEEKLY_BOSSES, type BossEntry } from "./bossData";
import { buildFoe, type Foe, type FoeMechanics } from "./combat";
import { BOSS_TOWER, CAMPAIGN, COMBAT, ENDLESS_TOWER, STATS, WEEKLY_BOSS, type Stat } from "./config";
import type { StatLine } from "./score";
import { daysBetween } from "./time";

/*
 * Where each fight's enemy comes from (GAME_DESIGN.md 10, Phase 5): the weekly boss and its tier,
 * endless tower floors, Boss Tower floors and Campaign stages, plus the boss stat minimums.
 */

/** A boss's mechanics: its type's, with its tweaks on top. */
export function mechanicsOf(entry: BossEntry): FoeMechanics {
  return { ...BOSS_TYPES[entry.type], ...(entry.tweak ?? {}) };
}

/** An enemy ready to fight, with what the fight screen and minimum check need. */
export interface Encounter {
  foe: Foe;
  /** The boss behind it; null for regular enemies. */
  boss: BossEntry | null;
  /** Recommended battle power. */
  power: number;
  minimums: Partial<Record<Stat, number>>;
}

function bossEncounter(entry: BossEntry, power: number): Encounter {
  return { foe: buildFoe(entry.name, power, mechanicsOf(entry)), boss: entry, power, minimums: entry.minimums ?? {} };
}

// ---- Weekly boss ----

/** The week's boss: the same for everyone, in WEEKLY_BOSSES order, repeating every 12 weeks. */
export function weeklyBoss(weekId: string): BossEntry {
  // Weeks since the first Sunday of 1970, so the order is the same for everyone.
  const week = Math.floor(daysBetween("1970-01-04", weekId) / 7);
  const n = WEEKLY_BOSSES.length;
  return WEEKLY_BOSSES[((week % n) + n) % n];
}

/** The tier (1 to 5) for a level and battle power: the highest the level allows whose power is within reach. */
export function weeklyTier(level: number, battlePower: number): number {
  let tier = 1;
  for (let i = 0; i < WEEKLY_BOSS.tierLevels.length; i++) {
    if (level >= WEEKLY_BOSS.tierLevels[i] && battlePower >= WEEKLY_BOSS.tierPower[i] * WEEKLY_BOSS.tierPowerShare) tier = i + 1;
  }
  return tier;
}

export const weeklyEncounter = (weekId: string, tier: number): Encounter =>
  bossEncounter(weeklyBoss(weekId), WEEKLY_BOSS.tierPower[Math.min(Math.max(tier, 1), WEEKLY_BOSS.tierPower.length) - 1]);

// ---- Endless tower ----

export const towerFloorPower = (floor: number) => Math.round(ENDLESS_TOWER.basePower * ENDLESS_TOWER.growth ** (floor - 1));

/** Floor `floor` (from 1): a Sentinel, a bleeding Stalker every 5th floor, a hard-hitting Warden every 10th. */
export function towerEncounter(floor: number): Encounter {
  const power = towerFloorPower(floor);
  const [name, mechanics] =
    floor % 10 === 0 ? ["Tower Warden", BOSS_TYPES.brute] : floor % 5 === 0 ? ["Tower Stalker", BOSS_TYPES.bleeder] : ["Tower Sentinel", BOSS_TYPES.plain];
  return { foe: buildFoe(`${name} (floor ${floor})`, power, mechanics), boss: null, power, minimums: {} };
}

// ---- Boss Tower ----

export const bossTowerPower = (floor: number) => Math.round(BOSS_TOWER.basePower * BOSS_TOWER.growth ** (floor - 1));

/** Floor `floor` (1 to BOSS_TOWER.floors), or null past the top. */
export function bossTowerEncounter(floor: number): Encounter | null {
  const entry = TOWER_BOSSES[floor - 1];
  return entry && floor <= BOSS_TOWER.floors ? bossEncounter(entry, bossTowerPower(floor)) : null;
}

/** The weekly drop tier a Boss Tower floor drops like: floors 1-6 tier 1, 7-12 tier 2, and so on. */
export const bossTowerDropTier = (floor: number) => Math.min(5, Math.ceil(floor / BOSS_TOWER.floorsPerTier));

// ---- Campaign ----

export const CAMPAIGN_STAGES = CAMPAIGN.chapters * CAMPAIGN.stagesPerChapter;
export const campaignPower = (stage: number) => Math.round(CAMPAIGN.basePower * CAMPAIGN.growth ** (stage - 1));

/** Stage `stage` (1 to CAMPAIGN_STAGES): regular enemies, and each chapter's boss on its last stage. */
export function campaignEncounter(stage: number): (Encounter & { chapter: number; stageInChapter: number }) | null {
  if (stage < 1 || stage > CAMPAIGN_STAGES) return null;
  const chapter = Math.ceil(stage / CAMPAIGN.stagesPerChapter);
  const stageInChapter = stage - (chapter - 1) * CAMPAIGN.stagesPerChapter;
  const ch = CAMPAIGN_CHAPTERS[chapter - 1];
  const power = campaignPower(stage);
  if (stageInChapter === CAMPAIGN.stagesPerChapter) return { ...bossEncounter(ch.boss, power), chapter, stageInChapter };
  const name = ch.enemies[(stageInChapter - 1) % ch.enemies.length];
  return { foe: buildFoe(name, power), boss: null, power, minimums: {}, chapter, stageInChapter };
}

// ---- Minimums (section 4) ----

export interface MinimumCheck {
  /** Whether the fight may start. */
  allowed: boolean;
  /** Every minimum: the stat needed and the hero's. */
  rows: { stat: Stat; needed: number; have: number; met: boolean; waived: boolean }[];
  /** True when some minimum is unmet and the hero is strong enough to fight anyway. */
  overpowered: boolean;
  /** The battle power that would allow it despite unmet minimums. */
  powerToOverride: number;
}

/**
 * Checks a boss's stat minimums. Under a minimum the fight is allowed only with
 * (1 + COMBAT.minimumMargin) × the boss's power. An injured stat's minimum is waived.
 */
export function checkMinimums({
  minimums,
  power,
  stats,
  heroPower,
  injured = [],
}: {
  minimums: Partial<Record<Stat, number>>;
  power: number;
  stats: StatLine;
  heroPower: number;
  injured?: Stat[];
}): MinimumCheck {
  const rows = STATS.filter((s) => minimums[s] != null).map((stat) => {
    const needed = Math.ceil((minimums[stat]! * power) / COMBAT.powerPerStat);
    const have = Math.round(stats[stat].value + stats[stat].bonus);
    const waived = injured.includes(stat);
    return { stat, needed, have, met: have >= needed, waived };
  });
  const unmet = rows.some((r) => !r.met && !r.waived);
  const powerToOverride = Math.ceil(power * (1 + COMBAT.minimumMargin));
  const overpowered = unmet && heroPower >= powerToOverride;
  return { allowed: !unmet || overpowered, rows, overpowered, powerToOverride };
}
