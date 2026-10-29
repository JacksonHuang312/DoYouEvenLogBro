import { POWER_MULTIPLIERS, RUST, STAT_MUSCLES, STAT_POINTS, STATS, SUB_MUSCLES, type Stat, type SubMuscle } from "./config";
import type { MuscleFacts, MusclesFacts } from "./facts";
import { frozenMs, statIntervals, type Freeze } from "./freeze";

/*
 * Stats come from training effort (the stat rework, GAME_DESIGN.md section 10): every counted
 * working set earns points for its stat, and a stat is its points ÷ STAT_POINTS.perStat. Stats
 * never go down; rust only weakens a stat in fights while it goes untrained.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A sub-muscle's points: each counted set, progressed sets worth a little more. */
export function musclePoints(facts: MuscleFacts | undefined): number {
  if (!facts) return 0;
  const sets = facts.sets ?? 0;
  const progressed = facts.progressed ?? 0;
  return (sets - progressed) * STAT_POINTS.perSet + progressed * STAT_POINTS.progressedSet;
}

export type SubMuscleScores = Record<SubMuscle, number>;

/** Each sub-muscle's share of its stat: its points ÷ STAT_POINTS.perStat. */
export function subMuscleScores(muscles: MusclesFacts): SubMuscleScores {
  return Object.fromEntries(SUB_MUSCLES.map((m) => [m, musclePoints(muscles[m]) / STAT_POINTS.perStat])) as SubMuscleScores;
}

/** The six stats. No cap. */
export type StatLine = Record<Stat, number>;

const musclesOf = (stat: Stat) => Object.keys(STAT_MUSCLES[stat]) as SubMuscle[];

/** A stat is the sum of its sub-muscles' scores. */
export function statScore(stat: Stat, scores: SubMuscleScores): number {
  return musclesOf(stat).reduce((sum, m) => sum + scores[m], 0);
}

export function computeStats(muscles: MusclesFacts): StatLine {
  const scores = subMuscleScores(muscles);
  return Object.fromEntries(STATS.map((s) => [s, statScore(s, scores)])) as StatLine;
}

/** Body power = Σ(stat × multiplier). Gear and titles count only in battle power. */
export function power(stats: StatLine): number {
  return STATS.reduce((sum, s) => sum + stats[s] * POWER_MULTIPLIERS[s], 0);
}

/** When any of the stat's sub-muscles was last trained, or null. */
export function statLastTrained(muscles: MusclesFacts, stat: Stat): number | null {
  const times = musclesOf(stat).flatMap((m) => (muscles[m]?.lastTrained != null ? [muscles[m]!.lastTrained!] : []));
  return times.length ? Math.max(...times) : null;
}

/**
 * Rust as a share of the stat (0.05 = fights at 95%): nothing for RUST.graceDays untrained days,
 * then RUST.perDay for each day from then on, at most RUST.max. Frozen time (pauses, and injury
 * flags on this stat) doesn't count. A stat never trained has nothing to rust.
 */
export function rustOf(lastTrained: number | null, now: number, frozen = 0): number {
  if (lastTrained == null) return 0;
  const days = Math.floor(Math.max(0, now - lastTrained - frozen) / DAY_MS);
  if (days < RUST.graceDays) return 0;
  return Math.min(RUST.max, (days - RUST.graceDays + 1) * RUST.perDay);
}

/** Rust on every stat at `now`. */
export function statRust(muscles: MusclesFacts, now: number, freeze: Freeze): StatLine {
  return Object.fromEntries(
    STATS.map((s) => {
      const last = statLastTrained(muscles, s);
      const frozen = last == null ? 0 : frozenMs(statIntervals(freeze, s), last, now);
      return [s, rustOf(last, now, frozen)];
    }),
  ) as StatLine;
}

/** The stats as they fight: each reduced by its rust. */
export function rustedStats(stats: StatLine, rust: StatLine): StatLine {
  return Object.fromEntries(STATS.map((s) => [s, stats[s] * (1 - rust[s])])) as StatLine;
}
