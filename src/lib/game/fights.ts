import { battlePower, type BattlePower, type GearPiece } from "./battle";
import { activePause, freezeFor, injuredStats } from "./breaks";
import { baseItem } from "./catalog";
import { energyOf, type GameState } from "./claim";
import { buildHero, simulateFight, type FightResult, type Hero } from "./combat";
import { BOSS_TOWER, ENDLESS_TOWER, ENERGY, WEEKLY_BOSS, type Rarity, type Stat } from "./config";
import {
  bossTowerEncounter,
  CAMPAIGN_STAGES,
  campaignEncounter,
  checkMinimums,
  towerEncounter,
  weeklyEncounter,
  weeklyTier,
  type Encounter,
  type MinimumCheck,
} from "./bosses";
import { gearEffects } from "./effects";
import { classBonusPct } from "./heroClass";
import { boosted } from "./levels";
import { fail, materialsOf, newItem, ok, type GameResult, type Item } from "./items";
import {
  bossTowerDrop,
  bossTowerPay,
  campaignDrop,
  campaignPay,
  NO_PITY,
  towerDrop,
  towerPay,
  weeklyDrop,
  weeklyPay,
  type Drop,
  type Pity,
} from "./loot";
import type { MusclesFacts } from "./facts";
import { seeded } from "./random";
import { computeStats, power, rustedStats, statRust, type StatLine } from "./score";
import { addDays, dayId, dayStartMs, weekId } from "./time";
import { titleBonusPct } from "./titles";
import { STAT_LABELS } from "./view";

/*
 * The four fight modes on the server (GAME_DESIGN.md 10, Phase 5): the weekly boss, the endless
 * tower, the Boss Tower and the Campaign. Pure: the route reads the documents, calls `runFight`
 * with a server-made seed, then `applyFightRewards`, and writes the results in one transaction.
 * Fights use rusted stats; an injury flag waives only that stat's boss minimum; a paused player
 * fights with frozen stats (rust doesn't run while paused). Nothing a player wears changes the
 * coins earned: the pay functions take no effects.
 */

const HOUR_MS = 60 * 60 * 1000;

export const FIGHT_MODES = ["weekly", "endless", "bossTower", "campaign"] as const;
export type FightMode = (typeof FIGHT_MODES)[number];

/** This fight week's weekly boss: its tier is locked by the week's first fight. */
export interface WeeklyProgress {
  weekId: string;
  tier: number;
  wins: number;
  fights: number;
  /** The fight day (see `fightDay`) of the last fight, win or lose: one a day. */
  lastFightDay: string | null;
}

/** users/{uid}/game/battle: progress in each mode. Written only by the server. */
export interface BattleDoc {
  weekly: WeeklyProgress | null;
  /** Highest floor cleared; after a loss, no fight until cooldownUntil. */
  endless: { cleared: number; cooldownUntil: number };
  /** Highest floor cleared; after any fight, no fight until cooldownUntil. */
  bossTower: { cleared: number; cooldownUntil: number };
  campaign: { cleared: number };
  /** Wins toward the Legendary and Mythic guarantees: weekly wins and Boss Tower first clears only. */
  pity: Pity;
  updatedAt: number;
}

export const newBattleDoc = (now: number): BattleDoc => ({
  weekly: null,
  endless: { cleared: 0, cooldownUntil: 0 },
  bossTower: { cleared: 0, cooldownUntil: 0 },
  campaign: { cleared: 0 },
  pity: NO_PITY,
  updatedAt: now,
});

// ---- The weekly boss's day and week ----

/** The fight day: the date of `now` less WEEKLY_BOSS.resetHour hours, so it turns at 04:00 local time. */
export const fightDay = (now: number, timeZone: string) => dayId(now - WEEKLY_BOSS.resetHour * HOUR_MS, timeZone);

/** The weekly boss's week, turning at 04:00 on Sunday like the fight day. */
export const fightWeek = (now: number, timeZone: string) => weekId(now - WEEKLY_BOSS.resetHour * HOUR_MS, timeZone);

/** When the next fight day starts: 04:00 tomorrow (fight-day wise) in the user's zone. */
export const nextWeeklyReset = (now: number, timeZone: string) =>
  dayStartMs(addDays(fightDay(now, timeZone), 1), timeZone) + WEEKLY_BOSS.resetHour * HOUR_MS;

/** This week's progress: kept within the week, else a new week whose tier is locked from the level and power now. */
export function weeklyFor(doc: BattleDoc, level: number, battle: number, now: number, timeZone: string): WeeklyProgress {
  const week = fightWeek(now, timeZone);
  if (doc.weekly?.weekId === week) return doc.weekly;
  return { weekId: week, tier: weeklyTier(level, battle), wins: 0, fights: 0, lastFightDay: null };
}

// ---- The hero as they fight ----

export interface FightHero {
  hero: Hero;
  /** Earned stats with rust applied, without stat points: what boss minimums check. */
  stats: StatLine;
  battle: BattlePower;
  injured: Stat[];
  paused: boolean;
}

/** The hero from the stored facts: rusted stats, worn gear, titles and class. Needs a picked class. */
export function fightHero({
  state,
  muscles,
  worn,
  now,
}: {
  state: GameState;
  muscles: MusclesFacts;
  worn: GearPiece[];
  now: number;
}): GameResult<FightHero> {
  if (!state.classId) return fail("Pick a class first");
  const stats = rustedStats(computeStats(muscles), statRust(muscles, now, freezeFor(state)));
  // Stat points make stats stronger in the fight itself, never toward a boss minimum.
  const fighting = boosted(stats, state);
  const battle = battlePower({
    body: power(fighting),
    equipped: worn,
    level: state.level,
    classId: state.classId,
    titlePct: titleBonusPct(state),
    classPct: classBonusPct(state),
  });
  const hero = buildHero({ stats: fighting, battle, classId: state.classId, effects: gearEffects(worn, state.level) });
  return ok({ hero, stats, battle, injured: injuredStats(state, now), paused: activePause(state, now) != null });
}

// ---- Fights ----

export interface FightRound {
  /** The weekly tier, tower floor or Campaign stage. */
  key: number;
  foe: string;
  bossId: string | null;
  power: number;
  minimums: MinimumCheck | null;
  result: FightResult;
}

export interface FightOutcome {
  mode: FightMode;
  doc: BattleDoc;
  rounds: FightRound[];
  coins: number;
  scrap: number;
  mythicCores: number;
  /** Fight energy this request spent (Campaign and endless tower: 1). */
  energySpent: number;
  /** Gear won: each becomes a new item (`applyFightRewards`). */
  drops: { baseId: string; rarity: Rarity; itemLevel: number; guaranteed: boolean }[];
  /** For a Boss Tower win: whether it was the floor's first clear. */
  firstClear?: boolean;
}

export interface FightInput {
  mode: FightMode;
  doc: BattleDoc;
  state: GameState;
  fighter: FightHero;
  now: number;
  timeZone: string;
  /** Made by the server, never the client, so nobody can search for a winning seed. */
  seed: string;
  /** Boss Tower only: the floor to fight (default the next one). Cleared floors can be refought. */
  floor?: number;
  /** Endless tower only: climb up to ENDLESS_TOWER.autoClimbMax floors, stopping at the first loss. */
  climb?: boolean;
}

const hoursLabel = (ms: number) => {
  const h = Math.ceil(ms / HOUR_MS);
  return h <= 1 ? "under an hour" : `${h} hours`;
};

/** Refuses a boss fight while a minimum is unmet (and the hero isn't strong enough to ignore it). */
function minimumsFor(encounter: Encounter, f: FightHero): GameResult<MinimumCheck | null> {
  if (!Object.keys(encounter.minimums).length) return ok(null);
  const check = checkMinimums({ minimums: encounter.minimums, power: encounter.power, stats: f.stats, heroPower: f.battle.total, injured: f.injured });
  if (check.allowed) return ok(check);
  const short = check.rows
    .filter((r) => !r.met && !r.waived)
    .map((r) => `${STAT_LABELS[r.stat]} ${r.have} of ${r.needed}`)
    .join(", ");
  return fail(`Under this boss's minimums (${short}). Train them up, or bring ${check.powerToOverride} battle power`);
}

function round(encounter: Encounter, key: number, f: FightHero, seed: string, minimums: MinimumCheck | null): FightRound {
  return {
    key,
    foe: encounter.foe.name,
    bossId: encounter.boss?.id ?? null,
    power: encounter.power,
    minimums,
    result: simulateFight(f.hero, encounter.foe, seed),
  };
}

const dropOf = (d: Drop) =>
  d.baseId && d.rarity ? [{ baseId: d.baseId, rarity: d.rarity, itemLevel: d.itemLevel, guaranteed: d.guaranteed }] : [];

/** Runs one fight request: checks the mode's rules, fights, and works out what it pays. */
export function runFight(input: FightInput): GameResult<FightOutcome> {
  const { mode, doc, state, fighter: f, now, timeZone, seed } = input;
  const loot = seeded(`loot:${seed}`);
  const base = { mode, rounds: [] as FightRound[], coins: 0, scrap: 0, mythicCores: 0, energySpent: 0, drops: [] as FightOutcome["drops"] };
  // The Campaign and the endless tower run on energy from workouts, so playing pulls you to the gym.
  if ((mode === "campaign" || mode === "endless") && energyOf(state) < 1) {
    return fail(`Out of fight energy. Each workout gives ${ENERGY.perWorkout}`);
  }

  switch (mode) {
    case "weekly": {
      const weekly = weeklyFor(doc, state.level, f.battle.total, now, timeZone);
      const day = fightDay(now, timeZone);
      if (weekly.lastFightDay === day) {
        return fail(`You've fought this week's boss today. Next fight in ${hoursLabel(nextWeeklyReset(now, timeZone) - now)}`);
      }
      const encounter = weeklyEncounter(weekly.weekId, weekly.tier);
      const minimums = minimumsFor(encounter, f);
      if (!minimums.ok) return minimums;
      const r = round(encounter, weekly.tier, f, `${seed}:0`, minimums.value);
      let pity = doc.pity;
      const out = { ...base, rounds: [r] };
      if (r.result.won) {
        const pay = weeklyPay(weekly.tier, weekly.wins === 0);
        const drop = weeklyDrop(weekly.tier, loot, pity, state.level);
        pity = drop.pity;
        Object.assign(out, { coins: pay.coins, scrap: pay.scrap, mythicCores: drop.mythicCore ? 1 : 0, drops: dropOf(drop) });
      }
      const next: WeeklyProgress = { ...weekly, wins: weekly.wins + (r.result.won ? 1 : 0), fights: weekly.fights + 1, lastFightDay: day };
      return ok({ ...out, doc: { ...doc, weekly: next, pity, updatedAt: now } });
    }

    case "endless": {
      if (state.level < ENDLESS_TOWER.minLevel) return fail(`The tower opens at level ${ENDLESS_TOWER.minLevel}`);
      if (now < doc.endless.cooldownUntil) return fail(`The tower opens again in ${hoursLabel(doc.endless.cooldownUntil - now)}`);
      const out = { ...base, energySpent: 1 };
      let { cleared, cooldownUntil } = doc.endless;
      const floors = input.climb ? ENDLESS_TOWER.autoClimbMax : 1;
      for (let i = 0; i < floors; i++) {
        const floor = cleared + 1;
        const r = round(towerEncounter(floor), floor, f, `${seed}:${i}`, null);
        out.rounds.push(r);
        if (!r.result.won) {
          cooldownUntil = now + ENDLESS_TOWER.lossCooldownHours * HOUR_MS;
          break;
        }
        cleared = floor;
        const pay = towerPay(floor);
        out.coins += pay.coins;
        out.scrap += pay.scrap;
        out.drops.push(...dropOf(towerDrop(loot, floor, state.level)));
      }
      return ok({ ...out, doc: { ...doc, endless: { cleared, cooldownUntil }, updatedAt: now } });
    }

    case "bossTower": {
      if (state.level < BOSS_TOWER.minLevel) return fail(`The Boss Tower opens at level ${BOSS_TOWER.minLevel}`);
      if (now < doc.bossTower.cooldownUntil) return fail(`The Boss Tower opens again in ${hoursLabel(doc.bossTower.cooldownUntil - now)}`);
      const { cleared } = doc.bossTower;
      const highest = Math.min(cleared + 1, BOSS_TOWER.floors);
      const floor = input.floor ?? highest;
      if (!Number.isInteger(floor) || floor < 1 || floor > highest) return fail(`You can fight floors 1 to ${highest}`);
      const encounter = bossTowerEncounter(floor);
      if (!encounter) return fail("That floor doesn't exist", 404);
      const minimums = minimumsFor(encounter, f);
      if (!minimums.ok) return minimums;
      const r = round(encounter, floor, f, `${seed}:0`, minimums.value);
      const firstClear = r.result.won && floor > cleared;
      let pity = doc.pity;
      const out = { ...base, rounds: [r] };
      if (r.result.won) {
        const pay = bossTowerPay(floor, firstClear);
        Object.assign(out, { coins: pay.coins, scrap: pay.scrap, firstClear });
        if (firstClear) {
          const drop = bossTowerDrop(floor, loot, pity, state.level);
          pity = drop.pity;
          Object.assign(out, { mythicCores: drop.mythicCore ? 1 : 0, drops: dropOf(drop) });
        }
      }
      const bossTower = { cleared: firstClear ? floor : cleared, cooldownUntil: now + BOSS_TOWER.cooldownHours * HOUR_MS };
      return ok({ ...out, doc: { ...doc, bossTower, pity, updatedAt: now } });
    }

    case "campaign": {
      const stage = doc.campaign.cleared + 1;
      const encounter = campaignEncounter(stage);
      if (!encounter || stage > CAMPAIGN_STAGES) return fail("You've finished the Campaign");
      const minimums = minimumsFor(encounter, f);
      if (!minimums.ok) return minimums;
      const r = round(encounter, stage, f, `${seed}:0`, minimums.value);
      const out = { ...base, rounds: [r], energySpent: 1 };
      if (r.result.won) {
        const pay = campaignPay(stage);
        Object.assign(out, { coins: pay.coins, scrap: pay.scrap, drops: dropOf(campaignDrop(loot, stage, state.level)) });
      }
      return ok({ ...out, doc: { ...doc, campaign: { cleared: r.result.won ? stage : doc.campaign.cleared }, updatedAt: now } });
    }
  }
}

// ---- Rewards ----

export interface FightRewards {
  state: GameState;
  /** New inventory docs, with ids made from the fight's id so a retry can't add them twice. */
  items: { id: string; item: Item }[];
}

/**
 * Pays a fight's coins, scrap and Mythic Cores, and turns every drop into a new item at its rarity and
 * item level. A second copy of something you own is kept too: salvage it or keep it (13.5).
 */
export function applyFightRewards({
  state,
  outcome,
  fightId,
  now,
}: {
  state: GameState;
  outcome: Pick<FightOutcome, "coins" | "scrap" | "mythicCores" | "drops"> & Partial<Pick<FightOutcome, "energySpent">>;
  fightId: string;
  now: number;
}): FightRewards {
  const items: FightRewards["items"] = [];
  outcome.drops.forEach((d, i) => {
    const base = baseItem(d.baseId);
    const item = base ? newItem(base, "boss", now, { rarity: d.rarity, itemLevel: d.itemLevel }) : null;
    if (item?.ok) items.push({ id: `fight-${fightId}-${i}`, item: item.value });
  });
  const scrap = outcome.scrap;
  const m = materialsOf(state);
  return {
    state: {
      ...state,
      coins: state.coins + outcome.coins,
      energy: energyOf(state) - (outcome.energySpent ?? 0),
      materials: { ...m, scrap: (m.scrap ?? 0) + scrap, mythicCore: (m.mythicCore ?? 0) + outcome.mythicCores },
      updatedAt: now,
    },
    items,
  };
}

