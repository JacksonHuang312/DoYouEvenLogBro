import { describe, expect, test } from "vitest";
import { startPause } from "./breaks";
import { newGameState } from "./claim";
import type { ScheduleDoc, WeekdayRoutines } from "./schedule";
import { bonusPercent, trainSchedule, type TrainScheduleInput } from "./train";
import { benchDay, DAY, lookup, set, T0, workout, BENCH } from "./test-helpers";

const UTC = "UTC";
const routines = [
  { id: "push", name: "Push day" },
  { id: "pull", name: "Pull day" },
  { id: "legs", name: "Leg day" },
];

/** T0 is Wednesday 2026-10-14; the week runs Sun 10-11 to Sat 10-17. */
const WEEK: WeekdayRoutines = { "1": "push", "3": "pull", "5": "legs" };

const schedule = (days: WeekdayRoutines = WEEK, matched: ScheduleDoc["matched"] = {}): ScheduleDoc => ({
  versions: [{ from: "2026-09-01", days }],
  matched,
  updatedAt: T0,
});

const slot = (workoutId: string, workoutDay: string, daysOff: number) => ({
  workoutId,
  workoutDay,
  daysOff,
  claimedAt: T0,
});

function plan(over: Partial<TrainScheduleInput> = {}) {
  return trainSchedule({
    schedule: schedule(),
    state: { pauses: [] },
    routines,
    workouts: [],
    lookup,
    now: T0,
    timeZone: UTC,
    ...over,
  });
}

const statuses = (p: ReturnType<typeof plan>) => p.days.map((d) => d.status);

describe("bonusPercent", () => {
  test("follows the off-day curve", () => {
    expect([0, 1, 2, 3, 4].map(bonusPercent)).toEqual([100, 80, 60, 40, 0]);
  });
});

describe("without a schedule", () => {
  test("the strip marks workout days and there is no card", () => {
    const p = plan({ schedule: null, workouts: [{ ...benchDay(T0 - DAY), id: "a" }] });
    expect(p.hasSchedule).toBe(false);
    expect(statuses(p)).toEqual(["rest", "rest", "done", "today", "rest", "rest", "rest"]);
    expect(p.card.kind).toBe("none");
    expect(p.summary).toBe("1 workout day");
  });
});

describe("today's card", () => {
  test("a scheduled workout today, with what tomorrow would pay", () => {
    const { card } = plan();
    expect(card).toMatchObject({ kind: "today", routineId: "pull", day: "2026-10-14", kicker: "Scheduled today" });
    expect(card.note).toBe("Full bonus if done today. Tomorrow pays 80%.");
  });

  test("a make-up for a recent missed slot, with its reduced bonus", () => {
    const { card } = plan({ now: T0 - DAY });
    expect(card).toMatchObject({ kind: "make-up", routineId: "push", day: "2026-10-12", kicker: "Make-up for Monday" });
    expect(card.note).toBe("Doing it today pays 80% of the bonus.");
  });

  test("an upcoming slot within reach shows what doing it early pays", () => {
    const filled = schedule(WEEK, { "2026-10-12": slot("m", "2026-10-12", 0), "2026-10-14": slot("w", "2026-10-14", 0) });
    const { card } = plan({ schedule: filled, now: T0 + DAY });
    expect(card).toMatchObject({ kind: "next", routineId: "legs", kicker: "Next: Tomorrow" });
    expect(card.note).toBe("Doing it today pays 80% of the bonus. Full bonus tomorrow.");
  });

  test("a slot beyond the bonus window is offered as next, with no bonus", () => {
    const mondays = schedule({ "1": "push" }, { "2026-10-12": slot("m", "2026-10-12", 0) });
    const { card } = plan({ schedule: mondays });
    expect(card).toMatchObject({ kind: "next", routineId: "push", day: "2026-10-19", kicker: "Next: Mon" });
    expect(card.note).toBe("Starting early pays no scheduled bonus.");
  });

  test("a scheduled routine that was deleted is skipped", () => {
    // Today's Pull day is gone, so the card offers the next slot whose routine still exists.
    expect(plan({ routines: routines.filter((r) => r.id !== "pull") }).card).toMatchObject({ kind: "next", routineId: "legs" });
    expect(plan({ routines: [] }).card.kind).toBe("none");
  });

  test("an active pause replaces it", () => {
    const paused = startPause(newGameState(T0 - 30 * DAY, UTC), 10, T0, UTC);
    if (!paused.ok) throw new Error(paused.error);
    const p = plan({ state: paused.value });
    expect(p.card.kind).toBe("paused");
    expect(p.card.note).toMatch(/^Back Oct 24\./);
    expect(statuses(p)).not.toContain("planned");
  });

  test("a workout done today moves the card on to the next open slot", () => {
    const p = plan({ workouts: [{ ...benchDay(T0), id: "today" }] });
    // Today's slot is taken by it; Monday's missed slot is the next one it could still fill.
    expect(p.card).toMatchObject({ kind: "make-up", day: "2026-10-12" });
  });
});

describe("week strip", () => {
  test("an untouched week: missed, today, planned and rest days", () => {
    expect(statuses(plan())).toEqual(["rest", "missed", "rest", "today", "rest", "planned", "rest"]);
  });

  test("done on schedule", () => {
    const p = plan({ schedule: schedule(WEEK, { "2026-10-12": slot("m", "2026-10-12", 0) }) });
    expect(p.days[1]).toMatchObject({ status: "on-time", predicted: false, label: "Done on schedule" });
    expect(p.summary).toBe("1 of 3 done");
  });

  test("late and early show on the scheduled day", () => {
    const p = plan({
      schedule: schedule(WEEK, {
        "2026-10-12": slot("m", "2026-10-13", 1),
        "2026-10-16": slot("f", "2026-10-14", 2),
      }),
    });
    expect(p.days[1]).toMatchObject({ status: "late", label: "Done a day late" });
    expect(p.days[5]).toMatchObject({ status: "early", label: "Done 2 days early" });
    expect(p.summary).toBe("2 of 3 done");
  });

  test("an unsynced workout is predicted with the server's own matching", () => {
    const p = plan({ workouts: [{ ...benchDay(T0), id: "offline" }] });
    expect(p.days[3]).toMatchObject({ status: "on-time", predicted: true });
    expect(p.days[3].label).toBe("Done on schedule (predicted, not synced yet)");
    expect(p.anyPredicted).toBe(true);
  });

  test("a workout the server already matched is not predicted twice", () => {
    const p = plan({
      schedule: schedule(WEEK, { "2026-10-14": slot("w1", "2026-10-14", 0) }),
      workouts: [{ ...benchDay(T0), id: "w1" }],
    });
    expect(p.days[3]).toMatchObject({ status: "on-time", predicted: false });
    expect(p.anyPredicted).toBe(false);
  });

  test("a workout with no open slot nearby is extra", () => {
    const mondays = schedule({ "1": "push" }, { "2026-10-12": slot("m", "2026-10-12", 0) });
    const p = plan({ schedule: mondays, workouts: [{ ...benchDay(T0), id: "x" }] });
    expect(p.days[3]).toMatchObject({ status: "extra", label: "Extra workout" });
  });

  test("workouts that fail the 4-set rule leave no mark", () => {
    const short = workout(T0, [[BENCH, [set(60, 5), set(60, 5)]]], "short");
    expect(statuses(plan({ workouts: [short] }))).toEqual(["rest", "missed", "rest", "today", "rest", "planned", "rest"]);
  });

  test("days inside a pause have no slots", () => {
    const paused = startPause(newGameState(T0 - 30 * DAY, UTC), 7, T0 - DAY, UTC);
    if (!paused.ok) throw new Error(paused.error);
    const s = statuses(plan({ state: paused.value }));
    expect(s.slice(3)).toEqual(["rest", "rest", "rest", "rest"]);
  });
});

describe("each routine's next day", () => {
  test("Today, a weekday, or nothing", () => {
    const next = plan().nextByRoutine;
    expect(next).toEqual({ pull: "Today", legs: "Fri", push: "Mon" });
  });

  test("a routine whose slot is already filled moves to its next one", () => {
    const next = plan({ schedule: schedule(WEEK, { "2026-10-14": slot("w", "2026-10-14", 0) }) }).nextByRoutine;
    expect(next.pull).toBe("Next Wed");
  });

  test("tomorrow reads as Tomorrow", () => {
    expect(plan({ now: T0 + DAY }).nextByRoutine.legs).toBe("Tomorrow");
  });

  test("routines that aren't scheduled are absent", () => {
    expect(plan({ schedule: schedule({ "1": "push" }) }).nextByRoutine).toEqual({ push: "Mon" });
  });
});
