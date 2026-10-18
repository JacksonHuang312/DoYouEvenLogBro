import { activeInjuries, activePause, pauseEnd, pausesOf, startPause, type Injury } from "./breaks";
import { newGameState, type GameState } from "./claim";
import { INJURY, PAUSE, STATS, type Stat } from "./config";
import { addDays, dayId, daysBetween } from "./time";
import { STAT_LABELS } from "./view";

/*
 * What the Breaks panel shows (pause mode and injury flags, GAME_DESIGN.md 3.6): what is running,
 * what can be done right now, and when it can be. The rules themselves live in breaks.ts; this
 * asks them, so the screen never disagrees with the server.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const dateLabel = (ms: number, timeZone: string) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
const dayLabel = (id: string) =>
  new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface PauseView {
  active: {
    /** First day back: "Oct 30". */
    backOn: string;
    daysLeft: number;
    canEndNow: boolean;
    /** When ending early opens up: "Oct 21". Only meaningful while canEndNow is false. */
    canEndFrom: string;
  } | null;
  /** When the next pause may start, if a cooldown is running. */
  nextPauseFrom: string | null;
}

export function pauseView(state: GameState | null, now: number, timeZone: string): PauseView {
  const game = state ?? newGameState(now, timeZone);
  const pause = activePause(game, now);
  const last = Math.max(0, ...pausesOf(game).map(pauseEnd));
  const cooldownEnds = last + PAUSE.cooldownDays * DAY_MS;
  return {
    active: pause && {
      backOn: dayLabel(pause.endDay),
      daysLeft: Math.max(1, daysBetween(dayId(now, timeZone), pause.endDay)),
      canEndNow: now - pause.startAt >= PAUSE.minDays * DAY_MS,
      canEndFrom: dateLabel(pause.startAt + PAUSE.minDays * DAY_MS, timeZone),
    },
    nextPauseFrom: !pause && last > 0 && now < cooldownEnds ? dateLabel(cooldownEnds, timeZone) : null,
  };
}

/** Whether a pause of `days` days can start now, and the day it would end on. `error` is the server's reason if not. */
export function pausePlan(
  state: GameState | null,
  days: number,
  now: number,
  timeZone: string,
): { backOn: string; error: string | null } {
  const game = state ?? newGameState(now, timeZone);
  const result = startPause(game, days, now, timeZone);
  return { backOn: dayLabel(addDays(dayId(now, timeZone), days)), error: result.ok ? null : result.error };
}

export interface InjuryRow {
  stat: Stat;
  label: string;
  /** The private note, shown to the owner only. */
  note: string | null;
  /** The day followers are told to expect you back. */
  expectedReturn: string | null;
  expires: string;
  daysToExpiry: number;
  /** A flag that lapses within this many days is worth renewing. */
  soon: boolean;
  renewals: number;
}

export interface InjuryView {
  rows: InjuryRow[];
  /** Stats that can still be flagged. Empty when the limit is reached. */
  flaggable: { stat: Stat; label: string }[];
  full: boolean;
  /** Whether followers see the flags. */
  shown: boolean;
}

const SOON_DAYS = 14;

export function injuryView(state: GameState | null, now: number, timeZone: string): InjuryView {
  const game = state ?? newGameState(now, timeZone);
  const active = activeInjuries(game, now);
  const today = dayId(now, timeZone);
  const row = (i: Injury): InjuryRow => {
    const daysToExpiry = Math.max(0, Math.ceil((i.expiresAt - now) / DAY_MS));
    return {
      stat: i.stat,
      label: STAT_LABELS[i.stat],
      note: i.note ?? null,
      expectedReturn: i.expectedReturn && i.expectedReturn >= today ? dayLabel(i.expectedReturn) : null,
      expires: dateLabel(i.expiresAt, timeZone),
      daysToExpiry,
      soon: daysToExpiry <= SOON_DAYS,
      renewals: i.renewals,
    };
  };
  const full = active.length >= INJURY.maxStats;
  return {
    rows: active.map(row),
    flaggable: full ? [] : STATS.filter((s) => !active.some((i) => i.stat === s)).map((s) => ({ stat: s, label: STAT_LABELS[s] })),
    full,
    shown: game.showInjuries !== false,
  };
}
