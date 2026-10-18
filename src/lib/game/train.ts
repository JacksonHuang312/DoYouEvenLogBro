import type { Workout } from "../types";
import { activePause } from "./breaks";
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

export function trainSchedule(input: TrainScheduleInput): TrainSchedule {
  const { routines, lookup, now, timeZone } = input;
  const doc = input.schedule ?? emptySchedule(now);
  const state = input.state ?? { pauses: [] };
  const hasSchedule = doc.versions.length > 0;
  const today = dayId(now, timeZone);
  const first = weekId(now, timeZone);

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

  // ---- Week strip ----
  const days: PlanDay[] = hasSchedule
    ? Array.from({ length: 7 }, (_, i): PlanDay => {
        const id = addDays(first, i);
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
      })
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
