import { describe, expect, test } from "vitest";
import {
  applyClaim,
  backfillHistory,
  newGameState,
  recomputedPeak,
  replayMuscles,
  reworkGame,
  roundStats,
  type ClaimableWorkout,
  type GameState,
} from "./claim";
import { COINS, MAX_FUTURE_MS, POWER_MULTIPLIERS, STAT_POINTS, XP } from "./config";
import type { MusclesFacts, PreviousSession } from "./facts";
import { BENCH, benchDay, CRUNCH, CURL, DAY, lookup, set, SQUAT, T0, workout } from "./test-helpers";

const UTC = "UTC";
const none: PreviousSession = () => undefined;
/** Four sets of bench (chest) give 4 points: 0.4 Chest, 0.4 body power. */
const BENCH_POWER = (4 * STAT_POINTS.perSet) / STAT_POINTS.perStat;

/** Claims workouts in order (each at its own end time unless `at` is given), with the replay's session rule. */
function claimAll(workouts: ClaimableWorkout[], { at, state = newGameState(T0, UTC) }: { at?: number; state?: GameState } = {}) {
  let muscles: MusclesFacts = {};
  const results = [];
  const last = new Map<string, ClaimableWorkout["exercises"][number]["sets"]>();
  for (const w of workouts) {
    const previous: PreviousSession = (id) => last.get(id);
    const outcome = applyClaim({ state, muscles, workout: w, lookup, previous, now: at ?? w.endedAt, timeZone: UTC });
    if (!outcome.counted) throw new Error(`not counted: ${outcome.reason}`);
    ({ state, muscles } = outcome);
    results.push(outcome.result);
    for (const e of w.exercises) last.set(e.exerciseId, e.sets);
  }
  return { state, muscles, results };
}

const claim = (w: ClaimableWorkout, extra: Partial<Parameters<typeof applyClaim>[0]> = {}) =>
  applyClaim({ state: newGameState(T0, UTC), muscles: {}, workout: w, lookup, previous: none, now: T0, timeZone: UTC, ...extra });

describe("game state helpers", () => {
  test("a new state starts at level 1 with nothing earned", () => {
    expect(newGameState(T0, UTC)).toMatchObject({ coins: 0, xp: 0, level: 1, peakPower: 0, timeZone: UTC, createdAt: T0 });
  });

  test("roundStats rounds to one decimal", () => {
    const stats = { chest: 61.96, back: 0.04, shoulders: 1, arms: 2.25, legs: 0, core: 0 };
    expect(roundStats(stats)).toEqual({ chest: 62, back: 0, shoulders: 1, arms: 2.3, legs: 0, core: 0 });
  });
});

describe("applyClaim", () => {
  test("a workout needs 4 working sets", () => {
    const w = workout(T0, [[SQUAT, [set(60, 5, "warmup"), set(100, 5), set(100, 5), set(100, 5)]]]);
    expect(claim(w)).toEqual({ counted: false, reason: "too-few-sets", workingSets: 3 });
  });

  test("rejects workouts from the future", () => {
    expect(claim(benchDay(T0 + MAX_FUTURE_MS + DAY))).toMatchObject({ counted: false, reason: "future" });
  });

  test("the first claim pays coins, workout XP and stat XP from 0", () => {
    const outcome = claim(benchDay(T0, 80, "w1"));
    if (!outcome.counted) throw new Error();
    const statXp = Math.round(BENCH_POWER * XP.perPowerPoint);
    expect(outcome.result).toMatchObject({
      workoutId: "w1",
      claimedAt: T0,
      coins: { base: COINS.base, scheduledBonus: 0, capped: 0, total: COINS.base, balance: COINS.base },
      xp: { workout: XP.perWorkout, stats: statXp, total: XP.perWorkout + statXp },
      level: { before: 1, after: 1 },
      progressed: [],
    });
    expect(outcome.result.stats.before.chest).toBe(0);
    expect(outcome.result.stats.after.chest).toBe(0.4);
    expect(outcome.muscles.chest).toMatchObject({ sets: 4, progressed: 0, lastTrained: T0 });
    expect(outcome.state.peakPower).toBeCloseTo(BENCH_POWER);
    expect(outcome.snapshot).toMatchObject({ weekId: "2026-10-11", power: 0.4 });
  });

  test("doesn't mutate the state or muscles it's given", () => {
    const state = newGameState(T0, UTC);
    const muscles: MusclesFacts = {};
    applyClaim({ state, muscles, workout: benchDay(T0), lookup, previous: none, now: T0, timeZone: UTC });
    expect(state).toEqual(newGameState(T0, UTC));
    expect(muscles).toEqual({});
  });

  test("the daily cap applies per claim day and resets the next day", () => {
    const sameDay = Array.from({ length: 4 }, (_, i) => benchDay(T0 + i * 60_000));
    const { state, results } = claimAll(sameDay, { at: T0 + DAY / 4 });
    expect(results.map((r) => r.coins.total)).toEqual([50, 50, 50, 0]);
    expect(results[3].coins.capped).toBe(COINS.base);
    expect(state.coins).toBe(COINS.dailyCap);

    const next = claim(benchDay(T0 + DAY), { state, now: T0 + DAY });
    expect(next.counted && next.result.coins.total).toBe(COINS.base);
  });

  test("the claim day is in the user's time zone", () => {
    // 23:30 and 00:30 UTC are the same evening in Los Angeles, so the cap carries over.
    const state = { ...newGameState(T0, UTC), coinDay: "2026-10-14", coinsToday: COINS.dailyCap };
    const at = Date.UTC(2026, 9, 15, 0, 30);
    const la = claim(benchDay(T0), { state, now: at, timeZone: "America/Los_Angeles" });
    const utc = claim(benchDay(T0), { state, now: at });
    expect(la.counted && la.result.coins.total).toBe(0);
    expect(utc.counted && utc.result.coins.total).toBe(COINS.base);
  });

  test("backdated workouts are paid at claim time, under that day's cap", () => {
    const state = { ...newGameState(T0, UTC), coinDay: "2026-10-14", coinsToday: COINS.dailyCap };
    const outcome = claim(benchDay(T0 - 5 * DAY), { state });
    expect(outcome.counted && outcome.result.coins.total).toBe(0);
  });

  test("a scheduled workout adds the off-day bonus", () => {
    const outcome = claim(benchDay(T0), { daysOff: 1 });
    expect(outcome.counted && outcome.result.coins).toMatchObject({ scheduledBonus: 20, total: COINS.base + 20 });
  });

  test("payCoins: false pays XP but no coins", () => {
    const outcome = claim(benchDay(T0), { payCoins: false });
    if (!outcome.counted) throw new Error();
    expect(outcome.result.coins.total).toBe(0);
    expect(outcome.state).toMatchObject({ coins: 0, coinDay: null, coinsToday: 0 });
    expect(outcome.state.xp).toBeGreaterThan(0);
  });

  test("workout XP pays at most once per 12 hours of claim time; stat XP still counts", () => {
    const first = claim(benchDay(T0));
    if (!first.counted) throw new Error();
    expect(first.state.workoutXpAt).toBe(T0);
    const soon = T0 + (XP.workoutCooldownHours - 1) * 60 * 60 * 1000;
    const second = claim(benchDay(soon), { state: first.state, muscles: first.muscles, now: soon });
    if (!second.counted) throw new Error();
    expect(second.result.xp.workout).toBe(0);
    expect(second.result.xp.stats).toBeGreaterThan(0);
    expect(second.state.workoutXpAt).toBe(T0);
    const later = T0 + XP.workoutCooldownHours * 60 * 60 * 1000;
    const third = claim(benchDay(later), { state: second.state, muscles: second.muscles, now: later });
    expect(third.counted && third.result.xp.workout).toBe(XP.perWorkout);
  });

  test("a state from before the 12-hour rule still pays workout XP", () => {
    const old: GameState = newGameState(T0, UTC);
    delete old.workoutXpAt;
    const outcome = claim(benchDay(T0), { state: old });
    expect(outcome.counted && outcome.result.xp.workout).toBe(XP.perWorkout);
  });

  test("every workout adds points, so stats only grow", () => {
    const { results } = claimAll([benchDay(T0), benchDay(T0 + 2 * DAY, 70), benchDay(T0 + 4 * DAY, 60)]);
    expect(results.map((r) => r.stats.after.chest)).toEqual([0.4, 0.8, 1.2]);
    expect(results.every((r) => r.xp.stats > 0)).toBe(true);
  });

  test("beating the last session makes every set of that exercise worth more", () => {
    const { results, muscles } = claimAll([benchDay(T0, 80), benchDay(T0 + 2 * DAY, 82.5)]);
    expect(results[1].progressed).toEqual([{ exerciseId: BENCH, stat: "chest" }]);
    expect(muscles.chest).toMatchObject({ sets: 8, progressed: 4 });
    const extra = (4 * STAT_POINTS.progressedSet) / STAT_POINTS.perStat;
    expect(results[1].stats.after.chest).toBeCloseTo(BENCH_POWER + extra);
  });

  test("Legs and Back count more in power, so their stat XP is bigger", () => {
    const squat = workout(T0, [[SQUAT, [set(100, 5), set(100, 5), set(100, 5), set(100, 5)]]]);
    const outcome = claim(squat);
    if (!outcome.counted) throw new Error();
    expect(outcome.state.peakPower).toBeCloseTo(BENCH_POWER * POWER_MULTIPLIERS.legs);
    expect(outcome.result.xp.stats).toBe(Math.round(BENCH_POWER * POWER_MULTIPLIERS.legs * XP.perPowerPoint));
  });

  test("tracks the most stats beaten in one workout (Record Breaker)", () => {
    const day = (at: number, kg: number) =>
      workout(at, [
        [BENCH, [set(kg, 5), set(kg, 5)]],
        [SQUAT, [set(kg, 5), set(kg, 5)]],
        [CURL, [set(kg / 2, 8), set(kg / 2, 8)]],
      ]);
    const { state } = claimAll([day(T0, 60), day(T0 + 2 * DAY, 65)]);
    expect(state.mostStatsBeaten).toBe(3);
  });

  test("levels up when XP crosses a level", () => {
    const state = { ...newGameState(T0, UTC), xp: XP.perLevel - 5 };
    const outcome = claim(benchDay(T0), { state });
    expect(outcome.counted && outcome.result.level).toEqual({ before: 1, after: 2 });
  });
});

describe("replayMuscles", () => {
  const history = [benchDay(T0, 80), benchDay(T0 + 2 * DAY, 90), benchDay(T0 + 9 * DAY, 85)];

  test("matches the facts live claims built", () => {
    const { muscles } = claimAll(history);
    expect(replayMuscles(history, lookup, UTC, T0 + 30 * DAY).muscles).toEqual(muscles);
  });

  test("a fixed typo no longer counts as beating the last session", () => {
    const typo = benchDay(T0 + DAY, 300); // meant 30
    const inflated = replayMuscles([...history, typo], lookup, UTC, T0 + 30 * DAY);
    const fixed = replayMuscles([...history, benchDay(T0 + DAY, 30, typo.id)], lookup, UTC, T0 + 30 * DAY);
    expect(inflated.muscles.chest?.progressed).toBe(4);
    expect(fixed.muscles.chest?.progressed).toBe(4);
    // 80 -> 300 -> 90 beats once; 80 -> 30 -> 90 beats once too, but on the 90 kg day, not the typo.
    expect(fixed.peakPower).toBeCloseTo(inflated.peakPower);
  });

  test("an uncounted workout still sets the last session", () => {
    const short = workout(T0 + DAY, [[BENCH, [set(100, 5)]]]);
    const { muscles } = replayMuscles([benchDay(T0, 80), short, benchDay(T0 + 2 * DAY, 90)], lookup, UTC, T0 + 30 * DAY);
    // 90 doesn't beat the 100 kg single, so nothing progressed; the short workout earns nothing itself.
    expect(muscles.chest).toMatchObject({ sets: 8, progressed: 0 });
  });

  test("writes one snapshot per week, as of that week's last workout", () => {
    const { snapshots } = replayMuscles(history, lookup, UTC, T0 + 30 * DAY);
    expect(snapshots.map((s) => s.weekId)).toEqual(["2026-10-11", "2026-10-18"]);
    expect(snapshots[0].takenAt).toBe(history[1].endedAt);
  });

  test("skips workouts that don't count or are in the future", () => {
    const short = workout(T0, [[SQUAT, [set(300, 5)]]]);
    const future = workout(T0 + 100 * DAY, [[CRUNCH, [set(null, 20), set(null, 20), set(null, 20), set(null, 20)]]]);
    const { muscles } = replayMuscles([...history, short, future], lookup, UTC, T0 + 30 * DAY);
    expect(muscles.quadriceps).toBeUndefined();
    expect(muscles.abdominals).toBeUndefined();
  });

  test("reports the highest power the history reached", () => {
    const { state } = claimAll(history);
    expect(replayMuscles(history, lookup, UTC, T0 + 30 * DAY).peakPower).toBeCloseTo(state.peakPower);
    expect(replayMuscles([], lookup, UTC, T0).peakPower).toBe(0);
  });

  test("order of the input doesn't matter", () => {
    expect(replayMuscles([...history].reverse(), lookup, UTC, T0 + 30 * DAY)).toEqual(replayMuscles(history, lookup, UTC, T0 + 30 * DAY));
  });
});

describe("recomputedPeak", () => {
  test("a deleted workout lowers the peak, so new training pays XP again", () => {
    const { state } = claimAll([benchDay(T0), benchDay(T0 + DAY), benchDay(T0 + 2 * DAY)]);
    const replay = replayMuscles([benchDay(T0), benchDay(T0 + DAY)], lookup, UTC, T0 + 3 * DAY);
    const peakPower = recomputedPeak(state, replay.peakPower);
    expect(peakPower).toBeLessThan(state.peakPower);
    const at = T0 + 4 * DAY;
    const next = claim(benchDay(at), { state: { ...state, peakPower }, muscles: replay.muscles, now: at });
    expect(next.counted && next.result.xp.stats).toBe(Math.round(BENCH_POWER * XP.perPowerPoint));
  });

  test("never raises the peak", () => {
    const state = { ...newGameState(T0, UTC), peakPower: 50 };
    expect(recomputedPeak(state, 80)).toBe(50);
    expect(recomputedPeak(state, 30)).toBe(30);
  });
});

describe("backfillHistory", () => {
  const history = Array.from({ length: 8 }, (_, i) => benchDay(T0 + i * 2 * DAY, 80 + i * 5));
  const now = T0 + 30 * DAY;

  test("replays XP and stats from 0, pays the welcome bonus instead of coins", () => {
    const { state, claims } = backfillHistory(history, lookup, UTC, now);
    expect(state.coins).toBe(COINS.welcomeBonus);
    expect(state.welcomeBonus).toBe(true);
    expect(claims).toHaveLength(8);
    expect(claims.every((c) => c.backfilled && c.coins.total === 0)).toBe(true);
    expect(state.xp).toBe(claims.reduce((sum, c) => sum + c.xp.total, 0));
    expect(claims.every((c) => c.xp.stats > 0)).toBe(true);
    // The first session has nothing to beat; the seven heavier ones after it do.
    expect(claims.filter((c) => c.progressed!.length > 0)).toHaveLength(7);
    expect(state.level).toBe(1 + Math.floor(state.xp / XP.perLevel));
  });

  test("builds the same muscles as a recompute", () => {
    const { muscles } = backfillHistory(history, lookup, UTC, now);
    expect(muscles).toEqual(replayMuscles(history, lookup, UTC, now).muscles);
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

describe("reworkGame", () => {
  const history = Array.from({ length: 6 }, (_, i) => benchDay(T0 + i * 2 * DAY, 80 + i * 5));
  const now = T0 + 30 * DAY;
  /** A game from before the rework: old XP and peak, retired fields, items and coins. 75 XP came from quests. */
  const old = {
    ...newGameState(T0, UTC),
    coins: 1234,
    xp: 575,
    level: 2,
    peakPower: 310,
    calibration: { startedAt: T0, workouts: 6, done: true },
    bodyweightKg: 80,
    age: 30,
    sex: "male",
    equipped: { helmet: "i1" },
  } as GameState;

  test("replays stats, peak, workout XP and level; keeps quest XP and everything else", () => {
    const { state } = reworkGame({ state: old, workouts: history, lookup, now, questXp: 75 });
    const replayed = backfillHistory(history, lookup, UTC, now).state;
    expect(state.xp).toBe(75 + replayed.xp);
    expect(state.level).toBe(1 + Math.floor(state.xp / XP.perLevel));
    expect(state.peakPower).toBeCloseTo(replayed.peakPower);
    expect(state).toMatchObject({ coins: 1234, equipped: { helmet: "i1" }, mostStatsBeaten: 1 });
    for (const field of ["calibration", "bodyweightKg", "age", "sex"]) expect(state).not.toHaveProperty(field);
  });

  test("is the same when run twice", () => {
    const once = reworkGame({ state: old, workouts: history, lookup, now, questXp: 75 });
    const twice = reworkGame({ state: once.state, workouts: history, lookup, now, questXp: 75 });
    expect(twice).toEqual(once);
  });
});
