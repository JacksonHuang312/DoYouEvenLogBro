import { describe, expect, test } from "vitest";
import { averageStats } from "./calibration";
import {
  applyClaim,
  backfillHistory,
  newGameState,
  profileOf,
  recomputedPeak,
  replayMuscles,
  roundStats,
  type ClaimableWorkout,
  type GameState,
} from "./claim";
import { CALIBRATION, COINS, MAX_FUTURE_MS, XP } from "./config";
import type { MusclesFacts } from "./facts";
import { benchDay, CRUNCH, DAY, lookup, set, SQUAT, T0, workout } from "./test-helpers";

const UTC = "UTC";
const noProfile = { bodyweightKg: null, age: null, sex: null };

/** Claims workouts in order (each at its own end time unless `at` is given), returning the last outcome. */
function claimAll(workouts: ClaimableWorkout[], { at, state = newGameState(T0, UTC) }: { at?: number; state?: GameState } = {}) {
  let muscles: MusclesFacts = {};
  const results = [];
  for (const w of workouts) {
    const outcome = applyClaim({ state, muscles, workout: w, lookup, now: at ?? w.endedAt, timeZone: UTC });
    if (!outcome.counted) throw new Error(`not counted: ${outcome.reason}`);
    ({ state, muscles } = outcome);
    results.push(outcome.result);
  }
  return { state, muscles, results };
}

/** A user who finished calibration with six bench days at 80 kg. */
function calibrated() {
  return claimAll(Array.from({ length: CALIBRATION.workouts }, (_, i) => benchDay(T0 + i * DAY)));
}

describe("game state helpers", () => {
  test("a new state starts at level 1 with nothing earned", () => {
    expect(newGameState(T0, UTC)).toMatchObject({ coins: 0, xp: 0, level: 1, peakPower: 0, timeZone: UTC, createdAt: T0 });
  });

  test("profileOf picks the body inputs", () => {
    const state = { ...newGameState(T0, UTC), bodyweightKg: 82, age: 41, sex: "female" as const };
    expect(profileOf(state)).toEqual({ bodyweightKg: 82, age: 41, sex: "female" });
  });

  test("roundStats rounds to one decimal", () => {
    const stats = { ...averageStats(), chest: { value: 61.96, bonus: 2.04 } };
    expect(roundStats(stats).chest).toEqual({ value: 62, bonus: 2 });
  });
});

describe("applyClaim", () => {
  test("a workout needs 4 working sets", () => {
    const w = workout(T0, [[SQUAT, [set(60, 5, "warmup"), set(100, 5), set(100, 5), set(100, 5)]]]);
    const outcome = applyClaim({ state: newGameState(T0, UTC), muscles: {}, workout: w, lookup, now: T0, timeZone: UTC });
    expect(outcome).toEqual({ counted: false, reason: "too-few-sets", workingSets: 3 });
  });

  test("rejects workouts from the future", () => {
    const outcome = applyClaim({
      state: newGameState(T0, UTC),
      muscles: {},
      workout: benchDay(T0 + MAX_FUTURE_MS + DAY),
      lookup,
      now: T0,
      timeZone: UTC,
    });
    expect(outcome).toMatchObject({ counted: false, reason: "future" });
  });

  test("the first claim pays base coins and workout XP, and starts calibration", () => {
    const outcome = applyClaim({ state: newGameState(T0, UTC), muscles: {}, workout: benchDay(T0, 80, "w1"), lookup, now: T0, timeZone: UTC });
    if (!outcome.counted) throw new Error();
    expect(outcome.result).toMatchObject({
      workoutId: "w1",
      claimedAt: T0,
      coins: { base: COINS.base, scheduledBonus: 0, capped: 0, total: COINS.base, balance: COINS.base },
      xp: { workout: XP.perWorkout, stats: 0, total: XP.perWorkout, balance: XP.perWorkout },
      level: { before: 1, after: 1 },
      calibrating: true,
    });
    // Calibrating: averages are shown, but the real facts are stored.
    expect(outcome.result.stats.after).toEqual(averageStats());
    expect(outcome.muscles.chest?.maxLoadKg).toBe(80);
    expect(outcome.state.calibration).toEqual({ startedAt: T0, workouts: 1, done: false });
    expect(outcome.snapshot.weekId).toBe("2026-10-11");
    expect(outcome.snapshot.stats.chest.value).toBeGreaterThan(0);
  });

  test("doesn't mutate the state or muscles it's given", () => {
    const state = newGameState(T0, UTC);
    const muscles: MusclesFacts = {};
    applyClaim({ state, muscles, workout: benchDay(T0), lookup, now: T0, timeZone: UTC });
    expect(state).toEqual(newGameState(T0, UTC));
    expect(muscles).toEqual({});
  });

  test("the daily cap applies per claim day and resets the next day", () => {
    const sameDay = Array.from({ length: 4 }, (_, i) => benchDay(T0 + i * 60_000));
    const { state, results } = claimAll(sameDay, { at: T0 + DAY / 4 });
    expect(results.map((r) => r.coins.total)).toEqual([50, 50, 50, 0]);
    expect(results[3].coins.capped).toBe(COINS.base);
    expect(state.coins).toBe(COINS.dailyCap);

    const next = applyClaim({ state, muscles: {}, workout: benchDay(T0 + DAY), lookup, now: T0 + DAY, timeZone: UTC });
    expect(next.counted && next.result.coins.total).toBe(COINS.base);
  });

  test("the claim day is in the user's time zone", () => {
    // 23:30 and 00:30 UTC are the same evening in Los Angeles, so the cap carries over.
    const state = { ...newGameState(T0, UTC), coinDay: "2026-10-14", coinsToday: COINS.dailyCap };
    const at = Date.UTC(2026, 9, 15, 0, 30);
    const la = applyClaim({ state, muscles: {}, workout: benchDay(T0), lookup, now: at, timeZone: "America/Los_Angeles" });
    const utc = applyClaim({ state, muscles: {}, workout: benchDay(T0), lookup, now: at, timeZone: UTC });
    expect(la.counted && la.result.coins.total).toBe(0);
    expect(utc.counted && utc.result.coins.total).toBe(COINS.base);
  });

  test("backdated workouts are paid at claim time, under that day's cap", () => {
    const state = { ...newGameState(T0, UTC), coinDay: "2026-10-14", coinsToday: COINS.dailyCap };
    const outcome = applyClaim({ state, muscles: {}, workout: benchDay(T0 - 5 * DAY), lookup, now: T0, timeZone: UTC });
    expect(outcome.counted && outcome.result.coins.total).toBe(0);
  });

  test("a scheduled workout adds the off-day bonus", () => {
    const outcome = applyClaim({ state: newGameState(T0, UTC), muscles: {}, workout: benchDay(T0), lookup, now: T0, timeZone: UTC, daysOff: 1 });
    expect(outcome.counted && outcome.result.coins).toMatchObject({ scheduledBonus: 20, total: COINS.base + 20 });
  });

  test("payCoins: false pays XP but no coins", () => {
    const outcome = applyClaim({ state: newGameState(T0, UTC), muscles: {}, workout: benchDay(T0), lookup, now: T0, timeZone: UTC, payCoins: false });
    if (!outcome.counted) throw new Error();
    expect(outcome.result.coins.total).toBe(0);
    expect(outcome.state).toMatchObject({ coins: 0, coinDay: null, coinsToday: 0, xp: XP.perWorkout });
  });

  test("no stat XP during calibration; the last calibration workout sets the peak", () => {
    const { state, results } = calibrated();
    expect(results.every((r) => r.xp.stats === 0)).toBe(true);
    expect(results.at(-1)!.calibrating).toBe(false);
    expect(state.calibration.done).toBe(true);
    expect(state.peakPower).toBeGreaterThan(0);
    expect(state.xp).toBe(CALIBRATION.workouts * XP.perWorkout);
  });

  test("after calibration, stat gains pay XP and stats show for real", () => {
    const { state, muscles } = calibrated();
    const at = T0 + 7 * DAY;
    const outcome = applyClaim({ state, muscles, workout: benchDay(at, 100), lookup, now: at, timeZone: UTC });
    if (!outcome.counted) throw new Error();
    expect(outcome.result.xp.stats).toBeGreaterThan(0);
    expect(outcome.result.xp.total).toBe(XP.perWorkout + outcome.result.xp.stats);
    expect(outcome.result.stats.after.chest.value).toBeGreaterThan(outcome.result.stats.before.chest.value);
    expect(outcome.state.peakPower).toBeGreaterThan(state.peakPower);
  });

  test("regaining decayed stats doesn't pay stat XP again", () => {
    const { state, muscles } = calibrated();
    // Two months off, then the same 80 kg bench: power recovers but doesn't pass the old peak.
    const at = T0 + 70 * DAY;
    const outcome = applyClaim({ state, muscles, workout: benchDay(at, 80), lookup, now: at, timeZone: UTC });
    if (!outcome.counted) throw new Error();
    expect(outcome.result.xp.stats).toBe(0);
    expect(outcome.state.peakPower).toBe(state.peakPower);
  });

  test("levels up when XP crosses a level", () => {
    const state = { ...newGameState(T0, UTC), xp: XP.perLevel - 5 };
    const outcome = applyClaim({ state, muscles: {}, workout: benchDay(T0), lookup, now: T0, timeZone: UTC });
    expect(outcome.counted && outcome.result.level).toEqual({ before: 1, after: 2 });
  });
});

describe("replayMuscles", () => {
  const history = [benchDay(T0, 80), benchDay(T0 + 2 * DAY, 90), benchDay(T0 + 9 * DAY, 85)];

  test("matches the facts live claims built", () => {
    const { muscles } = claimAll(history);
    expect(replayMuscles(history, lookup, noProfile, UTC, T0 + 30 * DAY).muscles).toEqual(muscles);
  });

  test("a fixed typo or deleted workout no longer counts", () => {
    const typo = benchDay(T0 + DAY, 300); // meant 30
    const inflated = replayMuscles([...history, typo], lookup, noProfile, UTC, T0 + 30 * DAY);
    const fixed = replayMuscles([...history, benchDay(T0 + DAY, 80, typo.id)], lookup, noProfile, UTC, T0 + 30 * DAY);
    expect(inflated.muscles.chest?.maxLoadKg).toBe(300);
    expect(fixed.muscles.chest?.maxLoadKg).toBe(90);
  });

  test("writes one snapshot per week, as of that week's last workout", () => {
    const { snapshots } = replayMuscles(history, lookup, noProfile, UTC, T0 + 30 * DAY);
    expect(snapshots.map((s) => s.weekId)).toEqual(["2026-10-11", "2026-10-18"]);
    expect(snapshots[0].takenAt).toBe(history[1].endedAt);
  });

  test("skips workouts that don't count or are in the future", () => {
    const short = workout(T0, [[SQUAT, [set(300, 5)]]]);
    const future = workout(T0 + 100 * DAY, [[CRUNCH, [set(null, 20), set(null, 20), set(null, 20), set(null, 20)]]]);
    const { muscles } = replayMuscles([...history, short, future], lookup, noProfile, UTC, T0 + 30 * DAY);
    expect(muscles.quadriceps).toBeUndefined();
    expect(muscles.abdominals).toBeUndefined();
  });

  test("reports the highest power the history reached", () => {
    const { peakPower } = replayMuscles(history, lookup, noProfile, UTC, T0 + 30 * DAY);
    const { state } = claimAll(Array.from({ length: CALIBRATION.workouts }, (_, i) => benchDay(T0 + i * DAY, 90)));
    expect(peakPower).toBeGreaterThan(0);
    // Same 90 kg best, so the same peak a live user reached.
    expect(replayMuscles([benchDay(T0, 90)], lookup, noProfile, UTC, T0 + DAY).peakPower).toBeLessThanOrEqual(state.peakPower + 1e-9);
    expect(replayMuscles([], lookup, noProfile, UTC, T0).peakPower).toBe(0);
  });

  test("order of the input doesn't matter", () => {
    expect(replayMuscles([...history].reverse(), lookup, noProfile, UTC, T0 + 30 * DAY)).toEqual(
      replayMuscles(history, lookup, noProfile, UTC, T0 + 30 * DAY),
    );
  });
});

describe("recomputedPeak", () => {
  test("a fixed typo lowers the peak, so real gains pay XP again", () => {
    const { state, muscles } = calibrated();
    // A 300 kg typo (meant 30) inflates the peak...
    const typo = benchDay(T0 + 7 * DAY, 300, "typo");
    const inflated = applyClaim({ state, muscles, workout: typo, lookup, now: typo.endedAt, timeZone: UTC });
    if (!inflated.counted) throw new Error();
    expect(inflated.state.peakPower).toBeGreaterThan(state.peakPower);

    // ...the fix is recomputed...
    const history = [
      ...Array.from({ length: CALIBRATION.workouts }, (_, i) => benchDay(T0 + i * DAY)),
      benchDay(T0 + 7 * DAY, 30, "typo"),
    ];
    const replay = replayMuscles(history, lookup, noProfile, UTC, T0 + 8 * DAY);
    const peakPower = recomputedPeak(inflated.state, replay.peakPower);
    expect(peakPower).toBeLessThan(inflated.state.peakPower);

    // ...and a real PR afterwards earns stat XP again.
    const at = T0 + 9 * DAY;
    const pr = applyClaim({
      state: { ...inflated.state, peakPower },
      muscles: replay.muscles,
      workout: benchDay(at, 100),
      lookup,
      now: at,
      timeZone: UTC,
    });
    expect(pr.counted && pr.result.xp.stats).toBeGreaterThan(0);
  });

  test("never raises the peak", () => {
    const state = { ...newGameState(T0, UTC), peakPower: 50, calibration: { startedAt: T0, workouts: 6, done: true } };
    expect(recomputedPeak(state, 80)).toBe(50);
    expect(recomputedPeak(state, 30)).toBe(30);
  });

  test("leaves it alone during calibration", () => {
    expect(recomputedPeak(newGameState(T0, UTC), 30)).toBe(0);
  });
});

describe("backfillHistory", () => {
  const history = Array.from({ length: 8 }, (_, i) => benchDay(T0 + i * 2 * DAY, 80 + i * 5));
  const now = T0 + 30 * DAY;

  test("replays XP and stats, pays the welcome bonus instead of coins", () => {
    const { state, claims } = backfillHistory(history, lookup, UTC, now);
    expect(state.coins).toBe(COINS.welcomeBonus);
    expect(state.welcomeBonus).toBe(true);
    expect(claims).toHaveLength(8);
    expect(claims.every((c) => c.backfilled && c.coins.total === 0)).toBe(true);
    expect(state.xp).toBe(claims.reduce((sum, c) => sum + c.xp.total, 0));
    // Calibration ended at the 6th workout; the two heavier ones after it earned stat XP.
    expect(state.calibration.done).toBe(true);
    expect(claims[6].xp.stats).toBeGreaterThan(0);
    expect(state.level).toBe(1 + Math.floor(state.xp / XP.perLevel));
  });

  test("builds the same muscles as a recompute", () => {
    const { muscles } = backfillHistory(history, lookup, UTC, now);
    expect(muscles).toEqual(replayMuscles(history, lookup, noProfile, UTC, now).muscles);
  });

  test("skips workouts that don't count", () => {
    const { claims } = backfillHistory([...history, workout(T0, [[SQUAT, [set(100, 5)]]])], lookup, UTC, now);
    expect(claims).toHaveLength(8);
  });

  test("an account with no workouts just gets the bonus", () => {
    const { state, claims, snapshots } = backfillHistory([], lookup, UTC, now);
    expect(state).toMatchObject({ coins: COINS.welcomeBonus, xp: 0, level: 1, createdAt: now });
    expect(claims).toEqual([]);
    expect(snapshots).toEqual([]);
  });
});
