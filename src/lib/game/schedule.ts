import { pausedOn } from "./breaks";
import type { GameState } from "./claim";
import { SCHEDULE } from "./config";
import { addDays, daysBetween, weekdayOf } from "./time";

/*
 * The workout schedule (GAME_DESIGN.md 3.2, 7.2). A schedule is a routine per weekday. It lives
 * in game/schedule, written only by the server, because it decides coins. Changes are saved as
 * new versions that start tomorrow, so what was scheduled on a past day never changes.
 */

/** "0" (Sunday) to "6" (Saturday) -> routine id. A missing weekday is a rest day. */
export type WeekdayRoutines = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", string>>;

export interface ScheduleVersion {
  /** First day id this version applies to. */
  from: string;
  days: WeekdayRoutines;
}

/** Which workout filled a scheduled day, and how far off it was. */
export interface MatchedSlot {
  workoutId: string;
  workoutDay: string;
  daysOff: number;
  claimedAt: number;
}

/** users/{uid}/game/schedule */
export interface ScheduleDoc {
  /** Oldest first, at most SCHEDULE.versionsKept. */
  versions: ScheduleVersion[];
  /** Scheduled day id -> the workout that filled it. A day pays its bonus once. */
  matched: Record<string, MatchedSlot>;
  updatedAt: number;
}

export const emptySchedule = (now: number): ScheduleDoc => ({ versions: [], matched: {}, updatedAt: now });

/** The routine scheduled on `day`, or null for a rest day or a day inside a pause. */
export function slotOn(doc: ScheduleDoc, state: Pick<GameState, "pauses">, day: string): { routineId: string } | null {
  if (pausedOn(state, day)) return null;
  let version: ScheduleVersion | undefined;
  for (const v of doc.versions) if (v.from <= day) version = v;
  const routineId = version?.days[String(weekdayOf(day)) as keyof WeekdayRoutines];
  return routineId ? { routineId } : null;
}

/** Scheduled days from `from` to `to`, both included, in order. */
export function slotsBetween(
  doc: ScheduleDoc,
  state: Pick<GameState, "pauses">,
  from: string,
  to: string,
): { day: string; routineId: string }[] {
  const slots: { day: string; routineId: string }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const slot = slotOn(doc, state, day);
    if (slot) slots.push({ day, routineId: slot.routineId });
  }
  return slots;
}

/**
 * Saves a new weekly schedule, starting tomorrow (so today's workout can't be scheduled after
 * the fact). A change made earlier the same day replaces the pending version.
 */
export function withSchedule(doc: ScheduleDoc | null, days: WeekdayRoutines, today: string, now: number): ScheduleDoc {
  const base = doc ?? emptySchedule(now);
  const from = addDays(today, 1);
  const kept = base.versions.filter((v) => v.from < from);
  return { ...base, versions: [...kept, { from, days }].slice(-SCHEDULE.versionsKept), updatedAt: now };
}

export interface ScheduleMatch {
  /** The scheduled day this workout fills. */
  day: string;
  routineId: string;
  /** Feeds the off-day curve: days away from the scheduled day. */
  daysOff: number;
}

/**
 * Which scheduled day a counted workout fills: the nearest unfilled one within SCHEDULE.matchDays
 * days of the day it was done (the earlier one on a tie, since it expires first). A day can only
 * be used until SCHEDULE.matchDays + syncGraceDays after it, counted at the claim day.
 * `daysOff` is the larger of the workout's distance and how late the claim is, less the sync
 * grace, so a workout done on its day but claimed the next morning still pays in full.
 */
export function matchWorkout({
  doc,
  state,
  workoutDay,
  claimDay,
}: {
  doc: ScheduleDoc;
  state: Pick<GameState, "pauses">;
  workoutDay: string;
  claimDay: string;
}): ScheduleMatch | null {
  const offsets = Array.from({ length: SCHEDULE.matchDays * 2 + 1 }, (_, i) => i - SCHEDULE.matchDays).sort(
    (a, b) => Math.abs(a) - Math.abs(b) || a - b,
  );
  for (const offset of offsets) {
    const day = addDays(workoutDay, offset);
    if (doc.matched[day]) continue;
    if (daysBetween(day, claimDay) > SCHEDULE.matchDays + SCHEDULE.syncGraceDays) continue;
    const slot = slotOn(doc, state, day);
    if (!slot) continue;
    const late = daysBetween(day, claimDay) - SCHEDULE.syncGraceDays;
    return { day, routineId: slot.routineId, daysOff: Math.max(Math.abs(offset), late, 0) };
  }
  return null;
}

/** Records that a workout filled `match.day`, and forgets days too old to matter. */
export function withMatch(
  doc: ScheduleDoc,
  match: ScheduleMatch,
  workout: { id: string; day: string },
  claimDay: string,
  now: number,
): ScheduleDoc {
  const cutoff = SCHEDULE.matchedWeeksKept * 7;
  const matched = Object.fromEntries(Object.entries(doc.matched).filter(([day]) => daysBetween(day, claimDay) <= cutoff));
  matched[match.day] = { workoutId: workout.id, workoutDay: workout.day, daysOff: match.daysOff, claimedAt: now };
  return { ...doc, matched, updatedAt: now };
}
