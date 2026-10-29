import { describe, expect, test } from "vitest";
import { clearInjury, flagInjury } from "./breaks";
import { newGameState, type GameState, type Snapshot } from "./claim";
import { RUST, STATS } from "./config";
import { mergeFacts, workoutFacts, type MusclesFacts } from "./facts";
import { buildExerciseLookup } from "./sets";
import { BENCH, BIKE, benchDay, CRUNCH, DAY, set, SQUAT, T0, workout } from "./test-helpers";
import {
  combineStatus,
  dayLabel,
  heroView,
  pickSnapshot,
  resolveTimeZone,
  routineStats,
  rustLine,
  snapshotStat,
  statNumber,
  trainedLabel,
  weekStrip,
} from "./view";

const UTC = "UTC";
const lookup = buildExerciseLookup();
const factsOf = (...days: ReturnType<typeof benchDay>[]) =>
  days.reduce<MusclesFacts>((all, w) => mergeFacts(all, workoutFacts(w, lookup, () => undefined, UTC).muscles), {});

/** A game/state that has been playing a while. */
const veteran = (overrides: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0 - 60 * DAY, UTC),
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
  test("empty state: a new account starts every stat at 0", () => {
    const v = heroView(null, {}, T0, "America/New_York");
    expect(STATS.every((s) => v.stats[s] === 0 && v.rust[s] === 0)).toBe(true);
    expect(v.power).toBe(0);
    expect(v.battleBody).toBe(0);
    expect(v.coins).toBe(0);
    expect(v.level).toMatchObject({ level: 1, into: 0 });
    expect(v.timeZone).toBe("America/New_York");
  });

  test("shows the earned stats, power and level progress from the first workout", () => {
    const v = heroView(veteran(), factsOf(benchDay(T0 - DAY, 100), benchDay(T0 - 3 * DAY, 100)), T0, UTC);
    expect(v.stats.chest).toBe(0.8);
    expect(v.scores.chest).toBe(0.8);
    expect(v.stats.legs).toBe(0);
    expect(v.power).toBe(0.8);
    expect(v.battleBody).toBe(0.8);
    expect(v.level.level).toBeGreaterThan(1);
    expect(v.coins).toBe(340);
  });

  test("rust weakens only the fighting power; the stats stay", () => {
    const muscles: MusclesFacts = { chest: { sets: 100, progressed: 0, lastTrained: T0 - DAY, weeks: [] } };
    const later = heroView(veteran(), muscles, T0 + (RUST.graceDays + 8) * DAY, UTC);
    expect(later.stats.chest).toBe(10);
    expect(later.power).toBe(10);
    expect(later.rust.chest).toBeCloseTo(0.1);
    expect(later.battleBody).toBeCloseTo(9);
  });

  test("a pause keeps rust away", () => {
    const muscles = factsOf(benchDay(T0 - DAY, 100));
    const paused = veteran({ pauses: [{ startAt: T0 - DAY, endAt: T0 + 60 * DAY, startDay: "2026-10-13", endDay: "2026-12-13" }] });
    expect(heroView(paused, muscles, T0 + 30 * DAY, UTC).rust.chest).toBe(0);
  });

  test("a missing state behaves like the server's new state", () => {
    const muscles = factsOf(benchDay(T0 - DAY, 100));
    expect(heroView(null, muscles, T0, UTC)).toEqual(heroView(newGameState(T0, UTC), muscles, T0, UTC));
  });
});

describe("rustLine", () => {
  test("lists rusty stats, or nothing", () => {
    const none = Object.fromEntries(STATS.map((s) => [s, 0])) as Record<(typeof STATS)[number], number>;
    expect(rustLine(none)).toBeNull();
    expect(rustLine({ ...none, legs: 0.12, core: 0.03 })).toBe("Rusty: Legs −12%, Core −3%");
  });
});

describe("statNumber", () => {
  test("one decimal under 10, whole numbers above", () => {
    expect(statNumber(0.44)).toBe("0.4");
    expect(statNumber(9.96)).toBe("10");
    expect(statNumber(55.6)).toBe("56");
    expect(statNumber(3)).toBe("3");
  });
});

describe("snapshotStat", () => {
  test("reads new snapshots and ones from before the stat rework", () => {
    const stats = Object.fromEntries(STATS.map((s) => [s, 0])) as Snapshot["stats"];
    const snap = (chest: unknown) => ({ weekId: "2026-10-11", stats: { ...stats, chest }, power: 0, takenAt: T0 }) as Snapshot;
    expect(snapshotStat(snap(12.5), "chest")).toBe(12.5);
    expect(snapshotStat(snap({ value: 40, bonus: 2 }), "chest")).toBe(40);
  });
});

describe("heroView injured stats", () => {
  const flag = (state: GameState, stat: "chest" | "legs", showInjuries?: boolean): GameState => {
    const r = flagInjury(state, stat, {}, T0 - DAY, UTC);
    if (!r.ok) throw new Error(r.error);
    return showInjuries === undefined ? r.value : { ...r.value, showInjuries };
  };

  test("lists the stats flagged as injured, from your own state", () => {
    const base = newGameState(T0 - 90 * DAY, UTC);
    expect(heroView(base, {}, T0, UTC).injured).toEqual([]);
    expect(heroView(null, {}, T0, UTC).injured).toEqual([]);
    expect(heroView(flag(flag(base, "chest"), "legs"), {}, T0, UTC).injured.sort()).toEqual(["chest", "legs"]);
  });

  test("still lists them with 'show to followers' off", () => {
    const hidden = flag(newGameState(T0 - 90 * DAY, UTC), "chest", false);
    expect(hidden.showInjuries).toBe(false);
    expect(heroView(hidden, {}, T0, UTC).injured).toEqual(["chest"]);
  });

  test("drops a cleared flag and a lapsed one", () => {
    const flagged = flag(newGameState(T0 - 90 * DAY, UTC), "chest");
    const cleared = clearInjury(flagged, "chest", T0);
    if (!cleared.ok) throw new Error(cleared.error);
    expect(heroView(cleared.value, {}, T0 + DAY, UTC).injured).toEqual([]);
    expect(heroView(flagged, {}, T0 + 9 * 7 * DAY, UTC).injured).toEqual([]);
  });
});

describe("pickSnapshot", () => {
  const snap = (daysAgo: number): Snapshot => ({
    weekId: `w${daysAgo}`,
    stats: Object.fromEntries(STATS.map((s) => [s, 10])) as Snapshot["stats"],
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

describe("trainedLabel", () => {
  test("says never, today, or how many days ago", () => {
    expect(trainedLabel(null, T0, UTC)).toBe("never");
    expect(trainedLabel(T0 - 1000, T0, UTC)).toBe("today");
    expect(trainedLabel(T0 - 3 * DAY, T0, UTC)).toBe("3d ago");
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
