import { describe, expect, test } from "vitest";
import { battlePower, weaponClassBonus } from "./battle";
import { ARMOR_SLOTS, WEAPON_CLASS_BONUS, type Focus, type Rarity } from "./config";
import { levelPower } from "./items";

/** A piece at item level 50 unless told: a Common armor piece there is 4 power. */
const piece = (setId: string, slot: (typeof ARMOR_SLOTS)[number], rarity: Rarity, plus = 0, itemLevel = 50) => ({
  baseId: `${setId}-${slot}`,
  slot,
  rarity,
  plus,
  itemLevel,
});
const fullSet = (setId: string, rarity: Rarity, plus = 0) => ARMOR_SLOTS.map((s) => piece(setId, s, rarity, plus));

describe("battlePower", () => {
  test("no gear and no titles: battle power is body power", () => {
    const p = battlePower({ body: 250, equipped: [], level: 1 });
    expect(p.total).toBe(250);
    expect(p.gear).toMatchObject({ raw: 0, counted: 0, capped: false });
  });

  test("gear counts in full under the cap", () => {
    const p = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare"), piece("ironbound", "boots", "common")], level: 50 });
    expect(p.gear.counted).toBeCloseTo(5.2 + 4);
    expect(p.total).toBeCloseTo(309.2);
  });

  test("gear is capped at 30% of total power", () => {
    const p = battlePower({ body: 50, equipped: fullSet("unbroken", "mythic"), level: 100 });
    expect(p.gear.capped).toBe(true);
    expect(p.gear.counted).toBeCloseTo((0.3 / 0.7) * 50);
    expect(p.gear.counted / p.total).toBeCloseTo(0.3);
  });

  test("five level-50 Mythics are 40 gear power with no set bonus, and count in full from about 94 body power", () => {
    const mythics = fullSet("unbroken", "mythic");
    expect(battlePower({ body: 200, equipped: mythics, level: 100 }).gear).toMatchObject({ setPct: 0, capped: false });
    expect(battlePower({ body: 200, equipped: mythics, level: 100 }).gear.raw).toBeCloseTo(40);
    expect(battlePower({ body: 94, equipped: mythics, level: 100 }).gear.capped).toBe(false);
    expect(battlePower({ body: 93, equipped: mythics, level: 100 }).gear.capped).toBe(true);
  });

  test("set bonuses multiply gear power before the cap", () => {
    const five = battlePower({ body: 1000, equipped: fullSet("warden", "epic"), level: 50 });
    expect(five.gear.raw).toBeCloseTo(30);
    expect(five.gear.setPct).toBe(0.2);
    expect(five.gear.counted).toBeCloseTo(36);
    expect(five.bonus.total).toBe(0);
    // Capped: the set bonus can't push gear past 30%.
    const capped = battlePower({ body: 50, equipped: fullSet("warden", "epic"), level: 50 });
    expect(capped.gear.counted).toBeCloseTo((0.3 / 0.7) * 50);
  });

  test("pieces above the user's level don't count, whatever their rarity", () => {
    const p = battlePower({ body: 300, equipped: [piece("warden", "helmet", "common", 0, 35), piece("ironbound", "boots", "legendary", 0, 30)], level: 34 });
    expect(p.gear.raw).toBeCloseTo(levelPower(30) * 1.75);
  });

  test("the class's own weapon type adds 10% to the weapon; other classes get none", () => {
    const sword = { baseId: "recruits-blade", slot: "weapon" as const, rarity: "rare" as Rarity, plus: 0, itemLevel: 50 };
    const plain = battlePower({ body: 1000, equipped: [sword], level: 50, classId: "cleric" }).gear.raw;
    expect(plain).toBeCloseTo(4 * 1.3 * 2);
    expect(battlePower({ body: 1000, equipped: [sword], level: 50, classId: "striker" }).gear.boosted).toBeCloseTo(plain * (1 + WEAPON_CLASS_BONUS));
    expect(weaponClassBonus(sword, "striker")).toBe(WEAPON_CLASS_BONUS);
    expect(weaponClassBonus(sword, "vanguard")).toBe(0);
    expect(weaponClassBonus({ baseId: "ironbound-helmet" }, "striker")).toBe(0);
    expect(weaponClassBonus(sword, null)).toBe(0);
  });

  test("titles and class share one bucket capped at +25%", () => {
    expect(battlePower({ body: 200, equipped: [], level: 1, titlePct: 0.13 }).total).toBeCloseTo(226);
    const capped = battlePower({ body: 200, equipped: [], level: 1, titlePct: 0.15, classPct: 0.2 });
    expect(capped.bonus).toMatchObject({ total: 0.25, capped: true });
    expect(capped.total).toBe(250);
  });

  test("the bucket multiplies body and counted gear together", () => {
    const p = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare")], level: 50, titlePct: 0.1 });
    expect(p.total).toBeCloseTo(305.2 * 1.1);
  });

  test("counted gear splits into HP, ATK and DEF by each piece's focus, scaled down with the cap", () => {
    // Steelguard is a 60% DEF / 40% HP set; Ironbound has no focus and uses its slot's 70/30.
    const one = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare"), piece("ironbound", "helmet", "common")], level: 50 });
    expect(one.gear.attributes.hp).toBeCloseTo(0.4 * 5.2 + 0.7 * 4);
    expect(one.gear.attributes.def).toBeCloseTo(0.6 * 5.2 + 0.3 * 4);
    expect(one.gear.attributes.atk).toBe(0);
    const capped = battlePower({ body: 50, equipped: fullSet("unbroken", "mythic"), level: 100 });
    const { hp, atk, def } = capped.gear.attributes;
    expect(hp + atk + def).toBeCloseTo(capped.gear.counted);
  });

  test("no body power means gear adds nothing", () => {
    expect(battlePower({ body: 0, equipped: fullSet("warden", "epic"), level: 40 }).total).toBe(0);
  });
});

/*
 * The balance of sets against Mythics (GAME_DESIGN.md 12, 13.5), all at item level 50 (a Common piece
 * is 4 power there). Pieces carry their own set and focus here, so these numbers don't change when real
 * catalog items do. With rarity as a multiplier, a full set beats swapping one piece for a Mythic on
 * power alone: a Mythic is worn for its own effect.
 */
describe("sets against Mythics", () => {
  type Worn = Parameters<typeof battlePower>[0]["equipped"][number];
  const set = (setId: string, rarity: Rarity, focus: Focus): Worn[] =>
    ARMOR_SLOTS.map((slot) => ({ baseId: `${setId}-${slot}`, slot, rarity, plus: 0, itemLevel: 50, setId, focus }));
  const mythic = (slot: (typeof ARMOR_SLOTS)[number], focus: Focus): Worn => ({
    baseId: `mythic-${slot}`,
    slot,
    rarity: "mythic",
    plus: 0,
    itemLevel: 50,
    setId: null,
    focus,
  });
  const power = (equipped: Worn[]) => battlePower({ body: 5000, equipped, level: 100 }).gear.attributes;

  test("Epic HP set: 5 × 6 with +20% is 36 HP; swapping one piece for a Mythic HP (8) gives 33.9", () => {
    const epic = set("epic-hp", "epic", { hp: 100 });
    expect(power(epic).hp).toBeCloseTo(36);
    const swapped = [...epic.slice(0, 4), mythic("boots", { hp: 100 })];
    expect(power(swapped).hp).toBeCloseTo(4 * 6 * 1.08 + 8);
    expect(power(swapped).hp).toBeLessThan(power(epic).hp);
  });

  test("Legendary HP set: 5 × 7 with +20% is 42 HP; the same swap gives about 38", () => {
    const legendary = set("legendary-hp", "legendary", { hp: 100 });
    expect(power(legendary).hp).toBeCloseTo(42);
    const swapped = [...legendary.slice(0, 4), mythic("boots", { hp: 100 })];
    expect(power(swapped).hp).toBeCloseTo(4 * 7 * 1.08 + 8);
    expect(power(swapped).hp).toBeLessThan(power(legendary).hp);
  });

  test("a Mythic piece beats a Legendary piece of the same level by itself", () => {
    expect(power([mythic("boots", { hp: 100 })]).hp).toBeGreaterThan(power(set("l", "legendary", { hp: 100 }).slice(4)).hp);
  });

  test("Epic ATK set with a Mythic HP piece replacing one: ATK drops by about 10 and HP rises by 8", () => {
    const epic = set("epic-atk", "epic", { atk: 100 });
    const before = power(epic);
    const after = power([...epic.slice(0, 4), mythic("boots", { hp: 100 })]);
    expect(before.atk - after.atk).toBeCloseTo(10.08);
    expect(after.hp - before.hp).toBeCloseTo(8);
  });

  test("the set bonus applies only to the set's own pieces, not to other gear, and only the best set counts", () => {
    const epic = set("epic-hp", "epic", { hp: 100 });
    const withLoose = battlePower({
      body: 5000,
      equipped: [...epic.slice(0, 3), mythic("leggings", { atk: 100 }), mythic("boots", { def: 100 })],
      level: 100,
    });
    expect(withLoose.gear.setPct).toBe(0.08);
    expect(withLoose.gear.boosted).toBeCloseTo(3 * 6 * 1.08 + 2 * 8);
    expect(withLoose.gear.attributes.atk).toBeCloseTo(8);
    // Two sets: only the one that reached a tier gets its bonus.
    const other = set("rare-atk", "rare", { atk: 100 });
    const two = battlePower({ body: 5000, equipped: [...epic.slice(0, 3), ...other.slice(3)], level: 100 });
    expect(two.gear.boosted).toBeCloseTo(3 * 6 * 1.08 + 2 * 5.2);
  });
});
