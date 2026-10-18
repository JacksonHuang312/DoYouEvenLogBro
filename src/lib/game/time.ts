import { WEEK_START_DAY } from "./config";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date ("2026-10-16") at `ms` in the time zone. */
export function dayId(ms: number, timeZone: string): string {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Days since 1970-01-01 for a day id, so dates can be subtracted. */
function dayNumber(id: string): number {
  return Math.round(Date.parse(`${id}T00:00:00Z`) / DAY_MS);
}

const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Whole calendar days from day `a` to day `b` (negative if b is earlier). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** The date `n` days after (or before, if negative) a day id. */
export const addDays = (id: string, n: number): string => fromDayNumber(dayNumber(id) + n);

/** 0 (Sunday) to 6 (Saturday) for a day id. */
export const weekdayOf = (id: string): number => new Date(dayNumber(id) * DAY_MS).getUTCDay();

/** Milliseconds the time zone's wall clock is ahead of UTC at `ms`. */
function offsetMs(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** The instant a day starts (00:00) in the time zone. Two passes settle the offset across a DST change. */
export function dayStartMs(id: string, timeZone: string): number {
  const wall = Date.parse(`${id}T00:00:00Z`);
  let guess = wall - offsetMs(wall, timeZone);
  guess = wall - offsetMs(guess, timeZone);
  return guess;
}

/** A week's id is the date its Sunday starts on, in the user's time zone. */
export function weekId(ms: number, timeZone: string): string {
  const day = dayNumber(dayId(ms, timeZone));
  const weekday = new Date(day * DAY_MS).getUTCDay();
  return fromDayNumber(day - ((weekday - WEEK_START_DAY + 7) % 7));
}

/** The ids of the `n` weeks ending with the one containing `ms`, newest first. */
export function recentWeekIds(ms: number, timeZone: string, n: number): string[] {
  const current = dayNumber(weekId(ms, timeZone));
  return Array.from({ length: n }, (_, i) => fromDayNumber(current - 7 * i));
}
