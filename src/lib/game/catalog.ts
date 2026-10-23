import { GEAR, NAMED_RARITIES, type Focus, type Rarity, type Slot } from "./config";
import { ITEMS, SETS as SET_ENTRIES } from "./catalogData";

/*
 * The item catalog (GAME_DESIGN.md 5): the list in catalogData.ts with its lookups. To add items
 * edit catalogData.ts, not this file.
 */

export interface SetDef {
  id: string;
  name: string;
  /** The rarity its pieces start at. */
  rarity: Rarity;
  /** Named sets (Legendary) also get a unique effect, defined with combat in Phase 5. */
  named: boolean;
  focus: Focus;
}

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  /** Null for loose items: Common, Uncommon, Mythic and every accessory. */
  setId: string | null;
  /** The rarity a new piece starts at (its origin rarity). */
  rarity: Rarity;
  /** Where its power goes: the set's, its own, or the slot's usual split. */
  focus: Focus;
  /** A Phase 5 hook: accessory effects and each Mythic's unique effect. */
  effect: string | null;
}

export const SETS: SetDef[] = SET_ENTRIES.map((s) => ({ ...s, named: NAMED_RARITIES.includes(s.rarity) }));

const setsById = new Map(SETS.map((s) => [s.id, s]));

export const BASE_ITEMS: BaseItem[] = ITEMS.map((i) => ({
  id: i.id,
  name: i.name,
  slot: i.slot,
  setId: i.set ?? null,
  rarity: i.rarity,
  focus: (i.set ? setsById.get(i.set)?.focus : i.focus) ?? GEAR.slotFocus[i.slot],
  effect: i.effect ?? null,
}));

const byId = new Map(BASE_ITEMS.map((b) => [b.id, b]));

/** A base item by id, or undefined if the catalog no longer has it. */
export const baseItem = (id: string): BaseItem | undefined => byId.get(id);

export const setDef = (id: string): SetDef | undefined => setsById.get(id);
