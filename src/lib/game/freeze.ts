import type { Stat, SubMuscle } from "./config";
import { statOf } from "./muscles";

/** A stretch of time [start, end) in ms. */
export type Interval = readonly [start: number, end: number];

/**
 * Time when decay and the frequency count stand still (section 3.6): pauses freeze every stat,
 * injury flags freeze one. Built from the game state by breaks.ts#freezeFor.
 */
export interface Freeze {
  all: Interval[];
  byStat: Partial<Record<Stat, Interval[]>>;
}

/** Nothing frozen: history replays and tests. Stat math takes a Freeze explicitly so no caller forgets one. */
export const NO_FREEZE: Freeze = { all: [], byStat: {} };

/** The intervals that apply to one sub-muscle: every pause plus its stat's injuries. */
export function intervalsFor(freeze: Freeze, muscle: SubMuscle): Interval[] {
  return [...freeze.all, ...(freeze.byStat[statOf(muscle)] ?? [])];
}

/** Milliseconds inside [from, to) covered by the intervals, counting overlaps once. */
export function frozenMs(intervals: readonly Interval[], from: number, to: number): number {
  if (to <= from) return 0;
  const clipped = intervals
    .map(([s, e]) => [Math.max(s, from), Math.min(e, to)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [s, e] of clipped) {
    if (e <= end) continue;
    total += e - Math.max(s, end);
    end = e;
  }
  return total;
}
