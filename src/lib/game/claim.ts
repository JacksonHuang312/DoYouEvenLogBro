import type { Workout } from "../types";
import { advanceCalibration, calibrationDone, displayStats, NEW_CALIBRATION, type Calibration } from "./calibration";
import { COINS, DEFAULT_BODYWEIGHT_KG, MAX_FUTURE_MS, MIN_WORKING_SETS, STATS, type Sex } from "./config";
import { coinPayout, levelForXp, statXp, workoutXp, type CoinPayout } from "./economy";
import { mergeFacts, workoutFacts, type MusclesFacts } from "./facts";
import { computeStats, power, type BodyProfile, type StatLine } from "./score";
import { workingSets, type ExerciseLookup } from "./sets";
import { dayId, weekId } from "./time";

/** users/{uid}/game/state. Written only by the server. */
export interface GameState {
  coins: number;
  xp: number;
  level: number;
  /** Highest power reached since calibration ended. Stat XP is paid only for power above it. */
  peakPower: number;
  /** Claim day (dayId in the user's time zone) that coinsToday counts, for the daily cap. */
  coinDay: string | null;
  coinsToday: number;
  /** Claim time of the last claim that paid workout XP (12-hour rule). Missing on docs from before the rule. */
  workoutXpAt?: number | null;
  calibration: Calibration;
  bodyweightKg: number | null;
  age: number | null;
  sex: Sex | null;
  timeZone: string;
  /** Whether the pre-RPG welcome bonus was paid (by the backfill script). */
  welcomeBonus: boolean;
  createdAt: number;
  updatedAt: number;
}

/** users/{uid}/game/muscles */
export interface MusclesDoc {
  muscles: MusclesFacts;
  updatedAt: number;
}

/** users/{uid}/snapshots/{weekId}: real (not calibration) stats, for the radar's comparison overlay. */
export interface Snapshot {
  weekId: string;
  stats: StatLine;
  power: number;
  takenAt: number;
}

/** What a claim paid, stored in users/{uid}/claims/{workoutId} and returned for the Rewards screen. */
export interface ClaimResult {
  workoutId: string;
  claimedAt: number;
  coins: CoinPayout & { balance: number };
  xp: { workout: number; stats: number; total: number; balance: number };
  level: { before: number; after: number };
  /** As shown: population averages while calibrating. */
  stats: { before: StatLine; after: StatLine };
  power: { before: number; after: number };
  calibrating: boolean;
  /** Set on claims written by the backfill script (which pays no coins). */
  backfilled?: boolean;
}

export type NotCountedReason = "too-few-sets" | "future";

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
    calibration: NEW_CALIBRATION,
    bodyweightKg: null,
    age: null,
    sex: null,
    timeZone,
    welcomeBonus: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const profileOf = (s: GameState): BodyProfile => ({ bodyweightKg: s.bodyweightKg, age: s.age, sex: s.sex });

const round1 = (x: number) => Math.round(x * 10) / 10;

export function roundStats(stats: StatLine): StatLine {
  return Object.fromEntries(
    STATS.map((s) => [s, { value: round1(stats[s].value), bonus: round1(stats[s].bonus) }]),
  ) as StatLine;
}

function snapshotOf(stats: StatLine, at: number, timeZone: string): Snapshot {
  return { weekId: weekId(at, timeZone), stats: roundStats(stats), power: round1(power(stats)), takenAt: at };
}

function snapshotAt(muscles: MusclesFacts, profile: BodyProfile, at: number, timeZone: string): Snapshot {
  return snapshotOf(computeStats(muscles, profile, at, timeZone), at, timeZone);
}

/**
 * Claims a saved workout at `now`: new stat facts, coins (daily cap, scheduled bonus by
 * `daysOff`), XP (workout XP at most once per 12 hours of claim time) and level. Pure; the
 * caller checks idempotency and writes the results.
 * `payCoins: false` is for the backfill, which replays XP and stats but not coins.
 */
export function applyClaim({
  state,
  muscles,
  workout,
  lookup,
  now,
  timeZone,
  daysOff = null,
  payCoins = true,
}: {
  state: GameState;
  muscles: MusclesFacts;
  workout: ClaimableWorkout;
  lookup: ExerciseLookup;
  now: number;
  timeZone: string;
  daysOff?: number | null;
  payCoins?: boolean;
}): ClaimOutcome {
  const sets = workingSets(workout, lookup).length;
  if (workout.startedAt > now + MAX_FUTURE_MS) return { counted: false, reason: "future", workingSets: sets };
  if (sets < MIN_WORKING_SETS) return { counted: false, reason: "too-few-sets", workingSets: sets };

  const profile = profileOf(state);
  const nextMuscles = mergeFacts(
    muscles,
    workoutFacts(workout, lookup, state.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG, timeZone),
  );
  const realBefore = computeStats(muscles, profile, now, timeZone);
  const realAfter = computeStats(nextMuscles, profile, now, timeZone);
  const powerAfter = power(realAfter);

  // No stat XP during calibration. The workout that ends it sets the baseline peak instead,
  // so jumping from "nothing logged" to real stats isn't paid as a gain.
  const calibration = advanceCalibration(state.calibration, now);
  let gainXp = 0;
  let peakPower = state.peakPower;
  if (state.calibration.done) {
    gainXp = statXp(powerAfter, state.peakPower);
    peakPower = Math.max(state.peakPower, powerAfter);
  } else if (calibration.done) {
    peakPower = powerAfter;
  }

  const today = dayId(now, timeZone);
  const earnedToday = state.coinDay === today ? state.coinsToday : 0;
  const coins = payCoins
    ? coinPayout({ daysOff, earnedToday })
    : { base: 0, scheduledBonus: 0, capped: 0, total: 0 };

  const completionXp = workoutXp(state.workoutXpAt ?? null, now);
  const xpGained = completionXp + gainXp;
  const nextState: GameState = {
    ...state,
    coins: state.coins + coins.total,
    xp: state.xp + xpGained,
    level: levelForXp(state.xp + xpGained),
    peakPower,
    coinDay: payCoins ? today : state.coinDay,
    coinsToday: payCoins ? earnedToday + coins.total : state.coinsToday,
    workoutXpAt: completionXp > 0 ? now : (state.workoutXpAt ?? null),
    calibration,
    timeZone,
    updatedAt: now,
  };

  const shownBefore = displayStats(realBefore, state.calibration, now);
  const shownAfter = displayStats(realAfter, calibration, now);
  const result: ClaimResult = {
    workoutId: workout.id,
    claimedAt: now,
    coins: { ...coins, balance: nextState.coins },
    xp: { workout: completionXp, stats: gainXp, total: xpGained, balance: nextState.xp },
    level: { before: state.level, after: nextState.level },
    stats: { before: roundStats(shownBefore), after: roundStats(shownAfter) },
    power: { before: round1(power(shownBefore)), after: round1(power(shownAfter)) },
    calibrating: !calibrationDone(calibration, now),
  };

  return {
    counted: true,
    state: nextState,
    muscles: nextMuscles,
    result,
    snapshot: snapshotAt(nextMuscles, profile, now, timeZone),
  };
}

/** Oldest first, without workouts a claim would reject as being in the future. */
const claimable = (workouts: ClaimableWorkout[], now: number) =>
  workouts.filter((w) => w.startedAt <= now + MAX_FUTURE_MS).sort((a, b) => a.startedAt - b.startedAt);

/** When a replayed workout is treated as claimed: when it ended. */
const replayTime = (w: ClaimableWorkout) => Math.max(w.startedAt, w.endedAt);

/**
 * Rebuilds the muscle facts and weekly snapshots from a user's whole history (POST /api/recompute,
 * after edits and deletes). Same facts and counting rules as claims. `peakPower` is the highest
 * power reached after any workout in the replay: the peak the history really supports.
 */
export function replayMuscles(
  workouts: ClaimableWorkout[],
  lookup: ExerciseLookup,
  profile: BodyProfile,
  timeZone: string,
  now: number,
): { muscles: MusclesFacts; snapshots: Snapshot[]; peakPower: number } {
  const bodyweight = profile.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  let muscles: MusclesFacts = {};
  let peakPower = 0;
  const snapshots = new Map<string, Snapshot>();
  for (const w of claimable(workouts, now)) {
    if (workingSets(w, lookup).length < MIN_WORKING_SETS) continue;
    muscles = mergeFacts(muscles, workoutFacts(w, lookup, bodyweight, timeZone));
    const stats = computeStats(muscles, profile, replayTime(w), timeZone);
    peakPower = Math.max(peakPower, power(stats));
    const snapshot = snapshotOf(stats, replayTime(w), timeZone);
    snapshots.set(snapshot.weekId, snapshot);
  }
  return { muscles, snapshots: [...snapshots.values()], peakPower };
}

/**
 * The peak after a recompute: lowered to the replayed peak when that's lower (a fixed typo or a
 * deleted workout had inflated it), so stat XP isn't blocked by gains that never happened. Never
 * raised, so nothing is paid twice. During calibration there's no peak yet.
 */
export function recomputedPeak(state: GameState, replayedPeak: number): number {
  return state.calibration.done ? Math.min(state.peakPower, replayedPeak) : state.peakPower;
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
  const sorted = claimable(workouts, now);
  let state = newGameState(sorted.length ? Math.min(now, replayTime(sorted[0])) : now, timeZone);
  let muscles: MusclesFacts = {};
  const claims: ClaimResult[] = [];
  const snapshots = new Map<string, Snapshot>();

  for (const w of sorted) {
    const outcome = applyClaim({ state, muscles, workout: w, lookup, now: replayTime(w), timeZone, payCoins: false });
    if (!outcome.counted) continue;
    ({ state, muscles } = outcome);
    claims.push({ ...outcome.result, backfilled: true });
    snapshots.set(outcome.snapshot.weekId, outcome.snapshot);
  }

  state = { ...state, coins: COINS.welcomeBonus, welcomeBonus: true, updatedAt: now };
  return { state, muscles, claims, snapshots: [...snapshots.values()] };
}
