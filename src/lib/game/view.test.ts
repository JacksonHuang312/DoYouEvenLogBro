import { describe, expect, test } from "vitest";
import { calibrationDone, NEW_CALIBRATION } from "./calibration";
import { newGameState, type GameState, type Snapshot } from "./claim";
import { CALIBRATION, POPULATION_AVERAGE_SCORE, STATS } from "./config";
import { workoutFacts, type MusclesFacts } from "./facts";
import { averageStats } from "./calibration";
import { buildExerciseLookup } from "./sets";
import { BENCH, BIKE, benchDay, CRUNCH, DAY, set, SQUAT, T0, workout } from "./test-helpers";
import {
  combineStatus,
  dayLabel,
  heroView,
  pickSnapshot,
  resolveTimeZone,
  routineStats,
  weekStrip,
} from "./view";

const UTC = "UTC";
const lookup = buildExerciseLookup();
const factsOf = (...days: ReturnType<typeof benchDay>[]) =>
  days.reduce<MusclesFacts>((all, w) => ({ ...all, ...workoutFacts(w, lookup, 75, UTC) }), {});

/** A game/state past calibration. */
const veteran = (overrides: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0 - 60 * DAY, UTC),
  calibration: { startedAt: T0 - 60 * DAY, workouts: 12, done: true },
  xp: 1250,
  coins: 340,
  ...overrides,
});

describe("combineStatus", () => {
  test("is loading until every listener is ready", () => {
    expect(combineStatus("loading", "loading")).toBe("loading");
    expect(combineStatus("ready", "loading")).toBe("loading");
    expect(combineStatus("ready", "ready")).toBe("ready");
  });

  test("any unavailable listener makes the screen unavailable", () => {
    expect(combineStatus("ready", "unavailable")).toBe("unavailable");
    expect(combineStatus("loading", "unavailable")).toBe("unavailable");
  });
});

describe("resolveTimeZone", () => {
  test("uses the time zone stored in game/state", () => {
    expect(resolveTimeZone({ timeZone: "Asia/Tokyo" }, "America/New_York")).toBe("Asia/Tokyo");
  });

  test("falls back to the browser's without a state or with an invalid stored zone", () => {
    expect(resolveTimeZone(null, "America/New_York")).toBe("America/New_York");
    expect(resolveTimeZone({ timeZone: "Not/AZone" }, "America/New_York")).toBe("America/New_York");
  });

  test("falls back to the default when the browser's is unusable too", () => {
    expect(resolveTimeZone(null, "")).toBe("UTC");
  });
});

describe("heroView", () => {
  test("empty state: a new account is calibrating at the population average, with no power", () => {
    const v = heroView(null, {}, T0, "America/New_York");
    expect(v.calibrating).toBe(true);
    expect(STATS.every((s) => v.stats[s].value === POPULATION_AVERAGE_SCORE && v.stats[s].bonus === 0)).toBe(true);
    expect(v.power).toBeNull();
    expect(v.coins).toBe(0);
    expect(v.level).toEqual({ level: 1, into: 0, needed: 500 });
    expect(v.calibration).toEqual({ workouts: 0, needed: CALIBRATION.workouts, daysLeft: null });
    expect(v.timeZone).toBe("America/New_York");
  });

  test("calibrating with stored facts still shows the averages, not the real numbers", () => {
    const state = veteran({ calibration: { startedAt: T0 - 4 * DAY, workouts: 2, done: false } });
    const v = heroView(state, factsOf(benchDay(T0 - DAY, 100)), T0, UTC);
    expect(v.calibrating).toBe(true);
    expect(v.stats).toEqual(averageStats());
    expect(v.scores.chest).toBeGreaterThan(0);
    expect(v.calibration).toEqual({ workouts: 2, needed: CALIBRATION.workouts, daysLeft: 10 });
  });

  test("calibration days left never go negative", () => {
    const state = veteran({ calibration: { startedAt: T0 - 30 * DAY, workouts: 3, done: false } });
    expect(calibrationDone(state.calibration, T0)).toBe(true);
    expect(heroView(state, {}, T0, UTC).calibration.daysLeft).toBe(0);
  });

  test("after calibration the real stats show, with power and level progress", () => {
    const v = heroView(veteran(), factsOf(benchDay(T0 - DAY, 100)), T0, UTC);
    expect(v.calibrating).toBe(false);
    expect(v.stats.chest.value).toBeGreaterThan(POPULATION_AVERAGE_SCORE);
    expect(v.stats.legs.value).toBe(0);
    expect(v.power).toBeGreaterThan(0);
    expect(v.level).toEqual({ level: 3, into: 250, needed: 500 });
    expect(v.coins).toBe(340);
  });

  test("decay lowers a stat that hasn't been trained for a while", () => {
    const muscles = factsOf(benchDay(T0 - DAY, 100));
    const fresh = heroView(veteran(), muscles, T0, UTC).stats.chest.value;
    const stale = heroView(veteran(), muscles, T0 + 40 * DAY, UTC).stats.chest.value;
    expect(stale).toBeLessThan(fresh);
  });

  test("a missing state with defaults behaves like the server's new state (same stats as a fresh one)", () => {
    const muscles = factsOf(benchDay(T0 - DAY, 100));
    const missing = heroView(null, muscles, T0, UTC);
    const fresh = heroView(newGameState(T0, UTC), muscles, T0, UTC);
    expect(missing).toEqual(fresh);
    expect(NEW_CALIBRATION.done).toBe(false);
  });

  test("uses the stored time zone for week boundaries", () => {
    // 03:30 UTC Sunday is still Saturday night in New York, so the two zones are in different weeks.
    const now = Date.UTC(2026, 9, 18, 3, 30);
    const muscles = factsOf(benchDay(now)); // the facts record the week as UTC sees it (starting 10-18)
    const ny = heroView(veteran({ timeZone: "America/New_York" }), muscles, now, UTC);
    const utc = heroView(veteran({ timeZone: UTC }), muscles, now, UTC);
    expect(ny.timeZone).toBe("America/New_York");
    expect(utc.timeZone).toBe(UTC);
    expect(ny.scores.chest).not.toBe(utc.scores.chest);
  });
});

describe("pickSnapshot", () => {
  const snap = (daysAgo: number): Snapshot => ({
    weekId: `w${daysAgo}`,
    stats: averageStats(),
    power: 0,
    takenAt: T0 - daysAgo * DAY,
  });

  test("returns the latest snapshot at least a period old", () => {
    const snaps = [snap(2), snap(9), snap(20), snap(45), snap(400)];
    expect(pickSnapshot(snaps, T0, "1W")?.weekId).toBe("w9");
    expect(pickSnapshot(snaps, T0, "1M")?.weekId).toBe("w45");
    expect(pickSnapshot(snaps, T0, "1Y")?.weekId).toBe("w400");
  });

  test("is null when nothing is that old, instead of faking one", () => {
    expect(pickSnapshot([snap(2), snap(5)], T0, "1W")).toBeNull();
    expect(pickSnapshot([snap(20)], T0, "1Y")).toBeNull();
  });

  test("is null with no snapshots at all", () => {
    expect(pickSnapshot([], T0, "1W")).toBeNull();
  });
});

describe("weekStrip", () => {
  const fourSets = [set(60, 8), set(60, 8), set(60, 8), set(60, 8)];

  test("marks counted workouts done, today, past rest days and future days (Sunday first)", () => {
    const workouts = [
      benchDay(T0 - 3 * DAY), // Sunday
      workout(T0 - DAY, [[BENCH, [set(60, 8), set(60, 8), set(60, 8)]]]), // Tuesday, only 3 sets: not counted
    ];
    const { days, workouts: count } = weekStrip(workouts, lookup, T0, UTC);
    expect(days.map((d) => d.letter).join("")).toBe("SMTWTFS");
    expect(days.map((d) => d.status)).toEqual(["done", "rest", "rest", "today", "future", "future", "future"]);
    expect(days[0].name).toBe("Sunday");
    expect(days.map((d) => d.isToday)).toEqual([false, false, false, true, false, false, false]);
    expect(count).toBe(1);
  });

  test("a counted workout today makes today done", () => {
    const { days } = weekStrip([workout(T0, [[SQUAT, fourSets]])], lookup, T0, UTC);
    expect(days[3].status).toBe("done");
    expect(days[3].isToday).toBe(true);
  });

  test("warm-ups and cardio don't count toward the 4 working sets", () => {
    const warm = workout(T0, [[BENCH, [set(40, 8, "warmup"), set(40, 8, "warmup"), set(60, 8), set(60, 8), set(60, 8)]]]);
    const cardio = workout(T0 - DAY, [[BIKE, fourSets]]);
    const { days, workouts } = weekStrip([warm, cardio], lookup, T0, UTC);
    expect(days[3].status).toBe("today");
    expect(days[2].status).toBe("rest");
    expect(workouts).toBe(0);
  });

  test("an empty week has only today and rest/future days", () => {
    const { days, workouts } = weekStrip([], lookup, T0, UTC);
    expect(days.some((d) => d.status === "done")).toBe(false);
    expect(workouts).toBe(0);
  });

  test("workouts from last week don't count this week", () => {
    const { workouts } = weekStrip([benchDay(T0 - 5 * DAY)], lookup, T0, UTC);
    expect(workouts).toBe(0);
  });
});

describe("routineStats", () => {
  test("lists the stats a routine trains, once each, in order", () => {
    expect(routineStats([BENCH, CRUNCH, BENCH, SQUAT], lookup)).toEqual(["chest", "core", "legs"]);
  });

  test("skips cardio and unknown exercises", () => {
    expect(routineStats([BIKE, "c_unknown", SQUAT], lookup)).toEqual(["legs"]);
    expect(routineStats([], lookup)).toEqual([]);
  });
});

describe("dayLabel", () => {
  test("says Today, Yesterday, a weekday, then a date", () => {
    expect(dayLabel(T0, T0, UTC)).toBe("Today");
    expect(dayLabel(T0 - DAY, T0, UTC)).toBe("Yesterday");
    expect(dayLabel(T0 - 3 * DAY, T0, UTC)).toBe("Sun");
    expect(dayLabel(T0 - 14 * DAY, T0, UTC)).toBe("Sep 30");
  });
});
