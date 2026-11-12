import { describe, expect, test } from "vitest";
import { fightReport, MONTH_MS, reportLines, type ReportPlayer } from "./fightReport";
import type { FightMode } from "./fights";
import { DAY, T0 } from "./test-helpers";
import type { FightRecord } from "../server/fights";

const round = (foe: string, key: number, won: boolean, { power = 100, seconds = 10, end }: { power?: number; seconds?: number; end?: "enrage" } = {}) => ({
  key,
  foe,
  bossId: null,
  power,
  minimums: null,
  result: {
    won,
    end: won ? ("foe-down" as const) : (end ?? ("hero-down" as const)),
    seconds,
    heroHpLeft: 1,
    foeHpLeft: 0,
    stats: { dealt: 1, taken: 1, absorbed: 0, healed: 0, crits: 0 },
    log: [],
  },
});

const fight = (mode: FightMode, at: number, rounds: ReturnType<typeof round>[], patch: Partial<FightRecord> = {}): FightRecord => ({
  mode,
  at,
  seed: "s",
  classId: "striker",
  heroPower: 150,
  rounds,
  won: rounds.some((r) => r.result.won),
  coins: 0,
  scrap: 0,
  mythicCores: 0,
  items: [],
  guaranteed: false,
  ...patch,
});

describe("fightReport (13.24)", () => {
  const alice: ReportPlayer = {
    uid: "alice",
    startedAt: T0,
    fights: [
      fight("campaign", T0 + DAY, [round("Rust Rat", 1, true, { seconds: 8 })], { coins: 20, scrap: 3 }),
      fight("campaign", T0 + DAY + 1, [round("Rust Rat", 1, false, { seconds: 12, power: 300 })]),
      fight("endless", T0 + 2 * DAY, [
        round("Tower Sentinel (floor 1)", 1, true),
        round("Tower Sentinel (floor 2)", 2, true),
        round("Tower Stalker (floor 3)", 3, false, { end: "enrage" }),
      ], {
        coins: 60,
        items: [{ id: "i", baseId: "ironbound-boots", rarity: "common", itemLevel: 3 }],
        salvaged: [
          { baseId: "ironbound-boots", rarity: "common", itemLevel: 3, scrap: 3 },
          { baseId: "ironbound-boots", rarity: "common", scrap: 5 },
        ],
      }),
      fight("weekly", T0 + MONTH_MS, [round("Vexa", 1, false)]),
      fight("weekly", T0 + 2 * MONTH_MS, [round("Vexa", 1, true)], { coins: 100, mythicCores: 1 }),
      fight("weekly", T0 + 3 * MONTH_MS, [round("Vexa", 1, true)], { coins: 100 }),
      fight("weekly", T0 + 4 * MONTH_MS, [round("Ironmaw", 2, true)], { coins: 200 }),
    ],
  };
  const bob: ReportPlayer = { uid: "bob", startedAt: T0, fights: [fight("weekly", T0 + 4 * MONTH_MS, [round("Vexa", 1, true)], { coins: 100 })] };
  const carol: ReportPlayer = { uid: "carol", startedAt: null, fights: [fight("weekly", T0 + DAY, [round("Vexa", 1, true)])] };
  const idle: ReportPlayer = { uid: "idle", startedAt: T0, fights: [] };
  const report = fightReport([alice, bob, carol, idle]);

  test("totals count only players who fought", () => {
    expect(report).toMatchObject({ players: 3, fights: 9, from: T0 + DAY, to: T0 + 4 * MONTH_MS });
    expect(fightReport([idle])).toMatchObject({ players: 0, fights: 0, from: null, to: null, byMode: [], byFoe: [], weeklyTiers: [], income: [] });
  });

  test("by mode: a climb is one fight; wins, pay, items kept and auto-salvaged drops", () => {
    expect(report.byMode.map((r) => r.mode)).toEqual(["campaign", "endless", "weekly"]);
    expect(report.byMode[0]).toMatchObject({ fights: 2, wins: 1, winRate: 0.5, coins: 20, scrap: 3 });
    // The pre-rework duplicate (no item level) is not an auto-salvage.
    expect(report.byMode[1]).toMatchObject({ fights: 1, wins: 1, winRate: 1, coins: 60, items: 1, autoSalvaged: 1 });
    expect(report.byMode[2]).toMatchObject({ fights: 6, wins: 5, coins: 500, mythicCores: 1 });
  });

  test("by enemy: every round counts, endless enemies are one row per type, losses split by how they ended", () => {
    expect(report.byFoe.map((r) => `${r.mode}:${r.foe}`)).toEqual([
      "campaign:Rust Rat",
      "endless:Tower Sentinel",
      "endless:Tower Stalker",
      "weekly:Vexa",
      "weekly:Ironmaw",
    ]);
    const rat = report.byFoe[0];
    expect(rat).toMatchObject({ rounds: 2, wins: 1, winRate: 0.5, fell: 1, enraged: 0, keys: [1, 1] });
    expect(rat.seconds).toBeCloseTo(10);
    // Hero power 150 against 100 and against 300: 1.5 and 0.5.
    expect(rat.powerRatio).toBeCloseTo(1);
    expect(report.byFoe[1]).toMatchObject({ rounds: 2, wins: 2, keys: [1, 2] });
    expect(report.byFoe[2]).toMatchObject({ rounds: 1, wins: 0, fell: 0, enraged: 1, keys: [3, 3] });
    expect(report.byFoe[3]).toMatchObject({ rounds: 5, wins: 4, fell: 1 });
  });

  test("weekly tiers: months from the start of the game to the first win, per player", () => {
    // Tier 1: alice at 2 months (her loss at 1 doesn't count), bob at 4; carol won too but has no start date.
    expect(report.weeklyTiers[0]).toMatchObject({ tier: 1, players: 3 });
    expect(report.weeklyTiers[0].months!.min).toBeCloseTo(2);
    expect(report.weeklyTiers[0].months!.median).toBeCloseTo(3);
    expect(report.weeklyTiers[0].months!.max).toBeCloseTo(4);
    expect(report.weeklyTiers[1]).toMatchObject({ tier: 2, players: 1 });
    expect(report.weeklyTiers[1].months!.median).toBeCloseTo(4);
    expect(fightReport([carol]).weeklyTiers).toEqual([{ tier: 1, players: 1, months: null }]);
  });

  test("income: fight coins per week between the first and last fight, at least a week", () => {
    const a = report.income.find((r) => r.uid === "alice")!;
    expect(a).toMatchObject({ fights: 7, coins: 480, fightDays: 6 });
    expect(a.weeks).toBeCloseTo((4 * MONTH_MS - DAY) / (7 * DAY));
    expect(a.coinsPerWeek).toBeCloseTo(480 / a.weeks);
    // One fight: a week, not zero.
    expect(report.income.find((r) => r.uid === "bob")).toMatchObject({ coins: 100, weeks: 1, coinsPerWeek: 100, fightDays: 1 });
    expect(report.income.map((r) => r.uid)).toEqual(["bob", "alice", "carol"]);
  });

  test("prints as text, and says so when there is nothing", () => {
    const lines = reportLines(report);
    expect(lines[0]).toMatch(/^9 fights by 3 players, 2026-10-15 to \d{4}-\d{2}-\d{2}\.$/);
    expect(lines.join("\n")).toContain("Tower Sentinel");
    expect(lines.find((l) => l.startsWith("Rust Rat"))).toMatch(/Campaign\s+stage 1\s+2\s+50%\s+1\s+0\s+10\.0\s+100%$/);
    expect(lines.find((l) => l.startsWith("Tower Sentinel"))).toContain("floor 1-2");
    expect(lines.find((l) => /^1\s+3\s/.test(l))).toMatch(/2\.0\s+3\.0\s+4\.0$/);
    expect(reportLines(fightReport([carol])).join("\n")).toMatch(/1\s+1\s+\?\s+\?\s+\?/);
    expect(reportLines(fightReport([]))).toEqual(["No stored fights."]);
  });
});
