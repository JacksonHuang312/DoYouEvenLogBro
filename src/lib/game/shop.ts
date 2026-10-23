import type { GameState } from "./claim";
import { BASE_ITEMS, type BaseItem } from "./catalog";
import { ITEM_VALUE, SHOP, SHOP_RARITIES, type ShopRarity } from "./config";
import { fail, newItem, ok, roundCoins, type GameResult, type Item } from "./items";
import { seeded } from "./random";

/*
 * The weekly shop (GAME_DESIGN.md 3.5, 5 and 10). A week's stock is a pure function of the
 * user, the week and how many times it was rerolled, so it is never stored. shop/{weekId} keeps
 * only the reroll count and what was bought.
 */

/** users/{uid}/shop/{weekId}. Written only by the server. */
export interface ShopDoc {
  weekId: string;
  timeZone: string;
  rerolls: number;
  /** Offer key ("rerolls:index") -> the inventory id of the item bought from it. */
  bought: Record<string, string>;
  updatedAt: number;
}

export interface ShopOffer {
  index: number;
  /** Identifies the offer across rerolls: "rerolls:index". */
  key: string;
  baseId: string;
  rarity: ShopRarity;
  price: number;
}

export const emptyShop = (weekId: string, timeZone: string, now: number): ShopDoc => ({
  weekId,
  timeZone,
  rerolls: 0,
  bought: {},
  updatedAt: now,
});

/** The shop's price: the item's value plus the markup. */
export const shopPrice = (rarity: ShopRarity) => roundCoins(ITEM_VALUE[rarity] * (1 + SHOP.markup));

export const offerKey = (rerolls: number, index: number) => `${rerolls}:${index}`;

/** The inventory id of an item bought from an offer. The same offer always makes the same id, so a retry can't buy twice. */
export const shopItemId = (weekId: string, rerolls: number, index: number) => `shop-${weekId}-${rerolls}-${index}`;

/** Coins for the next reroll, or null when none are left this week. */
export const rerollCost = (doc: Pick<ShopDoc, "rerolls">): number | null => SHOP.rerollCosts[doc.rerolls] ?? null;

const bases = (rarity: ShopRarity) => BASE_ITEMS.filter((b) => b.rarity === rarity);

/**
 * A week's stock: SHOP.offers items, Common to Epic, rarities rolled by SHOP.rarityWeights with
 * at most SHOP.maxEpic Epics, and no base item twice.
 */
export function shopStock(uid: string, weekId: string, rerolls: number): ShopOffer[] {
  const rand = seeded(`shop:${uid}:${weekId}:${rerolls}`);
  const used = new Set<string>();
  const offers: ShopOffer[] = [];
  for (let index = 0; index < SHOP.offers; index++) {
    const epics = offers.filter((o) => o.rarity === "epic").length;
    const rarities = SHOP_RARITIES.filter(
      (r) => (r !== "epic" || epics < SHOP.maxEpic) && bases(r).some((b) => !used.has(b.id)),
    );
    if (rarities.length === 0) break;
    const rarity = weighted(rarities, rand);
    const choices = bases(rarity).filter((b) => !used.has(b.id));
    const base: BaseItem = choices[Math.floor(rand() * choices.length)];
    used.add(base.id);
    offers.push({ index, key: offerKey(rerolls, index), baseId: base.id, rarity, price: shopPrice(rarity) });
  }
  return offers;
}

function weighted(rarities: ShopRarity[], rand: () => number): ShopRarity {
  const total = rarities.reduce((n, r) => n + SHOP.rarityWeights[r], 0);
  let roll = rand() * total;
  for (const r of rarities) {
    roll -= SHOP.rarityWeights[r];
    if (roll < 0) return r;
  }
  return rarities[rarities.length - 1];
}

/**
 * Buys one offer of the stock the caller saw (`expectedRerolls`). The caller checks that the
 * offer wasn't bought already (a retry), which returns the original item instead.
 */
export function buyOffer({
  uid,
  doc,
  state,
  index,
  expectedRerolls,
  now,
}: {
  uid: string;
  doc: ShopDoc;
  state: GameState;
  index: number;
  expectedRerolls: number;
  now: number;
}): GameResult<{ doc: ShopDoc; state: GameState; itemId: string; item: Item; offer: ShopOffer }> {
  if (doc.rerolls !== expectedRerolls) return fail("The shop changed. Take a look at the new stock");
  const offer = shopStock(uid, doc.weekId, doc.rerolls)[index];
  if (!offer) return fail("That offer doesn't exist", 404);
  if (doc.bought[offer.key]) return fail("Already bought");
  if (state.coins < offer.price) return fail("Not enough coins", 402);
  const base = BASE_ITEMS.find((b) => b.id === offer.baseId)!;
  const item = newItem(base, "shop", now, { rarity: offer.rarity });
  if (!item.ok) return item;
  const itemId = shopItemId(doc.weekId, doc.rerolls, index);
  return ok({
    doc: { ...doc, bought: { ...doc.bought, [offer.key]: itemId }, updatedAt: now },
    state: { ...state, coins: state.coins - offer.price, updatedAt: now },
    itemId,
    item: item.value,
    offer,
  });
}

/** Rerolls the whole stock for coins. `expectedRerolls` keeps a retry from charging twice. */
export function rerollShop(
  doc: ShopDoc,
  state: GameState,
  expectedRerolls: number,
  now: number,
): GameResult<{ doc: ShopDoc; state: GameState; cost: number }> {
  if (doc.rerolls !== expectedRerolls) return fail("The shop changed. Take a look at the new stock");
  const cost = rerollCost(doc);
  if (cost == null) return fail("No rerolls left this week");
  if (state.coins < cost) return fail("Not enough coins", 402);
  return ok({
    doc: { ...doc, rerolls: doc.rerolls + 1, updatedAt: now },
    state: { ...state, coins: state.coins - cost, updatedAt: now },
    cost,
  });
}
