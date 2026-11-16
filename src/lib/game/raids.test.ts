import { describe, expect, test } from "vitest";
import { BOSS_TYPES, RAID_BOSSES, TOWER_BOSSES, WEEKLY_BOSSES } from "./bossData";
import { baseItem } from "./catalog";
import { balancedHero } from "./combatTuning";
import { BOSS_DROPS, RAID, RARITIES, type ClassId } from "./config";
import { fightWeek } from "./fights";
import { checkParty, raidBoss, raidedThisWeek, raidEncounter, raidRewards, raidTierFor, RAID_TIERS, runRaid, type RaidMember } from "./raids";
import { DAY, T0 } from "./test-helpers";
import { addDays } from "./time";

const WEEK = "2026-10-11";
const member = (uid: string, level: number, power: number, lastRaidWeek: string | null = null): RaidMember => ({ uid, level, power, lastRaidWeek });

describe("the raid boss list (a draft for Jackson)", () => {
  test("ids are unique, never reuse another boss's, and every boss is ready to fight", () => {
    const ids = RAID_BOSSES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = new Set([...WEEKLY_BOSSES, ...TOWER_BOSSES].map((b) => b.id));
    expect(ids.filter((id) => others.has(id))).toEqual([]);
    for (const b of RAID_BOSSES) {
      expect(b.name.length, b.id).toBeGreaterThan(0);
      expect(b.epithet.length, b.id).toBeGreaterThan(0);
      expect(BOSS_TYPES[b.type], b.id).toBeDefined();
      expect([3, 4], b.id).toContain(b.bestWith);
      // A raid checks level and power per member, never stat minimums.
      expect(b.minimums, b.id).toBeUndefined();
    }
    // Some of each: bosses for three and bosses for four.
    expect(new Set(RAID_BOSSES.map((b) => b.bestWith))).toEqual(new Set([3, 4]));
  });

  test("one boss a week for everyone, in order, repeating", () => {
    const n = RAID_BOSSES.length;
    const seen = Array.from({ length: n }, (_, i) => raidBoss(addDays(WEEK, 7 * i)).id);
    expect(new Set(seen).size).toBe(n);
    expect(raidBoss(addDays(WEEK, 7 * n)).id).toBe(raidBoss(WEEK).id);
    expect(raidBoss(WEEK)).toBe(raidBoss(WEEK));
  });
});

describe("tiers and the encounter", () => {
  test("five tiers, harder each time, with a level and a power to enter", () => {
    expect(RAID_TIERS).toBe(5);
    for (const list of [RAID.tierLevels, RAID.tierPower, RAID.coins, RAID.scrap, RAID.itemLevel]) {
      expect(list).toHaveLength(5);
      expect([...list].sort((a, b) => a - b)).toEqual(list);
    }
    const e = raidEncounter(WEEK, 3, 3);
    expect(e).toMatchObject({ tier: 3, power: 350, minLevel: 55, minPower: 280 });
    expect(e.boss).toBe(raidBoss(WEEK));
    expect(e.foe.name).toBe(e.boss.name);
    // Out-of-range tiers clamp.
    expect(raidEncounter(WEEK, 0, 3).tier).toBe(1);
    expect(raidEncounter(WEEK, 9, 3).tier).toBe(5);
  });

  test("the boss is sized to the party and carries its own mechanics", () => {
    const two = raidEncounter(WEEK, 2, 2).foe;
    const four = raidEncounter(WEEK, 2, 4).foe;
    expect(four.maxHp).toBeGreaterThan(two.maxHp);
    expect(four.attackEverySec).toBeLessThan(two.attackEverySec);
    const cleaver = RAID_BOSSES.findIndex((b) => b.cleave);
    const plain = RAID_BOSSES.findIndex((b) => !b.cleave);
    expect(raidEncounter(addDays("1970-01-04", 7 * cleaver), 1, 3).foe.cleave).toBe(true);
    expect(raidEncounter(addDays("1970-01-04", 7 * plain), 1, 3).foe.cleave).toBe(false);
  });

  test("a player's own top tier: by level and by 80% of the tier's power", () => {
    expect(raidTierFor(19, 1000)).toBe(0);
    expect(raidTierFor(20, 119)).toBe(0);
    expect(raidTierFor(20, 120)).toBe(1);
    expect(raidTierFor(60, 280)).toBe(3);
    // The level for tier 4, but not the power: tier 3.
    expect(raidTierFor(75, 300)).toBe(3);
    expect(raidTierFor(100, 1000)).toBe(5);
  });
});

describe("who may raid together", () => {
  const ok = [member("a", 60, 360), member("b", 58, 300), member("c", 70, 400)];

  test("2 to 4 players, each once", () => {
    expect(checkParty(ok, 3, WEEK)).toEqual({ allowed: true, reason: null, problems: {} });
    expect(checkParty(ok.slice(0, 1), 3, WEEK)).toMatchObject({ allowed: false, reason: "A raid needs at least 2 players" });
    expect(checkParty([...ok, member("d", 60, 300), member("e", 60, 300)], 3, WEEK)).toMatchObject({ allowed: false, reason: "A raid takes at most 4 players" });
    expect(checkParty([...ok, member("d", 60, 300)], 3, WEEK).allowed).toBe(true);
    expect(checkParty([ok[0], ok[0]], 3, WEEK)).toMatchObject({ allowed: false, reason: "Someone is in the party twice" });
  });

  test("everyone within 25 levels of everyone else", () => {
    expect(checkParty([member("a", 55, 400), member("b", 80, 400)], 3, WEEK).allowed).toBe(true);
    expect(checkParty([member("a", 55, 400), member("b", 81, 400)], 3, WEEK)).toMatchObject({
      allowed: false,
      reason: "Everyone must be within 25 levels of each other",
    });
  });

  test("each member needs the tier's level and power, and says which is missing", () => {
    const r = checkParty([member("a", 60, 360), member("low", 54, 400), member("weak", 60, 279)], 3, WEEK);
    expect(r).toEqual({ allowed: false, reason: null, problems: { low: "Needs level 55", weak: "Needs 280 battle power" } });
    // The same party is fine a tier down.
    expect(checkParty([member("a", 60, 360), member("low", 54, 400), member("weak", 60, 279)], 2, WEEK).allowed).toBe(true);
  });

  test("one raid a week: a member who already raided this fight week blocks the start", () => {
    const r = checkParty([member("a", 60, 360), member("done", 60, 360, WEEK)], 3, WEEK);
    expect(r).toEqual({ allowed: false, reason: null, problems: { done: "Already raided this week" } });
    expect(checkParty([member("a", 60, 360), member("done", 60, 360, addDays(WEEK, -7))], 3, WEEK).allowed).toBe(true);
    // The week turns with the weekly boss: Sunday 04:00 in the player's zone.
    const week = fightWeek(T0, "UTC");
    expect(raidedThisWeek(week, T0, "UTC")).toBe(true);
    expect(raidedThisWeek(week, T0 + 7 * DAY, "UTC")).toBe(false);
    expect(raidedThisWeek(null, T0, "UTC")).toBe(false);
    expect(raidedThisWeek(undefined, T0, "UTC")).toBe(false);
  });
});

describe("what a raid pays", () => {
  const party = [member("a", 60, 360), member("b", 58, 300), member("c", 70, 400)];

  test("a loss pays nothing", () => {
    for (const r of raidRewards({ won: false, tier: 3, members: party, seed: "s" })) expect(r).toMatchObject({ coins: 0, scrap: 0, drop: null });
  });

  test("a win pays everyone the tier's coins and scrap", () => {
    const rewards = raidRewards({ won: true, tier: 3, members: party, seed: "s" });
    expect(rewards.map((r) => r.uid)).toEqual(["a", "b", "c"]);
    for (const r of rewards) expect(r).toMatchObject({ coins: 300, scrap: 90, lootEligible: true });
    expect(rewards.reduce((n, r) => n + r.contribution, 0)).toBeCloseTo(1);
  });

  test("a member under 15% of the party's power gets coins but never a loot roll", () => {
    // 100 of 1,300 total is under 15%; 200 of 1,400 is not.
    const carried = [member("a", 60, 600), member("b", 60, 600), member("alt", 45, 100)];
    let altDrops = 0;
    let otherDrops = 0;
    for (let i = 0; i < 400; i++) {
      const rewards = raidRewards({ won: true, tier: 1, members: carried, seed: `c${i}` });
      const alt = rewards.find((r) => r.uid === "alt")!;
      expect(alt).toMatchObject({ lootEligible: false, coins: RAID.coins[0], scrap: RAID.scrap[0] });
      if (alt.drop) altDrops++;
      otherDrops += rewards.filter((r) => r.uid !== "alt" && r.drop).length;
    }
    expect(altDrops).toBe(0);
    expect(otherDrops).toBeGreaterThan(0);
    const fine = raidRewards({ won: true, tier: 1, members: [member("a", 60, 600), member("b", 60, 600), member("c", 45, 215)], seed: "s" });
    expect(fine[2].lootEligible).toBe(true);
  });

  test("loot is each member's own roll, at their own level and the tier's rarities, about 1 win in 4", () => {
    const members = [member("low", 56, 300), member("high", 80, 400)];
    let drops = 0;
    const N = 1500;
    const rarities = new Set<string>();
    for (let i = 0; i < N; i++) {
      for (const r of raidRewards({ won: true, tier: 3, members, seed: `l${i}` })) {
        if (!r.drop) continue;
        drops++;
        rarities.add(r.drop.rarity);
        expect(baseItem(r.drop.baseId), r.drop.baseId).toBeTruthy();
        // Never above the player's own level, nor the tier's cap (69 at tier 3).
        const cap = Math.min(r.uid === "low" ? 56 : 80, RAID.itemLevel[2]);
        expect(r.drop.itemLevel).toBeLessThanOrEqual(cap);
        expect(r.drop.itemLevel).toBeGreaterThanOrEqual(cap - 2);
      }
    }
    expect(drops / (N * 2)).toBeGreaterThan(RAID.gearChance - 0.04);
    expect(drops / (N * 2)).toBeLessThan(RAID.gearChance + 0.04);
    const allowed = RARITIES.filter((r) => (BOSS_DROPS.tiers[2].weights[r] ?? 0) > 0);
    expect([...rarities].every((r) => (allowed as string[]).includes(r))).toBe(true);
    // The same seed pays the same; one member's roll doesn't depend on who else came.
    const a = raidRewards({ won: true, tier: 3, members, seed: "same" });
    expect(raidRewards({ won: true, tier: 3, members, seed: "same" })).toEqual(a);
    const withThird = raidRewards({ won: true, tier: 3, members: [...members, member("c", 60, 350)], seed: "same" });
    expect(withThird.find((r) => r.uid === "low")!.drop).toEqual(a.find((r) => r.uid === "low")!.drop);
  });
});

describe("running a raid", () => {
  const fighter = (uid: string, classId: ClassId, power: number, level = 60) => ({ uid, level, power, hero: balancedHero(power, classId) });

  test("the week's boss at the tier, sized to the party, fought once and paid", () => {
    const members = [fighter("tank", "vanguard", 500), fighter("dps", "striker", 500), fighter("heal", "cleric", 500)];
    const out = runRaid({ weekId: WEEK, tier: 3, members, seed: "run" });
    expect(out.encounter).toMatchObject({ tier: 3, power: 350 });
    expect(out.encounter.foe).toEqual(raidEncounter(WEEK, 3, 3).foe);
    expect(out.result.members).toHaveLength(3);
    // Well over the recommended power: they win, and everyone is paid.
    expect(out.result.won).toBe(true);
    expect(out.rewards.map((r) => [r.uid, r.coins, r.scrap])).toEqual([
      ["tank", 300, 90],
      ["dps", 300, 90],
      ["heal", 300, 90],
    ]);
    expect(runRaid({ weekId: WEEK, tier: 3, members, seed: "run" })).toEqual(out);
  });

  test("an underpowered party loses and is paid nothing", () => {
    const members = [fighter("a", "striker", 120, 60), fighter("b", "striker", 120, 60)];
    const out = runRaid({ weekId: WEEK, tier: 5, members, seed: "lose" });
    expect(out.result.won).toBe(false);
    expect(out.rewards.every((r) => r.coins === 0 && r.scrap === 0 && r.drop == null)).toBe(true);
  });

  test("every draft boss can be beaten by a strong party of three and of four, and beats a weak one", () => {
    for (let w = 0; w < RAID_BOSSES.length; w++) {
      const weekId = addDays(WEEK, 7 * w);
      const name = raidBoss(weekId).name;
      for (const classes of [["vanguard", "striker", "cleric"], ["vanguard", "striker", "striker", "cleric"]] as ClassId[][]) {
        let strong = 0;
        let weak = 0;
        for (let i = 0; i < 40; i++) {
          if (runRaid({ weekId, tier: 3, members: classes.map((c, k) => fighter(`m${k}`, c, 350 * 1.5)), seed: `b${i}` }).result.won) strong++;
          if (runRaid({ weekId, tier: 3, members: classes.map((c, k) => fighter(`m${k}`, c, 350 * 0.6)), seed: `b${i}` }).result.won) weak++;
        }
        expect(strong, `${name} x${classes.length} strong`).toBeGreaterThanOrEqual(34);
        expect(weak, `${name} x${classes.length} weak`).toBeLessThanOrEqual(6);
      }
    }
  });
});
