import { describe, expect, test } from "vitest";
import { startPause } from "./breaks";
import { newGameState } from "./claim";
import { COINS, SCHEDULE } from "./config";
import { scheduledBonus } from "./economy";
import { emptySchedule, matchWorkout, slotOn, slotsBetween, withMatch, withSchedule, type ScheduleDoc } from "./schedule";
import { T0 } from "./test-helpers";
import { dayId } from "./time";

// 2026-10-11 is a Sunday. Mon/Wed/Fri routines: "push", "pull", "legs".
const MWF = { "1": "push", "3": "pull", "5": "legs" } as const;
const noPause = { pauses: [] };

/** A schedule that has applied since long before the dates below. */
const doc = (days: ScheduleDoc["versions"][number]["days"] = MWF): ScheduleDoc => ({
  versions: [{ from: "2026-01-01", days }],
  matched: {},
  updatedAt: 0,
});

describe("slotOn and slotsBetween", () => {
  test("a slot is the routine for that weekday; other days rest", () => {
    expect(slotOn(doc(), noPause, "2026-10-12")).toEqual({ routineId: "push" });
    expect(slotOn(doc(), noPause, "2026-10-13")).toBeNull();
    expect(slotsBetween(doc(), noPause, "2026-10-11", "2026-10-17").map((s) => s.day)).toEqual([
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
    ]);
  });

  test("no schedule, no slots", () => {
    expect(slotOn(emptySchedule(0), noPause, "2026-10-12")).toBeNull();
    expect(slotOn(doc({}), noPause, "2026-10-12")).toBeNull();
  });

  test("days before a version starts use the earlier one", () => {
    const d: ScheduleDoc = {
      versions: [
        { from: "2026-01-01", days: { "1": "old" } },
        { from: "2026-10-14", days: { "1": "new" } },
      ],
      matched: {},
      updatedAt: 0,
    };
    expect(slotOn(d, noPause, "2026-10-12")).toEqual({ routineId: "old" });
    expect(slotOn(d, noPause, "2026-10-19")).toEqual({ routineId: "new" });
    expect(slotOn(d, noPause, "2025-12-29")).toBeNull();
  });

  test("a pause removes the slots inside it", () => {
    const paused = startPause(newGameState(T0, "UTC"), 7, T0, "UTC");
    if (!paused.ok) throw new Error(paused.error);
    // Paused 2026-10-14 to 2026-10-20: the Wed, Fri and Mon slots inside it are gone.
    expect(slotOn(doc(), paused.value, "2026-10-12")).toEqual({ routineId: "push" });
    expect(slotOn(doc(), paused.value, "2026-10-14")).toBeNull();
    expect(slotOn(doc(), paused.value, "2026-10-16")).toBeNull();
    expect(slotOn(doc(), paused.value, "2026-10-19")).toBeNull();
    expect(slotOn(doc(), paused.value, "2026-10-21")).toEqual({ routineId: "pull" });
  });
});

describe("withSchedule", () => {
  test("starts tomorrow, so today's slot can't be added after the fact", () => {
    const next = withSchedule(null, { "3": "pull" }, "2026-10-14", T0);
    expect(next.versions).toEqual([{ from: "2026-10-15", days: { "3": "pull" } }]);
    expect(slotOn(next, noPause, "2026-10-14")).toBeNull();
    expect(slotOn(next, noPause, "2026-10-21")).toEqual({ routineId: "pull" });
  });

  test("keeps the schedule in force until then", () => {
    const next = withSchedule(doc(), { "4": "x" }, "2026-10-14", T0);
    expect(slotOn(next, noPause, "2026-10-14")).toEqual({ routineId: "pull" });
    expect(slotOn(next, noPause, "2026-10-15")).toEqual({ routineId: "x" });
    expect(slotOn(next, noPause, "2026-10-16")).toBeNull();
  });

  test("a second change the same day replaces the pending version", () => {
    const once = withSchedule(doc(), { "4": "x" }, "2026-10-14", T0);
    const twice = withSchedule(once, { "6": "y" }, "2026-10-14", T0 + 1000);
    expect(twice.versions.map((v) => v.from)).toEqual(["2026-01-01", "2026-10-15"]);
    expect(twice.versions[1].days).toEqual({ "6": "y" });
  });

  test("clearing the schedule is a version with no days; old versions are capped", () => {
    expect(slotOn(withSchedule(doc(), {}, "2026-10-14", T0), noPause, "2026-10-16")).toBeNull();
    let d: ScheduleDoc | null = null;
    for (let i = 0; i < SCHEDULE.versionsKept + 5; i++) d = withSchedule(d, { "1": `r${i}` }, `2026-02-${String(i + 1).padStart(2, "0")}`, T0);
    expect(d!.versions).toHaveLength(SCHEDULE.versionsKept);
    expect(d!.versions.at(-1)!.days).toEqual({ "1": `r${SCHEDULE.versionsKept + 4}` });
  });
});

describe("matchWorkout", () => {
  const match = (workoutDay: string, claimDay = workoutDay, d = doc()) =>
    matchWorkout({ doc: d, state: noPause, workoutDay, claimDay });

  test("a workout on its scheduled day fills it, 0 off", () => {
    expect(match("2026-10-14")).toEqual({ day: "2026-10-14", routineId: "pull", daysOff: 0 });
  });

  test("any workout fills a slot, whatever it was named", () => {
    expect(match("2026-10-12")?.routineId).toBe("push");
  });

  test("a rest-day workout fills the nearest slot within 3 days, with that many days off", () => {
    // Tuesday 10-13: Monday and Wednesday are both 1 away; the earlier slot goes first.
    expect(match("2026-10-13")).toEqual({ day: "2026-10-12", routineId: "push", daysOff: 1 });
    // Saturday 10-17: Friday is 1 away.
    expect(match("2026-10-17")).toEqual({ day: "2026-10-16", routineId: "legs", daysOff: 1 });
  });

  test("the furthest a weekly slot can be is 3 days, which still earns a reduced bonus", () => {
    // Thursday 10-15: Monday 10-12 is 3 days back, Monday 10-19 is 4 ahead.
    expect(match("2026-10-15", "2026-10-15", doc({ "1": "push" }))).toEqual({ day: "2026-10-12", routineId: "push", daysOff: 3 });
    expect(scheduledBonus(3)).toBeLessThan(COINS.scheduledBonus);
    expect(scheduledBonus(3)).toBeGreaterThan(0);
  });

  test("a filled day pays once: the next workout takes the next-nearest slot", () => {
    const first = match("2026-10-14")!;
    const filled = withMatch(doc(), first, { id: "w1", day: "2026-10-14" }, "2026-10-14", T0);
    expect(match("2026-10-14", "2026-10-14", filled)).toEqual({ day: "2026-10-12", routineId: "push", daysOff: 2 });
    const bothFilled = withMatch(filled, { day: "2026-10-12", routineId: "push", daysOff: 2 }, { id: "w2", day: "2026-10-14" }, "2026-10-14", T0);
    // Fri 10-16 is 2 days from Wed and still open.
    expect(match("2026-10-14", "2026-10-14", bothFilled)).toEqual({ day: "2026-10-16", routineId: "legs", daysOff: 2 });
  });

  test("a workout done early takes tomorrow's slot, reduced", () => {
    expect(match("2026-10-13", "2026-10-13", doc({ "3": "pull" }))).toEqual({ day: "2026-10-14", routineId: "pull", daysOff: 1 });
  });

  test("synced the next day, a workout done on its day still pays in full", () => {
    expect(match("2026-10-14", "2026-10-15")).toEqual({ day: "2026-10-14", routineId: "pull", daysOff: 0 });
  });

  test("backdated: logged days later, it pays through the off-day curve", () => {
    const wed = doc({ "3": "pull" });
    // Wednesday's workout logged on Friday: 2 days late, less 1 day of sync grace.
    expect(match("2026-10-14", "2026-10-16", wed)).toEqual({ day: "2026-10-14", routineId: "pull", daysOff: 1 });
    // Logged 4 days late is the last claim day that still pays (3 days off)...
    expect(match("2026-10-14", "2026-10-18", wed)).toEqual({ day: "2026-10-14", routineId: "pull", daysOff: 3 });
    // ...and after that the slot has expired.
    expect(match("2026-10-14", "2026-10-19", wed)).toBeNull();
  });

  test("a workout from last week claimed now can't fill an old, unfilled slot", () => {
    expect(match("2026-10-05", "2026-10-14", doc({ "1": "push" }))).toBeNull();
  });

  test("no slots inside a pause; slots outside still match", () => {
    const paused = startPause(newGameState(T0, "UTC"), 7, T0, "UTC");
    if (!paused.ok) throw new Error(paused.error);
    const m = (workoutDay: string) =>
      matchWorkout({ doc: doc(), state: paused.value, workoutDay, claimDay: workoutDay });
    // Mon 10-12 was missed before the pause and can still be made up within 3 days.
    expect(m("2026-10-14")).toEqual({ day: "2026-10-12", routineId: "push", daysOff: 2 });
    // Fri 10-16 and its neighbours are paused; Mon 10-12 is 4 days back: out of reach.
    expect(m("2026-10-16")).toBeNull();
    // Wed 10-21 is the first slot after the pause.
    expect(m("2026-10-21")).toEqual({ day: "2026-10-21", routineId: "pull", daysOff: 0 });
  });

  test("no schedule, no match", () => {
    expect(match("2026-10-14", "2026-10-14", emptySchedule(0))).toBeNull();
  });
});

describe("withMatch", () => {
  test("records the match and forgets days older than the keep window", () => {
    const old = "2026-08-31";
    const d: ScheduleDoc = {
      ...doc(),
      matched: { [old]: { workoutId: "w0", workoutDay: old, daysOff: 0, claimedAt: 1 } },
    };
    const next = withMatch(d, { day: "2026-10-14", routineId: "pull", daysOff: 1 }, { id: "w1", day: "2026-10-15" }, "2026-10-15", T0);
    expect(next.matched["2026-10-14"]).toEqual({ workoutId: "w1", workoutDay: "2026-10-15", daysOff: 1, claimedAt: T0 });
    expect(next.matched[old]).toBeUndefined();
    expect(Object.keys(d.matched)).toEqual([old]);
  });
});

describe("time zones", () => {
  test("a late-evening workout in Los Angeles belongs to the local day, not the UTC one", () => {
    const lateEvening = Date.UTC(2026, 9, 15, 3); // 20:00 on Wed 10-14 in LA
    const la = dayId(lateEvening, "America/Los_Angeles");
    expect(la).toBe("2026-10-14");
    expect(matchWorkout({ doc: doc({ "3": "pull" }), state: noPause, workoutDay: la, claimDay: la })?.daysOff).toBe(0);
    expect(matchWorkout({ doc: doc({ "3": "pull" }), state: noPause, workoutDay: dayId(lateEvening, "UTC"), claimDay: dayId(lateEvening, "UTC") })?.daysOff).toBe(1);
  });
});
