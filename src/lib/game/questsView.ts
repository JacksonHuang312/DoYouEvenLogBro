import { QUESTS } from "./config";
import { claimable, isComplete, questProgress, type Quest, type QuestsDoc, type QuestWeek } from "./quests";
import type { ScheduleDoc, WeekdayRoutines } from "./schedule";
import { addDays } from "./time";

/*
 * What the Quests screen shows: the week's quests with progress counted from the workouts, the
 * reroll price, and the schedule editor's day assignments. Pure, so it is unit tested.
 */

export type QuestState =
  /** Not finished yet: can be rerolled. */
  | "active"
  /** Finished and unpaid: the Claim button (a workout claim pays it on its own; editing a workout needs the button). */
  | "complete"
  | "claimed"
  /** Finished but past the claim window. */
  | "expired";

export interface QuestCard {
  id: string;
  title: string;
  /** Capped at the target for the bar. */
  progress: number;
  target: number;
  pct: number;
  reward: string;
  state: QuestState;
}

export function questCards(doc: QuestsDoc, week: QuestWeek, now: number): QuestCard[] {
  return [...doc.quests]
    .sort((a, b) => a.slot - b.slot)
    .map((q: Quest): QuestCard => {
      const progress = questProgress(q, week);
      const state: QuestState =
        q.claimedAt != null ? "claimed" : !isComplete(q, progress) ? "active" : claimable(doc, q, progress, now) ? "complete" : "expired";
      return {
        id: q.id,
        title: q.title,
        progress: Math.min(progress, q.target),
        target: q.target,
        pct: Math.min(100, (100 * progress) / q.target),
        reward: `${q.reward.coins} coins · ${q.reward.xp} XP`,
        state,
      };
    });
}

export interface RerollInfo {
  /** Price of the next reroll, or null when none are left. */
  cost: number | null;
  left: number;
  /** "Rerolls: 25 coins, then 50 · 2 left this week" */
  label: string;
}

export function rerollInfo(doc: Pick<QuestsDoc, "rerollsUsed">): RerollInfo {
  const costs = QUESTS.rerollCosts;
  const left = Math.max(0, costs.length - doc.rerollsUsed);
  const cost = costs[doc.rerollsUsed] ?? null;
  const price = costs.map((c, i) => (i === 0 ? `${c} coins` : String(c))).join(", then ");
  return { cost, left, label: `Rerolls cost ${price}. ${left === 0 ? "None left this week." : `${left} left this week.`}` };
}

// ---- Schedule editor ----

/** Sunday first, as the week runs. Keys match WeekdayRoutines. */
export const WEEKDAYS = [
  { key: "0", letter: "S", name: "Sunday" },
  { key: "1", letter: "M", name: "Monday" },
  { key: "2", letter: "T", name: "Tuesday" },
  { key: "3", letter: "W", name: "Wednesday" },
  { key: "4", letter: "T", name: "Thursday" },
  { key: "5", letter: "F", name: "Friday" },
  { key: "6", letter: "S", name: "Saturday" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

/**
 * The days the editor starts from: the newest saved version (a change waiting to start counts),
 * without routines that no longer exist.
 */
export function editableDays(doc: ScheduleDoc | null, routineIds: string[]): WeekdayRoutines {
  const latest = doc?.versions.at(-1)?.days ?? {};
  return Object.fromEntries(Object.entries(latest).filter(([, id]) => routineIds.includes(id))) as WeekdayRoutines;
}

/** Puts a weekday on a routine, taking it from another routine. Tapping a routine's own day clears it. */
export function toggleDay(days: WeekdayRoutines, weekday: WeekdayKey, routineId: string): WeekdayRoutines {
  const next = { ...days };
  if (next[weekday] === routineId) delete next[weekday];
  else next[weekday] = routineId;
  return next;
}

export const routineDays = (days: WeekdayRoutines, routineId: string): WeekdayKey[] =>
  WEEKDAYS.filter((d) => days[d.key] === routineId).map((d) => d.key);

export function sameDays(a: WeekdayRoutines, b: WeekdayRoutines): boolean {
  return WEEKDAYS.every((d) => a[d.key] === b[d.key]);
}

/** "Mon, Wed, Fri", or "No days" for a routine that isn't scheduled. */
export function daysLabel(days: WeekdayRoutines, routineId: string): string {
  const keys = routineDays(days, routineId);
  return keys.length === 0 ? "No days" : keys.map((k) => WEEKDAYS[Number(k)].name.slice(0, 3)).join(", ");
}

/** The day a saved-but-not-started schedule begins, if one is waiting (versions start tomorrow). */
export function pendingFrom(doc: ScheduleDoc | null, today: string): string | null {
  const latest = doc?.versions.at(-1);
  return latest && latest.from > today ? latest.from : null;
}

/** The day a schedule saved today starts. */
export const startsOn = (today: string) => addDays(today, 1);
