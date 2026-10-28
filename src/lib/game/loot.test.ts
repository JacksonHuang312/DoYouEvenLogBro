import { describe, expect, test } from "vitest";
import { baseItem } from "./catalog";
import { BOSS_DROPS, BOSS_TOWER, WEEKLY_BOSS } from "./config";
import {
  bossTowerDrop,
  bossTowerPay,
  campaignDrop,
  campaignPay,
  NO_PITY,
  rollDrop,
  towerDrop,
  towerPay,
  weeklyDrop,
  weeklyPay,
  type Pity,
} from "./loot";
import { seeded } from "./random";

const never = () => 0.999999;

describe("drop rates", () => {
  test("weekly drops land near each tier's chance, at that tier's rarities", () => {
    for (let tier = 1; tier <= 5; tier++) {
      const rand = seeded(`rates-${tier}`);
      let drops = 0;
      const rarities = new Set<string>();
      const N = 20_000;
      for (let i = 0; i < N; i++) {
        const d = weeklyDrop(tier, rand, NO_PITY);
        if (d.rarity) {
          drops++;
          rarities.add(d.rarity);
        }
      }
      const chance = BOSS_DROPS.tiers[tier - 1].chance;
      expect(drops / N).toBeGreaterThan(chance * 0.7);
      expect(drops / N).toBeLessThan(chance * 1.3);
      for (const r of rarities) expect(BOSS_DROPS.tiers[tier - 1].weights[r as "rare"]).toBeGreaterThan(0);
    }
  });

  test("a drop is a real base item that starts at the dropped rarity", () => {
    const d = rollDrop({ table: { chance: 1, weights: { legendary: 1 } }, rand: seeded("base"), pity: NO_PITY });
    expect(baseItem(d.baseId!)?.rarity).toBe("legendary");
  });

  test("the Campaign and the endless tower never drop Legendary or Mythic", () => {
    const rand = seeded("low");
    for (let i = 0; i < 20_000; i++) {
      expect(["legendary", "mythic"]).not.toContain(campaignDrop(rand).rarity);
      expect(["legendary", "mythic", "epic"]).not.toContain(towerDrop(rand).rarity);
    }
  });
});

describe("guarantees", () => {
  test("a Legendary is guaranteed on the 42nd counted win without one", () => {
    let pity: Pity = NO_PITY;
    for (let i = 1; i < BOSS_DROPS.pity.legendary; i++) {
      const d = weeklyDrop(3, never, pity);
      expect(d.rarity).toBeNull();
      pity = d.pity;
    }
    expect(pity.sinceLegendary).toBe(BOSS_DROPS.pity.legendary - 1);
    const forced = weeklyDrop(3, never, pity);
    expect(forced).toMatchObject({ rarity: "legendary", guaranteed: true });
    expect(forced.pity.sinceLegendary).toBe(0);
  });

  test("wins at tiers that can't drop a Legendary don't count toward it", () => {
    const d = weeklyDrop(1, never, NO_PITY);
    expect(d.pity).toEqual({ sinceLegendary: 0, sinceMythic: 0 });
    expect(weeklyDrop(4, never, NO_PITY).pity).toEqual({ sinceLegendary: 1, sinceMythic: 1 });
  });

  test("a Mythic is guaranteed on the 210th counted win, with a Mythic Core", () => {
    const forced = weeklyDrop(5, never, { sinceLegendary: 3, sinceMythic: BOSS_DROPS.pity.mythic - 1 });
    expect(forced).toMatchObject({ rarity: "mythic", mythicCore: true, guaranteed: true });
    expect(forced.pity).toEqual({ sinceLegendary: 0, sinceMythic: 0 });
  });

  test("a natural Legendary resets its counter but not the Mythic one", () => {
    const d = rollDrop({ table: { chance: 1, weights: { legendary: 1, mythic: 0.0001 } }, rand: seeded("nat"), pity: { sinceLegendary: 10, sinceMythic: 10 } });
    if (d.rarity === "legendary") expect(d.pity).toEqual({ sinceLegendary: 0, sinceMythic: 11 });
  });
});

describe("what fights pay", () => {
  test("the weekly boss: the week's first win in full, refights at half", () => {
    expect(weeklyPay(3, true)).toEqual({ coins: WEEKLY_BOSS.coins[2], scrap: WEEKLY_BOSS.scrap[2] });
    expect(weeklyPay(3, false)).toEqual({ coins: 50, scrap: 15 });
  });

  test("the Boss Tower: a first clear pays well, a reclear pays a tenth of the coins and nothing else", () => {
    const first = bossTowerPay(10, true);
    expect(first).toEqual({ coins: BOSS_TOWER.coins.base + 60, scrap: BOSS_TOWER.scrap.base + 20 });
    expect(bossTowerPay(10, false)).toEqual({ coins: Math.round((first.coins * 0.1) / 5) * 5, scrap: 0 });
  });

  test("every 10th Boss Tower floor can drop a Mythic Core; others can't", () => {
    const always = () => 0;
    expect(bossTowerDrop(10, always, NO_PITY).mythicCore).toBe(true);
    expect(bossTowerDrop(9, always, NO_PITY).mythicCore).toBe(false);
  });

  test("Campaign stages and tower floors pay a little more as they go", () => {
    expect(campaignPay(10).coins).toBeGreaterThan(campaignPay(1).coins);
    expect(towerPay(9).coins).toBeLessThan(towerPay(10).coins);
    expect(towerPay(200).coins).toBeLessThanOrEqual(90);
  });

  test("payouts take no gear effects, so nothing worn changes coins earned", () => {
    expect(weeklyPay.length).toBe(2);
    expect(bossTowerPay.length).toBe(2);
    expect(campaignPay.length).toBe(1);
    expect(towerPay.length).toBe(1);
  });
});
