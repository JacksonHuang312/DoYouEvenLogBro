import { describe, expect, test } from "vitest";
import type { Quest, QuestsDoc, QuestWeek } from "./quests";
import type { ScheduleDoc } from "./schedule";
import {
  daysLabel,
  editableDays,
  pendingFrom,
  questCards,
  rerollInfo,
  routineDays,
  sameDays,
  toggleDay,
} from "./questsView";
import { benchDay, lookup, T0 } from "./test-helpers";

const UTC = "UTC";
const WEEK = "2026-10-11";

const quest = (patch: Partial<Quest> & Pick<Quest, "id" | "slot">): Quest => ({
  kind: "stat-sets",
  stat: "chest",
  target: 4,
  title: "Chest: 4 sets",
  reward: { coins: 30, xp: 25 },
  rerolls: 0,
  claimedAt: null,
  ...patch,
});

const doc = (quests: Quest[], rerollsUsed = 0): QuestsDoc => ({
  weekId: WEEK,
  timeZone: UTC,
  generatedAt: T0,
  rerollsUsed,
  quests,
  updatedAt: T0,
});

const week = (workouts: QuestWeek["workouts"] = []): QuestWeek => ({ weekId: WEEK, timeZone: UTC, workouts, lookup, matched: {} });

describe("questCards", () => {
  test("an unfinished quest is active, with progress counted from the workouts", () => {
    const [card] = questCards(doc([quest({ id: "s0r0", slot: 0, target: 8 })]), week([benchDay(T0)]), T0);
    expect(card).toMatchObject({ id: "s0r0", state: "active", progress: 4, target: 8, pct: 50, reward: "30 coins · 25 XP" });
  });

  test("a finished, unpaid quest can be claimed", () => {
    const [card] = questCards(doc([quest({ id: "s0r0", slot: 0 })]), week([benchDay(T0)]), T0);
    expect(card).toMatchObject({ state: "complete", progress: 4, pct: 100 });
  });

  test("progress past the target is capped for the bar", () => {
    const ws = [benchDay(T0), benchDay(T0 + 1000)];
    const [card] = questCards(doc([quest({ id: "s0r0", slot: 0 })]), week(ws), T0);
    expect(card.progress).toBe(4);
    expect(card.pct).toBe(100);
  });

  test("a paid quest is claimed, and one past its claim window is expired", () => {
    const paid = quest({ id: "s0r0", slot: 0, claimedAt: T0 });
    const unpaid = quest({ id: "s1r0", slot: 1 });
    const cards = questCards(doc([paid, unpaid]), week([benchDay(T0)]), T0);
    expect(cards[0].state).toBe("claimed");
    const late = T0 + 20 * 24 * 60 * 60 * 1000;
    expect(questCards(doc([unpaid]), week([benchDay(T0)]), late)[0].state).toBe("expired");
  });

  test("quests come in slot order", () => {
    const cards = questCards(doc([quest({ id: "s2r0", slot: 2 }), quest({ id: "s0r0", slot: 0 })]), week(), T0);
    expect(cards.map((c) => c.id)).toEqual(["s0r0", "s2r0"]);
  });
});

describe("rerollInfo", () => {
  test("shows the next price and how many are left", () => {
    expect(rerollInfo({ rerollsUsed: 0 })).toMatchObject({ cost: 25, left: 2 });
    expect(rerollInfo({ rerollsUsed: 1 })).toMatchObject({ cost: 50, left: 1 });
    expect(rerollInfo({ rerollsUsed: 0 }).label).toBe("Rerolls cost 25 coins, then 50. 2 left this week.");
  });

  test("none left after two", () => {
    expect(rerollInfo({ rerollsUsed: 2 })).toMatchObject({ cost: null, left: 0 });
    expect(rerollInfo({ rerollsUsed: 2 }).label).toContain("None left this week.");
  });
});

describe("schedule editing", () => {
  const sched = (days: ScheduleDoc["versions"][number]["days"], from = "2026-10-01"): ScheduleDoc => ({
    versions: [{ from: "2026-09-01", days: { "1": "old" } }, { from, days }],
    matched: {},
    updatedAt: T0,
  });

  test("starts from the newest version, minus routines that no longer exist", () => {
    const days = editableDays(sched({ "1": "push", "3": "gone", "5": "legs" }), ["push", "legs"]);
    expect(days).toEqual({ "1": "push", "5": "legs" });
    expect(editableDays(null, ["push"])).toEqual({});
  });

  test("tapping a day gives it to the routine, and tapping it again clears it", () => {
    const one = toggleDay({}, "1", "push");
    expect(one).toEqual({ "1": "push" });
    expect(toggleDay(one, "1", "push")).toEqual({});
  });

  test("tapping a day another routine holds moves it", () => {
    expect(toggleDay({ "1": "push" }, "1", "pull")).toEqual({ "1": "pull" });
  });

  test("toggling never mutates its input", () => {
    const days = { "1": "push" } as const;
    toggleDay(days, "2", "pull");
    expect(days).toEqual({ "1": "push" });
  });

  test("lists and labels a routine's days in week order", () => {
    const days = { "5": "push", "1": "push", "3": "pull" } as const;
    expect(routineDays(days, "push")).toEqual(["1", "5"]);
    expect(daysLabel(days, "push")).toBe("Mon, Fri");
    expect(daysLabel(days, "legs")).toBe("No days");
  });

  test("compares schedules by their days", () => {
    expect(sameDays({ "1": "push" }, { "1": "push" })).toBe(true);
    expect(sameDays({ "1": "push" }, { "2": "push" })).toBe(false);
    expect(sameDays({}, {})).toBe(true);
  });

  test("a version that hasn't started yet is pending", () => {
    expect(pendingFrom(sched({}, "2026-10-16"), "2026-10-15")).toBe("2026-10-16");
    expect(pendingFrom(sched({}, "2026-10-15"), "2026-10-15")).toBeNull();
    expect(pendingFrom(null, "2026-10-15")).toBeNull();
  });
});
