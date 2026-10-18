import {
  AGE_FACTOR,
  DECAY,
  DEFAULT_BODYWEIGHT_KG,
  FREQUENCY_WEEKS,
  ONE_RM_BONUS_CAP,
  POWER_MULTIPLIERS,
  STANDARD_SEX_FACTOR,
  STAT_MUSCLES,
  STATS,
  STRENGTH_SHARE,
  STRENGTH_STANDARDS,
  SUB_MUSCLES,
  type Sex,
  type Stat,
  type SubMuscle,
} from "./config";
import type { MuscleFacts, MusclesFacts } from "./facts";
import { recentWeekIds } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The user's inputs that strength is normalized against. Missing ones use defaults. */
export interface BodyProfile {
  bodyweightKg: number | null;
  age: number | null;
  sex: Sex | null;
}

/** How the strength standards scale for this person's age. */
export function ageFactor(age: number | null): number {
  if (age == null) return 1;
  if (age < AGE_FACTOR.youthAge) return AGE_FACTOR.youth;
  if (age <= AGE_FACTOR.peakAgeEnd) return 1;
  return Math.max(AGE_FACTOR.min, 1 - (age - AGE_FACTOR.peakAgeEnd) * AGE_FACTOR.perYearAfterPeak);
}

/**
 * Strength: estimated 1RM relative to bodyweight, against the standard for sex and age. The
 * standard scores 100; stronger lifts keep scaling past it (stats have no cap).
 */
export function strengthScore(muscle: SubMuscle, est1RMKg: number | null, profile: BodyProfile): number {
  if (est1RMKg == null || est1RMKg <= 0) return 0;
  const bodyweight = profile.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  const standard = STRENGTH_STANDARDS[muscle] * STANDARD_SEX_FACTOR[profile.sex ?? "unknown"] * ageFactor(profile.age);
  return Math.max(0, (100 * est1RMKg) / bodyweight / standard);
}

/** Frequency 0–100: the share of the last FREQUENCY_WEEKS weeks (this one included) it was trained. */
export function frequencyScore(weeks: string[], now: number, timeZone: string): number {
  const recent = recentWeekIds(now, timeZone, FREQUENCY_WEEKS);
  return (100 * recent.filter((w) => weeks.includes(w)).length) / FREQUENCY_WEEKS;
}

/** Multiplier on the strength part: 1 within the grace period, then compounding down to the floor. */
export function decayFactor(lastTrained: number | null, now: number): number {
  if (lastTrained == null) return 1;
  const days = (now - lastTrained) / DAY_MS;
  if (days <= DECAY.graceDays) return 1;
  return Math.max(DECAY.floor, (1 - DECAY.perDay) ** (days - DECAY.graceDays));
}

/** The calculated 1RM: the rep-based estimate, or the heaviest single for someone who only does singles. */
export function calculated1RM(facts: MuscleFacts): number | null {
  return facts.repEst1RMKg ?? facts.maxLoadKg;
}

/** Sub-muscle score: decayed strength blended with frequency (0–100). Untrained is 0; no upper cap. */
export function subMuscleScore(
  muscle: SubMuscle,
  facts: MuscleFacts | undefined,
  profile: BodyProfile,
  now: number,
  timeZone: string,
): number {
  if (!facts) return 0;
  const strength = strengthScore(muscle, calculated1RM(facts), profile) * decayFactor(facts.lastTrained, now);
  return STRENGTH_SHARE * strength + (1 - STRENGTH_SHARE) * frequencyScore(facts.weeks, now, timeZone);
}

/** How far an actual lift beat the calculated 1RM (0.04 = 4% heavier), or 0. */
export function oneRMBonusRatio(facts: MuscleFacts | undefined): number {
  if (!facts?.repEst1RMKg || facts.maxLoadKg == null) return 0;
  return Math.max(0, facts.maxLoadKg / facts.repEst1RMKg - 1);
}

export type SubMuscleScores = Record<SubMuscle, number>;

export function subMuscleScores(muscles: MusclesFacts, profile: BodyProfile, now: number, timeZone: string): SubMuscleScores {
  return Object.fromEntries(
    SUB_MUSCLES.map((m) => [m, subMuscleScore(m, muscles[m], profile, now, timeZone)]),
  ) as SubMuscleScores;
}

const weightsOf = (stat: Stat) => Object.entries(STAT_MUSCLES[stat]) as [SubMuscle, number][];

/** A stat is the weighted average of its sub-muscle scores. */
export function statScore(stat: Stat, scores: SubMuscleScores): number {
  return weightsOf(stat).reduce((sum, [m, w]) => sum + w * scores[m], 0);
}

/**
 * The 1RM bonus on a stat: each sub-muscle's score × how far its actual lift beat its calculated
 * 1RM, weighted like the stat, and capped at ONE_RM_BONUS_CAP of the stat.
 */
export function statBonus(stat: Stat, scores: SubMuscleScores, muscles: MusclesFacts): number {
  const raw = weightsOf(stat).reduce((sum, [m, w]) => sum + w * scores[m] * oneRMBonusRatio(muscles[m]), 0);
  return Math.min(raw, ONE_RM_BONUS_CAP * statScore(stat, scores));
}

export type StatLine = Record<Stat, { value: number; bonus: number }>;

export function computeStats(muscles: MusclesFacts, profile: BodyProfile, now: number, timeZone: string): StatLine {
  const scores = subMuscleScores(muscles, profile, now, timeZone);
  return Object.fromEntries(
    STATS.map((s) => [s, { value: statScore(s, scores), bonus: statBonus(s, scores, muscles) }]),
  ) as StatLine;
}

/** Power = Σ((stat + bonus) × multiplier). Gear and title bonuses come in later phases. */
export function power(stats: StatLine): number {
  return STATS.reduce((sum, s) => sum + (stats[s].value + stats[s].bonus) * POWER_MULTIPLIERS[s], 0);
}
