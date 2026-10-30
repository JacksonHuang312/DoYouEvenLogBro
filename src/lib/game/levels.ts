import type { GameState } from "./claim";
import { LEVEL_POINTS, LEVEL_REWARDS, STATS, type Stat } from "./config";
import { fail, materialsOf, ok, type GameResult } from "./items";
import type { StatLine } from "./score";

/*
 * What levels give (GAME_DESIGN.md 13.3): coins and scrap for each level reached, and stat points
 * that make a stat a little stronger in fights. Points compound with training (a percent of the
 * stat), are capped per stat, and count for nothing but fights.
 */

export interface LevelReward {
  /** The levels this paid for, oldest first. */
  levels: number[];
  coins: number;
  scrap: number;
}

const rewardFor = (level: number) => (level % 10 === 0 ? LEVEL_REWARDS.tenth : LEVEL_REWARDS);

/**
 * Pays every level above `levelRewardsTo` up to the state's level, once. A state without
 * `levelRewardsTo` has been paid up to level 1. `pay: false` (the backfill) only records them as paid.
 */
export function payLevelRewards(state: GameState, now: number, pay = true): { state: GameState; reward: LevelReward | null } {
  const from = state.levelRewardsTo ?? 1;
  if (state.level <= from) return { state, reward: null };
  if (!pay) return { state: { ...state, levelRewardsTo: state.level, updatedAt: now }, reward: null };
  const levels = Array.from({ length: state.level - from }, (_, i) => from + 1 + i);
  const coins = levels.reduce((n, l) => n + rewardFor(l).coins, 0);
  const scrap = levels.reduce((n, l) => n + rewardFor(l).scrap, 0);
  const m = materialsOf(state);
  return {
    state: { ...state, coins: state.coins + coins, materials: { ...m, scrap: (m.scrap ?? 0) + scrap }, levelRewardsTo: state.level, updatedAt: now },
    reward: { levels, coins, scrap },
  };
}

// ---- Stat points ----

export type StatPoints = Partial<Record<Stat, number>>;

export const pointsOf = (state: Pick<GameState, "statPoints">): StatPoints => state.statPoints ?? {};
export const pointsEarned = (level: number) => Math.max(0, level - 1) * LEVEL_POINTS.perLevel;
export const pointsSpent = (state: Pick<GameState, "statPoints">) => STATS.reduce((n, s) => n + (pointsOf(state)[s] ?? 0), 0);
export const pointsFree = (state: Pick<GameState, "statPoints" | "level">) => pointsEarned(state.level) - pointsSpent(state);

/** Each stat's fight multiplier from its points (1.05 = 5% stronger). */
export function pointBoost(state: Pick<GameState, "statPoints">): StatLine {
  const p = pointsOf(state);
  return Object.fromEntries(STATS.map((s) => [s, 1 + Math.min(LEVEL_POINTS.maxPerStat, p[s] ?? 0) * LEVEL_POINTS.pctPerPoint])) as StatLine;
}

/** The stats with their points applied (fights only). */
export function boosted(stats: StatLine, state: Pick<GameState, "statPoints">): StatLine {
  const b = pointBoost(state);
  return Object.fromEntries(STATS.map((s) => [s, stats[s] * b[s]])) as StatLine;
}

/**
 * Puts free points into stats. `expectedSpent` is the spent total the player saw, so a retry or a
 * change on another device never spends twice.
 */
export function assignPoints(state: GameState, add: StatPoints, expectedSpent: number, now: number): GameResult<GameState> {
  if (pointsSpent(state) !== expectedSpent) return fail("Your stat points changed. Take another look");
  const current = pointsOf(state);
  const next: StatPoints = { ...current };
  let total = 0;
  for (const [stat, n] of Object.entries(add) as [Stat, number][]) {
    if (!STATS.includes(stat)) return fail("Unknown stat", 404);
    if (!Number.isInteger(n) || n < 0) return fail("Points must be whole numbers");
    if ((current[stat] ?? 0) + n > LEVEL_POINTS.maxPerStat) return fail(`A stat holds at most ${LEVEL_POINTS.maxPerStat} points`);
    next[stat] = (current[stat] ?? 0) + n;
    total += n;
  }
  if (total === 0) return fail("Pick at least one point");
  if (total > pointsFree(state)) return fail("Not enough free points");
  return ok({ ...state, statPoints: next, updatedAt: now });
}

/** Takes every point back for LEVEL_POINTS.respecCost coins. */
export function respecPoints(state: GameState, expectedSpent: number, now: number): GameResult<{ state: GameState; cost: number }> {
  if (pointsSpent(state) !== expectedSpent) return fail("Your stat points changed. Take another look");
  if (expectedSpent === 0) return fail("No points to reset");
  if (state.coins < LEVEL_POINTS.respecCost) return fail("Not enough coins", 402);
  return ok({ state: { ...state, statPoints: {}, coins: state.coins - LEVEL_POINTS.respecCost, updatedAt: now }, cost: LEVEL_POINTS.respecCost });
}
