import type { LoggedSet, Workout } from "../types";
import type { Injury, Pause } from "./breaks";
import { COINS, DAILY_WORKOUTS, ENERGY, MAX_FUTURE_MS, MIN_WORKING_SETS, STATS, type AutoSalvageBelow, type ClassId, type Stat } from "./config";
import { coinPayout, levelForXp, statXp, workoutXp, type CoinPayout } from "./economy";
import { exerciseSessions, mergeFacts, workoutFacts, type MusclesFacts, type PreviousSession } from "./facts";
import { statOf } from "./muscles";
import type { Equipped, Materials } from "./items";
import type { QuestUpdate } from "./quests";
import { computeStats, power, type StatLine } from "./score";
import { workingSets, type ExerciseLookup } from "./sets";
import { dayId, daysBetween, weekId } from "./time";
import type { TitleId, TitlesState } from "./titles";
import { payLevelRewards, type LevelReward, type StatPoints } from "./levels";

/** users/{uid}/game/state. Written only by the server. */
export interface GameState {
  coins: number;
  xp: number;
  level: number;
  /** Highest body power reached. Stat XP is paid only for power above it. */
  peakPower: number;
  /** Claim day (dayId in the user's time zone) that coinsToday counts, for the daily cap. */
  coinDay: string | null;
  coinsToday: number;
  /** Claim time of the last claim that paid workout XP (12-hour rule). Missing on docs from before the rule. */
  workoutXpAt?: number | null;
  /** Most different stats with an exercise that beat its last session in one workout (Record Breaker). */
  mostStatsBeaten?: number;
  timeZone: string;
  /** Whether the pre-RPG welcome bonus was paid (by the backfill script). */
  welcomeBonus: boolean;
  /** Vacation pauses, past and current (section 3.6). Missing on docs from before Phase 3. */
  pauses?: Pause[];
  /** Injury flags, past and current. Missing on docs from before Phase 3. */
  injuries?: Injury[];
  /** Whether followers see the injury flags (publicStats). Missing counts as shown. */
  showInjuries?: boolean;
  /** Slot -> inventory id of the equipped item. Missing on docs from before Phase 4. */
  equipped?: Equipped;
  /** Upgrade materials (scrap, Mythic Cores). Missing on docs from before Phase 4. */
  materials?: Materials;
  /** Earned and equipped titles, and title slots. Missing on docs from before Phase 4 (see titlesOf). */
  titles?: TitlesState;
  /** The hero's class. Missing until the player picks one (free, once). Fights need it. */
  classId?: ClassId;
  /** When the class was last switched (not the free pick), for the once-per-7-days rule. */
  classSwitchedAt?: number | null;
  /** The highest level whose level-up reward was paid. Missing means up to level 1. */
  levelRewardsTo?: number;
  /** Stat points put into each stat (fights only). Missing means none. */
  statPoints?: StatPoints;
  /** Counted workouts per workout day (dayId), for the daily limit; the last DAILY_WORKOUTS.keepDays days. */
  countedDays?: Record<string, number>;
  /** Fight energy for the Campaign and endless tower. Missing means ENERGY.start. */
  energy?: number;
  /** Fight drops below this rarity are salvaged as they land (13.9). Missing or null means off. */
  autoSalvage?: AutoSalvageBelow | null;
  createdAt: number;
  updatedAt: number;
}

/** users/{uid}/game/muscles */
export interface MusclesDoc {
  muscles: MusclesFacts;
  updatedAt: number;
}

/** users/{uid}/snapshots/{weekId}: stats and body power, for the radar's comparison overlay. */
export interface Snapshot {
  weekId: string;
  stats: StatLine;
  power: number;
  takenAt: number;
}

/** An exercise that beat its last session, so its working sets earned extra points. */
export interface ProgressedLine {
  exerciseId: string;
  stat: Stat;
}

/**
 * What a claim paid, stored in users/{uid}/claims/{workoutId} and returned for the Rewards
 * screen. Fields marked optional are missing on claims from before Phase 3.
 */
export interface ClaimResult {
  workoutId: string;
  claimedAt: number;
  coins: CoinPayout & {
    /** Balance after this claim, quest rewards included. */
    balance: number;
    /** Coins counted toward the daily cap on the claim day, this claim included. */
    usedToday?: number;
    dailyCap?: number;
  };
  xp: { workout: number; stats: number; total: number; balance: number };
  level: { before: number; after: number };
  stats: { before: StatLine; after: StatLine };
  power: { before: number; after: number };
  /** Exercises that beat their last session. Missing on claims from before the stat rework. */
  progressed?: ProgressedLine[];
  /** The scheduled day this workout filled, or null if none (written by the claim route). */
  schedule?: { day: string; daysOff: number } | null;
  /** Quests this workout moved forward or finished (written by the claim route). Paid quests are in coins/xp.balance. */
  quests?: QuestUpdate[];
  /** Scrap paid with the quests this claim finished, and the balance after (written by the claim route). */
  scrap?: { earned: number; balance: number };
  /** Titles this claim earned (written by the claim route). */
  titles?: TitleId[];
  /** Level-up rewards this claim paid (already in coins.balance). Missing when it reached no new level. */
  levelRewards?: LevelReward;
  /** Set on claims written by the backfill script (which pays no coins). */
  backfilled?: boolean;
}

export type NotCountedReason = "too-few-sets" | "future" | "daily-limit";

export type ClaimOutcome =
  | { counted: false; reason: NotCountedReason; workingSets: number }
  | { counted: true; state: GameState; muscles: MusclesFacts; result: ClaimResult; snapshot: Snapshot };

export type ClaimableWorkout = Pick<Workout, "id" | "exercises" | "startedAt" | "endedAt">;

export function newGameState(now: number, timeZone: string): GameState {
  return {
    coins: 0,
    xp: 0,
    level: 1,
    peakPower: 0,
    coinDay: null,
    coinsToday: 0,
    workoutXpAt: null,
    mostStatsBeaten: 0,
    timeZone,
    welcomeBonus: false,
    pauses: [],
    injuries: [],
    showInjuries: true,
    createdAt: now,
    updatedAt: now,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function roundStats(stats: StatLine): StatLine {
  return Object.fromEntries(STATS.map((s) => [s, round1(stats[s])])) as StatLine;
}

function snapshotOf(stats: StatLine, at: number, timeZone: string): Snapshot {
  return { weekId: weekId(at, timeZone), stats: roundStats(stats), power: round1(power(stats)), takenAt: at };
}

/**
 * Claims a saved workout at `now`: new stat facts, coins (daily cap, scheduled bonus by
 * `daysOff`), XP (workout XP at most once per 12 hours of claim time) and level. `previous`
 * gives each exercise's latest earlier session, for "beat your last session". Pure; the caller
 * checks idempotency and writes the results.
 * `payCoins: false` is for the backfill, which replays XP and stats but not coins.
 */
export function applyClaim({
  state,
  muscles,
  workout,
  lookup,
  previous,
  now,
  timeZone,
  daysOff = null,
  payCoins = true,
}: {
  state: GameState;
  muscles: MusclesFacts;
  workout: ClaimableWorkout;
  lookup: ExerciseLookup;
  previous: PreviousSession;
  now: number;
  timeZone: string;
  daysOff?: number | null;
  payCoins?: boolean;
}): ClaimOutcome {
  const sets = workingSets(workout, lookup).length;
  if (workout.startedAt > now + MAX_FUTURE_MS) return { counted: false, reason: "future", workingSets: sets };
  if (sets < MIN_WORKING_SETS) return { counted: false, reason: "too-few-sets", workingSets: sets };
  const workoutDay = dayId(workout.startedAt, timeZone);
  const countedDays = recentDays(state.countedDays ?? {}, workoutDay);
  if ((countedDays[workoutDay] ?? 0) >= DAILY_WORKOUTS.max) return { counted: false, reason: "daily-limit", workingSets: sets };
  countedDays[workoutDay] = (countedDays[workoutDay] ?? 0) + 1;

  const facts = workoutFacts(workout, lookup, previous, timeZone);
  const nextMuscles = mergeFacts(muscles, facts.muscles);
  const before = computeStats(muscles);
  const after = computeStats(nextMuscles);
  const powerAfter = power(after);
  const gainXp = statXp(powerAfter, state.peakPower);

  const today = dayId(now, timeZone);
  const earnedToday = state.coinDay === today ? state.coinsToday : 0;
  const coins = payCoins
    ? coinPayout({ daysOff, earnedToday })
    : { base: 0, scheduledBonus: 0, capped: 0, total: 0 };

  const completionXp = workoutXp(state.workoutXpAt ?? null, now);
  const xpGained = completionXp + gainXp;
  const raw: GameState = {
    ...state,
    coins: state.coins + coins.total,
    xp: state.xp + xpGained,
    level: levelForXp(state.xp + xpGained),
    peakPower: Math.max(state.peakPower, powerAfter),
    coinDay: payCoins ? today : state.coinDay,
    coinsToday: payCoins ? earnedToday + coins.total : state.coinsToday,
    workoutXpAt: completionXp > 0 ? now : (state.workoutXpAt ?? null),
    mostStatsBeaten: Math.max(state.mostStatsBeaten ?? 0, facts.progressedStats.length),
    countedDays,
    energy: Math.min(ENERGY.max, energyOf(state) + ENERGY.perWorkout),
    timeZone,
    updatedAt: now,
  };
  // Level-ups pay outside the daily coin cap; the backfill only records them as paid.
  const { state: nextState, reward } = payLevelRewards(raw, now, payCoins);

  const result: ClaimResult = {
    workoutId: workout.id,
    claimedAt: now,
    coins: { ...coins, balance: nextState.coins, usedToday: nextState.coinDay === today ? nextState.coinsToday : 0, dailyCap: COINS.dailyCap },
    xp: { workout: completionXp, stats: gainXp, total: xpGained, balance: nextState.xp },
    level: { before: state.level, after: nextState.level },
    stats: { before: roundStats(before), after: roundStats(after) },
    power: { before: round1(power(before)), after: round1(powerAfter) },
    progressed: facts.progressed.map((exerciseId) => ({ exerciseId, stat: statOf(lookup(exerciseId)!.muscle) })),
    ...(reward ? { levelRewards: reward } : {}),
  };

  return { counted: true, state: nextState, muscles: nextMuscles, result, snapshot: snapshotOf(after, now, timeZone) };
}

/** Fight energy now: ENERGY.start before any is stored. */
export const energyOf = (state: Pick<GameState, "energy">): number => state.energy ?? ENERGY.start;

/** The day counts kept for the daily limit: those within DAILY_WORKOUTS.keepDays of `day`. */
function recentDays(days: Record<string, number>, day: string): Record<string, number> {
  return Object.fromEntries(Object.entries(days).filter(([d]) => Math.abs(daysBetween(d, day)) < DAILY_WORKOUTS.keepDays));
}

/** Oldest first, without workouts a claim would reject as being in the future. */
const claimable = (workouts: ClaimableWorkout[], now: number) =>
  workouts.filter((w) => w.startedAt <= now + MAX_FUTURE_MS).sort((a, b) => a.startedAt - b.startedAt);

/** When a replayed workout is treated as claimed: when it ended. */
const replayTime = (w: ClaimableWorkout) => Math.max(w.startedAt, w.endedAt);

/**
 * Each exercise's latest session as a replay walks the history in order. Every workout with
 * working sets of an exercise is a session, counted or not, like a live claim's lookup.
 */
function sessionTracker(lookup: ExerciseLookup) {
  const last = new Map<string, LoggedSet[]>();
  const previous: PreviousSession = (id) => last.get(id);
  return {
    previous,
    record(w: ClaimableWorkout) {
      for (const [id, sets] of exerciseSessions(w, lookup)) last.set(id, sets);
    },
  };
}

export interface Replay {
  muscles: MusclesFacts;
  snapshots: Snapshot[];
  /** The highest body power reached after any workout: the peak the history really supports. */
  peakPower: number;
  mostStatsBeaten: number;
}

/**
 * Rebuilds the muscle facts and weekly snapshots from a user's whole history (POST /api/recompute,
 * after edits and deletes). Same facts and counting rules as claims.
 */
export function replayMuscles(workouts: ClaimableWorkout[], lookup: ExerciseLookup, timeZone: string, now: number): Replay {
  let muscles: MusclesFacts = {};
  let peakPower = 0;
  let mostStatsBeaten = 0;
  const snapshots = new Map<string, Snapshot>();
  const sessions = sessionTracker(lookup);
  const perDay = new Map<string, number>();
  for (const w of claimable(workouts, now)) {
    const day = dayId(w.startedAt, timeZone);
    if (workingSets(w, lookup).length >= MIN_WORKING_SETS && (perDay.get(day) ?? 0) < DAILY_WORKOUTS.max) {
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      const facts = workoutFacts(w, lookup, sessions.previous, timeZone);
      muscles = mergeFacts(muscles, facts.muscles);
      mostStatsBeaten = Math.max(mostStatsBeaten, facts.progressedStats.length);
      const stats = computeStats(muscles);
      peakPower = Math.max(peakPower, power(stats));
      const snapshot = snapshotOf(stats, replayTime(w), timeZone);
      snapshots.set(snapshot.weekId, snapshot);
    }
    sessions.record(w);
  }
  return { muscles, snapshots: [...snapshots.values()], peakPower, mostStatsBeaten };
}

/**
 * The peak after a recompute: lowered to the replayed peak when that's lower (a fixed typo or a
 * deleted workout had inflated it), so stat XP isn't blocked by gains that never happened. Never
 * raised, so nothing is paid twice.
 */
export function recomputedPeak(state: GameState, replayedPeak: number): number {
  return Math.min(state.peakPower, replayedPeak);
}

/** Every claimable workout claimed in order on a new game state, paying no coins. */
function replayClaims(workouts: ClaimableWorkout[], lookup: ExerciseLookup, timeZone: string, now: number) {
  const sorted = claimable(workouts, now);
  let state = newGameState(sorted.length ? Math.min(now, replayTime(sorted[0])) : now, timeZone);
  let muscles: MusclesFacts = {};
  const claims: ClaimResult[] = [];
  const snapshots = new Map<string, Snapshot>();
  const sessions = sessionTracker(lookup);

  for (const w of sorted) {
    const outcome = applyClaim({ state, muscles, workout: w, lookup, previous: sessions.previous, now: replayTime(w), timeZone, payCoins: false });
    sessions.record(w);
    if (!outcome.counted) continue;
    ({ state, muscles } = outcome);
    claims.push({ ...outcome.result, backfilled: true });
    snapshots.set(outcome.snapshot.weekId, outcome.snapshot);
  }
  return { state, muscles, claims, snapshots: [...snapshots.values()] };
}

/**
 * A pre-RPG account's game from its history (scripts/backfill-game.ts): every counted workout
 * is claimed in order for stats and XP but no coins, and the welcome bonus is paid instead.
 */
export function backfillHistory(
  workouts: ClaimableWorkout[],
  lookup: ExerciseLookup,
  timeZone: string,
  now: number,
): { state: GameState; muscles: MusclesFacts; claims: ClaimResult[]; snapshots: Snapshot[] } {
  const replayed = replayClaims(workouts, lookup, timeZone, now);
  return { ...replayed, state: { ...replayed.state, coins: COINS.welcomeBonus, welcomeBonus: true, updatedAt: now } };
}

/** Fields of game/state from before the stat rework, dropped by reworkGame. */
const RETIRED_FIELDS = ["calibration", "bodyweightKg", "age", "sex"];

/**
 * An existing game moved onto the stat rework (scripts/backfill-game.ts --rework): stats, peak,
 * workout XP and level are replayed from the whole history under the current rules, plus the XP
 * its claimed quests paid (the only other XP source so far). Coins, items, titles, breaks and claim
 * records are kept. Running it again gives the same result.
 */
export function reworkGame({
  state,
  workouts,
  lookup,
  now,
  questXp,
}: {
  state: GameState;
  workouts: ClaimableWorkout[];
  lookup: ExerciseLookup;
  now: number;
  /** XP paid by the account's claimed quests (see questXpEarned). */
  questXp: number;
}): { state: GameState; muscles: MusclesFacts; snapshots: Snapshot[] } {
  const replayed = replayClaims(workouts, lookup, state.timeZone, now);
  const xp = questXp + replayed.state.xp;
  const kept: Record<string, unknown> = { ...state };
  for (const field of RETIRED_FIELDS) delete kept[field];
  return {
    state: {
      ...(kept as unknown as GameState),
      xp,
      level: levelForXp(xp),
      // A migration, not a level-up: levels the replay reaches are not paid.
      levelRewardsTo: Math.max(state.levelRewardsTo ?? 1, levelForXp(xp)),
      peakPower: replayed.state.peakPower,
      workoutXpAt: replayed.state.workoutXpAt ?? null,
      mostStatsBeaten: replayed.state.mostStatsBeaten ?? 0,
      updatedAt: now,
    },
    muscles: replayed.muscles,
    snapshots: replayed.snapshots,
  };
}
