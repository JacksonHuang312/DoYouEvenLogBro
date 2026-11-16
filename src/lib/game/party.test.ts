import { describe, expect, test } from "vitest";
import { buildFoe, simulateFight, type FoeMechanics, type Hero } from "./combat";
import { balancedHero } from "./combatTuning";
import { CLASS_IDS, CLASSES, RAID, type ClassId, type MythicEffect } from "./config";
import { NO_EFFECTS, type GearEffects } from "./effects";
import { buildRaidFoe, simulateParty, type PartyResult, type RaidMechanics } from "./party";

const POWER = 350;
const fx = (e: Partial<GearEffects>): GearEffects => ({ ...NO_EFFECTS, ...e });
const hero = (classId: ClassId, ratio = 1, effects: GearEffects = NO_EFFECTS): Hero => balancedHero(POWER * ratio, classId, effects);
const HEAVY: FoeMechanics = { heavy: { everySec: 8, telegraphSec: 1.5, multiplier: 2.5 } };
const BLEED: FoeMechanics = { bleed: { startSec: 5, perSec: 0.12 } };
const raid = (classes: ClassId[], m: RaidMechanics = {}, seed = "s", ratio = 1) =>
  simulateParty(classes.map((c) => hero(c, ratio)), buildRaidFoe("Boss", POWER, classes.length, m), seed);
const winRate = (classes: ClassId[], m: RaidMechanics = {}, ratio = 1, runs = 200) =>
  Array.from({ length: runs }, (_, i) => raid(classes, m, `w${i}`, ratio)).filter((r) => r.won).length / runs;
const foeHits = (r: PartyResult) => r.log.filter((e) => e.actor === "foe" && (e.action === "attack" || e.action === "heavy"));

describe("a party of one is the solo fight", () => {
  const MYTHICS: MythicEffect[] = [
    "unbroken-crown",
    "unbroken-heart",
    "unbroken-hands",
    "unbroken-pillars",
    "unbroken-path",
    "bulwark-plate",
    "executioners-ring",
    "bloodletter-gauntlets",
    "oathkeeper-belt",
    "saints-locket",
    "dawn-censer",
    "kingsbane",
    "first-light",
    "unyielding-wall",
  ];
  const loadouts: GearEffects[] = [
    NO_EFFECTS,
    fx({ haste: 0.1, ultCharge: 0.2, lifesteal: 0.05, critDamage: 0.2, finisher: 0.15, crit: 0.1 }),
    fx({ thorns: 0.1, healing: 0.02, healPower: 0.2, bleedResist: 0.3, guardDuration: 0.3, bastionShield: 0.2, damageReduction: 0.05 }),
    fx({ mythic: MYTHICS, healing: 0.02, lifesteal: 0.03 }),
  ];
  const mechanics: FoeMechanics[] = [{}, HEAVY, BLEED, { ...HEAVY, ...BLEED, hp: 1.3, enrageSec: 40 }];

  test("same seed, same hero, same enemy: the same fight, blow for blow, for every class, enemy type and gear effect", () => {
    let fights = 0;
    for (const classId of CLASS_IDS) {
      for (const effects of loadouts) {
        for (const m of mechanics) {
          for (const ratio of [0.7, 1, 1.4]) {
            for (let i = 0; i < 6; i++) {
              const h = hero(classId, ratio, effects);
              const solo = simulateFight(h, buildFoe("Boss", POWER, m), `eq-${i}`);
              const party = simulateParty([h], buildRaidFoe("Boss", POWER, 1, m), `eq-${i}`);
              const where = `${classId} ratio ${ratio} seed ${i}`;
              expect(party.won, where).toBe(solo.won);
              expect(party.seconds, where).toBe(solo.seconds);
              expect(party.foeHpLeft, where).toBe(solo.foeHpLeft);
              expect(party.members[0].hpLeft, where).toBe(solo.heroHpLeft);
              expect(party.members[0].stats, where).toEqual(solo.stats);
              expect(party.end === "party-down" ? "hero-down" : party.end, where).toBe(solo.end);
              fights++;
            }
          }
        }
      }
    }
    expect(fights).toBe(3 * 4 * 4 * 3 * 6);
  });

  test("a raid boss for one is the ordinary enemy", () => {
    expect(buildRaidFoe("Boss", POWER, 1, HEAVY)).toEqual({ ...buildFoe("Boss", POWER, HEAVY), cleave: false });
  });
});

describe("the boss grows with the party", () => {
  test("health per member, and faster attacks, since only one member is hit at a time", () => {
    const one = buildRaidFoe("Boss", POWER, 1);
    const four = buildRaidFoe("Boss", POWER, 4);
    expect(four.maxHp).toBe(Math.round(one.maxHp * (1 + 3 * RAID.hpPerExtraMember)));
    expect(four.attackEverySec).toBeCloseTo(one.attackEverySec / (1 + 3 * RAID.attackRatePerExtraMember));
    expect(four.atk).toBe(one.atk);
    expect(four.def).toBe(one.def);
    expect(buildRaidFoe("Boss", POWER, 3, { cleave: true }).cleave).toBe(true);
    expect([RAID.minParty, RAID.maxParty]).toEqual([2, 4]);
  });
});

describe("who the boss hits", () => {
  test("a standing Vanguard draws every hit", () => {
    const r = raid(["striker", "vanguard", "cleric"], HEAVY);
    const hits = foeHits(r);
    expect(hits.length).toBeGreaterThan(3);
    const tankDown = r.members[1].downAt;
    for (const e of hits) if (tankDown == null || e.t < tankDown) expect(e.target).toBe(1);
    // The others took nothing from attacks while the tank stood.
    if (tankDown == null) {
      expect(r.members[0].stats.taken).toBe(0);
      expect(r.members[2].stats.taken).toBe(0);
    }
  });

  test("with no Vanguard the hits are shared out by the seed", () => {
    const targets = new Set<number>();
    for (let i = 0; i < 10; i++) for (const e of foeHits(raid(["striker", "striker", "cleric"], {}, `t${i}`))) targets.add(e.target!);
    expect([...targets].sort()).toEqual([0, 1, 2]);
  });

  test("once the Vanguard is down, the rest are hit", () => {
    // An underpowered party against a hard-hitting boss: the tank falls first, then the others.
    const r = raid(["vanguard", "striker"], { atk: 3 }, "fall", 0.6);
    expect(r.members[0].downAt).not.toBeNull();
    const after = foeHits(r).filter((e) => e.t > r.members[0].downAt!);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((e) => e.target === 1)).toBe(true);
  });

  test("a cleaving big hit lands on everyone standing; an ordinary one only on its target", () => {
    const cleave = raid(["vanguard", "striker", "cleric"], { ...HEAVY, cleave: true });
    const first = cleave.log.filter((e) => e.action === "heavy").slice(0, 3);
    expect(first.map((e) => e.target).sort()).toEqual([0, 1, 2]);
    expect(cleave.members[1].stats.taken).toBeGreaterThan(0);
    const plain = raid(["vanguard", "striker", "cleric"], HEAVY);
    if (plain.members[0].downAt == null) expect(plain.log.filter((e) => e.action === "heavy").every((e) => e.target === 0)).toBe(true);
  });

  test("bleeding hits everyone", () => {
    const r = raid(["vanguard", "striker", "cleric"], BLEED);
    const bled = new Set(r.log.filter((e) => e.action === "bleed").map((e) => e.target));
    expect([...bled].sort()).toEqual([0, 1, 2]);
  });
});

describe("healing teammates", () => {
  test("a Cleric mends whoever is hurt worst, and the healing counts for the Cleric", () => {
    const r = raid(["vanguard", "striker", "cleric"], { atk: 1.6 });
    const onOthers = r.log.filter((e) => e.actor === 2 && e.action === "heal" && e.target != null);
    const mends = onOthers.filter((e) => e.name === CLASSES.cleric.skill.name);
    expect(mends.length).toBeGreaterThan(0);
    // While the tank stands it takes the hits, so it gets the Mends.
    const tankDown = r.members[0].downAt ?? Infinity;
    const whileTankStood = mends.filter((e) => e.t < tankDown);
    expect(whileTankStood.length).toBeGreaterThan(0);
    expect(whileTankStood.every((e) => e.target === 0)).toBe(true);
    expect(r.members[2].stats.healed).toBeGreaterThanOrEqual(onOthers.reduce((n, e) => n + e.amount!, 0));
    expect(r.members[0].stats.healed).toBe(0);
  });

  test("Radiance heals the Cleric in full and everyone else standing at a share", () => {
    const name = CLASSES.cleric.ultimate.name;
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) {
      const r = raid(["vanguard", "striker", "cleric"], { atk: 1.6, cleave: true, heavy: { everySec: 6, telegraphSec: 1, multiplier: 2 } }, `rad${i}`);
      const cast = r.log.find((e) => e.actor === 2 && e.action === "ultimate" && e.name === name);
      if (!cast) continue;
      const heals = r.log.filter((e) => e.actor === 2 && e.action === "heal" && e.name === name && e.t === cast.t);
      if (heals.some((e) => e.target != null)) seen = true;
    }
    expect(seen).toBe(true);
  });

  test("a healer keeps a tank standing longer", () => {
    const tankFallsAt = (classes: ClassId[]) => {
      let total = 0;
      for (let i = 0; i < 60; i++) {
        const r = raid(classes, { atk: 1.8, hp: 3 }, `h${i}`);
        total += r.members[0].downAt ?? r.seconds;
      }
      return total / 60;
    };
    expect(tankFallsAt(["vanguard", "cleric", "cleric"])).toBeGreaterThan(tankFallsAt(["vanguard", "striker", "striker"]));
  });

  test("nobody heals the fallen", () => {
    const r = raid(["vanguard", "cleric"], { atk: 3 }, "dead", 0.6);
    const down = r.members[0].downAt;
    expect(down).not.toBeNull();
    expect(r.log.some((e) => e.action === "heal" && e.target === 0 && e.t > down!)).toBe(false);
  });
});

describe("how a raid ends", () => {
  test("won when the boss falls; lost when everyone is down, or when it enrages", () => {
    const win = raid(["vanguard", "striker", "striker"], {}, "win", 1.6);
    expect(win).toMatchObject({ won: true, end: "foe-down", foeHpLeft: 0 });
    const wipe = raid(["striker", "striker"], { atk: 4 }, "wipe", 0.4);
    expect(wipe).toMatchObject({ won: false, end: "party-down" });
    expect(wipe.members.every((m) => m.downAt != null && m.hpLeft === 0)).toBe(true);
    const slow = raid(["vanguard", "vanguard"], { hp: 30, atk: 0.2, enrageSec: 20 }, "slow");
    expect(slow).toMatchObject({ won: false, end: "enrage", seconds: 20 });
  });

  test("a member who goes down stops fighting, and the rest carry on", () => {
    const r = raid(["vanguard", "striker"], { atk: 3 }, "fall", 0.6);
    const down = r.members[0].downAt!;
    expect(r.log.some((e) => e.actor === 0 && e.t > down)).toBe(false);
    expect(r.log.some((e) => e.actor === 1 && e.t > down)).toBe(true);
    expect(r.log.filter((e) => e.actor === 0 && e.action === "down")).toHaveLength(1);
  });

  test("the same seed gives the same raid; another seed gives another", () => {
    const a = raid(["vanguard", "striker", "cleric"], HEAVY, "same");
    expect(raid(["vanguard", "striker", "cleric"], HEAVY, "same")).toEqual(a);
    expect(raid(["vanguard", "striker", "cleric"], HEAVY, "other").log).not.toEqual(a.log);
  });

  test("everyone's numbers add up: the damage dealt is the boss's lost health", () => {
    const r = raid(["vanguard", "striker", "cleric", "striker"], HEAVY, "sum", 0.9);
    const dealt = r.members.reduce((n, m) => n + m.stats.dealt, 0);
    // The last blow can overshoot zero.
    expect(dealt).toBeGreaterThanOrEqual(r.foeMaxHp - r.foeHpLeft);
    expect(r.members).toHaveLength(4);
    expect(r.log.every((e) => e.fh >= 0 && e.fh <= r.foeMaxHp)).toBe(true);
  });
});

describe("draft balance (to be retuned with real fights)", () => {
  test("power still decides it at every party size: weak parties lose, strong ones win", () => {
    for (const classes of [
      ["vanguard", "striker"],
      ["vanguard", "striker", "cleric"],
      ["vanguard", "striker", "cleric", "striker"],
    ] as ClassId[][]) {
      const weak = winRate(classes, HEAVY, 0.6, 100);
      const strong = winRate(classes, HEAVY, 1.6, 100);
      expect(weak, `${classes.length} weak`).toBeLessThan(0.2);
      expect(strong, `${classes.length} strong`).toBeGreaterThan(0.8);
    }
  });
});
