import { describe, expect, test } from "vitest";
import { newGameState } from "./claim";
import { QUESTS, STAT_MUSCLES, SUB_MUSCLES, type Stat } from "./config";
import { statOf } from "./muscles";
import {
  claimable,
  claimDeadline,
  generateQuests,
  payQuest,
  payQuests,
  questContext,
  questProgress,
  questsAfterWorkout,
  questStat,
  rerollQuest,
  swapInjuredQuests,
  withQuestRewards,
  type Quest,
  type QuestContext,
  type QuestsDoc,
  type QuestWeek,
} from "./quests";
import type { SubMuscleScores } from "./score";
import { benchDay, CURL, DAY, lookup, set, SQUAT, T0, workout } from "./test-helpers";

const UTC = "UTC";
const WEEK = "2026-10-11";

const scoresOf = (base: number, overrides: Partial<SubMuscleScores> = {}) =>
  ({ ...Object.fromEntries(SUB_MUSCLES.map((m) => [m, base])), ...overrides }) as SubMuscleScores;

/** Chest strongest, arms weakest, then legs; everything else in between. */
const typical = scoresOf(50, { chest: 80, triceps: 20, biceps: 20, forearms: 20, quadriceps: 30, hamstrings: 30 });

const ctx = (patch: Partial<QuestContext> = {}): QuestContext => ({
  uid: "alice",
  weekId: WEEK,
  scores: typical,
  injured: [],
  scheduledLeft: 0,
  ...patch,
});

const make = (patch: Partial<QuestContext> = {}) => generateQuests(ctx(patch), UTC, T0);

describe("generateQuests", () => {
  test("three quests: weakest stat, weakest sub-muscle of another stat, consistency", () => {
    const doc = make();
    expect(doc.quests.map((q) => q.kind)).toEqual(["stat-sets", "muscle-sets", "days"]);
    expect(doc.quests[0]).toMatchObject({ stat: "arms", target: QUESTS.statSets });
    expect(doc.quests[0].title).toBe("Arms is your lowest stat: log 12 working sets of arms");
    const second = doc.quests[1];
    expect(statOf(second.muscle!)).not.toBe("arms");
    expect(second.muscle).toBe("quadriceps");
    expect(second.title).toContain("quadriceps");
  });

  test("is deterministic", () => {
    expect(make()).toEqual(make());
    expect(make({ uid: "bob" }).quests.map((q) => q.kind)).toEqual(make().quests.map((q) => q.kind));
  });

  test("rewards are about 100 coins a week: 30, 30 and 40, plus 25 XP each", () => {
    const rewards = make().quests.map((q) => q.reward);
    expect(rewards).toEqual([{ coins: 30, xp: 25 }, { coins: 30, xp: 25 }, { coins: 40, xp: 25 }]);
    expect(rewards.reduce((n, r) => n + r.coins, 0)).toBe(100);
  });

  test("Core is picked less often: it has to be about half as strong to count as weakest", () => {
    const coreModerate = scoresOf(50, { abdominals: 30, triceps: 20, biceps: 20, forearms: 20 });
    expect(make({ scores: coreModerate }).quests[0].stat).toBe("arms");
    const coreAwful = scoresOf(50, { abdominals: 5, triceps: 20, biceps: 20, forearms: 20 });
    expect(make({ scores: coreAwful }).quests[0].stat).toBe("core");
  });

  test("the sub-muscle quest is always in a different stat from the stat quest", () => {
    for (const weak of SUB_MUSCLES) {
      const doc = make({ scores: scoresOf(60, { [weak]: 1 }) });
      expect(questStat(doc.quests[1])).not.toBe(doc.quests[0].stat);
    }
  });

  test("never targets a minor sub-muscle like neck", () => {
    const doc = make({ scores: scoresOf(60, { neck: 0 }) });
    expect(doc.quests[1].muscle).not.toBe("neck");
    for (const muscle of SUB_MUSCLES) {
      const weight = (STAT_MUSCLES[statOf(muscle)] as Record<string, number>)[muscle];
      if (weight < QUESTS.minMuscleWeight) {
        expect(make({ scores: scoresOf(60, { [muscle]: 0 }) }).quests[1].muscle).not.toBe(muscle);
      }
    }
  });

  test("skips injured stats", () => {
    const doc = make({ injured: ["arms", "legs"] });
    expect(doc.quests[0].stat).not.toBe("arms");
    expect(doc.quests[0].stat).not.toBe("legs");
    for (const q of doc.quests.slice(0, 2)) expect(["arms", "legs"]).not.toContain(questStat(q));
  });

  test("the consistency quest is about scheduled workouts when there are at least 2 left, else days", () => {
    expect(make({ scheduledLeft: 1 }).quests[2]).toMatchObject({ kind: "days", target: QUESTS.daysTarget });
    expect(make({ scheduledLeft: 3 }).quests[2]).toMatchObject({ kind: "scheduled", target: 3 });
    expect(make({ scheduledLeft: 7 }).quests[2]).toMatchObject({ kind: "scheduled", target: QUESTS.scheduledMax });
  });

  test("a brand-new account still gets valid quests", () => {
    const doc = make({ scores: scoresOf(0) });
    expect(doc.quests).toHaveLength(3);
    expect(new Set(doc.quests.map((q) => q.id)).size).toBe(3);
    expect(doc).toMatchObject({ weekId: WEEK, rerollsUsed: 0 });
  });
});

describe("questProgress", () => {
  const week = (workouts: QuestWeek["workouts"], matched: QuestWeek["matched"] = {}): QuestWeek => ({
    weekId: WEEK,
    timeZone: UTC,
    workouts,
    lookup,
    matched,
  });
  const quest = (patch: Partial<Quest>): Quest => ({
    id: "q",
    slot: 0,
    kind: "stat-sets",
    target: 12,
    title: "",
    reward: { coins: 30, xp: 25 },
    rerolls: 0,
    claimedAt: null,
    ...patch,
  });

  test("stat and muscle sets count working sets (warm-ups excluded) from the week's workouts", () => {
    const ws = [
      benchDay(T0), // 4 chest sets
      workout(T0 + DAY, [
        [CURL, [set(30, 10, "warmup"), set(30, 10), set(30, 10), set(30, 10), set(30, 10)]], // 4 biceps working sets
      ]),
    ];
    expect(questProgress(quest({ kind: "stat-sets", stat: "chest" }), week(ws))).toBe(4);
    expect(questProgress(quest({ kind: "stat-sets", stat: "arms" }), week(ws))).toBe(4);
    expect(questProgress(quest({ kind: "muscle-sets", muscle: "biceps" }), week(ws))).toBe(4);
    expect(questProgress(quest({ kind: "muscle-sets", muscle: "triceps" }), week(ws))).toBe(0);
  });

  test("only workouts with 4+ working sets count, and only from this week", () => {
    const short = workout(T0, [[SQUAT, [set(100, 5), set(100, 5), set(100, 5)]]]);
    const lastWeek = benchDay(T0 - 7 * DAY);
    const nextWeek = benchDay(T0 + 7 * DAY);
    const ws = [short, lastWeek, nextWeek, benchDay(T0)];
    expect(questProgress(quest({ kind: "workouts" }), week(ws))).toBe(1);
    expect(questProgress(quest({ kind: "stat-sets", stat: "legs" }), week(ws))).toBe(0);
  });

  test("days counts distinct local days, not workouts", () => {
    const ws = [benchDay(T0), benchDay(T0 + 1000), benchDay(T0 + DAY)];
    expect(questProgress(quest({ kind: "days" }), week(ws))).toBe(2);
    expect(questProgress(quest({ kind: "workouts" }), week(ws))).toBe(3);
  });

  test("scheduled counts this week's days filled on the day", () => {
    const matched = {
      "2026-10-12": { daysOff: 0 },
      "2026-10-14": { daysOff: 1 },
      "2026-10-16": { daysOff: 0 },
      "2026-10-05": { daysOff: 0 }, // last week
      "2026-10-18": { daysOff: 0 }, // next week
    };
    expect(questProgress(quest({ kind: "scheduled" }), week([], matched))).toBe(2);
  });

  test("is recomputed from the workouts, so deleting one lowers it", () => {
    const q = quest({ kind: "workouts", target: 2 });
    expect(questProgress(q, week([benchDay(T0), benchDay(T0 + DAY)]))).toBe(2);
    expect(questProgress(q, week([benchDay(T0)]))).toBe(1);
  });
});

describe("rerollQuest", () => {
  const progress = () => 0;
  const doc = () => make();

  test("costs 25, then 50, then no more", () => {
    let d = doc();
    const first = rerollQuest(d, d.quests[0].id, 0, ctx(), progress, T0);
    if (!first.ok) throw new Error(first.error);
    expect(first.value.cost).toBe(25);
    d = first.value.doc;
    expect(d.rerollsUsed).toBe(1);
    const second = rerollQuest(d, d.quests[1].id, 1, ctx(), progress, T0);
    if (!second.ok) throw new Error(second.error);
    expect(second.value.cost).toBe(50);
    expect(rerollQuest(second.value.doc, second.value.doc.quests[2].id, 2, ctx(), progress, T0).ok).toBe(false);
  });

  test("replaces only that quest, with a different target, and keeps the stat/muscle split", () => {
    const d = doc();
    const result = rerollQuest(d, d.quests[0].id, 0, ctx(), progress, T0);
    if (!result.ok) throw new Error(result.error);
    const next = result.value.doc.quests;
    expect(next[1]).toBe(d.quests[1]);
    expect(next[2]).toBe(d.quests[2]);
    expect(next[0].id).not.toBe(d.quests[0].id);
    expect(next[0].stat).not.toBe(d.quests[0].stat);
    expect(next[0].stat).not.toBe(questStat(d.quests[1]));
    expect(next[0].title.startsWith("Log ")).toBe(true);
  });

  test("is deterministic", () => {
    const d = doc();
    expect(rerollQuest(d, d.quests[0].id, 0, ctx(), progress, T0)).toEqual(rerollQuest(d, d.quests[0].id, 0, ctx(), progress, T0));
  });

  test("a repeated request can't be charged twice", () => {
    const d = doc();
    const first = rerollQuest(d, d.quests[0].id, 0, ctx(), progress, T0);
    if (!first.ok) throw new Error(first.error);
    // The same request again, against the updated doc, is stale (the old quest id is gone, and the count moved).
    expect(rerollQuest(first.value.doc, d.quests[0].id, 0, ctx(), progress, T0).ok).toBe(false);
  });

  test("can't reroll a finished or claimed quest", () => {
    const d = doc();
    expect(rerollQuest(d, d.quests[0].id, 0, ctx(), (q) => q.target, T0).ok).toBe(false);
    const claimed: QuestsDoc = { ...d, quests: [{ ...d.quests[0], claimedAt: T0 }, ...d.quests.slice(1)] };
    expect(rerollQuest(claimed, d.quests[0].id, 0, ctx(), progress, T0).ok).toBe(false);
    expect(rerollQuest(d, "nope", 0, ctx(), progress, T0).ok).toBe(false);
  });

  test("the replacement isn't one that is already finished", () => {
    const d = doc();
    const result = rerollQuest(d, d.quests[0].id, 0, ctx(), (q) => (q.id === d.quests[0].id ? 0 : q.id.endsWith("r1") ? q.target : 0), T0);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.doc.quests[0].id).not.toBe("s0r1");
  });

  test("never lands on an injured stat", () => {
    const injured: Stat[] = ["chest", "back"];
    const d = make({ injured });
    for (const slot of [0, 1]) {
      const result = rerollQuest(d, d.quests[slot].id, 0, ctx({ injured }), progress, T0);
      if (!result.ok) throw new Error(result.error);
      expect(injured).not.toContain(questStat(result.value.doc.quests[slot]));
    }
  });

  test("the consistency quest rerolls to a different kind", () => {
    const d = make({ scheduledLeft: 3 });
    const result = rerollQuest(d, d.quests[2].id, 0, ctx({ scheduledLeft: 3 }), progress, T0);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.doc.quests[2].kind).not.toBe("scheduled");
  });
});

describe("swapInjuredQuests", () => {
  test("replaces unclaimed quests on a newly injured stat for free", () => {
    const d = make();
    expect(d.quests[0].stat).toBe("arms");
    const swapped = swapInjuredQuests(d, ctx({ injured: ["arms"] }), () => 0, T0);
    expect(swapped.rerollsUsed).toBe(0);
    expect(swapped.quests[0].stat).not.toBe("arms");
    expect(swapped.quests[0].id).not.toBe(d.quests[0].id);
    expect(swapped.quests[1]).toBe(d.quests[1]);
  });

  test("leaves claimed quests and uninvolved docs alone", () => {
    const d = make();
    const claimed: QuestsDoc = { ...d, quests: [{ ...d.quests[0], claimedAt: T0 }, ...d.quests.slice(1)] };
    expect(swapInjuredQuests(claimed, ctx({ injured: ["arms"] }), () => 0, T0)).toBe(claimed);
    expect(swapInjuredQuests(d, ctx({ injured: ["core"] }), () => 0, T0)).toBe(d);
  });

  test("also swaps a sub-muscle quest on an injured stat", () => {
    const d = make();
    const stat = questStat(d.quests[1])!;
    const swapped = swapInjuredQuests(d, ctx({ injured: [stat] }), () => 0, T0);
    expect(questStat(swapped.quests[1])).not.toBe(stat);
  });
});

describe("paying quests", () => {
  const done = (q: Quest) => q.target;

  test("pays every finished quest once", () => {
    const d = make();
    const first = payQuests(d, (q) => (q.slot === 0 ? q.target : 0), T0 + DAY);
    expect(first.paid.map((q) => q.slot)).toEqual([0]);
    expect(first.doc.quests[0].claimedAt).toBe(T0 + DAY);
    const again = payQuests(first.doc, done, T0 + 2 * DAY);
    expect(again.paid.map((q) => q.slot)).toEqual([1, 2]);
    expect(payQuests(again.doc, done, T0 + 3 * DAY).paid).toEqual([]);
  });

  test("a paid quest stays paid even if its progress later drops", () => {
    const d = make();
    const { doc: paid } = payQuests(d, done, T0);
    expect(payQuests(paid, () => 0, T0 + DAY).paid).toEqual([]);
    expect(paid.quests.every((q) => q.claimedAt != null)).toBe(true);
  });

  test("can be paid until 3 days after the week ends, not after", () => {
    const d = make();
    const deadline = claimDeadline(WEEK, UTC);
    expect(deadline).toBe(Date.UTC(2026, 9, 21));
    expect(claimable(d, d.quests[0], d.quests[0].target, deadline - 1)).toBe(true);
    expect(claimable(d, d.quests[0], d.quests[0].target, deadline)).toBe(false);
    expect(payQuests(d, done, deadline).paid).toEqual([]);
  });

  test("an unfinished quest isn't paid", () => {
    const d = make();
    expect(payQuests(d, (q) => q.target - 1, T0).paid).toEqual([]);
  });

  test("payQuest (the Claim button) explains why it can't", () => {
    const d = make();
    const id = d.quests[0].id;
    expect(payQuest(d, id, () => 0, T0)).toEqual({ ok: false, error: "Not finished yet" });
    expect(payQuest(d, "gone", done, T0)).toEqual({ ok: false, error: "That quest was replaced" });
    expect(payQuest(d, id, done, claimDeadline(WEEK, UTC))).toMatchObject({ ok: false });
    const ok = payQuest(d, id, done, T0);
    if (!ok.ok) throw new Error(ok.error);
    expect(ok.value.quest.claimedAt).toBe(T0);
    expect(payQuest(ok.value.doc, id, done, T0)).toEqual({ ok: false, error: "Already claimed" });
  });

  test("rewards add coins and XP, move the level, and leave the daily cap alone", () => {
    const state = { ...newGameState(T0, UTC), coins: 10, xp: 490, coinDay: "2026-10-14", coinsToday: 120 };
    const next = withQuestRewards(state, make().quests.slice(0, 2), T0 + 1);
    expect(next).toMatchObject({ coins: 70, xp: 540, level: 2, coinDay: "2026-10-14", coinsToday: 120, updatedAt: T0 + 1 });
  });
});


describe("questContext", () => {
  const schedule = {
    versions: [{ from: "2026-01-01", days: { "1": "a", "3": "b", "5": "c" } }],
    matched: { "2026-10-14": { workoutId: "w", workoutDay: "2026-10-14", daysOff: 0, claimedAt: T0 } },
    updatedAt: 0,
  };

  test("counts open scheduled days from today to the week's end, skipping filled ones", () => {
    const state = newGameState(T0, UTC);
    // Wed 10-14 (filled), Fri 10-16: one left. Monday 10-12 is already past.
    expect(questContext({ uid: "a", weekId: WEEK, state, muscles: {}, schedule, now: T0, timeZone: UTC }).scheduledLeft).toBe(1);
    const earlier = Date.UTC(2026, 9, 12, 8);
    expect(questContext({ uid: "a", weekId: WEEK, state, muscles: {}, schedule, now: earlier, timeZone: UTC }).scheduledLeft).toBe(2);
  });

  test("carries the injured stats and frozen-aware scores", () => {
    const base = newGameState(T0, UTC);
    const injured = { ...base, injuries: [{ stat: "arms" as const, since: T0 - DAY, expiresAt: T0 + DAY, renewals: 0 }] };
    const c = questContext({ uid: "a", weekId: WEEK, state: injured, muscles: {}, schedule, now: T0, timeZone: UTC });
    expect(c.injured).toEqual(["arms"]);
    expect(Object.keys(c.scores)).toHaveLength(SUB_MUSCLES.length);
  });
});

describe("questsAfterWorkout", () => {
  const weekOf = (workouts: QuestWeek["workouts"]): QuestWeek => ({ weekId: WEEK, timeZone: UTC, workouts, lookup, matched: {} });
  const doc = () => make();

  test("lists the quests a workout moved, pays the ones it finished, and leaves the rest out", () => {
    const d = doc(); // stat quest: arms x12, muscle quest: quadriceps x8, days x3
    const before = [benchDay(T0), benchDay(T0 + DAY)];
    const finishing = workout(T0 + 2 * DAY, [[CURL, Array.from({ length: 12 }, () => set(30, 10))]]);
    const result = questsAfterWorkout(d, weekOf(before), weekOf([...before, finishing]), T0 + 2 * DAY);
    // The arms quest went 0 -> 12 and finished; the third day finished the days quest; legs didn't move.
    expect(result.updates.map((u) => [u.id, u.before, u.after, u.paid != null])).toEqual([
      ["s0r0", 0, 12, true],
      ["s2r0", 2, 3, true],
    ]);
    expect(result.paid.map((q) => q.id)).toEqual(["s0r0", "s2r0"]);
    expect(result.doc.quests[0].claimedAt).toBe(T0 + 2 * DAY);
    expect(result.doc.quests[1].claimedAt).toBeNull();
  });

  test("a second claim for a finished quest pays nothing again", () => {
    const d = doc();
    const finishing = workout(T0, [[CURL, Array.from({ length: 12 }, () => set(30, 10))]]);
    const first = questsAfterWorkout(d, weekOf([]), weekOf([finishing]), T0);
    expect(first.paid).toHaveLength(1);
    const more = workout(T0 + DAY, [[CURL, Array.from({ length: 4 }, () => set(30, 10))]]);
    const second = questsAfterWorkout(first.doc, weekOf([finishing]), weekOf([finishing, more]), T0 + DAY);
    expect(second.paid).toEqual([]);
    // Progress still shows for the paid quest, with no payout.
    expect(second.updates.find((u) => u.id === "s0r0")).toMatchObject({ before: 12, after: 16, paid: null });
  });

  test("a workout that touches nothing changes nothing", () => {
    const d = doc();
    const result = questsAfterWorkout(d, weekOf([]), weekOf([]), T0);
    expect(result.updates).toEqual([]);
    expect(result.doc).toBe(d);
  });
});
