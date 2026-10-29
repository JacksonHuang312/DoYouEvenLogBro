import { campaignPower, CAMPAIGN_STAGES, bossTowerPower } from "./bosses";
import { BOSS_TOWER, GEAR, PACING, STAT_POINTS, STATS, WEEKLY_BOSS, XP } from "./config";
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

/** Week-by-week progress for `weeks` weeks at `perLevel` XP per level. */
export function simulatePacing(weeks: number, perLevel = XP.perLevel): PacingWeek[] {
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
      level: 1 + Math.floor(xp / perLevel),
    });
  }
  return out;
}

export interface Milestone {
  name: string;
  /** The design doc's target, in months (null when it has none). */
  target: number | null;
  /** When the model first reaches it, in months, or null if not within the simulated time. */
  months: number | null;
}

/** When each piece of content comes within reach (level gate and recommended power). */
export function milestones(run: PacingWeek[]): Milestone[] {
  const first = (ok: (w: PacingWeek) => boolean) => run.find(ok)?.months ?? null;
  const tiers = WEEKLY_BOSS.tierPower.map((p, i) => ({
    name: `Weekly boss tier ${i + 1}`,
    target: PACING.targets.weeklyTier[i],
    months: first((w) => w.level >= WEEKLY_BOSS.tierLevels[i] && w.battle >= p * WEEKLY_BOSS.tierPowerShare),
  }));
  return [
    ...tiers,
    { name: "Campaign finished", target: PACING.targets.campaign, months: first((w) => w.battle >= campaignPower(CAMPAIGN_STAGES)) },
    {
      name: `Boss Tower floor ${BOSS_TOWER.floors}`,
      target: PACING.targets.bossTower,
      months: first((w) => w.level >= BOSS_TOWER.minLevel && w.battle >= bossTowerPower(BOSS_TOWER.floors)),
    },
    { name: "Level 25 (Mythics)", target: null, months: first((w) => w.level >= 25) },
    { name: "Level 35", target: PACING.targets.level35, months: first((w) => w.level >= 35) },
  ];
}

/** The XP per level (rounded to 25) that puts level 35 at PACING.targets.level35 months. */
export function suggestedPerLevel(): number {
  const weeks = Math.round(PACING.targets.level35 * WEEKS_PER_MONTH);
  const xp = simulatePacing(weeks, 1).at(-1)!.xp;
  return Math.floor(xp / 34 / 25) * 25;
}
