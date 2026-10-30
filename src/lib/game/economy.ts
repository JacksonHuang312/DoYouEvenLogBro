import { COINS, XP } from "./config";

/**
 * The scheduled-workout bonus for doing it `daysOff` days away from its scheduled day: full on
 * the day, minus offDayPenaltyPerDay per day, 0 beyond offDayMaxDays. Null = not a scheduled workout.
 */
export function scheduledBonus(daysOff: number | null): number {
  if (daysOff == null) return 0;
  const days = Math.abs(daysOff);
  if (days > COINS.offDayMaxDays) return 0;
  return Math.round(COINS.scheduledBonus * Math.max(0, 1 - days * COINS.offDayPenaltyPerDay));
}

export interface CoinPayout {
  base: number;
  scheduledBonus: number;
  /** Coins the daily cap held back. */
  capped: number;
  /** What's actually paid: base + bonus − capped. */
  total: number;
}

/** Coins for one claim, after `earnedToday` coins were already paid on the claim day. */
export function coinPayout({ daysOff, earnedToday }: { daysOff: number | null; earnedToday: number }): CoinPayout {
  const base = COINS.base;
  const bonus = scheduledBonus(daysOff);
  const total = Math.min(base + bonus, Math.max(0, COINS.dailyCap - earnedToday));
  return { base, scheduledBonus: bonus, capped: base + bonus - total, total };
}

/**
 * Workout-completion XP for a claim at `now`: XP.perWorkout, or 0 within workoutCooldownHours of
 * the last claim that paid it (`lastPaidAt`, null if none has).
 */
export function workoutXp(lastPaidAt: number | null, now: number): number {
  const cooldownMs = XP.workoutCooldownHours * 60 * 60 * 1000;
  return lastPaidAt != null && now - lastPaidAt < cooldownMs ? 0 : XP.perWorkout;
}

/** XP for power gained above the previous peak, so regaining decayed stats pays nothing twice. */
export function statXp(powerAfter: number, peakPower: number): number {
  return Math.round(Math.max(0, powerAfter - peakPower) * XP.perPowerPoint);
}

/** Total XP needed to reach `level` (level 1 needs none), on the XP.curve. */
export const xpToReach = (level: number): number => Math.round(XP.curve.base * Math.max(0, level - 1) ** XP.curve.exponent);

/** The level for a total XP: 1 to XP.maxLevel. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < XP.maxLevel && xpToReach(level + 1) <= xp) level++;
  return level;
}

/**
 * Progress through the current level, for the level bar. Past XP.maxLevel the bar keeps filling in
 * steps the size of the last level, so a workout always moves it.
 */
export function levelProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelForXp(xp);
  const total = Math.max(0, xp);
  if (level >= XP.maxLevel) {
    const step = xpToReach(XP.maxLevel) - xpToReach(XP.maxLevel - 1);
    return { level, into: (total - xpToReach(XP.maxLevel)) % step, needed: step };
  }
  return { level, into: total - xpToReach(level), needed: xpToReach(level + 1) - xpToReach(level) };
}
