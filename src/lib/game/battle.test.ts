import { describe, expect, test } from "vitest";
import { battlePower } from "./battle";
import { ARMOR_SLOTS, type Focus, type Rarity } from "./config";

const piece = (setId: string, slot: (typeof ARMOR_SLOTS)[number], rarity: Rarity, plus = 0, originRarity: Rarity = rarity) => ({
  baseId: `${setId}-${slot}`,
  slot,
  rarity,
  plus,
  originRarity,
});
const fullSet = (setId: string, rarity: Rarity, plus = 0) => ARMOR_SLOTS.map((s) => piece(setId, s, rarity, plus));

describe("battlePower", () => {
  test("no gear and no titles: battle power is body power", () => {
    const p = battlePower({ body: 250, equipped: [], level: 1 });
    expect(p.total).toBe(250);
    expect(p.gear).toMatchObject({ raw: 0, counted: 0, capped: false });
  });

  test("gear counts in full under the cap", () => {
    const p = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare"), piece("ironbound", "boots", "common")], level: 1 });
    expect(p.gear.counted).toBe(13);
    expect(p.total).toBe(313);
  });

  test("gear is capped at 30% of total power", () => {
    const p = battlePower({ body: 100, equipped: fullSet("unbroken", "mythic"), level: 30 });
    expect(p.gear.capped).toBe(true);
    expect(p.gear.counted).toBeCloseTo((0.3 / 0.7) * 100);
    expect(p.gear.counted / p.total).toBeCloseTo(0.3);
  });

  test("five Mythics are 150 gear power with no set bonus, and count in full from an average stat of about 64", () => {
    const body = (avg: number) => avg * 5.5; // Five stats at 1×, Core at 0.5×.
    const mythics = fullSet("unbroken", "mythic");
    const p = battlePower({ body: body(70), equipped: mythics, level: 30 });
    expect(p.gear).toMatchObject({ raw: 150, setPct: 0, capped: false });
    expect(battlePower({ body: body(64), equipped: mythics, level: 30 }).gear.capped).toBe(false);
    expect(battlePower({ body: body(63), equipped: mythics, level: 30 }).gear.capped).toBe(true);
  });

  test("set bonuses multiply gear power before the cap", () => {
    const five = battlePower({ body: 1000, equipped: fullSet("warden", "epic"), level: 10 });
    expect(five.gear).toMatchObject({ raw: 75, setPct: 0.2 });
    expect(five.gear.counted).toBeCloseTo(90);
    expect(five.bonus.total).toBe(0);
    // Capped: the set bonus can't push gear past 30%.
    const capped = battlePower({ body: 150, equipped: fullSet("warden", "epic"), level: 10 });
    expect(capped.gear.counted).toBeCloseTo((0.3 / 0.7) * 150);
  });

  test("pieces the level can't equip don't count", () => {
    const p = battlePower({ body: 300, equipped: [piece("warden", "helmet", "epic"), piece("ironbound", "boots", "common")], level: 7 });
    expect(p.gear.raw).toBe(3);
  });

  test("titles and class share one bucket capped at +25%", () => {
    expect(battlePower({ body: 200, equipped: [], level: 1, titlePct: 0.13 }).total).toBeCloseTo(226);
    const capped = battlePower({ body: 200, equipped: [], level: 1, titlePct: 0.15, classPct: 0.2 });
    expect(capped.bonus).toMatchObject({ total: 0.25, capped: true });
    expect(capped.total).toBe(250);
  });

  test("the bucket multiplies body and counted gear together", () => {
    const p = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare")], level: 1, titlePct: 0.1 });
    expect(p.total).toBeCloseTo(310 * 1.1);
  });

  test("counted gear splits into HP, ATK and DEF by each piece's focus, scaled down with the cap", () => {
    // Steelguard is a 60% DEF / 40% HP set; Ironbound has no focus and uses its slot's 70/30.
    const one = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare"), piece("ironbound", "helmet", "common")], level: 1 });
    expect(one.gear.attributes.hp).toBeCloseTo(4 + 2.1);
    expect(one.gear.attributes.def).toBeCloseTo(6 + 0.9);
    expect(one.gear.attributes.atk).toBe(0);
    const capped = battlePower({ body: 100, equipped: fullSet("unbroken", "mythic"), level: 30 });
    const { hp, atk, def } = capped.gear.attributes;
    expect(hp + atk + def).toBeCloseTo(capped.gear.counted);
  });

  test("no body power means gear adds nothing", () => {
    expect(battlePower({ body: 0, equipped: fullSet("warden", "epic"), level: 10 }).total).toBe(0);
  });
});

/*
 * The intended balance of sets against Mythics (GAME_DESIGN.md 12). Pieces carry their own set and
 * focus here, so these numbers don't change when real catalog items do.
 */
describe("sets against Mythics", () => {
  type Worn = Parameters<typeof battlePower>[0]["equipped"][number];
  const set = (setId: string, rarity: Rarity, focus: Focus): Worn[] =>
    ARMOR_SLOTS.map((slot) => ({ baseId: `${setId}-${slot}`, slot, rarity, plus: 0, originRarity: rarity, setId, focus }));
  const mythic = (slot: (typeof ARMOR_SLOTS)[number], focus: Focus): Worn => ({
    baseId: `mythic-${slot}`,
    slot,
    rarity: "mythic",
    plus: 0,
    originRarity: "mythic",
    setId: null,
    focus,
  });
  const power = (equipped: Worn[]) => battlePower({ body: 5000, equipped, level: 30 }).gear.attributes;

  test("Epic HP set: 5 × 15 with +20% is 90 HP; swapping one piece for a Mythic HP (30) gives 94.8, so the Mythic is better", () => {
    const epic = set("epic-hp", "epic", { hp: 100 });
    expect(power(epic).hp).toBeCloseTo(90);
    const swapped = [...epic.slice(0, 4), mythic("boots", { hp: 100 })];
    expect(power(swapped).hp).toBeCloseTo(4 * 15 * 1.08 + 30);
    expect(power(swapped).hp).toBeCloseTo(94.8);
    expect(power(swapped).hp).toBeGreaterThan(power(epic).hp);
  });

  test("Legendary HP set: 5 × 22 with +20% is 132 HP; the same swap gives about 125, so the set is better", () => {
    const legendary = set("legendary-hp", "legendary", { hp: 100 });
    expect(power(legendary).hp).toBeCloseTo(132);
    const swapped = [...legendary.slice(0, 4), mythic("boots", { hp: 100 })];
    expect(power(swapped).hp).toBeCloseTo(4 * 22 * 1.08 + 30);
    expect(power(swapped).hp).toBeCloseTo(125.04);
    expect(power(swapped).hp).toBeLessThan(power(legendary).hp);
  });

  test("Epic ATK set with a Mythic HP piece replacing one: ATK drops by about 25 and HP rises by 30", () => {
    const epic = set("epic-atk", "epic", { atk: 100 });
    const before = power(epic);
    const after = power([...epic.slice(0, 4), mythic("boots", { hp: 100 })]);
    expect(before.atk - after.atk).toBeCloseTo(25.2);
    expect(after.hp - before.hp).toBeCloseTo(30);
  });

  test("the set bonus applies only to the set's own pieces, not to other gear, and only the best set counts", () => {
    const epic = set("epic-hp", "epic", { hp: 100 });
    const withLoose = battlePower({
      body: 5000,
      equipped: [...epic.slice(0, 3), mythic("leggings", { atk: 100 }), mythic("boots", { def: 100 })],
      level: 30,
    });
    expect(withLoose.gear.setPct).toBe(0.08);
    expect(withLoose.gear.boosted).toBeCloseTo(3 * 15 * 1.08 + 60);
    expect(withLoose.gear.attributes.atk).toBeCloseTo(30);
    // Two sets: only the one that reached a tier gets its bonus.
    const other = set("rare-atk", "rare", { atk: 100 });
    const two = battlePower({ body: 5000, equipped: [...epic.slice(0, 3), ...other.slice(3)], level: 30 });
    expect(two.gear.boosted).toBeCloseTo(3 * 15 * 1.08 + 2 * 10);
  });
});
