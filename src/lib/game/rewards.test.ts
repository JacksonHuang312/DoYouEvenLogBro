import { describe, expect, test } from "vitest";
import type { ClaimResponse } from "../server/game";
import { averageStats } from "./calibration";
import type { ClaimResult } from "./claim";
import { COINS, STATS } from "./config";
import { durationLabel, rewardsView, summaryOf, type RewardsInput, type RewardsSummary } from "./rewards";
import { BENCH, set, T0, workout } from "./test-helpers";

const UTC = "UTC";
const stats = (overrides: Record<string, number> = {}) => {
  const base = averageStats();
  return Object.fromEntries(STATS.map((s) => [s, { value: overrides[s] ?? base[s].value, bonus: 0 }])) as typeof base;
};

/** T0 is a Wednesday, 12:00 UTC. */
const summary: RewardsSummary = { name: "Push day", startedAt: T0, durationMs: 58 * 60_000, workingSets: 18, volumeKg: 6496 };

function result(over: Partial<ClaimResult> = {}): ClaimResult {
  return {
    workoutId: "w1",
    claimedAt: T0 + 3600_000,
    coins: { base: 50, scheduledBonus: 25, capped: 0, total: 75, balance: 500, usedToday: 75, dailyCap: 150 },
    xp: { workout: 20, stats: 0, total: 20, balance: 6760 },
    level: { before: 14, after: 14 },
    stats: { before: stats(), after: stats() },
    power: { before: 100, after: 100 },
    calibrating: false,
    ...over,
  };
}

const claimed = (over: Partial<ClaimResult> = {}): ClaimResponse => ({ status: "claimed", result: result(over) });

function view(response: ClaimResponse, over: Partial<RewardsInput> = {}) {
  return rewardsView({
    response,
    summary,
    unit: "lb",
    timeZone: UTC,
    paused: false,
    now: T0 + 3600_000,
    exerciseName: (id) => (id === BENCH ? "Bench Press" : undefined),
    ...over,
  });
}

describe("summaryOf", () => {
  test("counts working sets and their volume, leaving warm-ups out", () => {
    const w = workout(T0, [[BENCH, [set(40, 10, "warmup"), set(80, 5), set(80, 5)]]]);
    const s = summaryOf({ ...w, name: "Bench" });
    expect(s).toMatchObject({ name: "Bench", startedAt: T0, durationMs: 3600_000, workingSets: 2, volumeKg: 800 });
  });
});

describe("header", () => {
  const withSchedule = (schedule: ClaimResult["schedule"]) => claimed({ schedule });

  test("on schedule", () => {
    expect(view(withSchedule({ day: "2026-10-14", daysOff: 0 })).header).toEqual({ label: "Done on schedule", tone: "good" });
  });

  test("a workout after its slot is late", () => {
    expect(view(withSchedule({ day: "2026-10-13", daysOff: 1 })).header).toEqual({ label: "Done a day late", tone: "warn" });
    expect(view(withSchedule({ day: "2026-10-11", daysOff: 3 })).header.label).toBe("Done 3 days late");
  });

  test("a workout before its slot is early", () => {
    expect(view(withSchedule({ day: "2026-10-16", daysOff: 2 })).header.label).toBe("Done 2 days early");
  });

  test("claiming late on the slot's own day still reads late", () => {
    expect(view(withSchedule({ day: "2026-10-14", daysOff: 1 })).header.label).toBe("Done a day late");
  });

  test("without the workout's date the direction is not guessed", () => {
    expect(view(withSchedule({ day: "2026-10-16", daysOff: 2 }), { summary: null }).header.label).toBe(
      "Done 2 days off schedule",
    );
  });

  test("extra and paused", () => {
    expect(view(withSchedule(null)).header).toEqual({ label: "Extra workout", tone: "muted" });
    expect(view(claimed()).header.label).toBe("Extra workout");
    expect(view(withSchedule(null), { paused: true }).header.label).toBe("Done while paused");
  });
});

describe("title and meta", () => {
  test("shows the workout name and its numbers in the user's unit", () => {
    const v = view(claimed());
    expect(v.title).toBe("Push day complete");
    expect(v.meta).toBe("58 min · 18 working sets · 14,321 lb");
    expect(view(claimed(), { unit: "kg" }).meta).toBe("58 min · 18 working sets · 6,496 kg");
  });

  test("a missing summary still gives a usable screen", () => {
    const v = view(claimed(), { summary: null });
    expect(v.title).toBe("Workout complete");
    expect(v.meta).toBe("");
  });

  test("durations over an hour", () => {
    expect(durationLabel(61 * 60_000)).toBe("1 h 01 min");
    expect(durationLabel(10_000)).toBe("1 min");
  });
});

describe("coins", () => {
  test("base, scheduled bonus, total and the daily cap", () => {
    const c = view(claimed()).coins!;
    expect(c.rows).toEqual([
      { label: "Workout", value: "50" },
      { label: "Scheduled-day bonus", value: "+25" },
    ]);
    expect(c.total).toBe("+75");
    expect(c.cap).toBe("75 of 150 daily cap used");
  });

  test("a capped payout shows what was held back", () => {
    const capped = { base: 50, scheduledBonus: 25, capped: 25, total: 50, balance: 1, usedToday: 150, dailyCap: 150 };
    const c = view(claimed({ coins: capped })).coins!;
    expect(c.rows.at(-1)).toEqual({ label: "Held back by daily cap", value: "−25" });
    expect(c.total).toBe("+50");
    expect(c.cap).toBe("150 of 150 daily cap used");
  });

  test("no bonus row without a bonus", () => {
    const plain = { base: 50, scheduledBonus: 0, capped: 0, total: 50, balance: 1, usedToday: 50, dailyCap: COINS.dailyCap };
    expect(view(claimed({ coins: plain })).coins!.rows).toEqual([{ label: "Workout", value: "50" }]);
  });

  test("claims from before the cap was reported have no cap line", () => {
    const old = claimed({ coins: { base: 50, scheduledBonus: 0, capped: 0, total: 50, balance: 1 } });
    expect(view(old).coins!.cap).toBeNull();
  });
});

describe("xp bar", () => {
  test("the new segment starts where the old bar ended", () => {
    const x = view(claimed({ xp: { workout: 20, stats: 80, total: 100, balance: 6760 } })).xp!;
    // 500 XP per level: 6760 is 260 into level 14, so the bar was at 160.
    expect(x.gained).toBe(100);
    expect(x.label).toBe("Level 14 · 260 / 500");
    expect(x.basePct).toBeCloseTo(32);
    expect(x.addedPct).toBeCloseTo(20);
    expect(x.levelUp).toBeNull();
  });

  test("crossing a level fills from zero and says so", () => {
    const x = view(claimed({ xp: { workout: 20, stats: 80, total: 100, balance: 1050 } })).xp!;
    // 950 before (level 2, 450 in), 1050 after (level 3, 50 in).
    expect(x.levelUp).toBe("Level 2 → 3");
    expect(x.basePct).toBe(0);
    expect(x.addedPct).toBeCloseTo(10);
  });

  test("quest XP counts toward the gain", () => {
    const quests = [{ id: "s0r0", title: "Arms", before: 8, after: 12, target: 12, paid: { coins: 30, xp: 25 } }];
    expect(view(claimed({ quests })).xp!.gained).toBe(45);
  });

  test("says when workout XP was held back, and when it is next paid", () => {
    const held = claimed({ xp: { workout: 0, stats: 0, total: 0, balance: 6760 } });
    // now is 13:00 UTC; the last payout at 11:00 makes the next one 23:00 the same day.
    expect(view(held, { workoutXpAt: T0 - 3600_000 }).xp!.note).toBe(
      "Workout XP is paid once every 12 hours. Next at 11:00 PM.",
    );
    expect(view(held).xp!.note).toBe("Workout XP is paid once every 12 hours.");
    expect(view(claimed()).xp!.note).toBeNull();
  });

  test("a later day shows the weekday", () => {
    const held = claimed({ xp: { workout: 0, stats: 0, total: 0, balance: 6760 } });
    // Last payout Wed 12:00 + 12 h = Thu 00:00.
    expect(view(held, { workoutXpAt: T0 }).xp!.note).toContain("Next at Thu 12:00 AM");
  });
});

describe("stat changes", () => {
  test("lists only the stats that moved, biggest first, as from → to", () => {
    const before = stats({ chest: 62, arms: 39.4, back: 30 });
    const after = stats({ chest: 64.1, arms: 40, back: 30 });
    const v = view(claimed({ stats: { before, after } }));
    expect(v.stats).toEqual([
      { name: "Chest", from: "62", to: "64.1", delta: "+2.1" },
      { name: "Arms", from: "39.4", to: "40", delta: "+0.6" },
    ]);
  });

  test("a drop is shown with a minus", () => {
    const v = view(claimed({ stats: { before: stats({ legs: 50 }), after: stats({ legs: 49 }) } }));
    expect(v.stats).toEqual([{ name: "Legs", from: "50", to: "49", delta: "−1" }]);
  });

  test("calibrating shows no changes (the stats are averages)", () => {
    const v = view(claimed({ calibrating: true, stats: { before: stats(), after: stats({ chest: 70 }) } }));
    expect(v.calibrating).toBe(true);
    expect(v.stats).toEqual([]);
  });
});

describe("1RM line", () => {
  const oneRm = [{ stat: "chest" as const, exerciseId: BENCH, weightKg: 100, reps: 5, bonusDelta: 1 }];

  test("is in the user's unit", () => {
    expect(view(claimed({ oneRm })).oneRm).toEqual(["Bench Press 220.46 lb × 5 beat your estimate · Chest bonus +1"]);
    expect(view(claimed({ oneRm }), { unit: "kg" }).oneRm).toEqual([
      "Bench Press 100 kg × 5 beat your estimate · Chest bonus +1",
    ]);
  });

  test("falls back for an exercise it can't name, and is absent on old claims", () => {
    expect(view(claimed({ oneRm: [{ ...oneRm[0], exerciseId: "gone" }] }), { unit: "kg" }).oneRm[0]).toMatch(/^Lift 100 kg/);
    expect(view(claimed()).oneRm).toEqual([]);
  });
});

describe("quests", () => {
  test("bars show the old and the new part, and the reward when paid", () => {
    const quests = [
      { id: "s0r0", title: "The Neglected Limb", before: 4, after: 7, target: 12, paid: null },
      { id: "s2r0", title: "Three days", before: 2, after: 3, target: 3, paid: { coins: 40, xp: 25 } },
    ];
    const [a, b] = view(claimed({ quests })).quests;
    expect(a).toMatchObject({ label: "7 / 12", done: false, reward: null });
    expect(a.basePct).toBeCloseTo(33.3, 0);
    expect(a.addedPct).toBeCloseTo(25);
    expect(b).toMatchObject({ label: "3 / 3", done: true, reward: "+40 coins · +25 XP" });
  });

  test("progress past the target stays on the bar", () => {
    const q = view(claimed({ quests: [{ id: "x", title: "t", before: 11, after: 15, target: 12, paid: null }] })).quests[0];
    expect(q.label).toBe("12 / 12");
    expect(q.basePct + q.addedPct).toBeCloseTo(100);
  });

  test("old claims have none", () => {
    expect(view(claimed()).quests).toEqual([]);
  });
});

describe("titles and scrap", () => {
  test("a title this claim earned gets a line with its bonus", () => {
    expect(view(claimed({ titles: ["regular", "unbroken"] })).titles).toEqual([
      "Title earned: Regular (+3% battle power)",
      "Title earned: Unbroken (+5% battle power)",
    ]);
  });

  test("none earned, or a claim from before titles, shows nothing", () => {
    expect(view(claimed({ titles: [] })).titles).toEqual([]);
    expect(view(claimed()).titles).toEqual([]);
  });

  test("scrap paid by finished quests", () => {
    expect(view(claimed({ scrap: { earned: 10, balance: 40 } })).scrap).toBe("+10 scrap");
    expect(view(claimed({ scrap: { earned: 0, balance: 40 } })).scrap).toBeNull();
    expect(view(claimed()).scrap).toBeNull();
  });
});

describe("not counted", () => {
  test("shows how close it was", () => {
    const v = view({ status: "not-counted", reason: "too-few-sets", workingSets: 3, required: 4 });
    expect(v.counted).toBe(false);
    expect(v.header.label).toBe("Not counted");
    expect(v.title).toBe("Push day");
    expect(v.notCounted?.headline).toBe("3 of 4 working sets");
    expect(v.coins).toBeNull();
    expect(v.xp).toBeNull();
  });

  test("a workout dated in the future", () => {
    const v = view({ status: "not-counted", reason: "future", workingSets: 6, required: 4 });
    expect(v.notCounted?.headline).toBe("Starts too far ahead");
  });
});

describe("an already-claimed response", () => {
  test("renders like a fresh claim", () => {
    const v = view({ status: "already-claimed", result: result() });
    expect(v.counted).toBe(true);
    expect(v.coins?.total).toBe("+75");
  });
});
