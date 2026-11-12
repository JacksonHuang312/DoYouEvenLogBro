import type { Workout } from "../types";
import { activePause, pausedOn } from "./breaks";
import { monthGrid, monthLabel, monthStart, shiftMonth } from "./calendar";
import type { GameState } from "./claim";
import { COINS, SCHEDULE } from "./config";
import { scheduledBonus } from "./economy";
import { emptySchedule, matchWorkout, slotOn, type MatchedSlot, type ScheduleDoc } from "./schedule";
import { countsAsWorkout, type ExerciseLookup } from "./sets";
import { addDays, dayId, daysBetween, weekId } from "./time";
import { weekStrip } from "./view";

/*
 * What the Train screen shows about the schedule (GAME_DESIGN.md 7.2): today's slot, the week
 * strip and each routine's next day. Computed on the client from the schedule the server wrote
 * plus the workouts on the device. A workout the server hasn't claimed yet has no entry in
 * schedule.matched, so it is matched here with the server's own function and shown as a
 * prediction until the claim goes through.
 */

export type PlanStatus =
  /** A counted workout on a day with no schedule at all (no schedule has ever been set). */
  | "done"
  | "on-time"
  | "late"
  | "early"
  | "today"
  | "planned"
  | "missed"
  /** A counted workout on a day with no free slot nearby. */
  | "extra"
  | "rest";

export interface PlanDay {
  dayId: string;
  letter: string;
  name: string;
  status: PlanStatus;
  isToday: boolean;
  /** The mark comes from this device's own matching, not from the server yet. */
  predicted: boolean;
  /** For screen readers: "Done a day late". */
  label: string;
}

export type TodayKind = "today" | "make-up" | "next" | "paused" | "none";

export interface TodayCard {
  kind: TodayKind;
  /** The routine to start. Missing for "paused" and "none". */
  routineId?: string;
  /** The scheduled day this workout would fill. */
  day?: string;
  /** The small line above the routine name. */
  kicker: string;
  /** What starting it pays, e.g. "Full bonus if done today. Tomorrow pays 80%." */
  note: string | null;
}

export interface TrainSchedule {
  /** False until a schedule has been saved. */
  hasSchedule: boolean;
  card: TodayCard;
  days: PlanDay[];
  /** "3 of 5 done" or "2 workouts". */
  summary: string;
  /** Whether any mark on the strip is a prediction. */
  anyPredicted: boolean;
  /** Routine id -> "Today", "Tomorrow", a weekday or "Next Wed". Routines not scheduled in the next 8 days are absent. */
  nextByRoutine: Record<string, string>;
}

export interface TrainScheduleInput {
  schedule: ScheduleDoc | null;
  state: Pick<GameState, "pauses"> | null;
  routines: { id: string; name: string }[];
  workouts: Pick<Workout, "id" | "startedAt" | "exercises">[];
  lookup: ExerciseLookup;
  now: number;
  timeZone: string;
}

const WEEKDAY = (id: string, style: "long" | "short") =>
  new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });

/** The share of the scheduled-day bonus paid for a workout `daysOff` days from its slot, as a whole percent. */
export const bonusPercent = (daysOff: number) => Math.round((100 * scheduledBonus(daysOff)) / COINS.scheduledBonus);

const nearLabel = (day: string, today: string) => {
  const ahead = daysBetween(today, day);
  if (ahead === 0) return "Today";
  if (ahead === 1) return "Tomorrow";
  // The same weekday a week on would read as a day already past.
  return ahead >= 7 ? `Next ${WEEKDAY(day, "short")}` : WEEKDAY(day, "short");
};

function offLabel(daysOff: number, early: boolean) {
  return `Done ${daysOff === 1 ? "a day" : `${daysOff} days`} ${early ? "early" : "late"}`;
}

/** What marking a day needs: the schedule with this device's predictions added, and the workout days left over. */
interface PlanContext {
  live: ScheduleDoc;
  state: Pick<GameState, "pauses">;
  matched: Record<string, MatchedSlot>;
  predictedDays: Set<string>;
  /** Days with a counted workout that filled no scheduled day. */
  workoutDays: Set<string>;
  hasSchedule: boolean;
  today: string;
}

function planContext(input: TrainScheduleInput): PlanContext {
  const { lookup, now, timeZone } = input;
  const doc = input.schedule ?? emptySchedule(now);
  const state = input.state ?? { pauses: [] };
  const hasSchedule = doc.versions.length > 0;
  const today = dayId(now, timeZone);

  // Server-confirmed matches, plus this device's prediction for counted workouts the server hasn't matched.
  const matched: Record<string, MatchedSlot> = { ...doc.matched };
  const predictedDays = new Set<string>();
  const used = new Set(Object.values(matched).map((m) => m.workoutId));
  const counted = input.workouts
    .filter((w) => countsAsWorkout(w, lookup))
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const w of counted) {
    if (used.has(w.id)) continue;
    const workoutDay = dayId(w.startedAt, timeZone);
    if (daysBetween(workoutDay, today) > SCHEDULE.matchDays + SCHEDULE.syncGraceDays) continue;
    const match = matchWorkout({ doc: { ...doc, matched }, state, workoutDay, claimDay: today });
    if (!match) continue;
    matched[match.day] = { workoutId: w.id, workoutDay, daysOff: match.daysOff, claimedAt: now };
    predictedDays.add(match.day);
    used.add(w.id);
  }
  const live: ScheduleDoc = { ...doc, matched };
  const workoutDays = new Set(counted.filter((w) => !used.has(w.id)).map((w) => dayId(w.startedAt, timeZone)));
  return { live, state, matched, predictedDays, workoutDays, hasSchedule, today };
}

/** One day's mark under a schedule: the Train week strip and the Quests calendar both use it, so they always agree. */
function scheduledDay({ live, state, matched, predictedDays, workoutDays, today }: PlanContext, id: string): PlanDay {
  const name = WEEKDAY(id, "long");
  const slot = slotOn(live, state, id);
  const m = matched[id];
  const base = { dayId: id, letter: name[0], name, isToday: id === today, predicted: false };
  if (slot && m) {
    const early = daysBetween(m.workoutDay, id) > 0;
    const status: PlanStatus = m.daysOff === 0 ? "on-time" : early ? "early" : "late";
    const label = m.daysOff === 0 ? "Done on schedule" : offLabel(m.daysOff, early);
    const predicted = predictedDays.has(id);
    return { ...base, status, predicted, label: predicted ? `${label} (predicted, not synced yet)` : label };
  }
  if (slot) {
    if (id === today) return { ...base, status: "today", label: "Scheduled today" };
    if (id > today) return { ...base, status: "planned", label: "Scheduled" };
    return { ...base, status: "missed", label: "Missed" };
  }
  if (workoutDays.has(id)) return { ...base, status: "extra", label: "Extra workout" };
  return { ...base, status: "rest", label: "Rest day" };
}

export function trainSchedule(input: TrainScheduleInput): TrainSchedule {
  const { routines, lookup, now, timeZone } = input;
  const ctx = planContext(input);
  const { live, state, matched, hasSchedule, today } = ctx;
  const first = weekId(now, timeZone);

  // ---- Week strip ----
  const days: PlanDay[] = hasSchedule
    ? Array.from({ length: 7 }, (_, i) => scheduledDay(ctx, addDays(first, i)))
    : weekStrip(input.workouts, lookup, now, timeZone).days.map(
        (d): PlanDay => ({
          dayId: d.dayId,
          letter: d.letter,
          name: d.name,
          isToday: d.isToday,
          predicted: false,
          status: d.status === "done" ? "done" : d.status === "today" ? "today" : "rest",
          label: d.status === "done" ? "Workout done" : d.status === "today" ? "Today, no workout yet" : "No workout",
        }),
      );

  const scheduledThisWeek = days.filter((d) => ["on-time", "late", "early", "today", "planned", "missed"].includes(d.status));
  const doneThisWeek = scheduledThisWeek.filter((d) => ["on-time", "late", "early"].includes(d.status)).length;
  const weekWorkouts = days.filter((d) => ["done", "on-time", "late", "early", "extra"].includes(d.status)).length;
  const summary = hasSchedule && scheduledThisWeek.length > 0
    ? `${doneThisWeek} of ${scheduledThisWeek.length} done`
    : weekWorkouts === 1
      ? "1 workout day"
      : `${weekWorkouts} workout days`;

  // ---- Today's card ----
  const card = todayCard(live, state, routines, today, now);

  // ---- Each routine's next scheduled day ----
  const nextByRoutine: Record<string, string> = {};
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = addDays(today, ahead);
    const slot = slotOn(live, state, day);
    if (!slot || matched[day] || slot.routineId in nextByRoutine) continue;
    nextByRoutine[slot.routineId] = nearLabel(day, today);
  }

  return { hasSchedule, card, days, summary, anyPredicted: days.some((d) => d.predicted), nextByRoutine };
}

/**
 * What to put at the top of Train. A workout started now fills whichever open slot the server
 * would pick (matchWorkout), so the card shows exactly that one and what it pays.
 */
function todayCard(
  live: ScheduleDoc,
  state: Pick<GameState, "pauses">,
  routines: { id: string }[],
  today: string,
  now: number,
): TodayCard {
  const exists = (id: string) => routines.some((r) => r.id === id);
  const pause = activePause(state, now);
  if (pause) {
    const back = new Date(`${pause.endDay}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return { kind: "paused", kicker: "Paused", note: `Back ${back}. You can still log workouts; they pay no scheduled bonus.` };
  }

  const match = matchWorkout({ doc: live, state, workoutDay: today, claimDay: today });
  if (match && exists(match.routineId)) {
    const base = { routineId: match.routineId, day: match.day };
    if (match.day === today) {
      const tomorrow = addDays(today, 1);
      const tomorrowFree = !slotOn(live, state, tomorrow) || Boolean(live.matched[tomorrow]);
      return {
        kind: "today",
        ...base,
        kicker: "Scheduled today",
        note: `Full bonus if done today.${tomorrowFree && bonusPercent(1) > 0 ? ` Tomorrow pays ${bonusPercent(1)}%.` : ""}`,
      };
    }
    const pct = bonusPercent(match.daysOff);
    const pay = pct > 0 ? `Doing it today pays ${pct}% of the bonus.` : "Doing it today pays no scheduled bonus.";
    if (match.day < today) {
      return { kind: "make-up", ...base, kicker: `Make-up for ${WEEKDAY(match.day, "long")}`, note: pay };
    }
    const when = match.day === addDays(today, 1) ? "tomorrow" : `on ${WEEKDAY(match.day, "long")}`;
    return { kind: "next", ...base, kicker: `Next: ${nearLabel(match.day, today)}`, note: `${pay} Full bonus ${when}.` };
  }

  // Nothing in reach: the next open slot within a week.
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = addDays(today, ahead);
    const slot = slotOn(live, state, day);
    if (slot && !live.matched[day] && exists(slot.routineId)) {
      return { kind: "next", routineId: slot.routineId, day, kicker: `Next: ${nearLabel(day, today)}`, note: "Starting early pays no scheduled bonus." };
    }
  }
  return { kind: "none", kicker: "", note: null };
}

// ---- The Quests calendar (13.25) ----

export interface CalendarDay extends PlanDay {
  /** Day of the month. */
  date: number;
  /** Inside a pause: no slot that day. */
  paused: boolean;
  /** The line shown when the day is tapped: "Wed, Oct 14 · Pull day · Done a day late". */
  line: string;
}

export interface PlanMonth {
  /** The month's first day, yyyy-mm-01. */
  month: string;
  /** "October 2026". */
  label: string;
  /** Weeks, Sunday first; null pads the first and last week. */
  weeks: (CalendarDay | null)[][];
  /** "5 of 12 scheduled days done", or "3 workout days" without a schedule. */
  summary: string;
  /** The earlier and later month to show, or null at the end of the range. */
  prev: string | null;
  next: string | null;
  anyPredicted: boolean;
}

/** Months ahead of this one the calendar shows: the schedule simply repeats. */
export const CALENDAR_MONTHS_AHEAD = 3;

/** The first day whose scheduled-day matches the server still keeps (SCHEDULE.matchedWeeksKept); older marks would be guesses. */
export const calendarFrom = (today: string): string => addDays(today, -SCHEDULE.matchedWeeksKept * 7);

/**
 * A month of the plan for the Quests tab: every day marked like the Train week strip. `workouts`
 * must cover the month (and a few days either side, for early and late matches). Days before
 * `calendarFrom` show only whether a counted workout was logged, since their matches are gone.
 */
export function planMonth(input: TrainScheduleInput & { month: string }): PlanMonth {
  const { routines, lookup, timeZone } = input;
  const ctx = planContext(input);
  const { live, state, hasSchedule, today } = ctx;
  const month = monthStart(input.month);
  const from = calendarFrom(today);
  const doneDays = new Set(input.workouts.filter((w) => countsAsWorkout(w, lookup)).map((w) => dayId(w.startedAt, timeZone)));
  const routineName = (id: string) => routines.find((r) => r.id === id)?.name ?? "Scheduled workout";
  const dateLabel = (id: string) =>
    new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const cell = (id: string, date: number): CalendarDay => {
    const name = WEEKDAY(id, "long");
    const base = { dayId: id, letter: name[0], name, isToday: id === today, predicted: false, date, paused: false };
    const when = dateLabel(id);
    // No schedule, or too old for the kept matches: only whether a workout was logged.
    if (!hasSchedule || id < from) {
      if (doneDays.has(id)) return { ...base, status: "done", label: "Workout done", line: `${when} · Workout done` };
      if (id === today) return { ...base, status: "today", label: "Today, no workout yet", line: `${when} · Today, no workout yet` };
      return { ...base, status: "rest", label: "No workout", line: `${when} · No workout` };
    }
    const day = scheduledDay(ctx, id);
    const slot = slotOn(live, state, id);
    // A filled slot may be from an older schedule version; the slot's routine is the day's own.
    const what = slot ? `${routineName(slot.routineId)} · ` : "";
    if (!slot && day.status === "rest" && pausedOn(state, id)) {
      return { ...base, status: "rest", paused: true, label: "Paused", line: `${when} · Paused` };
    }
    return { ...day, date, paused: false, line: `${when} · ${what}${day.label}` };
  };

  const weeks = monthGrid(month, { today, min: "0000-01-01", max: "9999-12-31", selected: null }).map((week) =>
    week.map((c) => (c ? cell(c.day, c.date) : null)),
  );
  const days = weeks.flat().filter((d): d is CalendarDay => d != null);
  const scheduled = days.filter((d) => ["on-time", "late", "early", "today", "planned", "missed"].includes(d.status));
  const done = scheduled.filter((d) => ["on-time", "late", "early"].includes(d.status)).length;
  const workoutDays = days.filter((d) => ["done", "on-time", "late", "early", "extra"].includes(d.status)).length;
  const summary =
    hasSchedule && scheduled.length > 0
      ? `${done} of ${scheduled.length} scheduled days done`
      : `${workoutDays} ${workoutDays === 1 ? "workout day" : "workout days"}`;

  const thisMonth = monthStart(today);
  const earliest = monthStart(hasSchedule ? from : addDays(today, -365));
  const latest = hasSchedule ? shiftMonth(thisMonth, CALENDAR_MONTHS_AHEAD) : thisMonth;
  return {
    month,
    label: monthLabel(month),
    weeks,
    summary,
    prev: month > earliest ? shiftMonth(month, -1) : null,
    next: month < latest ? shiftMonth(month, 1) : null,
    anyPredicted: days.some((d) => d.predicted),
  };
}
