import type { GameState } from "./claim";
import { INJURY, PAUSE, STATS, type Stat } from "./config";
import type { Freeze, Interval } from "./freeze";
import { addDays, dayId, dayStartMs, daysBetween } from "./time";

/*
 * Pause mode and injury flags (GAME_DESIGN.md 3.6). Pure: each action returns the next
 * state or the reason it isn't allowed; the API routes write the result.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** A vacation pause. It covers the calendar days startDay up to (not including) endDay. */
export interface Pause {
  startAt: number;
  /** Planned end: the start of endDay in the user's time zone. */
  endAt: number;
  startDay: string;
  endDay: string;
  /** Set when the user ended it early; endDay then moves to that day. */
  endedEarlyAt?: number;
}

/** An injured stat. Cleared flags are kept for a year so decay stays frozen over the period. */
export interface Injury {
  stat: Stat;
  since: number;
  expiresAt: number;
  /** Private: never shown to followers. */
  note?: string;
  /** Day id the user expects to be back, shown to followers. */
  expectedReturn?: string;
  clearedAt?: number;
  /** How many times the flag was renewed past its first 8 weeks. */
  renewals: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const pausesOf = (s: Pick<GameState, "pauses">): Pause[] => s.pauses ?? [];
export const injuriesOf = (s: Pick<GameState, "injuries">): Injury[] => s.injuries ?? [];

export const pauseEnd = (p: Pause): number => p.endedEarlyAt ?? p.endAt;
const injuryEnd = (i: Injury): number => Math.min(i.expiresAt, i.clearedAt ?? Infinity);

/** The pause running at `now`, if any. Pauses end by themselves: nothing needs to be written. */
export function activePause(state: Pick<GameState, "pauses">, now: number): Pause | null {
  return pausesOf(state).find((p) => p.startAt <= now && now < pauseEnd(p)) ?? null;
}

/** Injury flags in effect at `now` (not cleared, not expired). */
export function activeInjuries(state: Pick<GameState, "injuries">, now: number): Injury[] {
  return injuriesOf(state).filter((i) => i.since <= now && now < injuryEnd(i));
}

export const injuredStats = (state: Pick<GameState, "injuries">, now: number): Stat[] =>
  activeInjuries(state, now).map((i) => i.stat);

/** Whether `day` falls inside a pause (no schedule slot that day). */
export function pausedOn(state: Pick<GameState, "pauses">, day: string): boolean {
  return pausesOf(state).some((p) => day >= p.startDay && day < p.endDay);
}

/** What decay and the frequency count must skip. */
export function freezeFor(state: Pick<GameState, "pauses" | "injuries">): Freeze {
  const byStat: Partial<Record<Stat, Interval[]>> = {};
  for (const i of injuriesOf(state)) (byStat[i.stat] ??= []).push([i.since, injuryEnd(i)]);
  return { all: pausesOf(state).map((p): Interval => [p.startAt, pauseEnd(p)]), byStat };
}

const withBreaks = (state: GameState, now: number, patch: Partial<GameState>): GameState => ({
  ...state,
  ...patch,
  updatedAt: now,
});

/** Drops pauses and injuries that ended more than a year ago. */
function prune(state: GameState, now: number) {
  return {
    pauses: pausesOf(state).filter((p) => now - pauseEnd(p) < PAUSE.historyDays * DAY_MS),
    injuries: injuriesOf(state).filter((i) => now - injuryEnd(i) < INJURY.historyDays * DAY_MS),
  };
}

// ---- Pause ----

/** Starts a pause today for `days` calendar days (today counts). */
export function startPause(state: GameState, days: number, now: number, timeZone: string): Result<GameState> {
  if (!Number.isInteger(days) || days < PAUSE.minDays || days > PAUSE.maxDays) {
    return fail(`A pause lasts ${PAUSE.minDays} to ${PAUSE.maxDays} days`);
  }
  if (activePause(state, now)) return fail("You are already paused");
  const last = Math.max(0, ...pausesOf(state).map(pauseEnd));
  if (now < last + PAUSE.cooldownDays * DAY_MS) {
    return fail(`Wait ${PAUSE.cooldownDays} days after a pause before starting another`);
  }
  const startDay = dayId(now, timeZone);
  const endDay = addDays(startDay, days);
  const pause: Pause = { startAt: now, endAt: dayStartMs(endDay, timeZone), startDay, endDay };
  const kept = prune(state, now);
  return ok(withBreaks(state, now, { ...kept, pauses: [...kept.pauses, pause] }));
}

/** Ends the running pause early. Only allowed once the 7-day minimum has passed. */
export function endPause(state: GameState, now: number, timeZone: string): Result<GameState> {
  const pause = activePause(state, now);
  if (!pause) return fail("You are not paused");
  if (now - pause.startAt < PAUSE.minDays * DAY_MS) {
    return fail(`A pause can end early after its first ${PAUSE.minDays} days`);
  }
  const ended: Pause = { ...pause, endedEarlyAt: now, endDay: dayId(now, timeZone) };
  return ok(withBreaks(state, now, { pauses: pausesOf(state).map((p) => (p === pause ? ended : p)) }));
}

// ---- Injuries ----

const expiry = (now: number) => now + INJURY.expiryWeeks * WEEK_MS;

function badReturn(day: string | undefined, today: string): string | null {
  if (day === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    return "Expected return must be a date";
  }
  if (daysBetween(today, day) < 0) return "Expected return can't be in the past";
  return null;
}

/** Marks a stat as injured, for up to INJURY.maxStats stats at once. */
export function flagInjury(
  state: GameState,
  stat: Stat,
  opts: { note?: string; expectedReturn?: string },
  now: number,
  timeZone: string,
): Result<GameState> {
  if (!STATS.includes(stat)) return fail("Unknown stat");
  const active = activeInjuries(state, now);
  if (active.some((i) => i.stat === stat)) return fail("That stat is already flagged");
  if (active.length >= INJURY.maxStats) return fail(`At most ${INJURY.maxStats} stats can be flagged at once`);
  const note = opts.note?.trim();
  if (note && note.length > INJURY.maxNoteLength) return fail("That note is too long");
  const problem = badReturn(opts.expectedReturn, dayId(now, timeZone));
  if (problem) return fail(problem);
  const injury: Injury = {
    stat,
    since: now,
    expiresAt: expiry(now),
    renewals: 0,
    ...(note ? { note } : {}),
    ...(opts.expectedReturn ? { expectedReturn: opts.expectedReturn } : {}),
  };
  const kept = prune(state, now);
  return ok(withBreaks(state, now, { ...kept, injuries: [...kept.injuries, injury] }));
}

/** Pushes an active flag's expiry out another INJURY.expiryWeeks weeks from now. */
export function renewInjury(state: GameState, stat: Stat, now: number): Result<GameState> {
  const injury = activeInjuries(state, now).find((i) => i.stat === stat);
  if (!injury) return fail("That stat is not flagged");
  const renewed: Injury = { ...injury, expiresAt: expiry(now), renewals: injury.renewals + 1 };
  return ok(withBreaks(state, now, { injuries: injuriesOf(state).map((i) => (i === injury ? renewed : i)) }));
}

/** Ends a flag now. */
export function clearInjury(state: GameState, stat: Stat, now: number): Result<GameState> {
  const injury = activeInjuries(state, now).find((i) => i.stat === stat);
  if (!injury) return fail("That stat is not flagged");
  const cleared: Injury = { ...injury, clearedAt: now };
  return ok(withBreaks(state, now, { injuries: injuriesOf(state).map((i) => (i === injury ? cleared : i)) }));
}

export const setShowInjuries = (state: GameState, show: boolean, now: number): GameState =>
  withBreaks(state, now, { showInjuries: show });

/** What followers may see (publicStats/{uid}): the stat and expected return, never the note. */
export interface PublicInjury {
  stat: Stat;
  expiresAt: number;
  expectedReturn?: string;
}

/** Empty when the user hides their flags. */
export function publicInjuries(state: GameState, now: number): PublicInjury[] {
  if (state.showInjuries === false) return [];
  return activeInjuries(state, now).map((i) => ({
    stat: i.stat,
    expiresAt: i.expiresAt,
    ...(i.expectedReturn ? { expectedReturn: i.expectedReturn } : {}),
  }));
}
