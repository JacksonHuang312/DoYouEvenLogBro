import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { newGameState, type GameState } from "../game/claim";
import { DEFAULT_TIME_ZONE, type Position, type Rarity } from "../game/config";
import {
  applyReforge,
  applyUpgrade,
  defaultPosition,
  equipItem,
  equippedOf,
  equippedPosition,
  materialsOf,
  removeItem,
  unequipPosition,
  upgradeStep,
  type Equipped,
  type GameResult,
  type Item,
  type Materials,
  type OwnedItem,
  type Removal,
} from "../game/items";
import { gearEffects, NO_EFFECTS, type GearEffects } from "../game/effects";
import { buyOffer, emptyShop, offerKey, rerollShop, type ShopDoc } from "../game/shop";
import { weekId as weekIdOf } from "../game/time";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { gameRefs, type GameRefs } from "./refs";

/** A failed game action becomes an HTTP error with the status it carries. */
export function unwrap<T>(result: GameResult<T>): T {
  if (!result.ok) throw new HttpError(result.status, result.error);
  return result.value;
}

export const stateOf = (snap: DocumentSnapshot, now: number, timeZone: string): GameState =>
  snap.exists ? (snap.data() as GameState) : newGameState(now, timeZone);

export const ownedOf = (snap: DocumentSnapshot): OwnedItem => ({ id: snap.id, ...(snap.data() as Item) });

/** The equipped items, read in the transaction. */
export async function wornItems(tx: Transaction, r: GameRefs, state: GameState): Promise<OwnedItem[]> {
  const ids = [...new Set(Object.values(equippedOf(state)).filter((id): id is string => !!id))];
  if (!ids.length) return [];
  const snaps = await tx.getAll(...ids.map((id) => r.inventory.doc(id)));
  return snaps.filter((s) => s.exists).map(ownedOf).filter((i) => !i.removed);
}

/** What the worn gear does (charms included), read in the transaction. */
export async function wornEffects(tx: Transaction, r: GameRefs, state: GameState): Promise<GearEffects> {
  const worn = await wornItems(tx, r, state);
  return worn.length ? gearEffects(worn, state.level) : NO_EFFECTS;
}

// ---- Shop ----

export type ShopAction =
  | { action: "buy"; weekId: string; index: number; expectedRerolls: number; expectedBaseId?: string }
  | { action: "reroll"; weekId: string; expectedRerolls: number };

export interface ShopResponse {
  status: "bought" | "already-bought" | "rerolled";
  shop: ShopDoc;
  coins: number;
  /** The item bought (also on a retry of the same buy). */
  item?: OwnedItem;
  cost?: number;
}

/**
 * Buys an offer or rerolls this week's stock (GAME_DESIGN.md 5, 10). The caller names the week
 * and reroll count it saw, so a week rollover or a reroll in between never charges for stock the
 * user didn't see, and a retried buy returns the item it already bought.
 */
export async function shopAction(uid: string, input: ShopAction, timeZone?: string): Promise<ShopResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);
  const shopRef = r.shop.doc(input.weekId);

  return db.runTransaction(async (tx) => {
    const [stateSnap, shopSnap] = await tx.getAll(r.state, shopRef);
    const now = Date.now();
    const state = stateOf(stateSnap, now, timeZone ?? DEFAULT_TIME_ZONE);
    const zone = timeZone ?? state.timeZone;
    const doc = shopSnap.exists ? (shopSnap.data() as ShopDoc) : emptyShop(input.weekId, zone, now);

    if (input.action === "buy") {
      const boughtId = doc.bought[offerKey(input.expectedRerolls, input.index)];
      if (boughtId) {
        const itemSnap = await tx.get(r.inventory.doc(boughtId));
        return { status: "already-bought", shop: doc, coins: state.coins, item: itemSnap.exists ? ownedOf(itemSnap) : undefined };
      }
    }
    if (weekIdOf(now, zone) !== input.weekId) throw new HttpError(409, "The shop just restocked. Take a look at the new stock");

    if (input.action === "reroll") {
      const { rerollDiscount } = await wornEffects(tx, r, state);
      const next = unwrap(rerollShop(doc, state, input.expectedRerolls, now, rerollDiscount));
      tx.set(shopRef, next.doc);
      tx.set(r.state, next.state);
      return { status: "rerolled", shop: next.doc, coins: next.state.coins, cost: next.cost };
    }

    const bought = unwrap(
      buyOffer({ uid, doc, state, index: input.index, expectedRerolls: input.expectedRerolls, expectedBaseId: input.expectedBaseId, now }),
    );
    tx.create(r.inventory.doc(bought.itemId), bought.item);
    tx.set(shopRef, bought.doc);
    tx.set(r.state, bought.state);
    return {
      status: "bought",
      shop: bought.doc,
      coins: bought.state.coins,
      item: { id: bought.itemId, ...bought.item },
      cost: bought.offer.price,
    };
  });
}

// ---- Items ----

export type ItemAction =
  | { action: "equip"; itemId: string; position?: Position }
  | { action: "unequip"; position: Position }
  | { action: "upgrade"; itemId: string; expectedRarity: Rarity; expectedPlus: number }
  | { action: "reforge"; itemId: string; expectedLevel: number }
  | { action: "equipMany"; items: { itemId: string; position: Position }[] }
  | { action: "sell"; itemId: string }
  | { action: "salvage"; itemId: string };

export interface ItemResponse {
  /** "already-done": a retry of an action that already happened; nothing changed. */
  status: "done" | "already-done";
  item?: OwnedItem;
  coins: number;
  materials: Materials;
  equipped: Equipped;
}

const REMOVAL: Record<"sell" | "salvage", Removal["reason"]> = { sell: "sold", salvage: "salvaged" };

/** Equips (at a position, or several at once), unequips, upgrades, reforges, sells or salvages. Every action is safe to retry. */
export async function itemAction(uid: string, input: ItemAction): Promise<ItemResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const answer = (status: ItemResponse["status"], state: GameState, item?: OwnedItem): ItemResponse => ({
      status,
      item,
      coins: state.coins,
      materials: materialsOf(state),
      equipped: equippedOf(state),
    });

    if (input.action === "unequip") {
      const state = stateOf(await tx.get(r.state), now, DEFAULT_TIME_ZONE);
      if (!equippedOf(state)[input.position]) return answer("already-done", state);
      const next = unequipPosition(state, input.position, now);
      tx.set(r.state, next);
      return answer("done", next);
    }

    if (input.action === "equipMany") {
      // Each item goes to its position in turn; a retry finds them all already there and changes nothing.
      const refs = input.items.map((i) => r.inventory.doc(i.itemId));
      const [stateSnap, ...snaps] = await tx.getAll(r.state, ...refs);
      const state = stateOf(stateSnap, now, DEFAULT_TIME_ZONE);
      let next = state;
      for (const [i, { position }] of input.items.entries()) {
        if (!snaps[i].exists) throw new HttpError(404, "That item doesn't exist");
        const item = ownedOf(snaps[i]);
        if (equippedOf(next)[position] === item.id) continue;
        // Moving an item that is worn elsewhere: take it off there first.
        const at = equippedPosition(next, item.id);
        if (at) next = unequipPosition(next, at, now);
        next = unwrap(equipItem(next, item, now, position));
      }
      if (next === state) return answer("already-done", state);
      tx.set(r.state, next);
      return answer("done", next);
    }

    const [stateSnap, itemSnap] = await tx.getAll(r.state, r.inventory.doc(input.itemId));
    if (!itemSnap.exists) throw new HttpError(404, "That item doesn't exist");
    const state = stateOf(stateSnap, now, DEFAULT_TIME_ZONE);
    const item = ownedOf(itemSnap);

    switch (input.action) {
      case "equip": {
        // A retry finds the item already where it was sent.
        const target = input.position ?? equippedPosition(state, item.id) ?? defaultPosition(state, item.slot);
        if (!item.removed && equippedOf(state)[target] === item.id) return answer("already-done", state, item);
        const next = unwrap(equipItem(state, item, now, target));
        tx.set(r.state, next);
        return answer("done", next, item);
      }
      case "upgrade": {
        // A retry after the upgrade went through finds the item one step past what it expected.
        const expected = { rarity: input.expectedRarity, plus: input.expectedPlus };
        const step = upgradeStep(expected);
        if (!item.removed && step.ok && step.value.to.rarity === item.rarity && step.value.to.plus === item.plus) {
          return answer("already-done", state, item);
        }
        const next = unwrap(applyUpgrade({ state, item, expected, now }));
        tx.set(r.state, next.state);
        tx.set(itemSnap.ref, next.item);
        return answer("done", next.state, { id: item.id, ...next.item });
      }
      case "reforge": {
        // A retry after the reforge went through finds the item already at the user's level.
        if (!item.removed && item.itemLevel !== input.expectedLevel && item.itemLevel === state.level) return answer("already-done", state, item);
        const next = unwrap(applyReforge({ state, item, expectedLevel: input.expectedLevel, now }));
        tx.set(r.state, next.state);
        tx.set(itemSnap.ref, next.item);
        return answer("done", next.state, { id: item.id, ...next.item });
      }
      case "sell":
      case "salvage": {
        const reason = REMOVAL[input.action];
        if (item.removed?.reason === reason) return answer("already-done", state, item);
        const bonus = input.action === "salvage" ? (await wornEffects(tx, r, state)).salvageYield : 0;
        const next = unwrap(removeItem(state, item, reason, now, bonus));
        tx.set(r.state, next.state);
        tx.set(itemSnap.ref, next.item);
        return answer("done", next.state, { id: item.id, ...next.item });
      }
    }
  });
}
