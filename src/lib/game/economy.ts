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

/** XP for power gained above the previous peak, so regaining decayed stats pays nothing twice. */
export function statXp(powerAfter: number, peakPower: number): number {
  return Math.round(Math.max(0, powerAfter - peakPower) * XP.perPowerPoint);
}

/** Levels start at 1 and are flat: every XP.perLevel XP is one level. */
export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / XP.perLevel);
}

/** Progress through the current level, for the level bar. */
export function levelProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelForXp(xp);
  return { level, into: Math.max(0, xp) - (level - 1) * XP.perLevel, needed: XP.perLevel };
}
