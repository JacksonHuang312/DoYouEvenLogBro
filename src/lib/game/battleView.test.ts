import { describe, expect, test } from "vitest";
import {
  battleView,
  logLines,
  replayAt,
  replayRounds,
  resultView,
  timeLeft,
} from "./battleView";
import { classCards } from "./heroClass";
import { newGameState, type GameState } from "./claim";
import type { FightEvent } from "./combat";
import { BOSS_TOWER, ENDLESS_TOWER, ENERGY, STATS } from "./config";
import type { MusclesFacts } from "./facts";
import { newBattleDoc } from "./fights";
import { DAY, T0 } from "./test-helpers";
import type { FightRecord } from "../server/fights";

const HOUR = 60 * 60 * 1000;
const UTC = "UTC";

const state = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  level: 60,
  classId: "striker",
  coins: 1000,
  ...patch,
});
/** Plenty of points in every stat, trained yesterday: a hero that can meet any minimum. */
const strongMuscles = (): MusclesFacts =>
  ({
    chest: { sets: 30_000, progressed: 0, lastTrained: T0 - DAY, weeks: [] },
    lats: { sets: 30_000, progressed: 0, lastTrained: T0 - DAY, weeks: [] },
    shoulders: {
      sets: 30_000,
      progressed: 0,
      lastTrained: T0 - DAY,
      weeks: [],
    },
    triceps: { sets: 30_000, progressed: 0, lastTrained: T0 - DAY, weeks: [] },
    quadriceps: {
      sets: 30_000,
      progressed: 0,
      lastTrained: T0 - DAY,
      weeks: [],
    },
    abdominals: {
      sets: 30_000,
      progressed: 0,
      lastTrained: T0 - DAY,
      weeks: [],
    },
  }) as MusclesFacts;
const view = (over: Partial<Parameters<typeof battleView>[0]> = {}) =>
  battleView({
    state: state(),
    battle: null,
    muscles: strongMuscles(),
    inventory: [],
    now: T0,
    timeZone: UTC,
    ...over,
  });

describe("battleView", () => {
  test("without a class there is a picker and no fights", () => {
    const v = view({ state: state({ classId: undefined }) });
    expect(v).toMatchObject({ classId: null, cards: [], power: null });
    expect(v.classes.map((c) => c.id)).toEqual([
      "vanguard",
      "striker",
      "cleric",
    ]);
    expect(classCards()[2]).toMatchObject({
      skill: "Mend",
      ultimate: "Radiance",
    });
  });

  test("four cards, in order, each with the next enemy and the server's own verdict", () => {
    const v = view();
    expect(v.cards.map((c) => c.mode)).toEqual([
      "weekly",
      "endless",
      "bossTower",
      "campaign",
    ]);
    expect(v.cards.every((c) => c.enabled && c.reason == null)).toBe(true);
    const [weekly, endless, tower, campaign] = v.cards;
    expect(weekly.facts[0]).toMatch(/^Tier \d \(locked for the week\)$/);
    expect(endless.foe).toMatch(/floor 1/);
    expect(tower.floors).toEqual([
      { floor: 1, boss: "Gatewatch Brann", reclear: false },
    ]);
    expect(campaign.facts[0]).toBe("Chapter 1, stage 1 of 12");
    expect(endless.canClimb).toBe(true);
    expect(endless.energy).toBe(1);
    expect(weekly.energy).toBe(0);
  });

  test("a fought weekly boss says when it opens again", () => {
    const doc = {
      ...newBattleDoc(T0),
      weekly: {
        weekId: "2026-10-11",
        tier: 3,
        wins: 1,
        fights: 1,
        lastFightDay: "2026-10-14",
      },
    };
    const weekly = view({ battle: doc }).cards[0];
    expect(weekly).toMatchObject({ enabled: false });
    expect(weekly.reason).toMatch(/fought this week's boss today/);
    expect(weekly.facts.at(-1)).toMatch(/^Next fight in /);
    expect(weekly.facts[0]).toBe("Tier 3 (locked for the week)");
  });

  test("cooldowns and energy turn the right buttons off, with the reason", () => {
    const doc = {
      ...newBattleDoc(T0),
      endless: { cleared: 3, cooldownUntil: T0 + 2 * HOUR },
      bossTower: { cleared: 2, cooldownUntil: T0 + HOUR },
    };
    const [, endless, tower] = view({ battle: doc }).cards;
    expect(endless).toMatchObject({ enabled: false, canClimb: false });
    expect(endless.reason).toMatch(/2 hours/);
    expect(endless.facts[0]).toBe("Floor 4 next (3 cleared)");
    expect(tower.enabled).toBe(false);
    expect(tower.floors.map((f) => f.reclear)).toEqual([true, true, false]);
    const noEnergy = view({ state: state({ energy: 0 }) }).cards;
    expect(noEnergy[1]).toMatchObject({ enabled: false });
    expect(noEnergy[1].reason).toMatch(/energy/);
    expect(noEnergy[3].enabled).toBe(false);
    expect(noEnergy[0].enabled).toBe(true);
  });

  test("gates show up as reasons", () => {
    const low = view({ state: state({ level: 1 }) }).cards;
    expect(low[1].reason).toMatch(
      new RegExp(`level ${ENDLESS_TOWER.minLevel}`),
    );
    expect(low[2].reason).toMatch(new RegExp(`level ${BOSS_TOWER.minLevel}`));
    expect(low[0].enabled).toBe(true);
  });

  test("an unmet minimum shows have and needed, and blocks the fight", () => {
    const weak: MusclesFacts = {
      chest: { sets: 10, progressed: 0, lastTrained: T0 - DAY, weeks: [] },
    } as MusclesFacts;
    const tower = view({
      muscles: weak,
      state: state({ level: 100 }),
      battle: {
        ...newBattleDoc(T0),
        bossTower: { cleared: 29, cooldownUntil: 0 },
      },
    }).cards[2];
    expect(tower.minimums.length).toBeGreaterThan(0);
    expect(tower.minimums.some((m) => !m.met && !m.waived)).toBe(true);
    expect(tower.enabled).toBe(false);
    expect(tower.reason).toMatch(/minimums/);
  });

  test("energy, points and the class switch", () => {
    const v = view({
      state: state({
        level: 11,
        energy: 4,
        statPoints: { legs: 4 },
        classSwitchedAt: T0 - DAY,
      }),
    });
    expect(v).toMatchObject({ energy: 4, energyMax: ENERGY.max });
    expect(v.points).toMatchObject({ free: 6, spent: 4 });
    expect(v.points.perStat.find((p) => p.stat === "legs")).toMatchObject({
      points: 4,
      boostPct: 2,
    });
    expect(v.points.perStat).toHaveLength(STATS.length);
    expect(v.classSwitch).toMatchObject({ enabled: false });
    expect(v.classSwitch.reason).toMatch(
      /Next switch in 6 d|Next switch in 1\d\d h/,
    );
    expect(view({ state: state({ coins: 0 }) }).classSwitch.reason).toBe(
      "Not enough coins",
    );
    expect(view().classSwitch).toMatchObject({ enabled: true, reason: null });
  });
});

describe("timeLeft", () => {
  test("hours and minutes", () => {
    expect(timeLeft(0)).toBe("under a minute");
    expect(timeLeft(45 * 60_000)).toBe("45 m");
    expect(timeLeft(3 * HOUR + 20 * 60_000)).toBe("3 h 20 m");
    expect(timeLeft(2 * HOUR)).toBe("2 h");
  });
});

describe("log lines", () => {
  test("read like a sentence, in time order", () => {
    const events: FightEvent[] = [
      { t: 0.9, actor: "hero", action: "attack", amount: 120.4 },
      { t: 1.5, actor: "foe", action: "attack", amount: 80, crit: true },
      {
        t: 3,
        actor: "hero",
        action: "skill",
        name: "Power Strike",
        amount: 260,
      },
      { t: 4, actor: "foe", action: "telegraph" },
      { t: 7, actor: "foe", action: "heavy", amount: 400 },
      { t: 8, actor: "hero", action: "heal", name: "Mend", amount: 300 },
      { t: 9, actor: "foe", action: "down" },
    ];
    expect(logLines(events, "Ironmaw").map((l) => `${l.t} ${l.text}`)).toEqual([
      "0.9s You hit Ironmaw for 120",
      "1.5s Ironmaw hits you for 80 (critical)",
      "3.0s Power Strike: 260",
      "4.0s Ironmaw winds up a heavy blow",
      "7.0s Ironmaw lands a heavy blow for 400",
      "8.0s Mend: you heal 300",
      "9.0s Ironmaw is down",
    ]);
  });
});

describe("result view", () => {
  const round = (won: boolean, foe = "Tower Sentinel (floor 1)") => ({
    key: 1,
    foe,
    bossId: null,
    power: 120,
    minimums: null,
    result: {
      won,
      end: won ? ("foe-down" as const) : ("hero-down" as const),
      seconds: 12.3,
      heroHpLeft: 1,
      foeHpLeft: 0,
      stats: { dealt: 1, taken: 1, absorbed: 0, healed: 0, crits: 0 },
      log: [],
    },
  });
  const record = (patch: Partial<FightRecord> = {}): FightRecord => ({
    mode: "campaign",
    at: T0,
    seed: "s",
    classId: "striker",
    heroPower: 150.2,
    rounds: [round(true)],
    won: true,
    coins: 40,
    scrap: 6,
    mythicCores: 0,
    items: [{ id: "i1", baseId: "ironbound-boots", rarity: "common" }],
    salvaged: [{ baseId: "ironbound-boots", rarity: "common", scrap: 5 }],
    guaranteed: false,
    ...patch,
  });

  test("a win lists rewards, the item and the duplicate turned to scrap", () => {
    const r = resultView(record());
    expect(r).toMatchObject({
      won: true,
      headline: "Victory",
      best: "common",
      guaranteed: false,
    });
    expect(r.rewards).toEqual([
      { label: "Coins", value: "+40" },
      { label: "Scrap", value: "+6" },
    ]);
    expect(r.items).toEqual([
      { id: "i1", name: "Ironbound Boots", rarity: "common" },
    ]);
    expect(r.salvaged[0]).toMatch(/duplicate.*5 scrap/);
    expect(r.rounds[0]).toMatchObject({
      won: true,
      ended: "Defeated it",
      power: "150 vs 120",
      seconds: "12.3s",
    });
  });

  test("a loss and a stopped climb", () => {
    const loss = resultView(
      record({
        won: false,
        rounds: [round(false)],
        coins: 0,
        scrap: 0,
        items: [],
        salvaged: [],
      }),
    );
    expect(loss).toMatchObject({ headline: "Defeat", best: null, rewards: [] });
    expect(loss.rounds[0].ended).toBe("You fell");
    const climb = resultView(
      record({
        mode: "endless",
        rounds: [round(true), round(true), round(false)],
      }),
    );
    expect(climb).toMatchObject({
      headline: "Climb stopped",
      sub: "Endless tower · 2 of 3 floors cleared",
    });
  });

  test("the best rarity sets how big the reveal is, and a guarantee is flagged", () => {
    const r = resultView(
      record({
        items: [{ id: "i", baseId: "unbroken-helmet", rarity: "mythic" }],
        salvaged: [],
        guaranteed: true,
        mythicCores: 1,
      }),
    );
    expect(r).toMatchObject({ best: "mythic", guaranteed: true });
    expect(r.rewards.at(-1)).toEqual({ label: "Mythic Core", value: "+1" });
  });
});

describe("replay view", () => {
  const events: FightEvent[] = [
    { t: 1.5, actor: "hero", action: "attack", amount: 40, hh: 100, fh: 160 },
    { t: 3, actor: "foe", action: "attack", amount: 25, hh: 75, fh: 160 },
    { t: 4.5, actor: "hero", action: "attack", amount: 160, hh: 75, fh: 0 },
    { t: 4.5, actor: "foe", action: "down", hh: 75, fh: 0 },
  ];
  const rounds = (
    log: FightEvent[],
    max = { heroMaxHp: 100, foeMaxHp: 200 },
  ) => [
    {
      key: 1,
      foe: "Ironmaw",
      bossId: "ironmaw",
      power: 120,
      minimums: null,
      result: {
        won: true,
        end: "foe-down" as const,
        seconds: 4.5,
        heroHpLeft: 75,
        foeHpLeft: 0,
        ...max,
        stats: { dealt: 1, taken: 1, absorbed: 0, healed: 0, crits: 0 },
        log,
      },
    },
  ];

  test("each event becomes a line with both sides' health after it", () => {
    const [r] = replayRounds(rounds(events))!;
    expect(r).toMatchObject({
      foe: "Ironmaw",
      heroMax: 100,
      foeMax: 200,
      seconds: 4.5,
    });
    expect(r.events[1]).toMatchObject({
      text: "Ironmaw hits you for 25",
      hh: 75,
      fh: 160,
    });
  });

  test("fights stored before health was recorded have no replay", () => {
    expect(
      replayRounds(
        rounds(
          events.map((e) => ({ t: e.t, actor: e.actor, action: e.action })),
        ),
      ),
    ).toBeNull();
    expect(replayRounds(rounds(events, {} as never))).toBeNull();
  });

  test("health follows the clock, and starts full", () => {
    const [r] = replayRounds(rounds(events))!;
    expect(replayAt(r, 0)).toEqual({ hh: 100, fh: 200, lines: [] });
    expect(replayAt(r, 3.2)).toMatchObject({ hh: 75, fh: 160 });
    expect(replayAt(r, 3.2).lines).toEqual([
      "You hit Ironmaw for 40",
      "Ironmaw hits you for 25",
    ]);
    expect(replayAt(r, 99)).toMatchObject({ hh: 75, fh: 0 });
    expect(replayAt(r, 99, 2).lines).toEqual([
      "You hit Ironmaw for 160",
      "Ironmaw is down",
    ]);
  });
});
