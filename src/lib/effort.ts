/*
 * RPE and RIR (GAME_DESIGN.md 10, "RPE and RIR"). A set may carry how hard it was, stored as one
 * number: RPE in half steps. Settings picks whether it shows as RPE or as reps in reserve
 * (RIR = 10 − RPE). It is for logging and insight only: stats and rewards never read it.
 */

export type EffortScale = "rpe" | "rir";

export const DEFAULT_EFFORT_SCALE: EffortScale = "rpe";

/** The RPE values the picker offers, easiest first: 5 to 10 in half steps (RIR 5 to 0). */
export const RPE_OPTIONS = Array.from({ length: 11 }, (_, i) => 5 + i / 2);

/** Whether a value can be stored as a set's RPE. */
export function isValidRpe(value: unknown): value is number {
  return typeof value === "number" && RPE_OPTIONS.includes(value);
}

const number = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** The value on the chosen scale: RPE as is, or reps in reserve. */
export const effortValue = (rpe: number, scale: EffortScale) => (scale === "rir" ? 10 - rpe : rpe);

/** Short form for a set row: "@8" (RPE) or "2 RIR". */
export function effortShort(rpe: number, scale: EffortScale): string {
  return scale === "rir" ? `${number(effortValue(rpe, scale))} RIR` : `@${number(rpe)}`;
}

/** A picker button's label: "8.5" on the RPE scale, "1.5" on the RIR scale. */
export const effortOption = (rpe: number, scale: EffortScale) => number(effortValue(rpe, scale));

/** Words for screen readers and the picker heading: "RPE 8" or "2 reps in reserve". */
export function effortLong(rpe: number, scale: EffortScale): string {
  if (scale === "rpe") return `RPE ${number(rpe)}`;
  const rir = effortValue(rpe, scale);
  return `${number(rir)} ${rir === 1 ? "rep" : "reps"} in reserve`;
}

/** The scale a profile uses (missing on profiles from before the setting). */
export const effortScaleOf = (profile: { effortScale?: EffortScale } | null | undefined): EffortScale =>
  profile?.effortScale ?? DEFAULT_EFFORT_SCALE;
