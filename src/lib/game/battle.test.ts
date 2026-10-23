import { describe, expect, test } from "vitest";
import { battlePower } from "./battle";
import { SLOTS, type Rarity } from "./config";

const piece = (setId: string, slot: (typeof SLOTS)[number], rarity: Rarity, plus = 0, originRarity: Rarity = rarity) => ({
  baseId: `${setId}-${slot}`,
  slot,
  rarity,
  plus,
  originRarity,
});
const fullSet = (setId: string, rarity: Rarity, plus = 0) => SLOTS.map((s) => piece(setId, s, rarity, plus));

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

  test("160 Mythic gear power counts fully from an average stat of about 70; a full set (192 with its bonus) from about 82", () => {
    const body = (avg: number) => avg * 5.5; // Five stats at 1×, Core at 0.5×.
    const noSet = SLOTS.map((s, i) => ({ ...piece("unbroken", s, "mythic"), baseId: `other-${i}` }));
    expect(battlePower({ body: body(70), equipped: noSet, level: 30 }).gear.capped).toBe(false);
    expect(battlePower({ body: body(60), equipped: noSet, level: 30 }).gear.capped).toBe(true);
    expect(battlePower({ body: body(81), equipped: fullSet("unbroken", "mythic"), level: 30 }).gear.capped).toBe(true);
    expect(battlePower({ body: body(82), equipped: fullSet("unbroken", "mythic"), level: 30 }).gear.capped).toBe(false);
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

  test("counted gear splits into HP, ATK and DEF by slot, scaled down with the cap", () => {
    const one = battlePower({ body: 300, equipped: [piece("steelguard", "helmet", "rare")], level: 1 });
    expect(one.gear.attributes.hp).toBeCloseTo(7);
    expect(one.gear.attributes.def).toBeCloseTo(3);
    expect(one.gear.attributes.atk).toBe(0);
    const capped = battlePower({ body: 100, equipped: fullSet("unbroken", "mythic"), level: 30 });
    const { hp, atk, def } = capped.gear.attributes;
    expect(hp + atk + def).toBeCloseTo(capped.gear.counted);
  });

  test("no body power means gear adds nothing", () => {
    expect(battlePower({ body: 0, equipped: fullSet("warden", "epic"), level: 10 }).total).toBe(0);
  });
});
