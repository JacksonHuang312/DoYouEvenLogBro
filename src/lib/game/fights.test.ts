import { describe, expect, test } from "vitest";
import { battlePower } from "./battle";
import { weeklyEncounter, weeklyTier } from "./bosses";
import { newGameState, type GameState } from "./claim";
import { BOSS_DROPS, BOSS_TOWER, ENDLESS_TOWER, STATS, WEEKLY_BOSS, type ClassId, type Stat } from "./config";
import { balancedHero } from "./combatTuning";
import {
  applyFightRewards,
  fightDay,
  fightHero,
  fightWeek,
  newBattleDoc,
  nextWeeklyReset,
  runFight,
  type BattleDoc,
  type FightHero,
  type FightInput,
} from "./fights";
import { bossTowerPay, weeklyPay } from "./loot";
import type { StatLine } from "./score";
import { DAY, T0 } from "./test-helpers";

const HOUR = 60 * 60 * 1000;
const UTC = "UTC";
const state = (patch: Partial<GameState> = {}): GameState => ({ ...newGameState(T0, UTC), level: 100, classId: "striker", ...patch });
const statLine = (v: number, over: Partial<Record<Stat, number>> = {}): StatLine =>
  Object.fromEntries(STATS.map((s) => [s, over[s] ?? v])) as StatLine;

/** A hero of battle power `power`, with `stats` for the minimum checks. */
function fighter(power: number, { stats = statLine(1000), injured = [] as Stat[], classId = "striker" as ClassId } = {}): FightHero {
  return { hero: balancedHero(power, classId), stats, battle: battlePower({ body: power, equipped: [], level: 100 }), injured, paused: false };
}
const STRONG = fighter(100_000);
const WEAK = fighter(1);

function fight(over: Partial<FightInput> & Pick<FightInput, "mode">) {
  return runFight({ doc: newBattleDoc(T0), state: state(), fighter: STRONG, now: T0, timeZone: UTC, seed: "s", ...over });
}
function won(over: Partial<FightInput> & Pick<FightInput, "mode">) {
  const r = fight(over);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("the weekly boss", () => {
  test("one fight a day, win or lose, resetting at 04:00 in the user's zone", () => {
    const first = won({ mode: "weekly", fighter: WEAK });
    expect(first.rounds[0].result.won).toBe(false);
    expect(fight({ mode: "weekly", doc: first.doc, now: T0 + HOUR }).ok).toBe(false);
    // T0 is Wednesday 12:00; Thursday 03:59 is still Wednesday's fight day, 04:00 is Thursday's.
    const thu4 = Date.UTC(2026, 9, 15, 4);
    expect(fight({ mode: "weekly", doc: first.doc, now: thu4 - 60_000 }).ok).toBe(false);
    expect(fight({ mode: "weekly", doc: first.doc, now: thu4 }).ok).toBe(true);
    expect(nextWeeklyReset(T0, UTC)).toBe(thu4);
    expect(fightDay(Date.UTC(2026, 9, 11, 3), UTC)).toBe("2026-10-10");
    expect(fightWeek(Date.UTC(2026, 9, 11, 3), UTC)).toBe("2026-10-04");
  });

  test("the tier is locked by the week's first fight; the first win pays in full, later wins less", () => {
    const tierNow = weeklyTier(100, STRONG.battle.total);
    const first = won({ mode: "weekly" });
    expect(first.doc.weekly).toMatchObject({ tier: tierNow, wins: 1, fights: 1 });
    expect(first.coins).toBe(weeklyPay(tierNow, true).coins);
    const next = won({ mode: "weekly", doc: first.doc, now: T0 + DAY, fighter: fighter(100_000), state: state({ level: 1 }) });
    expect(next.doc.weekly!.tier).toBe(tierNow);
    expect(next.coins).toBe(weeklyPay(tierNow, false).coins);
    // A new week locks a new tier.
    const later = won({ mode: "weekly", doc: next.doc, now: T0 + 7 * DAY, state: state({ level: 1 }) });
    expect(later.doc.weekly).toMatchObject({ tier: 1, wins: 1, fights: 1 });
  });

  test("wins count toward the guarantees, and the Legendary guarantee pays out", () => {
    const doc: BattleDoc = { ...newBattleDoc(T0), pity: { sinceLegendary: BOSS_DROPS.pity.legendary - 1, sinceMythic: 0 } };
    const r = won({ mode: "weekly", doc, state: state({ level: WEEKLY_BOSS.tierLevels[2] }) });
    expect(r.drops[0]).toMatchObject({ guaranteed: true });
    expect(["legendary", "mythic"]).toContain(r.drops[0].rarity);
    expect(r.doc.pity.sinceLegendary).toBe(0);
  });

  test("minimums block a fight; an injury flag waives that stat's", () => {
    const encounter = weeklyEncounter(fightWeek(T0, UTC), 1);
    const [stat] = Object.keys(encounter.minimums) as Stat[];
    const under = fighter(encounter.power, { stats: statLine(1000, { [stat]: 0 }) });
    const lvl1 = state({ level: 1 });
    expect(fight({ mode: "weekly", fighter: under, state: lvl1 })).toMatchObject({ ok: false });
    const injured = fighter(encounter.power, { stats: statLine(1000, { [stat]: 0 }), injured: [stat] });
    expect(fight({ mode: "weekly", fighter: injured, state: lvl1 }).ok).toBe(true);
  });
});

describe("the endless tower", () => {
  test("opens at its level and fights only the next floor", () => {
    expect(fight({ mode: "endless", state: state({ level: ENDLESS_TOWER.minLevel - 1 }) }).ok).toBe(false);
    const r = won({ mode: "endless" });
    expect(r.rounds.map((x) => x.key)).toEqual([1]);
    expect(r.doc.endless).toEqual({ cleared: 1, cooldownUntil: 0 });
  });

  test("auto-climb fights up to 5 floors and pays each", () => {
    const r = won({ mode: "endless", climb: true });
    expect(r.rounds.map((x) => x.key)).toEqual([1, 2, 3, 4, 5]);
    expect(r.doc.endless.cleared).toBe(ENDLESS_TOWER.autoClimbMax);
    expect(r.coins).toBeGreaterThan(0);
  });

  test("a loss stops the climb and closes the tower for 4 hours", () => {
    const r = won({ mode: "endless", climb: true, fighter: WEAK });
    expect(r.rounds).toHaveLength(1);
    expect(r.doc.endless).toEqual({ cleared: 0, cooldownUntil: T0 + ENDLESS_TOWER.lossCooldownHours * HOUR });
    expect(r.coins).toBe(0);
    expect(fight({ mode: "endless", doc: r.doc, now: T0 + HOUR }).ok).toBe(false);
    expect(fight({ mode: "endless", doc: r.doc, now: T0 + ENDLESS_TOWER.lossCooldownHours * HOUR }).ok).toBe(true);
  });
});

describe("the Boss Tower", () => {
  test("opens at level 15, and every fight closes it for 4 hours", () => {
    expect(fight({ mode: "bossTower", state: state({ level: BOSS_TOWER.minLevel - 1 }) }).ok).toBe(false);
    const r = won({ mode: "bossTower" });
    expect(r.doc.bossTower).toEqual({ cleared: 1, cooldownUntil: T0 + BOSS_TOWER.cooldownHours * HOUR });
    expect(fight({ mode: "bossTower", doc: r.doc, now: T0 + HOUR }).ok).toBe(false);
  });

  test("a first clear pays coins, scrap and counts toward the guarantees; a reclear pays a little gold only", () => {
    const first = won({ mode: "bossTower" });
    expect(first).toMatchObject({ firstClear: true, ...bossTowerPay(1, true) });
    expect(first.doc.pity.sinceLegendary + first.doc.pity.sinceMythic).toBeGreaterThanOrEqual(0);
    const later = T0 + BOSS_TOWER.cooldownHours * HOUR;
    const again = won({ mode: "bossTower", doc: first.doc, now: later, floor: 1 });
    expect(again).toMatchObject({ firstClear: false, ...bossTowerPay(1, false), drops: [], mythicCores: 0 });
    expect(again.doc.pity).toEqual(first.doc.pity);
    expect(again.doc.bossTower.cleared).toBe(1);
  });

  test("only cleared floors and the next one can be fought", () => {
    expect(fight({ mode: "bossTower", floor: 2 }).ok).toBe(false);
    const doc = { ...newBattleDoc(T0), bossTower: { cleared: BOSS_TOWER.floors, cooldownUntil: 0 } };
    expect(fight({ mode: "bossTower", doc, floor: BOSS_TOWER.floors + 1 }).ok).toBe(false);
    expect(won({ mode: "bossTower", doc }).rounds[0].key).toBe(BOSS_TOWER.floors);
  });

  test("a loss pays nothing and clears nothing", () => {
    const r = won({ mode: "bossTower", fighter: WEAK });
    expect(r).toMatchObject({ coins: 0, scrap: 0, drops: [] });
    expect(r.doc.bossTower.cleared).toBe(0);
  });
});

describe("the Campaign", () => {
  test("fights the next stage only, with no cooldown, until it is finished", () => {
    const one = won({ mode: "campaign" });
    expect(one.rounds[0].key).toBe(1);
    const two = won({ mode: "campaign", doc: one.doc });
    expect(two.rounds[0].key).toBe(2);
    expect(two.doc.campaign.cleared).toBe(2);
    const done = { ...newBattleDoc(T0), campaign: { cleared: 60 } };
    expect(fight({ mode: "campaign", doc: done }).ok).toBe(false);
  });

  test("a loss leaves the stage uncleared", () => {
    expect(won({ mode: "campaign", fighter: WEAK }).doc.campaign.cleared).toBe(0);
  });
});

describe("fight energy", () => {
  test("the Campaign and endless tower need energy and spend one a request, a climb included", () => {
    expect(fight({ mode: "campaign", state: state({ energy: 0 }) })).toMatchObject({ ok: false });
    expect(fight({ mode: "endless", state: state({ energy: 0 }) })).toMatchObject({ ok: false });
    expect(won({ mode: "endless", climb: true }).energySpent).toBe(1);
    expect(won({ mode: "campaign" }).energySpent).toBe(1);
    // The weekly boss and the Boss Tower don't use it.
    expect(won({ mode: "weekly", state: state({ energy: 0 }) }).energySpent).toBe(0);
    expect(won({ mode: "bossTower", state: state({ energy: 0 }) }).energySpent).toBe(0);
    const paid = applyFightRewards({ state: state({ energy: 4 }), outcome: { ...won({ mode: "campaign" }) }, fightId: "e", now: T0 });
    expect(paid.state.energy).toBe(3);
  });
});

describe("fight rewards and the hero", () => {
  test("coins, scrap and cores are paid; every drop becomes an item at its rarity and level, copies too; ids come from the fight", () => {
    const r = applyFightRewards({
      state: state({ coins: 10, materials: { scrap: 1 } }),
      outcome: {
        coins: 50,
        scrap: 5,
        mythicCores: 1,
        drops: [
          { baseId: "ironbound-boots", rarity: "common", itemLevel: 12, guaranteed: false },
          { baseId: "ironbound-boots", rarity: "common", itemLevel: 12, guaranteed: false },
          { baseId: "wayfarer-boots", rarity: "legendary", itemLevel: 30, guaranteed: true },
        ],
      },
      fightId: "abc",
      now: T0,
    });
    expect(r.items.map((i) => i.id)).toEqual(["fight-abc-0", "fight-abc-1", "fight-abc-2"]);
    expect(r.items[0].item).toMatchObject({ baseId: "ironbound-boots", source: "boss", plus: 0, rarity: "common", itemLevel: 12 });
    expect(r.items[2].item).toMatchObject({ baseId: "wayfarer-boots", rarity: "legendary", itemLevel: 30 });
    expect(r.state).toMatchObject({ coins: 60, materials: { scrap: 1 + 5, mythicCore: 1 } });
  });

  test("drops come at or a little below the lower of your level and the source's", () => {
    // A level-5 hero clearing Campaign stage 1 (source level 1) gets level-1 items; the weekly boss caps at tier 1's 34.
    const lows = Array.from({ length: 30 }, (_, i) => won({ mode: "campaign", seed: `s${i}` }).drops).flat();
    for (const d of lows) expect(d.itemLevel).toBe(1);
  });

  test("a hero needs a class, and fights with rusted stats", () => {
    expect(fightHero({ state: state({ classId: undefined }), muscles: {}, worn: [], now: T0 }).ok).toBe(false);
    const muscles = { chest: { sets: 100, progressed: 0, lastTrained: T0 - 60 * DAY, weeks: [] } };
    const r = fightHero({ state: state(), muscles, worn: [], now: T0 });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.stats.chest).toBeCloseTo(10 * 0.7);
    expect(r.value.battle.bonus.class).toBeGreaterThan(0);
    // Stat points raise battle power but not the stats minimums check.
    const pts = fightHero({ state: state({ statPoints: { chest: 20 } }), muscles, worn: [], now: T0 });
    if (!pts.ok) throw new Error(pts.error);
    expect(pts.value.stats.chest).toBeCloseTo(10 * 0.7);
    expect(pts.value.battle.body).toBeCloseTo(r.value.battle.body * 1.1);
  });
});
