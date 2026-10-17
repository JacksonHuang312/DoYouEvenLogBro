import type { Workout } from "../types";
import { calibrationDone, displayStats, type Calibration } from "./calibration";
import { newGameState, profileOf, roundStats, type GameState, type Snapshot } from "./claim";
import { CALIBRATION, DEFAULT_TIME_ZONE, EXCLUDED_CATEGORIES, type Stat } from "./config";
import { levelProgress } from "./economy";
import type { MusclesFacts } from "./facts";
import { statOf } from "./muscles";
import { computeStats, power, subMuscleScores, type StatLine, type SubMuscleScores } from "./score";
import { countsAsWorkout, type ExerciseLookup } from "./sets";
import { dayId, daysBetween, isValidTimeZone, weekId } from "./time";

/*
 * What the Train and Hero screens show, computed on the client from the game docs the server
 * writes. Pure, so it is unit tested; the same functions the server uses do the scoring.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where a Firestore listener stands. "ready" only once the server has answered (or the data is cached). */
export type LoadStatus = "loading" | "ready" | "unavailable";

/** The status of a screen that needs several listeners: ready only when every one is. */
export function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes("unavailable")) return "unavailable";
  return statuses.every((s) => s === "ready") ? "ready" : "loading";
}

/** The time zone for decay and week boundaries: the one stored in game/state, else the browser's. */
export function resolveTimeZone(state: Pick<GameState, "timeZone"> | null, browserTimeZone: string): string {
  if (state?.timeZone && isValidTimeZone(state.timeZone)) return state.timeZone;
  return isValidTimeZone(browserTimeZone) ? browserTimeZone : DEFAULT_TIME_ZONE;
}

export interface HeroView {
  /** In the calibration period: `stats` are population averages. */
  calibrating: boolean;
  calibration: { workouts: number; needed: number; daysLeft: number | null };
  /** As shown: averages while calibrating, real (decayed) stats after. Rounded to 1 decimal. */
  stats: StatLine;
  /** The real sub-muscle scores behind the stats. */
  scores: SubMuscleScores;
  /** Null while calibrating. */
  power: number | null;
  level: { level: number; into: number; needed: number };
  coins: number;
  timeZone: string;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Everything the Hero · Stats screen shows. A missing game/state (an account the server hasn't
 * touched yet) is a new account, exactly as the server treats it: default body inputs, empty
 * calibration. Decay is applied for `now`.
 */
export function heroView(state: GameState | null, muscles: MusclesFacts, now: number, browserTimeZone: string): HeroView {
  const timeZone = resolveTimeZone(state, browserTimeZone);
  const game = state ?? newGameState(now, timeZone);
  const profile = profileOf(game);
  const calibrating = !calibrationDone(game.calibration, now);
  const real = computeStats(muscles, profile, now, timeZone);
  const stats = roundStats(displayStats(real, game.calibration, now));
  return {
    calibrating,
    calibration: calibrationProgress(game.calibration, now),
    stats,
    scores: subMuscleScores(muscles, profile, now, timeZone),
    power: calibrating ? null : round1(power(stats)),
    level: levelProgress(game.xp),
    coins: game.coins,
    timeZone,
  };
}

function calibrationProgress(c: Calibration, now: number) {
  const daysLeft = c.startedAt == null ? null : Math.max(0, Math.ceil((c.startedAt + CALIBRATION.days * DAY_MS - now) / DAY_MS));
  return { workouts: c.workouts, needed: CALIBRATION.workouts, daysLeft };
}

// ---- Comparison overlay ----

export const COMPARE_PERIODS = ["1W", "1M", "1Y"] as const;
export type ComparePeriod = (typeof COMPARE_PERIODS)[number];

const PERIOD_DAYS: Record<ComparePeriod, number> = { "1W": 7, "1M": 30, "1Y": 365 };

/**
 * The snapshot to compare against: the latest one taken at or before `period` ago. Null when the
 * account has no snapshot that old, which the UI says out loud rather than faking one.
 */
export function pickSnapshot(snapshots: Snapshot[], now: number, period: ComparePeriod): Snapshot | null {
  const cutoff = now - PERIOD_DAYS[period] * DAY_MS;
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.takenAt <= cutoff && (!best || s.takenAt > best.takenAt)) best = s;
  }
  return best;
}

// ---- Train: week strip, routines, last workout ----

export type DayStatus = "done" | "today" | "rest" | "future";

export interface DayCell {
  dayId: string;
  /** Single letter for the strip. */
  letter: string;
  /** Full weekday name, for screen readers. */
  name: string;
  status: DayStatus;
  /** Whether this is today, whether or not a workout is done. */
  isToday: boolean;
}

const addDays = (id: string, n: number) => new Date(Date.parse(`${id}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekdayName = (id: string) =>
  new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/**
 * This week (Sunday to Saturday, in the game's time zone) day by day. A day is "done" when a
 * counted workout (4+ working sets, the claim rule) started on it.
 */
export function weekStrip(
  workouts: Pick<Workout, "startedAt" | "exercises">[],
  lookup: ExerciseLookup,
  now: number,
  timeZone: string,
): { days: DayCell[]; workouts: number } {
  const first = weekId(now, timeZone);
  const today = dayId(now, timeZone);
  const counted = workouts.filter((w) => countsAsWorkout(w, lookup));
  const doneDays = new Set(counted.map((w) => dayId(w.startedAt, timeZone)));
  const days = Array.from({ length: 7 }, (_, i): DayCell => {
    const id = addDays(first, i);
    const name = weekdayName(id);
    const status: DayStatus = doneDays.has(id) ? "done" : id === today ? "today" : id < today ? "rest" : "future";
    return { dayId: id, letter: name[0], name, status, isToday: id === today };
  });
  const thisWeek = counted.filter((w) => days.some((d) => d.dayId === dayId(w.startedAt, timeZone))).length;
  return { days, workouts: thisWeek };
}

/** The stats a routine trains, in the order its exercises first hit them. Cardio and unknown exercises are skipped. */
export function routineStats(exerciseIds: string[], lookup: ExerciseLookup): Stat[] {
  const found: Stat[] = [];
  for (const id of exerciseIds) {
    const info = lookup(id);
    if (!info || EXCLUDED_CATEGORIES.includes(info.category)) continue;
    const stat = statOf(info.muscle);
    if (!found.includes(stat)) found.push(stat);
  }
  return found;
}

/** "Today", "Yesterday", a weekday within the last week, else a date. */
export function dayLabel(ms: number, now: number, timeZone: string): string {
  const ago = daysBetween(dayId(ms, timeZone), dayId(now, timeZone));
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString("en-US", { timeZone, ...opts });
  return ago < 7 ? fmt({ weekday: "short" }) : fmt({ month: "short", day: "numeric" });
}

export const STAT_LABELS: Record<Stat, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
};
