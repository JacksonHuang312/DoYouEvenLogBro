import { addDays, weekdayOf } from "./time";

/*
 * The month grid behind the date picker. Days are yyyy-mm-dd ids; nothing here touches the clock
 * or a time zone, so the screen passes in today.
 */

export interface CalendarCell {
  day: string;
  /** The day of the month, for the label. */
  date: number;
  /** Outside the allowed range: before `min` or after `max`. */
  disabled: boolean;
  today: boolean;
  selected: boolean;
}

/** First of the month of `day`: "2026-10-18" gives "2026-10-01". */
export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

/** First of the month `n` months after (or before) the month of `day`. */
export function shiftMonth(day: string, n: number): string {
  const total = Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1) + n;
  const year = Math.floor(total / 12);
  return `${String(year).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** "October 2026". */
export const monthLabel = (day: string): string =>
  new Date(`${monthStart(day)}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The weeks of the month holding `month`, Sunday first. Days of the neighbouring months that fill
 * out the first and last week are null, so the grid stays square without showing days of other months.
 */
export function monthGrid(
  month: string,
  opts: { today: string; min: string; max: string; selected: string | null },
): (CalendarCell | null)[][] {
  const first = monthStart(month);
  const cells: (CalendarCell | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); day = addDays(day, 1)) {
    cells.push({
      day,
      date: Number(day.slice(8)),
      disabled: day < opts.min || day > opts.max,
      today: day === opts.today,
      selected: day === opts.selected,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Whether any day of the month of `month` can be picked, so the arrows stop at the range. */
export const monthInRange = (month: string, min: string, max: string): boolean =>
  monthStart(month) <= max && shiftMonth(month, 1) > min;
