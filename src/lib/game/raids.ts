import { BOSS_TYPES, RAID_BOSSES, type RaidBossEntry } from "./bossData";
import type { Hero } from "./combat";
import { BOSS_DROPS, RAID, type Rarity } from "./config";
import { fightWeek } from "./fights";
import { NO_PITY, rollDrop } from "./loot";
import { buildRaidFoe, simulateParty, type PartyResult, type RaidFoe } from "./party";
import { seeded } from "./random";
import { daysBetween } from "./time";

/*
 * Raid rules (GAME_DESIGN.md 13.10 and 13.30): the week's raid boss and its tiers, who may enter
 * together, the one-raid-a-week lockout, and what a win pays each member. Pure. The lobby and the
 * server route (stage 3) call these; nothing here reads or writes anything.
 */

export const RAID_TIERS = RAID.tierLevels.length;
const tierIndex = (tier: number) => Math.min(Math.max(Math.floor(tier), 1), RAID_TIERS) - 1;

/** The week's raid boss: the same for everyone, in RAID_BOSSES order. `weekId` is the fight week. */
export function raidBoss(weekId: string): RaidBossEntry {
  const week = Math.floor(daysBetween("1970-01-04", weekId) / 7);
  const n = RAID_BOSSES.length;
  return RAID_BOSSES[((week % n) + n) % n];
}

export interface RaidEncounter {
  boss: RaidBossEntry;
  foe: RaidFoe;
  tier: number;
  /** Recommended battle power per member. */
  power: number;
  /** The level and battle power each member needs to enter. */
  minLevel: number;
  minPower: number;
}

/** The week's boss at `tier`, sized for a party of `size`. */
export function raidEncounter(weekId: string, tier: number, size: number): RaidEncounter {
  const i = tierIndex(tier);
  const boss = raidBoss(weekId);
  const power = RAID.tierPower[i];
  const mechanics = { ...BOSS_TYPES[boss.type], ...(boss.tweak ?? {}) };
  return {
    boss,
    foe: buildRaidFoe(boss.name, power, size, { ...mechanics, atk: (mechanics.atk ?? 1) * RAID.bossAtk, cleave: boss.cleave ?? false }),
    tier: i + 1,
    power,
    minLevel: RAID.tierLevels[i],
    minPower: Math.ceil(power * RAID.tierPowerShare),
  };
}

/** What the rules need to know about someone in a party. */
export interface RaidMember {
  uid: string;
  level: number;
  /** Battle power, as they would fight. */
  power: number;
  /** The fight week of their last raid, or null: one raid a week. */
  lastRaidWeek: string | null;
}

/** The highest tier a player may enter by their own level and power, or 0 if none yet. */
export function raidTierFor(level: number, power: number): number {
  let tier = 0;
  for (let i = 0; i < RAID_TIERS; i++) {
    if (level >= RAID.tierLevels[i] && power >= RAID.tierPower[i] * RAID.tierPowerShare) tier = i + 1;
  }
  return tier;
}

export interface PartyCheck {
  /** Whether the leader may start. */
  allowed: boolean;
  /** Why not, about the party as a whole (its size, the level spread). Null when that is fine. */
  reason: string | null;
  /** Why each member can't enter, by uid. A member with no entry is fine. */
  problems: Record<string, string>;
}

/**
 * Whether these members may raid `tier` together in fight week `weekId`: 2 to 4 of them, each one
 * once, all within RAID.levelBand levels of each other, and each with the tier's level and power
 * and no raid yet this week.
 */
export function checkParty(members: RaidMember[], tier: number, weekId: string): PartyCheck {
  const i = tierIndex(tier);
  const minPower = Math.ceil(RAID.tierPower[i] * RAID.tierPowerShare);
  const problems: Record<string, string> = {};
  for (const m of members) {
    if (m.lastRaidWeek === weekId) problems[m.uid] = "Already raided this week";
    else if (m.level < RAID.tierLevels[i]) problems[m.uid] = `Needs level ${RAID.tierLevels[i]}`;
    else if (m.power < minPower) problems[m.uid] = `Needs ${minPower} battle power`;
  }
  let reason: string | null = null;
  if (new Set(members.map((m) => m.uid)).size !== members.length) reason = "Someone is in the party twice";
  else if (members.length < RAID.minParty) reason = `A raid needs at least ${RAID.minParty} players`;
  else if (members.length > RAID.maxParty) reason = `A raid takes at most ${RAID.maxParty} players`;
  else {
    const levels = members.map((m) => m.level);
    if (Math.max(...levels) - Math.min(...levels) > RAID.levelBand) reason = `Everyone must be within ${RAID.levelBand} levels of each other`;
  }
  return { allowed: reason == null && Object.keys(problems).length === 0, reason, problems };
}

/** Whether a player has used this fight week's raid. */
export const raidedThisWeek = (lastRaidWeek: string | null | undefined, now: number, timeZone: string): boolean =>
  lastRaidWeek === fightWeek(now, timeZone);

export interface RaidReward {
  uid: string;
  coins: number;
  scrap: number;
  /** Whether their power was a big enough share of the party's to roll for loot. */
  lootEligible: boolean;
  /** Their share of the party's total battle power, 0 to 1. */
  contribution: number;
  /** The gear they won, at their own item level, or null. */
  drop: { baseId: string; rarity: Rarity; itemLevel: number } | null;
}

/**
 * What a raid pays each member. A loss pays nothing. A win pays everyone the tier's coins and scrap;
 * each member whose battle power is at least RAID.minContributionShare of the party's total also
 * rolls for gear, with their own roll, at their own level (capped by the tier). So carrying a much
 * weaker account through pays it coins, never loot.
 */
export function raidRewards({ won, tier, members, seed }: { won: boolean; tier: number; members: Pick<RaidMember, "uid" | "level" | "power">[]; seed: string }): RaidReward[] {
  const i = tierIndex(tier);
  const total = members.reduce((n, m) => n + Math.max(0, m.power), 0);
  return members.map((m) => {
    const contribution = total > 0 ? Math.max(0, m.power) / total : 0;
    const lootEligible = contribution >= RAID.minContributionShare;
    if (!won) return { uid: m.uid, coins: 0, scrap: 0, lootEligible, contribution, drop: null };
    let drop: RaidReward["drop"] = null;
    if (lootEligible) {
      // Each member's own roll: nobody's luck depends on who else is in the party.
      const rolled = rollDrop({
        table: { chance: RAID.gearChance, weights: BOSS_DROPS.tiers[i].weights },
        rand: seeded(`raid-loot:${seed}:${m.uid}`),
        pity: NO_PITY,
        usePity: false,
        maxLevel: Math.min(m.level, RAID.itemLevel[i]),
      });
      if (rolled.baseId && rolled.rarity) drop = { baseId: rolled.baseId, rarity: rolled.rarity, itemLevel: rolled.itemLevel };
    }
    return { uid: m.uid, coins: RAID.coins[i], scrap: RAID.scrap[i], lootEligible, contribution, drop };
  });
}

export interface RaidOutcome {
  encounter: RaidEncounter;
  result: PartyResult;
  rewards: RaidReward[];
}

/**
 * Runs a raid for a party that `checkParty` allowed: the week's boss at `tier`, sized to the party,
 * fought once from `seed`, and what each member is paid. Members fight in the order given.
 */
export function runRaid({
  weekId,
  tier,
  members,
  seed,
}: {
  weekId: string;
  tier: number;
  members: (Pick<RaidMember, "uid" | "level" | "power"> & { hero: Hero })[];
  seed: string;
}): RaidOutcome {
  const encounter = raidEncounter(weekId, tier, members.length);
  const result = simulateParty(members.map((m) => m.hero), encounter.foe, seed);
  return { encounter, result, rewards: raidRewards({ won: result.won, tier: encounter.tier, members, seed }) };
}
