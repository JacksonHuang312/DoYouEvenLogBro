import { GEAR, PACING, STAT_POINTS, STATS, XP } from "./config";
import { levelForXp } from "./economy";
import { power, type StatLine } from "./score";

/*
 * The pacing model behind `npm run pacing-table` (GAME_DESIGN.md 10, stat rework): a steady
 * player training PACING.workoutsPerWeek times a week, simulated week by week with the real
 * point, power, XP and level rules, to check when each piece of content comes within reach.
 * Gear and the bonus bucket are assumptions (PACING), since drops are random.
 */

const WEEKS_PER_MONTH = 52 / 12;

export interface PacingWeek {
  week: number;
  months: number;
  stats: StatLine;
  body: number;
  gear: number;
  battle: number;
  xp: number;
  level: number;
}

/** Gear power assumed at `months`: straight lines between the PACING.gearByMonth points. */
export function assumedGear(months: number): number {
  const points = PACING.gearByMonth;
  if (months <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [m0, g0] = points[i - 1];
    const [m1, g1] = points[i];
    if (months <= m1) return g0 + ((g1 - g0) * (months - m0)) / (m1 - m0);
  }
  return points[points.length - 1][1];
}

/** Battle power from body and gear power: gear capped at its share, then the bonus bucket (section 12). */
export function battleFrom(body: number, gear: number, bonusPct: number): number {
  const cap = (GEAR.maxShare / (1 - GEAR.maxShare)) * body;
  return (body + Math.min(gear, cap)) * (1 + bonusPct);
}

/** Week-by-week progress for `weeks` weeks, levels on the XP.curve. */
export function simulatePacing(weeks: number): PacingWeek[] {
  const stats = Object.fromEntries(STATS.map((s) => [s, 0])) as StatLine;
  const perWorkout = Object.fromEntries(
    STATS.map((s) => {
      const sets = Math.min(PACING.setsPerStat[s], STAT_POINTS.maxSetsPerStat);
      const points = sets * (STAT_POINTS.perSet + PACING.progressedShare * (STAT_POINTS.progressedSet - STAT_POINTS.perSet));
      return [s, points / STAT_POINTS.perStat];
    }),
  ) as StatLine;

  let xp = 0;
  let peak = 0;
  const out: PacingWeek[] = [];
  for (let week = 1; week <= weeks; week++) {
    for (let w = 0; w < PACING.workoutsPerWeek; w++) {
      for (const s of STATS) stats[s] += perWorkout[s];
      const body = power(stats);
      xp += XP.perWorkout + Math.round(Math.max(0, body - peak) * XP.perPowerPoint);
      peak = Math.max(peak, body);
    }
    xp += PACING.questXpPerWeek;
    const months = week / WEEKS_PER_MONTH;
    const body = power(stats);
    const gear = assumedGear(months);
    out.push({
      week,
      months,
      stats: { ...stats },
      body,
      gear,
      battle: battleFrom(body, gear, PACING.bonusPct),
      xp,
      level: levelForXp(xp),
    });
  }
  return out;
}

const TYPICAL_WEEKS = 520;
let typicalRun: PacingWeek[] | null = null;

/**
 * The stats a typically geared hero has at `battle` power (GAME_DESIGN.md 10, round 3): the pacing
 * model's steady player, with its training split, assumed gear and bonuses, at the moment their
 * battle power reaches `battle` (straight lines between weeks; scaled past either end). Boss
 * minimums are shares of this, so they ask for stats a hero at the boss's power really has.
 */
export function typicalStats(battle: number): StatLine {
  const run = (typicalRun ??= simulatePacing(TYPICAL_WEEKS));
  const scaled = (w: PacingWeek, by: number) => Object.fromEntries(STATS.map((s) => [s, w.stats[s] * by])) as StatLine;
  if (battle <= run[0].battle) return scaled(run[0], Math.max(0, battle) / run[0].battle);
  const i = run.findIndex((w) => w.battle >= battle);
  if (i < 0) return scaled(run[run.length - 1], battle / run[run.length - 1].battle);
  const [a, b] = [run[i - 1], run[i]];
  const t = (battle - a.battle) / (b.battle - a.battle);
  return Object.fromEntries(STATS.map((s) => [s, a.stats[s] + t * (b.stats[s] - a.stats[s])])) as StatLine;
}
