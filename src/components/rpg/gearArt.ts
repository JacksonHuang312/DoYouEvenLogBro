import { LEVEL_BANDS, type Slot, type WeaponType } from "@/lib/game/config";

/*
 * Flat line-art for gear (24×24, one stroke, one colour; GAME_DESIGN.md 7.1 and 13.15). Lookup: the item's
 * own art by id (Mythics), else its piece type and level band, else null (the caller draws the slot icon).
 * Rarity stays in the colour, so the shared art climbs with the band only: cloth and leather, chain, plate...
 */

/** A piece type: an armor or accessory slot, or one of the three weapon types. */
export type PieceType = Exclude<Slot, "weapon"> | WeaponType;
export type Band = (typeof LEVEL_BANDS)[number];

export const PIECE_TYPES: PieceType[] = [
  "helmet", "chestplate", "gloves", "leggings", "boots", "ring", "necklace", "belt", "charm", "sword", "staff", "shield",
];

/** Shared art per piece type, one path per level band (LEVEL_BANDS order: 1, 20, 40, 60, 80). Missing types fall back. */
export const BAND_ART: Partial<Record<PieceType, Record<Band, string>>> = {
  helmet: {
    // Cloth hood
    1: "M12 3C7 3 5 8 5 13l-1 5 4-1 1 3h6l1-3 4 1-1-5c0-5-2-10-7-10zM9 11c0-2 1.5-3 3-3s3 1 3 3v4H9zM12 3V1.5",
    // Leather cap with a brim and seams
    20: "M5 14a7 7 0 0 1 14 0zM3 14h18M5 14v3M19 14v3M12 7v7M8.5 8.5l1 5.5M15.5 8.5l-1 5.5M12 5.2h.01",
    // Chain coif under a steel dome
    40: "M6 11a6 6 0 0 1 12 0v10l-3-2-3 2-3-2-3 2zM6 11h12M9 11v4h6v-4M8.5 7.5l1 1.5M15.5 7.5l-1 1.5M7.5 14v.01M16.5 14v.01M7.5 17v.01M16.5 17v.01M12 5v6",
    // Closed plate helm with a visor, crest and bevor
    60: "M5 13a7 7 0 0 1 14 0v6l-3 3H8l-3-3zM5 13h14M7 10.5h10M8 13v6M16 13v6M8 16h8M12 3.5V6M10.5 3.5h3",
    // Crowned great helm with horns
    80: "M5 14a7 7 0 0 1 14 0v5l-3 3H8l-3-3zM5 14h14M7 11.5h10M12 14v8M8 7l1-5 3 3 3-3 1 5M5 9L2.5 5.5M19 9l2.5-3.5",
  },
};

/** Art for individual items, by base id. Mythics only. */
export const UNIQUE_ART: Record<string, string> = {};

export const bandOfLevel = (level: number): Band => [...LEVEL_BANDS].reverse().find((b) => level >= b) ?? LEVEL_BANDS[0];

export const pieceOf = (slot: Slot, weapon?: string | null): PieceType | null =>
  slot === "weapon" ? ((weapon as WeaponType | null | undefined) ?? null) : slot;

/** The icon path for an item, or null if there is no art for it yet. */
export function gearArt(item: { baseId?: string; slot: Slot; weapon?: string | null; itemLevel?: number }): {
  d: string;
  source: string;
} | null {
  const own = item.baseId ? UNIQUE_ART[item.baseId] : undefined;
  if (own) return { d: own, source: `unique:${item.baseId}` };
  const piece = pieceOf(item.slot, item.weapon);
  if (!piece || item.itemLevel == null) return null;
  const band = bandOfLevel(item.itemLevel);
  const d = BAND_ART[piece]?.[band];
  return d ? { d, source: `shared:${piece}:${band}` } : null;
}
