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
  chestplate: {
    // Cloth tunic
    1: "M8 3l4 3 4-3 4 4-2.5 3L16 9v12H8V9l-1.5 4L4 10zM12 6v4M8 15h8",
    // Leather jerkin, laced
    20: "M8 3l4 2 4-2 4 4-2 3v11H6V10L4 7zM12 5v16M10 8l2 2 2-2M10 12l2 2 2-2M10 16l2 2 2-2",
    // Chain hauberk with a pointed hem
    40: "M8 3l4 2 4-2 4 4-1 4h-3v10H8V11H5L4 7zM8 21l1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5M10 9h.01M14 9h.01M12 11h.01M10 13h.01M14 13h.01M12 15h.01M10 17h.01M14 17h.01",
    // Plate cuirass with pauldrons
    60: "M7 4l5 2 5-2M3.5 6a3 3 0 0 1 4-2l1 5-4 1zM20.5 6a3 3 0 0 0-4-2l-1 5 4 1zM8 9h8v10l-2 2h-4l-2-2zM12 6v15M8 13h8",
    // Ornate plate, winged pauldrons and a crest
    80: "M7 4l5 2 5-2M2 3c1 3 1.5 6 3 8l3-2-1-5zM22 3c-1 3-1.5 6-3 8l-3-2 1-5zM8 9h8v10l-2 3h-4l-2-3zM12 11l2 2-2 3-2-3zM8 17h8",
  },
  gloves: {
    // Cloth wraps
    1: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M7 21h8M7 18.5h8",
    // Leather gloves with a cuff strap
    20: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6.5 18h9v3h-9zM11 12.5v.01M8 13h.01M14 13h.01",
    // Chain mittens
    40: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6.5 18h9v3h-9zM9 12h.01M12 12h.01M15 12h.01M9 14.5h.01M12 14.5h.01",
    // Plate gauntlets
    60: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6 17h10l-1 4H7zM6 17l-1-2M8.5 13h2M11.5 13h2",
    // Spiked gauntlets
    80: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6 17h10l-1 4H7zM6 17l-1-2M9.5 3.5v-2M12.5 3v-2M15.5 4l.5-2M7 14h8",
  },
  leggings: {
    // Cloth trousers
    1: "M7 3h10l1 18h-4l-2-11-2 11H6zM7 6h10M6.5 18h4M13.5 18h4",
    // Leather trousers with knee patches
    20: "M7 3h10l1 18h-4l-2-11-2 11H6zM7 6h10M7.5 11h3v3h-3zM13.5 11h3v3h-3z",
    // Chain chausses under a short skirt
    40: "M6 3h12l1 5H5zM7 8l-1 13h4l2-11 2 11h4l-1-13M9 14h.01M8.5 17h.01M15 14h.01M15.5 17h.01M12 5.5h.01",
    // Plate cuisses with knee plates
    60: "M7 3h10l1 18h-4l-2-11-2 11H6zM6.5 7h11M7 11l3 .5-.5 3H7zM17 11l-3 .5.5 3H17z",
    // Ornate tassets and greaves
    80: "M6 3h12l2 6H4zM7 9l-1 12h4l2-9 2 9h4l-1-12M12 3v7M6 16h4M14 16h4M8 12l1 .5M16 12l-1 .5",
  },
  boots: {
    // Cloth slippers
    1: "M9 8h4v5l6 2.5a2 2 0 0 1 1 1.7V19H5v-2.5l4-2zM5 19v1.5h15V19M9 11h4",
    // Laced leather boots
    20: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M7 3h7M8 6h5M8 8.5h5M8 11h5",
    // Riveted boots with a buckle
    40: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M7.5 10.5h6M9 7h2v2H9zM10 5.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 16.5h.01",
    // Plate greaves and sabatons
    60: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M8 7h5M8 11h5M13 12l-5 1.5M14 14l3 1.2M5 16.5h15",
    // Winged plate boots
    80: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M8 7h5M8 11h5M8 8L3.5 5.5M8.5 10.5L2.5 9M8 6L4 2.5",
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
