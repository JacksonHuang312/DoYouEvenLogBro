import type { GameState } from "./claim";
import { baseItem, type BaseItem } from "./catalog";
import {
  ACCESSORY_EFFECTS,
  AUTO_SALVAGE_BELOW,
  EFFECT_SCALE,
  GEAR,
  type Focus,
  ITEM_LEVEL,
  ITEM_VALUE,
  MYTHIC_PROMOTION,
  POSITIONS,
  RARITIES,
  REFORGE_SCRAP_PER_LEVEL,
  SALVAGE,
  SALVAGE_LEVEL,
  SELL_SHARE,
  SET_BONUS,
  SHOP,
  SHOP_RARITIES,
  UPGRADE_COSTS,
  isAccessory,
  isWeapon,
  positionsOf,
  slotOfPosition,
  type AccessoryEffect,
  type AutoSalvageBelow,
  type Material,
  type Position,
  type Rarity,
  type ShopRarity,
  type Slot,
  type UpgradeCost,
} from "./config";

/*
 * Items (GAME_DESIGN.md 5, 12 and 13.5). An owned item stores only facts: which base it is, its
 * rarity, item level and upgrade level. Its power, set and sell price are computed. Every action is
 * pure and returns the next state or why it isn't allowed; the API routes write the result.
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
  /** Rolled when it dropped. Only a Legendary turned Mythic with a Mythic Core ever changes it. */
  rarity: Rarity;
  /** Upgrade level within the rarity: 0 to GEAR.maxPlus. */
  plus: number;
  /** Where it dropped (13.5); reforging raises it. Items from before item levels have none: level 1. */
  itemLevel: number;
  source: ItemSource;
  acquiredAt: number;
  removed: Removal | null;
  updatedAt: number;
}

export type OwnedItem = Item & { id: string };

export type Materials = Partial<Record<Material, number>>;
/** Position -> inventory id: helmet … boots, ring1, ring2, necklace, belt, charm1, charm2. */
export type Equipped = Partial<Record<Position, string>>;

/** A Result whose failure carries the HTTP status the route should answer with. */
export type GameResult<T> = { ok: true; value: T } | { ok: false; error: string; status: 402 | 404 | 409 };
export const ok = <T>(value: T): GameResult<T> => ({ ok: true, value });
export const fail = (error: string, status: 402 | 404 | 409 = 409): GameResult<never> => ({ ok: false, error, status });

export const rarityIndex = (r: Rarity) => RARITIES.indexOf(r);

/** An item's level; items from before item levels count as level 1. */
export const itemLevelOf = (item: Partial<Pick<Item, "itemLevel">>): number => item.itemLevel ?? ITEM_LEVEL.min;

/** An armor piece's power at item level `level`, Common, +0 (GEAR.levelPower). */
export function levelPower(level: number): number {
  const { base, perLevel, perLevelSq } = GEAR.levelPower;
  return base + perLevel * level + perLevelSq * level * level;
}

/** How a slot's power compares with an armor piece: accessories less, the weapon more. */
export const slotWeight = (slot?: Slot): number => (!slot ? 1 : isWeapon(slot) ? GEAR.weaponWeight : isAccessory(slot) ? GEAR.accessoryWeight : 1);

/**
 * One piece's power: its level's power × its rarity multiplier × its slot's weight, +4% per + step.
 * Without a slot it is armor; without an item level, level 1.
 */
export function piecePower(item: Pick<Item, "rarity" | "plus"> & Partial<Pick<Item, "slot" | "itemLevel">>): number {
  return levelPower(itemLevelOf(item)) * GEAR.rarityMultiplier[item.rarity] * slotWeight(item.slot) * (1 + GEAR.plusStep * item.plus);
}

/** An accessory effect's strength at a rarity (a Phase 5 hook: nothing in combat reads it yet). */
export const effectValue = (effect: AccessoryEffect, rarity: Rarity): number => ACCESSORY_EFFECTS[effect].value * EFFECT_SCALE[rarity];

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

export const isItemLevel = (level: unknown): level is number =>
  Number.isInteger(level) && (level as number) >= ITEM_LEVEL.min && (level as number) <= ITEM_LEVEL.max;

/**
 * A new item of a base at a rarity and item level, normally +0 (the admin script may ask for a plus).
 * A unique Mythic is always Mythic; anything else can be any rarity.
 */
export function newItem(
  base: BaseItem,
  source: ItemSource,
  now: number,
  { rarity, itemLevel, plus = 0 }: { rarity: Rarity; itemLevel: number; plus?: number },
): GameResult<Item> {
  if (!RARITIES.includes(rarity)) return fail("Unknown rarity");
  if (base.mythic && rarity !== "mythic") return fail(`${base.name} is always Mythic`);
  if (!isItemLevel(itemLevel)) return fail(`Item level must be ${ITEM_LEVEL.min} to ${ITEM_LEVEL.max}`);
  if (!Number.isInteger(plus) || plus < 0 || plus > GEAR.maxPlus) return fail(`Plus must be 0 to ${GEAR.maxPlus}`);
  return ok({
    baseId: base.id,
    slot: base.slot,
    rarity,
    plus,
    itemLevel,
    source,
    acquiredAt: now,
    removed: null,
    updatedAt: now,
  });
}

// ---- Upgrades ----

export interface UpgradeStep {
  /** "plus" raises the + level; "promote" turns a Legendary +2 into a Mythic +0. */
  kind: "plus" | "promote";
  to: { rarity: Rarity; plus: number };
  cost: UpgradeCost;
}

/** The item's next upgrade and its cost, or why there is none. Rarity only changes Legendary → Mythic (13.5). */
export function upgradeStep(item: Pick<Item, "rarity" | "plus">): GameResult<UpgradeStep> {
  if (item.plus < GEAR.maxPlus) {
    const cost = UPGRADE_COSTS[item.rarity][item.plus];
    return ok({ kind: "plus", to: { rarity: item.rarity, plus: item.plus + 1 }, cost });
  }
  if (item.rarity === "legendary") return ok({ kind: "promote", to: { rarity: "mythic", plus: 0 }, cost: MYTHIC_PROMOTION });
  return fail("Already maxed");
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
 * the rarity and plus the caller saw, so a retried request can't upgrade twice.
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

// ---- Reforging ----

/** Scrap to raise an item to `level`: REFORGE_SCRAP_PER_LEVEL by its rarity for each level gained. */
export const reforgeCost = (item: Pick<Item, "rarity"> & Partial<Pick<Item, "itemLevel">>, level: number): number =>
  Math.max(0, level - itemLevelOf(item)) * REFORGE_SCRAP_PER_LEVEL[item.rarity];

/**
 * Reforges an item to the user's level for scrap (13.5), so a great roll doesn't go obsolete.
 * `expectedLevel` is the item level the caller saw, so a retried request can't pay twice.
 */
export function applyReforge({
  state,
  item,
  expectedLevel,
  now,
}: {
  state: GameState;
  item: OwnedItem;
  expectedLevel: number;
  now: number;
}): GameResult<{ state: GameState; item: Item; scrap: number; to: number }> {
  if (item.removed) return fail("That item is gone", 404);
  if (itemLevelOf(item) !== expectedLevel) return fail("That item changed. Reload and try again");
  const to = Math.min(state.level, ITEM_LEVEL.max);
  if (itemLevelOf(item) >= to) return fail("Already at your level");
  const scrap = reforgeCost(item, to);
  const m = materialsOf(state);
  if (amount(m, "scrap") < scrap) return fail("Not enough scrap", 402);
  return ok({
    state: { ...state, materials: { ...m, scrap: amount(m, "scrap") - scrap }, updatedAt: now },
    item: { ...itemDoc(item), itemLevel: to, updatedAt: now },
    scrap,
    to,
  });
}

// ---- Equipping ----

/** Whether the user's level allows equipping the item: you can't wear one above your level. */
export const canEquip = (item: Partial<Pick<Item, "itemLevel">>, level: number) => itemLevelOf(item) <= level;

/** Where an item is equipped, or null. */
export function equippedPosition(state: Pick<GameState, "equipped">, itemId: string): Position | null {
  return POSITIONS.find((p) => equippedOf(state)[p] === itemId) ?? null;
}

/** Where an item of a slot goes when the player doesn't choose: the first empty position, else the first. */
export function defaultPosition(state: Pick<GameState, "equipped">, slot: Slot): Position {
  const positions = positionsOf(slot);
  return positions.find((p) => !equippedOf(state)[p]) ?? positions[0];
}

/**
 * Equips an item at `position` (default: where it already is, else the first empty position of its
 * slot), replacing what is there. An item fits only positions of its own slot, and only one at a time.
 */
export function equipItem(state: GameState, item: OwnedItem, now: number, position?: Position): GameResult<GameState> {
  if (item.removed) return fail("That item is gone", 404);
  if (!canEquip(item, state.level)) return fail(`Needs level ${itemLevelOf(item)}`);
  const at = equippedPosition(state, item.id);
  const target = position ?? at ?? defaultPosition(state, item.slot);
  if (slotOfPosition(target) !== item.slot) return fail(`A ${item.slot} can't be worn in the ${target} position`);
  if (at && at !== target) return fail("Already equipped in another position. Unequip it first");
  return ok({ ...state, equipped: { ...equippedOf(state), [target]: item.id }, updatedAt: now });
}

export function unequipPosition(state: GameState, position: Position, now: number): GameState {
  const equipped = { ...equippedOf(state) };
  delete equipped[position];
  return { ...state, equipped, updatedAt: now };
}

/** The equipped items that still exist and fit where they are worn, each once. */
export function equippedItems(state: Pick<GameState, "equipped">, inventory: OwnedItem[]): OwnedItem[] {
  const equipped = equippedOf(state);
  const live = new Map(inventory.filter((i) => !i.removed).map((i) => [i.id, i]));
  const worn = new Set<OwnedItem>();
  for (const position of POSITIONS) {
    const item = live.get(equipped[position] ?? "");
    if (item && slotOfPosition(position) === item.slot) worn.add(item);
  }
  return [...worn];
}

// ---- Selling and salvage ----

/** Coins for selling: a share of the rarity's value. Null for Legendary and Mythic, which can only be salvaged. */
export function sellPrice(item: Pick<Item, "rarity">): number | null {
  if (!(SHOP_RARITIES as readonly Rarity[]).includes(item.rarity)) return null;
  return roundCoins(ITEM_VALUE[item.rarity as ShopRarity] * SELL_SHARE);
}

/** Scrap for salvaging, by rarity and item level, plus the salvage charm's share (`bonus`, the salvageYield effect), rounded. */
export function salvageYield(item: Pick<Item, "rarity"> & Partial<Pick<Item, "itemLevel">>, bonus = 0): number {
  const byLevel = SALVAGE_LEVEL.levelBase + SALVAGE_LEVEL.perLevel * itemLevelOf(item);
  return Math.max(1, Math.round(SALVAGE[item.rarity] * byLevel * (1 + bonus)));
}

/** Sells or salvages an item. It must be unequipped first. `salvageBonus` is the worn salvageYield effect. */
export function removeItem(
  state: GameState,
  item: OwnedItem,
  reason: Removal["reason"],
  now: number,
  salvageBonus = 0,
): GameResult<{ state: GameState; item: Item; removal: Removal }> {
  if (item.removed) return fail("That item is gone", 404);
  if (equippedPosition(state, item.id)) return fail("Unequip it first");
  const price = reason === "sold" ? sellPrice(item) : 0;
  if (price == null) return fail("Legendary and Mythic gear can't be sold. Salvage it for scrap instead");
  const scrap = reason === "salvaged" ? salvageYield(item, salvageBonus) : 0;
  const removal: Removal = { reason, at: now, coins: price, scrap };
  const m = materialsOf(state);
  return ok({
    state: { ...state, coins: state.coins + price, materials: { ...m, scrap: amount(m, "scrap") + scrap }, updatedAt: now },
    item: { ...itemDoc(item), removed: removal, updatedAt: now },
    removal,
  });
}

// ---- Auto-salvage (13.9) ----

/** The rarity below which fight drops are salvaged as they land, or null when it is off. */
export const autoSalvageOf = (s: Pick<GameState, "autoSalvage">): AutoSalvageBelow | null =>
  (AUTO_SALVAGE_BELOW as readonly unknown[]).includes(s.autoSalvage) ? s.autoSalvage! : null;

/** Whether an item of `rarity` falls under "salvage below `below`". Never Legendary or Mythic, and nothing when it is off. */
export const salvagesBelow = (rarity: Rarity, below: AutoSalvageBelow | null): boolean =>
  below != null && rarityIndex(rarity) < rarityIndex(below) && rarityIndex(rarity) < rarityIndex("legendary");

/** Turns auto-salvage on at a rarity, or off with null. */
export const setAutoSalvage = (state: GameState, below: AutoSalvageBelow | null, now: number): GameState => ({
  ...state,
  autoSalvage: below,
  updatedAt: now,
});

/**
 * Salvages every one of `items` that is below `below`, still owned and not worn, in one go (the Gear
 * tab's bulk button). Anything else in the list is left alone, so a retry after it went through
 * changes nothing. `salvageBonus` is the worn salvageYield effect.
 */
export function salvageBelow(
  state: GameState,
  items: OwnedItem[],
  below: AutoSalvageBelow,
  now: number,
  salvageBonus = 0,
): { state: GameState; items: { id: string; item: Item }[]; scrap: number } {
  let next = state;
  let scrap = 0;
  const changed: { id: string; item: Item }[] = [];
  for (const item of items) {
    if (!salvagesBelow(item.rarity, below) || changed.some((c) => c.id === item.id)) continue;
    const r = removeItem(next, item, "salvaged", now, salvageBonus);
    if (!r.ok) continue;
    next = r.value.state;
    scrap += r.value.removal.scrap;
    changed.push({ id: item.id, item: r.value.item });
  }
  return { state: next, items: changed, scrap };
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
