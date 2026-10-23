import type { Rarity, Slot } from "./config";

/*
 * The base items gear is made from (GAME_DESIGN.md 5). Names only: an item's power comes from its
 * rarity and upgrade level (config.ts), so the catalog holds no numbers. Each set has one piece
 * per slot. An unnamed set's pieces start at its rarity and can climb; named sets start at
 * Legendary or Mythic and only drop from bosses (Phase 5).
 */

export interface SetDef {
  id: string;
  name: string;
  /** The rarity its pieces start at. */
  rarity: Rarity;
  /** Named sets also get a unique effect, defined with combat in Phase 5. */
  named: boolean;
}

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  setId: string;
  /** The rarity a new piece starts at (its origin rarity). */
  rarity: Rarity;
}

export const SETS: SetDef[] = [
  { id: "ironbound", name: "Ironbound", rarity: "common", named: false },
  { id: "wayfarer", name: "Wayfarer", rarity: "uncommon", named: false },
  { id: "steelguard", name: "Steelguard", rarity: "rare", named: false },
  { id: "warden", name: "Warden", rarity: "epic", named: false },
  { id: "titans-vow", name: "Titan's Vow", rarity: "legendary", named: true },
  { id: "unbroken", name: "Unbroken", rarity: "mythic", named: true },
];

const PIECES: Record<string, Record<Slot, string>> = {
  ironbound: {
    helmet: "Ironbound Helm",
    chestplate: "Ironbound Plate",
    gloves: "Ironbound Gloves",
    leggings: "Ironbound Legguards",
    boots: "Ironbound Boots",
  },
  wayfarer: {
    helmet: "Wayfarer Hood",
    chestplate: "Wayfarer Jerkin",
    gloves: "Wayfarer Grips",
    leggings: "Wayfarer Trousers",
    boots: "Wayfarer Treads",
  },
  steelguard: {
    helmet: "Steelguard Helm",
    chestplate: "Steelguard Cuirass",
    gloves: "Steelguard Gauntlets",
    leggings: "Steelguard Tassets",
    boots: "Steelguard Sabatons",
  },
  warden: {
    helmet: "Warden Visor",
    chestplate: "Warden Hauberk",
    gloves: "Warden Fists",
    leggings: "Warden Greaves",
    boots: "Warden Striders",
  },
  "titans-vow": {
    helmet: "Titan's Crest",
    chestplate: "Titan's Mantle",
    gloves: "Titan's Grasp",
    leggings: "Titan's Pillars",
    boots: "Titan's March",
  },
  unbroken: {
    helmet: "Crown of the Unbroken",
    chestplate: "Heart of the Unbroken",
    gloves: "Hands of the Unbroken",
    leggings: "Pillars of the Unbroken",
    boots: "Path of the Unbroken",
  },
};

export const BASE_ITEMS: BaseItem[] = SETS.flatMap((set) =>
  (Object.entries(PIECES[set.id]) as [Slot, string][]).map(([slot, name]) => ({
    id: `${set.id}-${slot}`,
    name,
    slot,
    setId: set.id,
    rarity: set.rarity,
  })),
);

const byId = new Map(BASE_ITEMS.map((b) => [b.id, b]));
const setsById = new Map(SETS.map((s) => [s.id, s]));

/** A base item by id, or undefined if the catalog no longer has it. */
export const baseItem = (id: string): BaseItem | undefined => byId.get(id);

export const setDef = (id: string): SetDef | undefined => setsById.get(id);
