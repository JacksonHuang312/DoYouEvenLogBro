import type { GameState } from "./claim";
import { calibrationDone } from "./calibration";
import { ACHIEVEMENTS, QUESTS, SCHEDULE, STATS, TITLES } from "./config";
import type { MusclesFacts } from "./facts";
import { fail, ok, type GameResult } from "./items";
import type { QuestsDoc } from "./quests";
import type { StatLine } from "./score";
import { slotsBetween, type ScheduleDoc } from "./schedule";
import { addDays, dayId, dayStartMs, daysBetween, recentWeekIds, weekId as weekIdOf } from "./time";

/*
 * Titles (GAME_DESIGN.md 5.1). Each is earned by an achievement computed from facts the game
 * already stores. Earning one is itself stored as a fact (titles.earned), because the facts
 * behind some achievements (recent schedule matches, decaying stats) don't last.
 */

export const TITLE_IDS = [
  "calibrated",
  "regular",
  "unbroken",
  "recordBreaker",
  "questmaster",
  "wellRounded",
  "ironHabit",
  "centurion",
] as const;
export type TitleId = (typeof TITLE_IDS)[number];

const A = ACHIEVEMENTS;

export const TITLE_INFO: Record<TitleId, { name: string; description: string }> = {
  calibrated: { name: "Calibrated", description: "Finish calibration" },
  regular: { name: "Regular", description: `${A.regular.workoutsPerWeek}+ workouts a week, ${A.regular.weeks} weeks in a row` },
  unbroken: {
    name: "Unbroken",
    description: `No skipped scheduled workout for ${A.unbroken.days} days, with ${A.unbroken.minSlots}+ scheduled`,
  },
  recordBreaker: { name: "Record Breaker", description: `A 1RM bonus on ${A.recordBreaker.stats} stats at once` },
  questmaster: { name: "Questmaster", description: "Claim every quest in one week" },
  wellRounded: { name: "Well Rounded", description: `Every stat at ${A.wellRounded.minStat} or more at once` },
  ironHabit: { name: "Iron Habit", description: `Train in ${A.ironHabit.weeks} of the last ${A.ironHabit.outOf} weeks` },
  centurion: { name: "Centurion", description: `${A.centurion.workouts} counted workouts` },
};

/** A title's bonus: a share of battle power, added to the bonus bucket. */
export const titleBonus = (id: TitleId): number => A[id].bonus;

/** game/state.titles */
export interface TitlesState {
  /** Title -> when it was earned. Never taken away. */
  earned: Partial<Record<TitleId, number>>;
  equipped: TitleId[];
  slots: number;
}

export const titlesOf = (s: Pick<GameState, "titles">): TitlesState => ({
  earned: s.titles?.earned ?? {},
  equipped: s.titles?.equipped ?? [],
  slots: s.titles?.slots ?? TITLES.defaultSlots,
});

/** The bonus from the equipped titles (only ones actually earned count). */
export function titleBonusPct(state: Pick<GameState, "titles">): number {
  const t = titlesOf(state);
  return t.equipped.filter((id) => t.earned[id] != null).reduce((sum, id) => sum + titleBonus(id), 0);
}

// ---- Achievements ----

/** What achievements are computed from. */
export interface TitleFacts {
  now: number;
  timeZone: string;
  state: Pick<GameState, "calibration" | "pauses">;
  /** Real stats at `now` (decay applied, not the calibration averages). */
  stats: StatLine;
  muscles: MusclesFacts;
  schedule: ScheduleDoc;
  /** claimedAt of every claim since regularWindowStart(now). */
  claimTimes: number[];
  /** All claims (counted workouts) ever. */
  claimCount: number;
  /** Quest weeks to look for a fully claimed one in. */
  quests: Pick<QuestsDoc, "quests">[];
}

export interface AchievementProgress {
  progress: number;
  target: number;
  met: boolean;
}

/** The earliest claim the Regular achievement looks at: the start of the week `weeks` weeks before this one. */
export function regularWindowStart(now: number, timeZone: string): number {
  const weeks = recentWeekIds(now, timeZone, A.regular.weeks + 1);
  return dayStartMs(weeks[weeks.length - 1], timeZone);
}

const measure = (progress: number, target: number, met = progress >= target): AchievementProgress => ({ progress, target, met });

/** Weeks in a row, ending this week (or last week, while this one isn't there yet), with enough workouts. */
function regularStreak(f: TitleFacts): number {
  const counts = new Map<string, number>();
  for (const t of f.claimTimes) {
    const w = weekIdOf(t, f.timeZone);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const weeks = recentWeekIds(f.now, f.timeZone, A.regular.weeks + 1);
  const enough = (w: string) => (counts.get(w) ?? 0) >= A.regular.workoutsPerWeek;
  let streak = 0;
  for (const w of enough(weeks[0]) ? weeks : weeks.slice(1)) {
    if (!enough(w)) break;
    streak++;
  }
  return streak;
}

/**
 * Days in a row, up to today, without a skipped scheduled workout, and the scheduled workouts
 * done in the window. A slot still inside its make-up window isn't a skip yet. Days before the
 * schedule existed don't count; paused days do (they have no slots).
 */
function unbrokenRun(f: TitleFacts): { days: number; done: number } {
  const today = dayId(f.now, f.timeZone);
  const from = addDays(today, -(A.unbroken.days - 1));
  const firstVersion = f.schedule.versions[0]?.from;
  if (!firstVersion || firstVersion > today) return { days: 0, done: 0 };

  let lastSkip: string | null = null;
  let done = 0;
  for (const slot of slotsBetween(f.schedule, f.state, from, today)) {
    if (f.schedule.matched[slot.day]) done++;
    else if (daysBetween(slot.day, today) > SCHEDULE.matchDays + SCHEDULE.syncGraceDays) lastSkip = slot.day;
  }
  const cleanFrom = [from, firstVersion, lastSkip ? addDays(lastSkip, 1) : from].reduce((a, b) => (a > b ? a : b));
  return { days: Math.max(0, daysBetween(cleanFrom, today) + 1), done };
}

export function achievementProgress(f: TitleFacts): Record<TitleId, AchievementProgress> {
  const unbroken = unbrokenRun(f);
  const trained = new Set(Object.values(f.muscles).flatMap((m) => m?.weeks ?? []));
  const questWeeks = f.quests.filter((d) => d.quests.length === QUESTS.rewards.length);
  const mostClaimed = Math.max(0, ...questWeeks.map((d) => d.quests.filter((q) => q.claimedAt != null).length));
  return {
    calibrated: measure(calibrationDone(f.state.calibration, f.now) ? 1 : 0, 1),
    regular: measure(regularStreak(f), A.regular.weeks),
    unbroken: measure(unbroken.days, A.unbroken.days, unbroken.days >= A.unbroken.days && unbroken.done >= A.unbroken.minSlots),
    recordBreaker: measure(STATS.filter((s) => f.stats[s].bonus > 0).length, A.recordBreaker.stats),
    questmaster: measure(mostClaimed, QUESTS.rewards.length),
    wellRounded: measure(STATS.filter((s) => f.stats[s].value >= A.wellRounded.minStat).length, STATS.length),
    ironHabit: measure(
      recentWeekIds(f.now, f.timeZone, A.ironHabit.outOf).filter((w) => trained.has(w)).length,
      A.ironHabit.weeks,
    ),
    centurion: measure(f.claimCount, A.centurion.workouts),
  };
}

/**
 * Records every newly met achievement's title as earned at `now`. A new title fills an empty
 * slot by itself, so the first one counts without a trip to the Titles tab.
 */
export function withEarnedTitles(
  state: GameState,
  progress: Record<TitleId, AchievementProgress>,
  now: number,
): { state: GameState; earned: TitleId[] } {
  const t = titlesOf(state);
  const earned = TITLE_IDS.filter((id) => progress[id].met && t.earned[id] == null);
  if (earned.length === 0) return { state, earned };
  const equipped = [...t.equipped];
  for (const id of earned) if (equipped.length < t.slots) equipped.push(id);
  const earnedAt = { ...t.earned, ...Object.fromEntries(earned.map((id) => [id, now])) };
  return { state: { ...state, titles: { ...t, earned: earnedAt, equipped }, updatedAt: now }, earned };
}

// ---- Slots ----

/** Equips exactly `ids` (in order). Each must be earned, none twice, no more than the slots. */
export function equipTitles(state: GameState, ids: TitleId[], now: number): GameResult<GameState> {
  const t = titlesOf(state);
  if (new Set(ids).size !== ids.length) return fail("A title can only be equipped once");
  if (ids.length > t.slots) return fail(`You have ${t.slots} title ${t.slots === 1 ? "slot" : "slots"}`);
  if (ids.some((id) => t.earned[id] == null)) return fail("You haven't earned that title yet");
  return ok({ ...state, titles: { ...t, equipped: ids }, updatedAt: now });
}

/** Coins for the next title slot, or null at the maximum. */
export function slotCost(state: Pick<GameState, "titles">): number | null {
  const slots = titlesOf(state).slots;
  return slots >= TITLES.maxSlots ? null : (TITLES.slotCosts[slots - TITLES.defaultSlots] ?? null);
}

/** Buys one more title slot. `expectedSlots` keeps a retry from buying two. */
export function buyTitleSlot(state: GameState, expectedSlots: number, now: number): GameResult<{ state: GameState; cost: number }> {
  const t = titlesOf(state);
  if (t.slots !== expectedSlots) return fail("Your title slots changed. Reload and try again");
  const cost = slotCost(state);
  if (cost == null) return fail(`${TITLES.maxSlots} title slots is the most`);
  if (state.coins < cost) return fail("Not enough coins", 402);
  return ok({ state: { ...state, coins: state.coins - cost, titles: { ...t, slots: t.slots + 1 }, updatedAt: now }, cost });
}
