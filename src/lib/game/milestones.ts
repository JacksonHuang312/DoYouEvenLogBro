import { bossTowerPower, campaignPower, CAMPAIGN_STAGES } from "./bosses";
import { BOSS_TOWER, EQUIP_LEVEL, PACING, WEEKLY_BOSS, XP } from "./config";
import type { PacingWeek } from "./pacing";

/* When each piece of content comes within reach in the pacing model (`npm run pacing-table`). */

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
    { name: `Level ${EQUIP_LEVEL.mythic} (Mythics)`, target: null, months: first((w) => w.level >= EQUIP_LEVEL.mythic) },
    { name: `Level ${XP.maxLevel}`, target: PACING.targets.level100, months: first((w) => w.level >= XP.maxLevel) },
  ];
}

