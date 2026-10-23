import type { GameState } from "./claim";
import { baseItem, type BaseItem } from "./catalog";
import {
  EQUIP_LEVEL,
  GEAR,
  type Focus,
  ITEM_VALUE,
  NAMED_RARITIES,
  RARITIES,
  SALVAGE,
  SELL_SHARE,
  SET_BONUS,
  SHOP,
  UNNAMED_MAX_RARITY,
  UPGRADE_COSTS,
  type Material,
  type Rarity,
  type ShopRarity,
  type Slot,
  type UpgradeCost,
} from "./config";

/*
 * Items (GAME_DESIGN.md 5 and 12). An owned item stores only facts: which base it is, the
 * rarity it started at, its current rarity and upgrade level. Its power, set and sell price are
 * computed. Every action is pure and returns the next state or why it isn't allowed; the API
 * routes write the result.
 */

export type ItemSource = "shop" | "admin" | "boss";

/** Set instead of deleting the doc, so a retried sell or salvage returns what it paid. */
export interface Removal {
  reason: "sold" | "salvaged";
  at: number;
  coins: number;
  scrap: number;
}

/** users/{uid}/inventory/{itemId}. Written only by the server. */
export interface Item {
  baseId: string;
  /** Also in the catalog; kept so the item still works if its base is ever removed. */
  slot: Slot;
  /** The rarity it started at. */
  originRarity: Rarity;
  rarity: Rarity;
  /** Upgrade level within the rarity: 0 to GEAR.maxPlus. */
  plus: number;
  /** True when it started at Legendary or Mythic. */
  named: boolean;
  source: ItemSource;
  acquiredAt: number;
  removed: Removal | null;
  updatedAt: number;
}

export type OwnedItem = Item & { id: string };

export type Materials = Partial<Record<Material, number>>;
export type Equipped = Partial<Record<Slot, string>>;

/** A Result whose failure carries the HTTP status the route should answer with. */
export type GameResult<T> = { ok: true; value: T } | { ok: false; error: string; status: 402 | 404 | 409 };
export const ok = <T>(value: T): GameResult<T> => ({ ok: true, value });
export const fail = (error: string, status: 402 | 404 | 409 = 409): GameResult<never> => ({ ok: false, error, status });

export const rarityIndex = (r: Rarity) => RARITIES.indexOf(r);
export const isNamedRarity = (r: Rarity) => NAMED_RARITIES.includes(r);

/** Promoted into a named rarity it didn't start at (Epic → Legendary, Legendary → Mythic). */
export const isAscended = (item: Pick<Item, "rarity" | "originRarity">) =>
  isNamedRarity(item.rarity) && rarityIndex(item.rarity) > rarityIndex(item.originRarity);

/** One piece's power: its rarity's base, +4% of it per + step, less the ascended penalty. */
export function piecePower(item: Pick<Item, "rarity" | "plus" | "originRarity">): number {
  const native = GEAR.basePower[item.rarity] * (1 + GEAR.plusStep * item.plus);
  return isAscended(item) ? native * GEAR.ascendedFactor[item.plus] : native;
}

export const materialsOf = (s: Pick<GameState, "materials">): Materials => s.materials ?? {};
export const equippedOf = (s: Pick<GameState, "equipped">): Equipped => s.equipped ?? {};
const amount = (m: Materials, k: Material) => m[k] ?? 0;

/** The inventory doc of an owned item (its id is the doc id, not a field). */
export function itemDoc(item: OwnedItem): Item {
  const doc: Partial<OwnedItem> = { ...item };
  delete doc.id;
  return doc as Item;
}

export const roundCoins = (x: number) => Math.round(x / SHOP.roundTo) * SHOP.roundTo;

/**
 * A new item of a base. Normally at the base's own rarity and +0; the admin script may ask for
 * a higher rarity or plus, as long as an upgrade could have got there.
 */
export function newItem(
  base: BaseItem,
  source: ItemSource,
  now: number,
  { rarity = base.rarity, plus = 0 }: { rarity?: Rarity; plus?: number } = {},
): GameResult<Item> {
  const named = isNamedRarity(base.rarity);
  if (rarityIndex(rarity) < rarityIndex(base.rarity)) return fail(`${base.name} starts at ${base.rarity}`);
  if (!named && rarityIndex(rarity) > rarityIndex(UNNAMED_MAX_RARITY)) return fail(`Unnamed gear stops at ${UNNAMED_MAX_RARITY}`);
  if (!Number.isInteger(plus) || plus < 0 || plus > GEAR.maxPlus) return fail(`Plus must be 0 to ${GEAR.maxPlus}`);
  return ok({
    baseId: base.id,
    slot: base.slot,
    originRarity: base.rarity,
    rarity,
    plus,
    named,
    source,
    acquiredAt: now,
    removed: null,
    updatedAt: now,
  });
}

// ---- Upgrades ----

export interface UpgradeStep {
  /** "plus" raises the + level; "promote" moves to the next rarity at +0. */
  kind: "plus" | "promote";
  to: { rarity: Rarity; plus: number };
  cost: UpgradeCost;
}

/** The item's next upgrade and its cost, or why there is none. */
export function upgradeStep(item: Pick<Item, "rarity" | "plus" | "named">): GameResult<UpgradeStep> {
  const costs = UPGRADE_COSTS[item.rarity];
  if (item.plus < GEAR.maxPlus) {
    const cost = costs[item.plus];
    return cost ? ok({ kind: "plus", to: { rarity: item.rarity, plus: item.plus + 1 }, cost }) : fail("Already maxed");
  }
  const next = RARITIES[rarityIndex(item.rarity) + 1];
  const cost = costs[GEAR.maxPlus];
  if (!next || !cost) return fail("Already maxed");
  if (!item.named && rarityIndex(item.rarity) >= rarityIndex(UNNAMED_MAX_RARITY)) return fail("Unnamed gear stops at Legendary +2");
  return ok({ kind: "promote", to: { rarity: next, plus: 0 }, cost });
}

/** Why `state` can't pay `cost`, or null if it can. */
export function shortfall(state: Pick<GameState, "coins" | "materials">, cost: UpgradeCost): string | null {
  const m = materialsOf(state);
  if (state.coins < cost.coins) return "Not enough coins";
  if (amount(m, "scrap") < cost.scrap) return "Not enough scrap";
  if (amount(m, "mythicCore") < (cost.mythicCore ?? 0)) return "Needs a Mythic Core (boss drop)";
  return null;
}

/**
 * Upgrades an item one step, paying coins and materials. Never fails once paid. `expected` is
 * the rarity and plus the caller saw, so a retried request can't upgrade twice. An equipped
 * item can't be upgraded into a rarity the user's level can't equip.
 */
export function applyUpgrade({
  state,
  item,
  expected,
  now,
}: {
  state: GameState;
  item: OwnedItem;
  expected: { rarity: Rarity; plus: number };
  now: number;
}): GameResult<{ state: GameState; item: Item; step: UpgradeStep }> {
  if (item.removed) return fail("That item is gone", 404);
  if (item.rarity !== expected.rarity || item.plus !== expected.plus) return fail("That item changed. Reload and try again");
  const step = upgradeStep(item);
  if (!step.ok) return step;
  const { to, cost } = step.value;
  if (equippedOf(state)[item.slot] === item.id && state.level < EQUIP_LEVEL[to.rarity]) {
    return fail(`${label(to.rarity)} needs level ${EQUIP_LEVEL[to.rarity]} to equip. Unequip it first to upgrade it`);
  }
  const missing = shortfall(state, cost);
  if (missing) return fail(missing, 402);

  const m = materialsOf(state);
  const materials: Materials = { ...m, scrap: amount(m, "scrap") - cost.scrap };
  if (cost.mythicCore) materials.mythicCore = amount(m, "mythicCore") - cost.mythicCore;
  return ok({
    state: { ...state, coins: state.coins - cost.coins, materials, updatedAt: now },
    item: { ...itemDoc(item), rarity: to.rarity, plus: to.plus, updatedAt: now },
    step: step.value,
  });
}

const label = (r: Rarity) => r[0].toUpperCase() + r.slice(1);

// ---- Equipping ----

/** Whether the user's level allows equipping the item at its current rarity. */
export const canEquip = (item: Pick<Item, "rarity">, level: number) => level >= EQUIP_LEVEL[item.rarity];

export function equipItem(state: GameState, item: OwnedItem, now: number): GameResult<GameState> {
  if (item.removed) return fail("That item is gone", 404);
  if (!canEquip(item, state.level)) return fail(`${label(item.rarity)} gear needs level ${EQUIP_LEVEL[item.rarity]}`);
  return ok({ ...state, equipped: { ...equippedOf(state), [item.slot]: item.id }, updatedAt: now });
}

export function unequipSlot(state: GameState, slot: Slot, now: number): GameState {
  const equipped = { ...equippedOf(state) };
  delete equipped[slot];
  return { ...state, equipped, updatedAt: now };
}

/** The equipped items that still exist and fit their slot. */
export function equippedItems(state: Pick<GameState, "equipped">, inventory: OwnedItem[]): OwnedItem[] {
  const equipped = equippedOf(state);
  return inventory.filter((i) => !i.removed && equipped[i.slot] === i.id);
}

// ---- Selling and salvage ----

/** Coins for selling: a share of the origin rarity's value. Null for named gear, which can only be salvaged. */
export function sellPrice(item: Pick<Item, "named" | "originRarity">): number | null {
  if (item.named) return null;
  return roundCoins(ITEM_VALUE[item.originRarity as ShopRarity] * SELL_SHARE);
}

/** Scrap for salvaging, by current rarity. */
export const salvageYield = (item: Pick<Item, "rarity">): number => SALVAGE[item.rarity];

/** Sells or salvages an item. It must be unequipped first. */
export function removeItem(
  state: GameState,
  item: OwnedItem,
  reason: Removal["reason"],
  now: number,
): GameResult<{ state: GameState; item: Item; removal: Removal }> {
  if (item.removed) return fail("That item is gone", 404);
  if (equippedOf(state)[item.slot] === item.id) return fail("Unequip it first");
  const price = reason === "sold" ? sellPrice(item) : 0;
  if (price == null) return fail("Named gear can't be sold. Salvage it for scrap instead");
  const scrap = reason === "salvaged" ? salvageYield(item) : 0;
  const removal: Removal = { reason, at: now, coins: price, scrap };
  const m = materialsOf(state);
  return ok({
    state: { ...state, coins: state.coins + price, materials: { ...m, scrap: amount(m, "scrap") + scrap }, updatedAt: now },
    item: { ...itemDoc(item), removed: removal, updatedAt: now },
    removal,
  });
}

/**
 * What a boss drop becomes (Phase 5): the item, or scrap when the user already owns that base.
 * Duplicates convert to salvage, never coins (section 12).
 */
export function dropOutcome(
  drop: { baseId: string; rarity: Rarity },
  owned: Pick<OwnedItem, "baseId" | "removed">[],
): { kind: "item" } | { kind: "salvage"; scrap: number } {
  const duplicate = owned.some((o) => !o.removed && o.baseId === drop.baseId);
  return duplicate ? { kind: "salvage", scrap: SALVAGE[drop.rarity] } : { kind: "item" };
}

// ---- Sets and focus ----

/**
 * What the set and focus rules need to know about a worn piece. `setId` and `focus` default to the
 * catalog's for the base; passing them overrides it (tests do, so they don't depend on catalog data).
 */
export type PieceRef = Pick<Item, "baseId"> & Partial<Pick<Item, "slot">> & { setId?: string | null; focus?: Focus };

/** The set a piece belongs to. Items whose base left the catalog, and loose items, belong to none. */
export const pieceSetId = (p: PieceRef): string | null => (p.setId !== undefined ? p.setId : (baseItem(p.baseId)?.setId ?? null));

/** How a piece's power splits over HP, ATK and DEF (whole percents): its own focus, else its slot's usual split. */
export function pieceFocus(p: PieceRef & Pick<Item, "slot">): Focus {
  return p.focus ?? baseItem(p.baseId)?.focus ?? GEAR.slotFocus[p.slot];
}

/** Pieces per set among `items`. */
export function setCounts(items: PieceRef[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) {
    const setId = pieceSetId(i);
    if (setId) counts[setId] = (counts[setId] ?? 0) + 1;
  }
  return counts;
}

/**
 * The set whose bonus applies: only the best equipped set counts, and it applies to that set's own
 * pieces only. With 5 armor slots two sets can't both reach the first tier, so the best set is the
 * one with the most pieces. Null when no set reaches a tier.
 */
export function activeSet(items: PieceRef[]): { setId: string; pieces: number; pct: number } | null {
  let best: { setId: string; pieces: number; pct: number } | null = null;
  for (const [setId, pieces] of Object.entries(setCounts(items))) {
    const pct = SET_BONUS.reduce((p, tier) => (pieces >= tier.pieces ? Math.max(p, tier.gearPct) : p), 0);
    if (pct > 0 && (!best || pieces > best.pieces)) best = { setId, pieces, pct };
  }
  return best;
}

/** The gear-power bonus (a share) that the best set gives its own pieces: the highest SET_BONUS tier reached. */
export const setBonusPct = (items: PieceRef[]): number => activeSet(items)?.pct ?? 0;
