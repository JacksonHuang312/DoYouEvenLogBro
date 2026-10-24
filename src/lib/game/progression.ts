import { kgTo, toKg } from "../units";
import type { LoggedSet, Unit } from "../types";
import { PROGRESSION } from "./config";
import { isWorkingSet } from "./sets";

/*
 * Rep ranges and progression (GAME_DESIGN.md 9.2). An exercise can carry a target rep range, for
 * example 6-9. These functions read the last session's sets and say where the lifter stands.
 * Nothing here is stored or paid: no coins, XP or stats, so it can never be farmed.
 */

export interface RepRange {
  repMin: number;
  repMax: number;
}

export type ProgressionStatus =
  /** The exercise has no range. */
  | "no-range"
  /** There are no working sets to judge. */
  | "no-sets"
  /** Every working set reached the top of the range: time to add weight. */
  | "add-weight"
  | "in-range"
  /** A working set fell under the minimum: suggest a lighter weight. */
  | "below-range";

/** A whole-number range inside the allowed bounds, min at most max. */
export function validRepRange(repMin: unknown, repMax: unknown): boolean {
  const whole = (n: unknown): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= PROGRESSION.minReps && n <= PROGRESSION.maxReps;
  return whole(repMin) && whole(repMax) && repMin <= repMax;
}

/**
 * What is wrong with a half-typed range, in words for the routine editor, or null when it is fine.
 * Leaving both ends empty is fine: the exercise just has no range.
 */
export function repRangeProblem(repMin: number | null | undefined, repMax: number | null | undefined): string | null {
  if (repMin == null && repMax == null) return null;
  if (repMin == null || repMax == null) return "Set both a minimum and a maximum, or clear both.";
  if (!validRepRange(repMin, repMax) && (repMin > repMax)) return "The minimum can't be higher than the maximum.";
  if (!validRepRange(repMin, repMax)) return `Use whole numbers from ${PROGRESSION.minReps} to ${PROGRESSION.maxReps}.`;
  return null;
}

/**
 * The exercise with its range, step set or cleared. A cleared value is removed from the object,
 * not set to undefined, which Firestore refuses to save. Clearing the range also clears the step.
 */
export function withRepRange<T extends { repMin?: number; repMax?: number; stepKg?: number }>(
  exercise: T,
  patch: { repMin?: number | null; repMax?: number | null; stepKg?: number | null },
): T {
  const next: T = { ...exercise };
  for (const key of ["repMin", "repMax", "stepKg"] as const) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value == null) delete next[key];
    else next[key] = value as T[typeof key];
  }
  if (next.repMin == null && next.repMax == null) delete next.stepKg;
  return next;
}

/** The range an exercise carries, or null when it has none (or a broken one). */
export function rangeOf(e: { repMin?: number; repMax?: number } | null | undefined): RepRange | null {
  if (!e || !validRepRange(e.repMin, e.repMax)) return null;
  return { repMin: e.repMin!, repMax: e.repMax! };
}

/** The weight step in kg: the exercise's own, else the default for the unit (5 lb is about 2.27 kg). */
export function stepKgFor(unit: Unit, stepKg?: number | null): number {
  return stepKg != null && stepKg > 0 ? stepKg : toKg(unit, PROGRESSION.defaultStep[unit]);
}

/**
 * The sets progression looks at: real sets with reps, without warm-ups or drop sets (a drop set
 * is lighter on purpose, so it would drag the comparison down).
 */
export function progressionSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => isWorkingSet(s) && s.type !== "drop");
}

/**
 * Where the last session stands against the range. Below the minimum wins over everything: it
 * is a neutral hint to go lighter, never a failure.
 */
export function progressionStatus(range: RepRange | null, sets: LoggedSet[]): ProgressionStatus {
  if (!range) return "no-range";
  const working = progressionSets(sets);
  if (working.length === 0) return "no-sets";
  if (working.some((s) => s.reps < range.repMin)) return "below-range";
  if (working.every((s) => s.reps >= range.repMax)) return "add-weight";
  return "in-range";
}

const load = (s: LoggedSet) => s.weightKg ?? 0;
const same = (a: number, b: number) => Math.abs(a - b) < PROGRESSION.sameWeightKg;

export type ProgressHow = "weight" | "reps";

/**
 * Whether this session beat the last one (section 9.2): the same weight for more reps, or more
 * weight (at least `stepKg` heavier) with every working set at or above the range's minimum reps.
 * With no weight logged (bodyweight) only more reps counts, and added weight counts as more weight.
 * `repMin` is the range's minimum, 1 when the exercise has no range.
 */
export function didProgress({
  previous,
  current,
  stepKg,
  repMin = PROGRESSION.minReps,
}: {
  previous: LoggedSet[];
  current: LoggedSet[];
  stepKg: number;
  repMin?: number;
}): { progressed: boolean; how: ProgressHow | null } {
  const before = progressionSets(previous);
  const now = progressionSets(current);
  const none = { progressed: false, how: null };
  if (before.length === 0 || now.length === 0) return none;

  const topBefore = Math.max(...before.map(load));
  const topNow = Math.max(...now.map(load));

  if (topNow - topBefore >= stepKg - PROGRESSION.sameWeightKg && now.every((s) => s.reps >= repMin)) {
    return { progressed: true, how: "weight" };
  }
  if (same(topNow, topBefore)) {
    const reps = (sets: LoggedSet[], top: number) => sets.filter((s) => same(load(s), top)).reduce((n, s) => n + s.reps, 0);
    if (reps(now, topNow) > reps(before, topBefore)) return { progressed: true, how: "reps" };
  }
  return none;
}

/**
 * The weight to try next, in kg: one step heavier, or one step lighter. Rounded in the display unit
 * so a 5 lb step doesn't leave 61.2349 kg. Null when there is nothing sensible to suggest: going
 * lighter from bodyweight, or lighter than nothing.
 */
export function nextWeightKg({
  lastWeightKg,
  stepKg,
  unit,
  direction,
}: {
  lastWeightKg: number | null;
  stepKg: number;
  unit: Unit;
  direction: "heavier" | "lighter";
}): number | null {
  const last = kgTo(unit, lastWeightKg ?? 0);
  const step = kgTo(unit, stepKg);
  const target = direction === "heavier" ? last + step : last - step;
  if (target <= 0) return null;
  const grid = PROGRESSION.suggestionRounding;
  return toKg(unit, Math.round(target / grid) * grid);
}
