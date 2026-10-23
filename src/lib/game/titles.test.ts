import { describe, expect, test } from "vitest";
import { newGameState, type GameState } from "./claim";
import { ACHIEVEMENTS, STATS } from "./config";
import type { QuestsDoc } from "./quests";
import type { StatLine } from "./score";
import type { ScheduleDoc } from "./schedule";
import { DAY, T0 } from "./test-helpers";
import { addDays, dayId, daysBetween, recentWeekIds } from "./time";
import {
  achievementProgress,
  buyTitleSlot,
  equipTitles,
  regularWindowStart,
  slotCost,
  titleBonusPct,
  withEarnedTitles,
  type TitleFacts,
} from "./titles";

const UTC = "UTC";
const TODAY = dayId(T0, UTC); // Wednesday 2026-10-14

const statLine = (value: number, bonus = 0, overrides: Partial<StatLine> = {}): StatLine =>
  ({ ...Object.fromEntries(STATS.map((s) => [s, { value, bonus }])), ...overrides }) as StatLine;

const facts = (patch: Partial<TitleFacts> = {}): TitleFacts => ({
  now: T0,
  timeZone: UTC,
  state: newGameState(T0, UTC),
  stats: statLine(30),
  muscles: {},
  schedule: { versions: [], matched: {}, updatedAt: T0 },
  claimTimes: [],
  claimCount: 0,
  quests: [],
  ...patch,
});

describe("achievements", () => {
  test("Calibrated: once calibration is done", () => {
    expect(achievementProgress(facts()).calibrated.met).toBe(false);
    const state = { ...newGameState(T0, UTC), calibration: { startedAt: T0 - 20 * DAY, workouts: 3, done: true } };
    expect(achievementProgress(facts({ state })).calibrated.met).toBe(true);
  });

  test("Regular: 3+ workouts in each of 4 weeks in a row; an unfinished current week doesn't break it", () => {
    const weeksAgo = (n: number) => [0, 1, 2].map((i) => T0 - n * 7 * DAY - i * 60_000);
    const fourWeeks = [1, 2, 3, 4].flatMap(weeksAgo);
    expect(achievementProgress(facts({ claimTimes: fourWeeks })).regular).toMatchObject({ progress: 4, met: true });
    expect(achievementProgress(facts({ claimTimes: [...weeksAgo(0), ...weeksAgo(1), ...weeksAgo(2)] })).regular).toMatchObject({ progress: 3, met: false });
    // A gap ends the run.
    expect(achievementProgress(facts({ claimTimes: [1, 3, 4].flatMap(weeksAgo) })).regular.progress).toBe(1);
    expect(regularWindowStart(T0, UTC)).toBeLessThanOrEqual(T0 - 4 * 7 * DAY);
  });

  describe("Unbroken", () => {
    // Mon/Wed/Fri since September: 12 slots in the 28 days up to today.
    const versions = [{ from: "2026-09-01", days: { "1": "a", "3": "b", "5": "c" } }];
    const slots: string[] = [];
    for (let d = addDays(TODAY, -27); d <= TODAY; d = addDays(d, 1)) {
      if ([1, 3, 5].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) slots.push(d);
    }
    const matched = (days: string[]) =>
      Object.fromEntries(days.map((day) => [day, { workoutId: day, workoutDay: day, daysOff: 0, claimedAt: T0 }]));
    const schedule = (days: string[]): ScheduleDoc => ({ versions, matched: matched(days), updatedAt: T0 });

    test("every scheduled workout done for 28 days", () => {
      expect(slots.length).toBe(12);
      expect(achievementProgress(facts({ schedule: schedule(slots) })).unbroken).toMatchObject({ progress: 28, met: true });
    });

    test("a slot still inside its make-up window isn't a skip yet", () => {
      // Today (Wed) and Monday are unmatched, but can still be made up.
      const done = slots.filter((d) => d < addDays(TODAY, -2));
      expect(achievementProgress(facts({ schedule: schedule(done) })).unbroken.met).toBe(true);
    });

    test("a skip restarts the count from the day after it", () => {
      const skipped = slots[5];
      const p = achievementProgress(facts({ schedule: schedule(slots.filter((d) => d !== skipped)) })).unbroken;
      expect(p.met).toBe(false);
      expect(p.progress).toBe(daysBetween(skipped, TODAY));
    });

    test("needs enough scheduled workouts in the window, and days before the schedule existed don't count", () => {
      const late: ScheduleDoc = { versions: [{ from: addDays(TODAY, -9), days: { "1": "a", "3": "b", "5": "c" } }], matched: matched(slots), updatedAt: T0 };
      expect(achievementProgress(facts({ schedule: late })).unbroken).toMatchObject({ progress: 10, met: false });
      const sparse: ScheduleDoc = { versions: [{ from: "2026-09-01", days: { "3": "b" } }], matched: matched(slots), updatedAt: T0 };
      expect(achievementProgress(facts({ schedule: sparse })).unbroken).toMatchObject({ progress: 28, met: false });
    });

    test("no schedule, no progress", () => {
      expect(achievementProgress(facts()).unbroken).toMatchObject({ progress: 0, met: false });
    });
  });

  test("Record Breaker: a 1RM bonus on 3 stats at once", () => {
    const two = statLine(50, 0, { chest: { value: 50, bonus: 1 }, back: { value: 50, bonus: 2 } });
    expect(achievementProgress(facts({ stats: two })).recordBreaker).toMatchObject({ progress: 2, met: false });
    expect(achievementProgress(facts({ stats: { ...two, arms: { value: 40, bonus: 0.4 } } })).recordBreaker.met).toBe(true);
  });

  test("Questmaster: every quest of one week claimed", () => {
    const week = (claimed: number): Pick<QuestsDoc, "quests"> => ({
      quests: [0, 1, 2].map((i) => ({ claimedAt: i < claimed ? T0 : null }) as QuestsDoc["quests"][number]),
    });
    expect(achievementProgress(facts({ quests: [week(2), week(1)] })).questmaster).toMatchObject({ progress: 2, met: false });
    expect(achievementProgress(facts({ quests: [week(2), week(3)] })).questmaster.met).toBe(true);
  });

  test("Well Rounded: every stat at 50+", () => {
    expect(achievementProgress(facts({ stats: statLine(50, 0, { core: { value: 49.9, bonus: 0 } }) })).wellRounded).toMatchObject({ progress: 5, met: false });
    expect(achievementProgress(facts({ stats: statLine(ACHIEVEMENTS.wellRounded.minStat) })).wellRounded.met).toBe(true);
  });

  test("Iron Habit: trained in 12 of the last 16 weeks (any muscle)", () => {
    const weeks = recentWeekIds(T0, UTC, 16);
    const fact = (w: string[]) => ({ repEst1RMKg: 100, maxLoadKg: 100, lastTrained: T0, weeks: w });
    const eleven = { chest: fact(weeks.slice(0, 6)), lats: fact(weeks.slice(5, 11)) };
    expect(achievementProgress(facts({ muscles: eleven })).ironHabit).toMatchObject({ progress: 11, met: false });
    expect(achievementProgress(facts({ muscles: { ...eleven, quadriceps: fact([weeks[15]]) } })).ironHabit.met).toBe(true);
  });

  test("Centurion: 100 counted workouts", () => {
    expect(achievementProgress(facts({ claimCount: 99 })).centurion.met).toBe(false);
    expect(achievementProgress(facts({ claimCount: 100 })).centurion.met).toBe(true);
  });
});

describe("withEarnedTitles", () => {
  const met = (ids: string[]) =>
    Object.fromEntries(
      ["calibrated", "regular", "unbroken", "recordBreaker", "questmaster", "wellRounded", "ironHabit", "centurion"].map((id) => [
        id,
        { progress: 0, target: 1, met: ids.includes(id) },
      ]),
    ) as ReturnType<typeof achievementProgress>;

  test("records new titles once, and fills empty slots with them", () => {
    const first = withEarnedTitles(newGameState(T0, UTC), met(["calibrated", "centurion"]), T0 + 1);
    expect(first.earned).toEqual(["calibrated", "centurion"]);
    expect(first.state.titles).toEqual({ earned: { calibrated: T0 + 1, centurion: T0 + 1 }, equipped: ["calibrated"], slots: 1 });
    const again = withEarnedTitles(first.state, met(["calibrated", "centurion"]), T0 + 2);
    expect(again.earned).toEqual([]);
    expect(again.state).toBe(first.state);
  });

  test("a title stays earned when its achievement no longer holds", () => {
    const first = withEarnedTitles(newGameState(T0, UTC), met(["wellRounded"]), T0);
    expect(withEarnedTitles(first.state, met([]), T0 + DAY).state.titles?.earned.wellRounded).toBe(T0);
  });
});

describe("title slots and bonuses", () => {
  const earnedAll = (patch: Partial<GameState> = {}): GameState => ({
    ...newGameState(T0, UTC),
    coins: 5000,
    titles: { earned: { calibrated: T0, unbroken: T0, wellRounded: T0, regular: T0 }, equipped: [], slots: 3 },
    ...patch,
  });

  test("equips earned titles up to the slots, each once", () => {
    expect(equipTitles(earnedAll(), ["unbroken", "wellRounded"], T0)).toMatchObject({ ok: true, value: { titles: { equipped: ["unbroken", "wellRounded"] } } });
    expect(equipTitles(earnedAll(), ["unbroken", "unbroken"], T0)).toMatchObject({ ok: false });
    expect(equipTitles(earnedAll(), ["centurion"], T0)).toMatchObject({ ok: false, error: "You haven't earned that title yet" });
    expect(equipTitles(earnedAll(), ["calibrated", "unbroken", "wellRounded", "regular"], T0)).toMatchObject({ ok: false });
  });

  test("the bonus is the sum of the equipped titles", () => {
    const state = earnedAll({ titles: { earned: { unbroken: T0, wellRounded: T0 }, equipped: ["unbroken", "wellRounded"], slots: 2 } });
    expect(titleBonusPct(state)).toBeCloseTo(0.09);
    expect(titleBonusPct(newGameState(T0, UTC))).toBe(0);
  });

  test("slots: 1 to start, then 500 and 1,500 coins, 3 at most", () => {
    const one = newGameState(T0, UTC);
    expect(slotCost(one)).toBe(500);
    const two = buyTitleSlot({ ...one, coins: 2000 }, 1, T0);
    expect(two).toMatchObject({ ok: true, value: { cost: 500, state: { coins: 1500, titles: { slots: 2 } } } });
    const three = two.ok ? buyTitleSlot(two.value.state, 2, T0) : null;
    expect(three).toMatchObject({ ok: true, value: { cost: 1500, state: { coins: 0, titles: { slots: 3 } } } });
    expect(three?.ok && buyTitleSlot(three.value.state, 3, T0)).toMatchObject({ ok: false });
  });

  test("a retry with the old slot count can't buy twice; short on coins is a 402", () => {
    expect(buyTitleSlot({ ...newGameState(T0, UTC), coins: 9999, titles: { earned: {}, equipped: [], slots: 2 } }, 1, T0)).toMatchObject({ ok: false, status: 409 });
    expect(buyTitleSlot({ ...newGameState(T0, UTC), coins: 499 }, 1, T0)).toMatchObject({ ok: false, status: 402 });
  });
});
