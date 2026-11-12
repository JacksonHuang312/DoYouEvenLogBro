import { ITEMS, SETS } from "@/lib/game/catalogData";
import { LEVEL_BANDS, WEAPON_TYPES, type Slot, type WeaponType } from "@/lib/game/config";
import { art, type Band, type Layer, type Palette, type PieceType } from "./gearLayers";

/*
 * Gear art is PLACEHOLDER for now (GAME_DESIGN.md 13.20): every item draws the same small gem, coloured by
 * its band's material palette, on its rarity tile. The real icons are being designed in Figma and will be
 * dropped back in as layer lists (the format is in gearLayers.ts) once they are done; the earlier hand-drawn
 * art (13.19) lives in git history.
 */

export type { Band, Layer, Palette, PieceType, Tone } from "./gearLayers";

export const PIECE_TYPES: PieceType[] = [
  "helmet", "chestplate", "gloves", "leggings", "boots", "ring", "necklace", "belt", "charm", "sword", "staff", "shield",
];

/** One material palette per level band (cloth, leather, chain, plate, ornate). */
export const PALETTE: Record<Band, Palette> = {
  1: { light: "#e8d7a8", base: "#b79d68", dark: "#5e4b2e", trim: "#8f6a44" },
  20: { light: "#c98f5a", base: "#8b5a34", dark: "#41281a", trim: "#cfd5dc" },
  40: { light: "#c9d3de", base: "#7f8b99", dark: "#363e48", trim: "#8f5d37" },
  60: { light: "#f0f4f9", base: "#a8b3c1", dark: "#454e5c", trim: "#7f8b99" },
  80: { light: "#aeb9d6", base: "#4c5370", dark: "#191c2c", trim: "#f2cc55" },
};

/** The one placeholder picture: a faceted gem with an accent in the rarity colour. */
export const PLACEHOLDER_LAYERS: Layer[] = art(`
b M12 3.5l7.5 5.5v6L12 20.5 4.5 15V9z
s M12 12l7.5-3v6L12 20.5z
h M12 3.5L4.5 9l7.5 3.5L19.5 9z
a M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z
l M4.5 9l7.5 3 7.5-3M12 12v8.5
`);

/** A weapon's type by base id, so callers can pass any `weapon` text (the views pass a display label). */
const weaponOfBase = new Map(ITEMS.filter((i) => i.weapon).map((i) => [i.id, i.weapon!]));
/** A named item's own band (set pieces take their set's, weapons carry one); everything else follows the item's level. */
const bandOfBase = new Map<string, Band>([
  ...ITEMS.filter((i) => i.set).map((i) => [i.id, SETS.find((s) => s.id === i.set)!.band as Band] as const),
  ...ITEMS.filter((i) => i.weapon && i.band).map((i) => [i.id, i.band as Band] as const),
]);

export const bandOfLevel = (level: number): Band => [...LEVEL_BANDS].reverse().find((b) => level >= b) ?? LEVEL_BANDS[0];

export const pieceOf = (slot: Slot, weapon?: string | null): PieceType | null =>
  slot === "weapon" ? ((WEAPON_TYPES as readonly string[]).includes(weapon ?? "") ? (weapon as WeaponType) : null) : slot;

/** The art for an item, or null for a weapon of no known type (the caller draws the plain slot icon). */
export function gearArt(item: { baseId?: string; slot: Slot; weapon?: string | null; itemLevel?: number }): {
  layers: Layer[];
  palette: Palette;
  /** Names the palette, so the icon's gradient has a unique id. */
  key: string;
  source: string;
} | null {
  const band = (item.baseId && bandOfBase.get(item.baseId)) || bandOfLevel(item.itemLevel ?? 1);
  const weaponType = (item.baseId && weaponOfBase.get(item.baseId)) || item.weapon;
  const piece = pieceOf(item.slot, weaponType);
  if (!piece || item.itemLevel == null) return null;
  return { layers: PLACEHOLDER_LAYERS, palette: PALETTE[band], key: `ph-${band}`, source: `placeholder:${piece}:${band}` };
}
