import { describe, expect, test } from "vitest";
import { BOSS_TYPES, CAMPAIGN_CHAPTERS, TOWER_BOSSES, WEEKLY_BOSSES } from "./bossData";
import {
  bossTowerDropTier,
  bossTowerEncounter,
  CAMPAIGN_STAGES,
  campaignEncounter,
  checkMinimums,
  mechanicsOf,
  minimumNeeded,
  towerEncounter,
  weeklyBoss,
  weeklyEncounter,
  weeklyTier,
} from "./bosses";
import { BOSS_TOWER, STATS, WEEKLY_BOSS, type Stat } from "./config";
import { simulatePacing, typicalStats } from "./pacing";
import { power as power_, type StatLine } from "./score";
import { addDays } from "./time";

const statLine = (value: number, over: Partial<Record<(typeof STATS)[number], number>> = {}): StatLine =>
  Object.fromEntries(STATS.map((s) => [s, over[s] ?? value])) as StatLine;

describe("the boss list", () => {
  const all = [...WEEKLY_BOSSES, ...TOWER_BOSSES, ...CAMPAIGN_CHAPTERS.map((c) => c.boss)];

  test("has 12 weekly bosses, 30 tower bosses and 5 chapter bosses, all different", () => {
    expect(WEEKLY_BOSSES).toHaveLength(12);
    expect(TOWER_BOSSES).toHaveLength(BOSS_TOWER.floors);
    expect(CAMPAIGN_CHAPTERS).toHaveLength(5);
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
    expect(new Set(all.map((b) => b.name)).size).toBe(all.length);
  });

  test("every boss has a known type, a description and sensible minimums", () => {
    for (const b of all) {
      expect(Object.keys(BOSS_TYPES)).toContain(b.type);
      expect(b.epithet.length).toBeGreaterThan(5);
      for (const share of Object.values(b.minimums ?? {})) {
        expect(share).toBeGreaterThan(0);
        expect(share).toBeLessThanOrEqual(1);
      }
    }
  });

  test("a boss's tweaks override its type's mechanics", () => {
    const halvard = WEEKLY_BOSSES.find((b) => b.id === "halvard")!;
    expect(mechanicsOf(halvard).heavy).toMatchObject({ multiplier: 2.4 });
    expect(mechanicsOf(halvard).atk).toBe(BOSS_TYPES.brute.atk);
  });
});

describe("the weekly boss", () => {
  test("changes every week, the same for everyone, and repeats every 12 weeks", () => {
    const week = "2026-10-25";
    const twelve = Array.from({ length: 12 }, (_, i) => weeklyBoss(addDays(week, 7 * i)).id);
    expect(new Set(twelve).size).toBe(12);
    expect(weeklyBoss(addDays(week, 7 * 12)).id).toBe(twelve[0]);
    expect(weeklyBoss(week)).toBe(weeklyBoss(week));
  });

  test("tier is the highest the level allows whose power is within reach", () => {
    expect(weeklyTier(1, 0)).toBe(1);
    expect(weeklyTier(100, 10_000)).toBe(5);
    // Power enough for tier 5 but level only 60: tier 3.
    expect(weeklyTier(60, 10_000)).toBe(3);
    // Level enough for everything but power only for tier 2 (within tierPowerShare).
    expect(weeklyTier(100, WEEKLY_BOSS.tierPower[1] * WEEKLY_BOSS.tierPowerShare)).toBe(2);
    expect(weeklyTier(100, WEEKLY_BOSS.tierPower[1] * WEEKLY_BOSS.tierPowerShare - 1)).toBe(1);
  });

  test("the encounter is the week's boss at the tier's recommended power", () => {
    const e = weeklyEncounter("2026-10-25", 3);
    expect(e.power).toBe(WEEKLY_BOSS.tierPower[2]);
    expect(e.boss?.id).toBe(weeklyBoss("2026-10-25").id);
    expect(e.foe.name).toBe(e.boss?.name);
  });
});

describe("towers and the Campaign", () => {
  test("endless tower floors get stronger, with a Stalker every 5th and a Warden every 10th", () => {
    expect(towerEncounter(2).power).toBeGreaterThan(towerEncounter(1).power);
    expect(towerEncounter(1).foe.name).toMatch(/Sentinel/);
    expect(towerEncounter(5).foe.bleed).not.toBeNull();
    expect(towerEncounter(10).foe.heavy).not.toBeNull();
  });

  test("the Boss Tower has one boss per floor and ends at the top", () => {
    expect(bossTowerEncounter(1)?.boss?.id).toBe(TOWER_BOSSES[0].id);
    expect(bossTowerEncounter(30)?.boss?.id).toBe(TOWER_BOSSES[29].id);
    expect(bossTowerEncounter(31)).toBeNull();
    expect(bossTowerEncounter(2)!.power).toBeGreaterThan(bossTowerEncounter(1)!.power);
    expect([1, 6, 7, 30].map(bossTowerDropTier)).toEqual([1, 1, 2, 5]);
  });

  test("the Campaign has 60 stages with a chapter boss every 12th", () => {
    expect(CAMPAIGN_STAGES).toBe(60);
    expect(campaignEncounter(1)).toMatchObject({ chapter: 1, stageInChapter: 1, boss: null });
    expect(campaignEncounter(12)?.boss?.id).toBe("warden-kell");
    expect(campaignEncounter(13)).toMatchObject({ chapter: 2, stageInChapter: 1 });
    expect(campaignEncounter(60)?.boss?.id).toBe("king-molar");
    expect(campaignEncounter(61)).toBeNull();
    expect(campaignEncounter(0)).toBeNull();
  });
});

describe("boss minimums", () => {
  const power = 350;
  const needed = (share: number) => Math.ceil(share * typicalStats(power).legs);

  test("minimums follow a typically geared hero's stats at the boss's power, per stat", () => {
    const t = typicalStats(power);
    // Gear and bonuses carry part of the power, so the stats are below an ungeared hero's.
    expect(power_(t)).toBeLessThan(power);
    expect(t.core).toBeLessThan(t.back);
    expect(minimumNeeded("core", 0.8, power)).toBe(Math.ceil(0.8 * t.core));
    // Boss Tower's last floor asks for what the pacing player has when reaching its power.
    const top = bossTowerEncounter(30)!;
    const run = simulatePacing(520).find((w) => w.battle >= top.power)!;
    for (const [stat, share] of Object.entries(top.minimums) as [Stat, number][]) {
      expect(minimumNeeded(stat, share, top.power)).toBeLessThanOrEqual(Math.ceil(run.stats[stat]));
    }
  });

  test("met minimums allow the fight", () => {
    const c = checkMinimums({ minimums: { legs: 0.8 }, power, stats: statLine(60), heroPower: power });
    expect(c).toMatchObject({ allowed: true, overpowered: false });
    expect(c.rows).toEqual([{ stat: "legs", needed: needed(0.8), have: 60, met: true, waived: false }]);
  });

  test("an unmet minimum blocks the fight unless the hero has 20% more power", () => {
    const stats = statLine(60, { legs: 20 });
    expect(checkMinimums({ minimums: { legs: 0.8 }, power, stats, heroPower: power }).allowed).toBe(false);
    const strong = checkMinimums({ minimums: { legs: 0.8 }, power, stats, heroPower: power * 1.2 });
    expect(strong).toMatchObject({ allowed: true, overpowered: true, powerToOverride: Math.ceil(power * 1.2) });
  });

  test("an injured stat's minimum is waived", () => {
    const c = checkMinimums({ minimums: { legs: 0.8 }, power, stats: statLine(60, { legs: 5 }), heroPower: power, injured: ["legs"] });
    expect(c.allowed).toBe(true);
    expect(c.rows[0]).toMatchObject({ met: false, waived: true });
  });

  test("a boss without minimums is always allowed", () => {
    expect(checkMinimums({ minimums: {}, power, stats: statLine(0), heroPower: 1 }).allowed).toBe(true);
  });
});
