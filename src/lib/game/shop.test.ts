import { describe, expect, test } from "vitest";
import { baseItem } from "./catalog";
import { newGameState, type GameState } from "./claim";
import { SHOP } from "./config";
import { buyOffer, emptyShop, rerollCost, rerollShop, shopItemId, shopPrice, shopStock, type ShopDoc } from "./shop";
import { T0 } from "./test-helpers";

const WEEK = "2026-10-11";
const state = (coins: number): GameState => ({ ...newGameState(T0, "UTC"), coins });
const shop = (patch: Partial<ShopDoc> = {}): ShopDoc => ({ ...emptyShop(WEEK, "UTC", T0), ...patch });

describe("prices", () => {
  test("value plus 25%: 190, 565, 1,250, 3,125", () => {
    expect(["common", "uncommon", "rare", "epic"].map((r) => shopPrice(r as "common"))).toEqual([190, 565, 1250, 3125]);
  });
});

describe("shopStock", () => {
  test("the same user, week and reroll count always give the same stock", () => {
    expect(shopStock("alice", WEEK, 0)).toEqual(shopStock("alice", WEEK, 0));
  });

  test("changes with the week, the user and each reroll", () => {
    const ids = (s: ReturnType<typeof shopStock>) => s.map((o) => o.baseId).join();
    const base = ids(shopStock("alice", WEEK, 0));
    expect(ids(shopStock("alice", "2026-10-18", 0))).not.toBe(base);
    expect(ids(shopStock("bob", WEEK, 0))).not.toBe(base);
    expect(ids(shopStock("alice", WEEK, 1))).not.toBe(base);
  });

  test("six offers, Common to Epic only, at most one Epic, no base twice, priced by rarity", () => {
    for (let w = 0; w < 300; w++) {
      const stock = shopStock(`u${w % 7}`, `2026-${String(1 + (w % 12)).padStart(2, "0")}-0${1 + (w % 9)}`, w % 3);
      expect(stock).toHaveLength(SHOP.offers);
      expect(stock.filter((o) => o.rarity === "epic").length).toBeLessThanOrEqual(SHOP.maxEpic);
      expect(new Set(stock.map((o) => o.baseId)).size).toBe(stock.length);
      for (const o of stock) {
        expect(["common", "uncommon", "rare", "epic"]).toContain(o.rarity);
        expect(baseItem(o.baseId)?.rarity).toBe(o.rarity);
        expect(o.price).toBe(shopPrice(o.rarity));
      }
    }
  });

  test("rarities roughly follow the weights", () => {
    const counts: Record<string, number> = {};
    for (let w = 0; w < 500; w++) for (const o of shopStock(`u${w}`, WEEK, 0)) counts[o.rarity] = (counts[o.rarity] ?? 0) + 1;
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.uncommon).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.epic);
    expect(counts.epic).toBeGreaterThan(0);
  });
});

describe("buyOffer", () => {
  const offer = shopStock("alice", WEEK, 0)[2];

  test("charges the price, records the offer and makes the item with a deterministic id", () => {
    const r = buyOffer({ uid: "alice", doc: shop(), state: state(5000), index: 2, expectedRerolls: 0, now: T0 + 1 });
    expect(r).toMatchObject({
      ok: true,
      value: {
        state: { coins: 5000 - offer.price },
        doc: { bought: { "0:2": shopItemId(WEEK, 0, 2) } },
        itemId: `shop-${WEEK}-0-2`,
        item: { baseId: offer.baseId, rarity: offer.rarity, originRarity: offer.rarity, source: "shop", plus: 0, named: false },
      },
    });
  });

  test("refuses a stock the caller didn't see (rerolled meanwhile)", () => {
    expect(buyOffer({ uid: "alice", doc: shop({ rerolls: 1 }), state: state(5000), index: 2, expectedRerolls: 0, now: T0 })).toMatchObject({ ok: false, status: 409 });
  });

  test("an offer sells once", () => {
    const doc = shop({ bought: { "0:2": shopItemId(WEEK, 0, 2) } });
    expect(buyOffer({ uid: "alice", doc, state: state(5000), index: 2, expectedRerolls: 0, now: T0 })).toMatchObject({ ok: false, error: "Already bought" });
  });

  test("not enough coins is a 402; a missing offer a 404", () => {
    expect(buyOffer({ uid: "alice", doc: shop(), state: state(offer.price - 1), index: 2, expectedRerolls: 0, now: T0 })).toMatchObject({ ok: false, status: 402 });
    expect(buyOffer({ uid: "alice", doc: shop(), state: state(5000), index: 6, expectedRerolls: 0, now: T0 })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("rerollShop", () => {
  test("costs 100, then 200, then none are left", () => {
    expect(rerollCost(shop())).toBe(100);
    const first = rerollShop(shop(), state(1000), 0, T0);
    expect(first).toMatchObject({ ok: true, value: { cost: 100, state: { coins: 900 }, doc: { rerolls: 1 } } });
    const second = first.ok ? rerollShop(first.value.doc, first.value.state, 1, T0) : null;
    expect(second).toMatchObject({ ok: true, value: { cost: 200, state: { coins: 700 }, doc: { rerolls: 2 } } });
    expect(second?.ok && rerollShop(second.value.doc, second.value.state, 2, T0)).toMatchObject({ ok: false, error: "No rerolls left this week" });
  });

  test("a retry with the old count can't charge twice", () => {
    expect(rerollShop(shop({ rerolls: 1 }), state(1000), 0, T0)).toMatchObject({ ok: false, status: 409 });
  });

  test("not enough coins is a 402", () => {
    expect(rerollShop(shop(), state(99), 0, T0)).toMatchObject({ ok: false, status: 402 });
  });
});
