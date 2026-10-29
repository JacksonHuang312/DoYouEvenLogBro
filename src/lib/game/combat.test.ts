import { describe, expect, test } from "vitest";
import { battlePower } from "./battle";
import { BOSS_TYPES } from "./bossData";
import { attributePoints, buildFoe, buildHero, simulateFight, type Hero } from "./combat";
import { balancedHero, winRate } from "./combatTuning";
import { CLASS_IDS, COMBAT, SKILLS, STATS, type ClassId } from "./config";
import { NO_EFFECTS, type GearEffects } from "./effects";
import type { StatLine } from "./score";

const RUNS = 300;
const statLine = (value: number, over: Partial<Record<(typeof STATS)[number], number>> = {}): StatLine =>
  Object.fromEntries(STATS.map((s) => [s, over[s] ?? value])) as StatLine;
const withEffects = (e: Partial<GearEffects>): GearEffects => ({ ...NO_EFFECTS, ...e });

describe("building the hero", () => {
  test("attribute points add up to battle power", () => {
    const stats = statLine(60);
    const battle = battlePower({ body: 60 * 5.5, equipped: [], level: 10, titlePct: 0.05 });
    const pts = attributePoints(stats, battle);
    expect(pts.hp + pts.atk + pts.def).toBeCloseTo(battle.total, 6);
  });

  test("classes weight the same stats differently", () => {
    const [v, s, c] = (["vanguard", "striker", "cleric"] as ClassId[]).map((id) => balancedHero(350, id));
    expect(v.maxHp).toBeGreaterThan(c.maxHp);
    expect(c.maxHp).toBeGreaterThan(s.maxHp);
    expect(s.atk).toBeGreaterThan(c.atk);
    expect(c.atk).toBeGreaterThan(v.atk);
    expect(v.def).toBeGreaterThan(s.def);
  });

  test("only a Cleric has Mend, and it grows with Core against the other stats", () => {
    expect(balancedHero(350, "vanguard").mendPct).toBe(0);
    expect(balancedHero(350, "striker").mendPct).toBe(0);
    const battle = battlePower({ body: 330, equipped: [], level: 10 });
    const even = buildHero({ stats: statLine(60), battle, classId: "cleric", effects: NO_EFFECTS });
    const strongCore = buildHero({ stats: statLine(55, { core: 90 }), battle, classId: "cleric", effects: NO_EFFECTS });
    expect(even.mendPct).toBeCloseTo(SKILLS.mend.basePct + SKILLS.mend.perCorePct, 6);
    expect(strongCore.mendPct).toBeGreaterThan(even.mendPct);
    expect(strongCore.mendPct).toBeLessThanOrEqual(SKILLS.mend.maxPct);
  });

  test("a necklace heals at half strength for anyone but a Cleric", () => {
    const e = withEffects({ healing: 0.06 });
    expect(balancedHero(350, "cleric", e).regenPct).toBeCloseTo(0.06, 6);
    expect(balancedHero(350, "striker", e).regenPct).toBeCloseTo(0.06 * COMBAT.necklaceNonClericFactor, 6);
  });
});

describe("a fight", () => {
  const hero = balancedHero(350, "striker");
  const foe = buildFoe("Test", 350, BOSS_TYPES.mixed);

  test("is the same every time for the same seed", () => {
    expect(simulateFight(hero, foe, "same")).toEqual(simulateFight(hero, foe, "same"));
  });

  test("differs between seeds", () => {
    const outcomes = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(simulateFight(hero, foe, `s${i}`).stats)));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  test("never lasts past the enrage, and an enrage is a loss", () => {
    const tank = balancedHero(350, "vanguard");
    const wall = buildFoe("Wall", 350, { hp: 50, atk: 0.01 });
    const r = simulateFight(tank, wall, "x");
    expect(r).toMatchObject({ won: false, end: "enrage", seconds: COMBAT.enrageSec });
    expect(r.log.at(-1)?.action).toBe("enrage");
  });

  test("keeps a readable log: times in order, and it ends on the decisive event", () => {
    const r = simulateFight(hero, foe, "log");
    const times = r.log.map((e) => e.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(r.log.at(-1)?.action).toMatch(/down|enrage/);
    expect(r.log.some((e) => e.action === "skill" && e.name === "Power Strike")).toBe(true);
    expect(r.log.some((e) => e.action === "ultimate" && e.name === "Execution")).toBe(true);
  });

  test("telegraphs a big hit before it lands", () => {
    const r = simulateFight(balancedHero(350, "vanguard"), buildFoe("Brute", 350, BOSS_TYPES.brute), "tele");
    const warn = r.log.findIndex((e) => e.action === "telegraph");
    const hit = r.log.findIndex((e) => e.action === "heavy");
    expect(warn).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(warn);
    expect(r.log[hit].t - r.log[warn].t).toBeCloseTo(BOSS_TYPES.brute.heavy!.telegraphSec, 1);
  });

  test("a Vanguard raises Guard just before a telegraphed big hit", () => {
    const r = simulateFight(balancedHero(350, "vanguard"), buildFoe("Brute", 350, BOSS_TYPES.brute), "guard");
    const hit = r.log.find((e) => e.action === "heavy")!;
    const guard = r.log.filter((e) => e.action === "skill" && e.name === "Guard" && e.t <= hit.t).at(-1);
    expect(guard).toBeDefined();
    expect(hit.t - guard!.t).toBeLessThanOrEqual(SKILLS.guard.durationSec);
  });
});

describe("balance (see scripts/combat-table.ts)", () => {
  test.each(CLASS_IDS)("%s wins about two thirds at even power against a plain boss", (classId) => {
    const rate = winRate({ classId, ratio: 1, runs: RUNS });
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.85);
  });

  test.each(CLASS_IDS)("%s wins more with more power", (classId) => {
    const rates = [0.9, 1, 1.1].map((ratio) => winRate({ classId, ratio, runs: RUNS }));
    expect(rates[1]).toBeGreaterThanOrEqual(rates[0]);
    expect(rates[2]).toBeGreaterThanOrEqual(rates[1]);
    expect(winRate({ classId, ratio: 0.8, runs: RUNS })).toBeLessThan(0.1);
    expect(winRate({ classId, ratio: 1.3, runs: RUNS })).toBeGreaterThan(0.9);
  });

  test.each(CLASS_IDS)("%s plays the same at low and high power", (classId) => {
    const low = winRate({ classId, ratio: 1, foePower: 150, runs: RUNS });
    const high = winRate({ classId, ratio: 1, foePower: 1200, runs: RUNS });
    expect(Math.abs(low - high)).toBeLessThan(0.1);
  });

  const at = (classId: ClassId, type: keyof typeof BOSS_TYPES) => winRate({ classId, ratio: 1, mechanics: BOSS_TYPES[type], runs: RUNS });

  test("a Vanguard handles brutes best", () => {
    expect(at("vanguard", "brute")).toBeGreaterThan(at("striker", "brute"));
    expect(at("vanguard", "brute")).toBeGreaterThan(at("cleric", "brute"));
  });

  test("a Cleric handles bleeders best", () => {
    expect(at("cleric", "bleeder")).toBeGreaterThan(at("striker", "bleeder"));
    expect(at("cleric", "bleeder")).toBeGreaterThan(at("vanguard", "bleeder"));
  });

  test("a Striker handles timers best", () => {
    expect(at("striker", "timer")).toBeGreaterThan(at("vanguard", "timer"));
    expect(at("striker", "timer")).toBeGreaterThan(at("cleric", "timer"));
  });
});

describe("gear effects in a fight", () => {
  const foe = buildFoe("Test", 350);
  const fight = (h: Hero, seed = "fx") => simulateFight(h, foe, seed);

  test("Crown of the Unbroken survives one killing blow at 1 HP", () => {
    const weak = balancedHero(200, "striker", withEffects({ mythic: ["unbroken-crown"] }));
    const r = fight(weak);
    const stands = r.log.filter((e) => e.action === "last-stand");
    expect(stands).toHaveLength(1);
    expect(r.won).toBe(false);
    expect(fight(balancedHero(200, "striker")).log.some((e) => e.action === "last-stand")).toBe(false);
  });

  test("Hands of the Unbroken makes every 4th basic attack a crit", () => {
    const h = { ...balancedHero(350, "striker", withEffects({ mythic: ["unbroken-hands"] })), critChance: 0 };
    const attacks = fight(h).log.filter((e) => e.action === "attack" && e.actor === "hero");
    attacks.forEach((a, i) => expect(Boolean(a.crit)).toBe((i + 1) % COMBAT.mythic.handsEvery === 0));
  });

  test("Heart of the Unbroken reflects damage taken", () => {
    const r = fight(balancedHero(350, "vanguard", withEffects({ mythic: ["unbroken-heart"] })));
    expect(r.log.some((e) => e.action === "reflect" && (e.amount ?? 0) > 0)).toBe(true);
  });

  test("Pillars of the Unbroken regenerates only below half HP", () => {
    const r = fight(balancedHero(300, "striker", withEffects({ mythic: ["unbroken-pillars"] })));
    expect(r.log.some((e) => e.action === "heal")).toBe(true);
    expect(fight(balancedHero(300, "striker")).log.some((e) => e.action === "heal")).toBe(false);
  });

  test("Path of the Unbroken pushes the enrage back", () => {
    const tank = balancedHero(350, "vanguard", withEffects({ mythic: ["unbroken-path"] }));
    const r = simulateFight(tank, buildFoe("Wall", 350, { hp: 50, atk: 0.01 }), "path");
    expect(r.seconds).toBe(COMBAT.enrageSec + COMBAT.mythic.pathEnrageSec);
  });

  test("a belt's damage reduction lowers damage taken", () => {
    const plain = fight(balancedHero(350, "vanguard"), "belt");
    const belted = fight(balancedHero(350, "vanguard", withEffects({ damageReduction: 0.2 })), "belt");
    expect(belted.stats.taken / Math.max(1, belted.seconds)).toBeLessThan(plain.stats.taken / Math.max(1, plain.seconds));
  });

  const total = (h: Hero, pick: (r: ReturnType<typeof simulateFight>) => number, n = 30) =>
    Array.from({ length: n }, (_, i) => pick(fight(h, `n${i}`))).reduce((a, b) => a + b, 0);

  test("haste makes basic attacks come faster", () => {
    const attacks = (h: Hero) => fight(h, "haste").log.filter((e) => e.action === "attack" && e.actor === "hero").length;
    const wall = buildFoe("Wall", 350, { hp: 50, atk: 0.01 });
    const count = (h: Hero) => simulateFight(h, wall, "haste").log.filter((e) => e.action === "attack" && e.actor === "hero").length;
    expect(count(balancedHero(350, "striker", withEffects({ haste: 0.25 })))).toBeGreaterThan(count(balancedHero(350, "striker")));
    expect(attacks(balancedHero(350, "striker"))).toBeGreaterThan(0);
  });

  test("ult charge fires the ultimate more often", () => {
    const wall = buildFoe("Wall", 350, { hp: 50, atk: 0.01 });
    const ults = (h: Hero) => simulateFight(h, wall, "ult").log.filter((e) => e.action === "ultimate").length;
    expect(ults(balancedHero(350, "striker", withEffects({ ultCharge: 0.4 })))).toBeGreaterThan(ults(balancedHero(350, "striker")));
  });

  test("lifesteal heals without filling the log", () => {
    const r = fight(balancedHero(350, "striker", withEffects({ lifesteal: 0.12 })));
    expect(r.stats.healed).toBeGreaterThan(0);
    expect(r.log.some((e) => e.action === "heal")).toBe(false);
  });

  test("crit damage and Finisher raise damage dealt", () => {
    const dealt = (h: Hero) => total(h, (r) => r.stats.dealt / r.seconds);
    const plain = dealt(balancedHero(350, "striker"));
    expect(dealt(balancedHero(350, "striker", withEffects({ critDamage: 0.6 })))).toBeGreaterThan(plain);
    expect(dealt(balancedHero(350, "striker", withEffects({ finisher: 0.5 })))).toBeGreaterThan(plain);
  });

  test("thorns hurt the enemy on every hit taken", () => {
    const r = fight(balancedHero(350, "vanguard", withEffects({ thorns: 0.15 })));
    expect(r.log.filter((e) => e.action === "reflect").length).toBeGreaterThan(3);
  });

  test("Guard duration and Bastion shield strengthen the Vanguard", () => {
    const brute = buildFoe("Brute", 350, BOSS_TYPES.brute);
    const shields = (h: Hero) => simulateFight(h, brute, "bastion").log.filter((e) => e.action === "shield").map((e) => e.amount!);
    const base = shields(balancedHero(350, "vanguard"))[0];
    expect(shields(balancedHero(350, "vanguard", withEffects({ bastionShield: 0.3 })))[0]).toBeCloseTo(base * 1.3, -1);
    expect(shields(balancedHero(350, "vanguard", withEffects({ mythic: ["oathkeeper-belt"] })))[0]).toBeCloseTo(base * COMBAT.mythic.oathkeeperShieldFactor, -1);
    const taken = (h: Hero) => total(h, (r) => r.stats.taken / r.seconds);
    expect(taken(balancedHero(350, "vanguard", withEffects({ guardDuration: 0.75 })))).toBeLessThan(taken(balancedHero(350, "vanguard")));
  });

  test("heal power and bleed resistance help the Cleric against bleeders", () => {
    const bleeder = buildFoe("Bleeder", 350, BOSS_TYPES.bleeder);
    const heals = (h: Hero) => simulateFight(h, bleeder, "mend").log.find((e) => e.action === "heal" && e.name === "Mend")!.amount!;
    expect(heals(balancedHero(350, "cleric", withEffects({ healPower: 0.6 })))).toBeGreaterThan(heals(balancedHero(350, "cleric")));
    const bled = (h: Hero) => simulateFight(h, bleeder, "bleed").log.filter((e) => e.action === "bleed")[0].amount!;
    expect(bled(balancedHero(350, "cleric", withEffects({ bleedResist: 0.45 })))).toBeLessThan(bled(balancedHero(350, "cleric")));
  });

  test("Executioner's Ring crits every hit on an enemy under 30% HP", () => {
    const h = { ...balancedHero(500, "striker", withEffects({ mythic: ["executioners-ring"] })), critChance: 0 };
    const r = fight(h, "exec");
    expect(r.won).toBe(true);
    let hp = foe.maxHp;
    for (const e of r.log) {
      if (e.actor !== "hero" || !["attack", "skill", "ultimate"].includes(e.action) || e.amount == null) continue;
      expect(Boolean(e.crit)).toBe(hp < foe.maxHp * COMBAT.mythic.executionerBelowPct);
      hp -= e.amount;
    }
  });

  test("Bloodletter Gauntlets heal on crits", () => {
    const h = { ...balancedHero(350, "striker", withEffects({ mythic: ["bloodletter-gauntlets"] })), critChance: 0.5 };
    expect(fight(h).stats.healed).toBeGreaterThan(0);
  });

  test("Bulwark Plate reflects while Guard is up", () => {
    const brute = buildFoe("Brute", 350, BOSS_TYPES.brute);
    const reflects = (h: Hero) => simulateFight(h, brute, "bulwark").log.filter((e) => e.action === "reflect").length;
    expect(reflects(balancedHero(350, "vanguard", withEffects({ mythic: ["bulwark-plate"] })))).toBeGreaterThan(0);
    expect(reflects(balancedHero(350, "vanguard"))).toBe(0);
  });

  test("Saint's Locket stops bleeding after Mend", () => {
    const bleeder = buildFoe("Bleeder", 350, BOSS_TYPES.bleeder);
    const bleeds = (h: Hero) =>
      Array.from({ length: 10 }, (_, i) => simulateFight(h, bleeder, `saint${i}`))
        .map((r) => r.log.filter((e) => e.action === "bleed").length / r.seconds)
        .reduce((a, b) => a + b, 0);
    expect(bleeds(balancedHero(350, "cleric", withEffects({ mythic: ["saints-locket"] })))).toBeLessThan(bleeds(balancedHero(350, "cleric")));
  });

  test("Dawn Censer turns overhealing into a shield", () => {
    const wall = buildFoe("Wall", 350, { hp: 50, atk: 0.3 });
    const taken = (h: Hero) => simulateFight(h, wall, "censer").stats.taken;
    const regen = withEffects({ healing: 0.2 });
    expect(taken(balancedHero(350, "cleric", { ...regen, mythic: ["dawn-censer"] }))).toBeLessThan(taken(balancedHero(350, "cleric", regen)));
  });

  test("ring crit raises the crit rate", () => {
    const crits = (h: Hero) => Array.from({ length: 30 }, (_, i) => fight(h, `c${i}`).stats.crits).reduce((a, b) => a + b, 0);
    expect(crits(balancedHero(350, "striker", withEffects({ crit: 0.2 })))).toBeGreaterThan(crits(balancedHero(350, "striker")));
  });
});
