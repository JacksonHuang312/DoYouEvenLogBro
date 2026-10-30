import { GEAR, LEVEL_BANDS, WEAPONS, isAccessory, isWeapon, type AccessoryEffect, type ClassId, type Focus, type Slot, type WeaponType } from "./config";
import { ITEMS, SETS as SET_ENTRIES } from "./catalogData";

/*
 * The item catalog (GAME_DESIGN.md 5 and 13.5): the list in catalogData.ts with its lookups. To add
 * items edit catalogData.ts, not this file.
 */

export interface SetDef {
  id: string;
  name: string;
  classId: ClassId;
  /** The first level of its band. */
  band: number;
  focus: Focus;
  /** An effect while all five pieces are worn, at Legendary strength. */
  effect: { id: AccessoryEffect; value: number };
}

/** What a base is, for drops and the shop. */
export type BaseKind = "set" | "loose" | "accessory" | "weapon" | "mythic";

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  /** Null for everything but set armor. */
  setId: string | null;
  /** Weapons only. */
  weapon: WeaponType | null;
  /** The level band it drops in (set pieces and weapons), or null when it fits any level. */
  band: number | null;
  /** A unique Mythic: always Mythic, with its own effect. */
  mythic: boolean;
  kind: BaseKind;
  /** Where its power goes: the set's, the weapon type's, its own, or the slot's usual split. */
  focus: Focus;
  /** An accessory effect, or a Mythic's unique effect. */
  effect: string | null;
}

export const SETS: SetDef[] = SET_ENTRIES;

const setsById = new Map(SETS.map((s) => [s.id, s]));

function kindOf(i: (typeof ITEMS)[number]): BaseKind {
  if (i.mythic) return "mythic";
  if (i.set) return "set";
  if (isWeapon(i.slot)) return "weapon";
  return isAccessory(i.slot) ? "accessory" : "loose";
}

export const BASE_ITEMS: BaseItem[] = ITEMS.map((i) => {
  const set = i.set ? setsById.get(i.set) : undefined;
  return {
    id: i.id,
    name: i.name,
    slot: i.slot,
    setId: i.set ?? null,
    weapon: i.weapon ?? null,
    band: i.mythic ? null : (set?.band ?? i.band ?? null),
    mythic: !!i.mythic,
    kind: kindOf(i),
    focus: set?.focus ?? (i.weapon ? WEAPONS[i.weapon].focus : i.focus) ?? GEAR.slotFocus[i.slot],
    effect: i.effect ?? null,
  };
});

const byId = new Map(BASE_ITEMS.map((b) => [b.id, b]));

/** A base item by id, or undefined if the catalog no longer has it. */
export const baseItem = (id: string): BaseItem | undefined => byId.get(id);

export const setDef = (id: string): SetDef | undefined => setsById.get(id);

/** The band an item level falls in: the highest LEVEL_BANDS entry at or below it. */
export const bandOf = (level: number): number => [...LEVEL_BANDS].reverse().find((b) => level >= b) ?? LEVEL_BANDS[0];

/** "Levels 20-39": the range a band covers. */
export function bandLabel(band: number): string {
  const next = LEVEL_BANDS.find((b) => b > band);
  return `Levels ${band}-${next ? next - 1 : 100}`;
}

/**
 * The bases a drop of `kind` at item level `level` can be: set pieces and weapons of the level's band,
 * loose armor and accessories at any level, the unique Mythics at any level.
 */
export function basesFor(kind: BaseKind, level: number): BaseItem[] {
  const band = bandOf(level);
  return BASE_ITEMS.filter((b) => b.kind === kind && (b.band == null || b.band === band));
}
