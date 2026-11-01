import { ITEMS, SETS } from "@/lib/game/catalogData";
import { LEVEL_BANDS, WEAPON_TYPES, type ClassId, type Slot, type WeaponType } from "@/lib/game/config";
import { type Band, type Layer, type Palette, type PieceArt, type PieceType } from "./gearLayers";
import { ACCESSORY_ART, ACCESSORY_PALETTE } from "./accessoryArt";
import { MYTHIC_ART } from "./mythicArt";
import { LOOSE_ART, LOOSE_PALETTE } from "./looseArt";
import { CLERIC_ART, CLERIC_PALETTE } from "./clericArt";
import { STRIKER_ART, STRIKER_PALETTE } from "./strikerArt";
import { WEAPON_ART, WEAPON_PALETTE, WEAPON_PALETTES } from "./weaponArt";
import { VANGUARD_ART, VANGUARD_PALETTE } from "./vanguardArt";

/*
 * Gear art: small filled, shaded vector pictures (24×24) drawn on a rarity tile (GAME_DESIGN.md 7.1, 13.15).
 * Lookup: the item's own art by id (Mythics), else its piece type and level band, else null (the caller
 * draws the plain slot icon). Each picture is a list of layers drawn in order; a tone says how a layer is
 * painted, and the band's material palette supplies the colours, so the look climbs with the band (cloth,
 * leather, chain, plate, ornate) while rarity shows in the tile and in the one accent layer.
 */

export type { Band, Layer, Palette, PieceType, Tone } from "./gearLayers";

export const PIECE_TYPES: PieceType[] = [
  "helmet", "chestplate", "gloves", "leggings", "boots", "ring", "necklace", "belt", "charm", "sword", "staff", "shield",
];

/** Loose armor (no set, no class) and its palette, which is also the fallback: see looseArt.ts. */
export const PALETTE = LOOSE_PALETTE;
export const BAND_ART: PieceArt = LOOSE_ART;

/** Art for individual items, by base id, each with its own palette. Mythics only: see mythicArt.ts. */
export const UNIQUE_ART = MYTHIC_ART;

/** Set armor is drawn per class (GAME_DESIGN.md 13.15); loose armor, accessories and weapons share the neutral art. */
export const CLASS_ART: Partial<Record<ClassId, { art: PieceArt; palette: Record<Band, Palette> }>> = {
  vanguard: { art: VANGUARD_ART, palette: VANGUARD_PALETTE },
  striker: { art: STRIKER_ART, palette: STRIKER_PALETTE },
  cleric: { art: CLERIC_ART, palette: CLERIC_PALETTE },
};

const classOfSet = new Map(SETS.map((s) => [s.id, s.classId]));
const classOfBase = new Map(ITEMS.filter((i) => i.set).map((i) => [i.id, classOfSet.get(i.set!)!]));
/** A weapon's type by base id, so callers can pass any `weapon` text (the views pass a display label). */
const weaponOfBase = new Map(ITEMS.filter((i) => i.weapon).map((i) => [i.id, i.weapon!]));
/**
 * A named item's own band (set pieces take their set's, weapons carry one), so a Moonwood Staff always looks
 * like the Moonwood Staff whatever level it rolled or was reforged to. Loose armor and accessories have none
 * and follow the item's level.
 */
const bandOfBase = new Map<string, Band>([
  ...ITEMS.filter((i) => i.set).map((i) => [i.id, SETS.find((s) => s.id === i.set)!.band as Band] as const),
  ...ITEMS.filter((i) => i.weapon && i.band).map((i) => [i.id, i.band as Band] as const),
]);

export const bandOfLevel = (level: number): Band => [...LEVEL_BANDS].reverse().find((b) => level >= b) ?? LEVEL_BANDS[0];

export const pieceOf = (slot: Slot, weapon?: string | null): PieceType | null =>
  slot === "weapon" ? ((WEAPON_TYPES as readonly string[]).includes(weapon ?? "") ? (weapon as WeaponType) : null) : slot;

/** The art for an item, or null if there is none for it yet. */
export function gearArt(item: { baseId?: string; slot: Slot; weapon?: string | null; itemLevel?: number }): {
  layers: Layer[];
  palette: Palette;
  /** Names the palette, so the icon's gradient has a unique id. */
  key: string;
  source: string;
} | null {
  const band = (item.baseId && bandOfBase.get(item.baseId)) || bandOfLevel(item.itemLevel ?? 1);
  const own = item.baseId ? UNIQUE_ART[item.baseId] : undefined;
  if (own) return { layers: own.layers, palette: own.palette, key: `u-${item.baseId}`, source: `unique:${item.baseId}` };
  const weaponType = (item.baseId && weaponOfBase.get(item.baseId)) || item.weapon;
  const piece = pieceOf(item.slot, weaponType);
  if (!piece || item.itemLevel == null) return null;
  const cls = item.baseId ? classOfBase.get(item.baseId) : undefined;
  const classArt = cls ? CLASS_ART[cls] : undefined;
  const classLayers = classArt?.art[piece]?.[band];
  if (cls && classArt && classLayers) return { layers: classLayers, palette: classArt.palette[band], key: `${cls}-${band}`, source: `${cls}:${piece}:${band}` };
  const weapon = WEAPON_ART[piece]?.[band];
  if (weapon) return { layers: weapon, palette: (WEAPON_PALETTES[piece] ?? WEAPON_PALETTE)[band], key: `${piece}-${band}`, source: `weapon:${piece}:${band}` };
  const accessory = ACCESSORY_ART[piece]?.[band];
  if (accessory) return { layers: accessory, palette: ACCESSORY_PALETTE[band], key: `acc-${band}`, source: `accessory:${piece}:${band}` };
  const layers = BAND_ART[piece]?.[band];
  return layers ? { layers, palette: PALETTE[band], key: `n-${band}`, source: `shared:${piece}:${band}` } : null;
}
