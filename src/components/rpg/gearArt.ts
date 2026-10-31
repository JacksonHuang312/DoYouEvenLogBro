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
    // Cloth hood: draped, tied at the throat, with a tip tassel
    1: "M12 2.5C7.5 2.5 5.5 7 5.5 12.5L4 19l4-1.5 1 3.5h6l1-3.5 4 1.5-1.5-6.5C18.5 7 16.5 2.5 12 2.5zM8.8 11.5c0-2.2 1.5-3.8 3.2-3.8s3.2 1.6 3.2 3.8v4.2H8.8zM12 2.5V.8M7.2 9c.6-1.8 1.4-3 2.6-4M16.8 9c-.6-1.8-1.4-3-2.6-4M10.5 17.5h3M12 15.7v3.3M8.8 15.7l-1.6 1.6M15.2 15.7l1.6 1.6M9.6 21v-2.2M14.4 21v-2.2",
    // Leather cap: nose guard, ear flaps, seams and rivets
    20: "M4.5 13.5a7.5 7.5 0 0 1 15 0M3 13.5h18M4.5 13.5v4.5l2.5 1.5v-6M19.5 13.5v4.5l-2.5 1.5v-6M12 6v7.5M8.5 7.5l1.2 6M15.5 7.5l-1.2 6M10.2 13.5v5.5h3.6v-5.5M6 9.5l1.2.8M18 9.5l-1.2.8M12 4.8h.01M7 16h.01M17 16h.01M12 8.8h.01M12 11h.01",
    // Open steel cap over a chain coif, with a nasal
    40: "M5.5 11a6.5 6.5 0 0 1 13 0M4.5 11h15M5.5 11v9l3-1.5 3.5 2 3.5-2 3 1.5v-9M9 11v4.5c0 1 1.2 1.8 3 1.8s3-.8 3-1.8V11M12 5v8M10.5 8.5h3M7 7l1.2 1.5M17 7l-1.2 1.5M7 14h.01M7 16.5h.01M17 14h.01M17 16.5h.01M8 18.5h.01M16 18.5h.01M12 19h.01M12 3.5h.01",
    // Closed plate helm: visor, breaths, plume
    60: "M5 14a7 7 0 0 1 14 0v5l-3.5 3h-7L5 19zM5 14h14M7 11.5h10M9 12.7h6M12 14v8M9 16h.01M9 18h.01M15 16h.01M15 18h.01M12 7c0-2.5 1-4 4-4.5-1 1.5-1 3-2.5 4.5M12 7C11 5 9.5 4 8 4M7 14v5.5M17 14v5.5",
    // Crowned great helm: horns, gem and a barred visor
    80: "M5 14.5a7 7 0 0 1 14 0v4.5l-3.5 3h-7L5 19zM5 14.5h14M7 12h10M9 13.2h6M12 14.5v7.5M9.5 17l1.8.5M14.5 17l-1.8.5M7.5 7.5l1-5.5 3.5 3 3.5-3 1 5.5M8 7.5h8M12 3.8l.8.8-.8.8-.8-.8zM5.5 9.5C3 9 2 6.5 2 3.5c2 .5 3.2 1.8 4 3.5M18.5 9.5C21 9 22 6.5 22 3.5c-2 .5-3.2 1.8-4 3.5",
  },
  chestplate: {
    // Cloth tunic: collar laces, cuffs, belt
    1: "M8.5 3L12 5.5 15.5 3 20 6.5 18.5 11.5 16 10.5V21H8V10.5L5.5 11.5 4 6.5zM8.5 3c.5 2 1.8 3 3.5 3s3-1 3.5-3M12 6v5M10.5 7.5h3M8 14h8M8 16.5h8M5.5 11.5l-1 .5M18.5 11.5l1 .5M10 21v-1.5M14 21v-1.5",
    // Leather jerkin: straps, lacing, hem tabs
    20: "M8 3.5l4 2 4-2 4 3.5-2 4.5-2-.8V21H8V10.2l-2 .8L4 7zM12 5.5V21M10 8l4 3M14 8l-4 3M10 12l4 3M14 12l-4 3M8 17.5h8M5.5 7.5l1.2 2M18.5 7.5l-1.2 2M9 21v1.2M12 21v1.2M15 21v1.2",
    // Chain hauberk: sleeves, belt, toothed hem
    40: "M8.5 3L12 5l3.5-2 4.5 3-1 5.5h-3V19H8v-7.5H5L4 6zM12 5v3M8 14h8M8 16.5h8M8 19l.8 2 1.2-2 1.2 2 1.2-2 1.2 2 1.2-2 1.2 2 .8-2M10 9.5h.01M14 9.5h.01M12 11h.01M10 12.5h.01M14 12.5h.01M6.5 8.5h.01M17.5 8.5h.01M6 10.5h.01M18 10.5h.01",
    // Plate cuirass: gorget, pauldrons, vambraces, faulds
    60: "M9.5 3.5h5l1 2.5h-7zM8.5 6h7v10l1 1.5V21H7.5v-3.5l1-1.5zM3.5 11C3.5 7.5 5 5.5 8.5 6L8.5 11zM20.5 11C20.5 7.5 19 5.5 15.5 6L15.5 11zM3.5 11l.8 5h3.2M20.5 11l-.8 5h-3.2M12 6v15M8.5 11.5h7M8.5 14h7M7.5 18h9M5.2 8h.01M18.8 8h.01",
    // Ornate plate: spiked pauldrons, gem, trim
    80: "M9.5 3.5h5l1 2.5h-7zM8.5 6h7v10l1 1.5V21H7.5v-3.5l1-1.5zM3.5 11C3.5 7.5 5 5.5 8.5 6L8.5 11zM20.5 11C20.5 7.5 19 5.5 15.5 6L15.5 11zM3.5 11l.8 5h3.2M20.5 11l-.8 5h-3.2M5 6.5L3 3M7 6L6 2.5M19 6.5l2-3.5M17 6l1-3.5M12 8l2 2.3-2 3.2-2-3.2zM8.5 15h7M9.5 18.5h5M7.5 21v1.2M16.5 21v1.2",
  },
  gloves: {
    // Cloth wraps
    1: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M7 21h8M7 18.5h8M7.5 16l7.5 1.5M8 12.5h9M8 7.5h3M11 6.5h3M14 7.2h3M5 11l3 1M8 8.5v.01",
    // Leather gloves: cuff strap, buckle, stitching
    20: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6.5 17.5h9v3.5h-9zM9 19.2h.01M12 19.2h.01M14.5 19.2h.01M8 14h8M8 11.5h2M11.5 11.5h2M9.5 5.5v2.5M12.5 5v3M15.5 6.5v2M12 17.5v3.5",
    // Chain mittens: mail, riveted cuff
    40: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6.5 17.5h9v3.5h-9zM9 12h.01M12 12h.01M15 12h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9.5 6h.01M12.5 5.5h.01M15.5 7h.01M9.5 8.5h.01M12.5 8h.01M15.5 9.5h.01M8 19.2h.01M14.5 19.2h.01",
    // Plate gauntlets: finger lames, flared cuff
    60: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6 17h10l-1 4H7zM6 17l-1-2M8 6.5h3M11 6h3M14 7h3M8 8.5h3M11 8h3M14 9h3M8 11h9M8.5 13.5h2M11.5 13.5h2M9 19h5",
    // Spiked gauntlets: knuckle spikes, flared cuff
    80: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4M6 17h10l-1 4H7zM6 17l-1-2M9.5 3.5v-2M12.5 3v-2M15.5 4l.5-2M8 6.5h3M11 6h3M14 7h3M8 8.5h3M11 8h3M14 9h3M7 14h8M9 19h5M5 11l-1.5-1",
  },
  leggings: {
    // Cloth trousers: drawstring, cuffs, wrinkles
    1: "M7 3h10l1.2 18H14l-2-10.5L10 21H5.8zM7 6h10M10 3v3M14 3v3M12 6v2M6.2 17.5h4.2M13.6 17.5h4.2M6.8 12.5l3.2.5M17.2 12.5L14 13",
    // Leather trousers: belt, knee patches, stitching
    20: "M7 3h10l1.2 18H14l-2-10.5L10 21H5.8zM7 5.5h10M12 3v2.5M7.5 11h3.5v3.5H7.5zM13 11h3.5v3.5H13zM9 8.5h.01M15 8.5h.01M6.2 18h4.2M13.6 18h4.2M9 12.7h.01M14.8 12.7h.01",
    // Chain chausses: mail skirt over riveted legs
    40: "M6 3h12l1.5 5.5H4.5zM7 8.5L5.8 21H10l2-10.5L14 21h4.2L17 8.5M12 5.5V8M9 5.5h.01M15 5.5h.01M8 8.5l.8 1.5.8-1.5M14.4 8.5l.8 1.5.8-1.5M8.5 13h.01M8.5 16h.01M15.5 13h.01M15.5 16h.01M6.2 19h4M13.8 19h4",
    // Plate cuisses: faulds, knee cops, greaves
    60: "M7 3h10l1.2 18H14l-2-10.5L10 21H5.8zM6.5 6.5h11M6.2 8.5h11.6M7 11l3 .5-.5 3H7zM17 11l-3 .5.5 3H17zM12 3v7.5M7 17.5h3.5M13.5 17.5h3.5M9.5 14.5v2.5M14.5 14.5v2.5",
    // Ornate: flared tassets, knee spikes, trim
    80: "M6 3h12l2 6H4zM7 9l-1 12h4l2-9 2 9h4l-1-12M12 3v7M5 6h14M6 16h4M14 16h4M8 12l1 .5M16 12l-1 .5M8.5 14l-1.2-1.8M15.5 14l1.2-1.8M7.5 19h2M14.5 19h2M12 11.5l-.01.01",
  },
  boots: {
    // Cloth slippers: wrap ties
    1: "M9 7.5h4v5.5l6 2.5a2 2 0 0 1 1 1.7V19H5v-2.5l4-2zM5 19v1.5h15V19M9 10.5h4M9 8.8l4 1M9 12l4-.7M8.5 15.5l3 1M11 18.5h6M9 7.5V6M13 7.5V6",
    // Laced leather boots: fold cuff, eyelets, stitched sole
    20: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M7 3h7M7 5.5h7M8 6.5h5M8 8.5h5M8 10.5h5M7.5 8.5l-.01.01M13.5 8.5l-.01.01M5 20h15M9 14.5l1.5-1M15 15.5l2 1M8 3v2.5",
    // Riveted boots: buckle straps, mail shaft
    40: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M7.5 7h6M7.5 11h6M9 7.5h2V10H9zM10 4.5h.01M8.5 5h.01M12 5h.01M8.5 15.5h.01M12 15.5h.01M15.5 16.5h.01M17.5 17h.01M5 20.5h15",
    // Plate greaves and sabatons: lames, rivets
    60: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M8 6h5M8 9h5M8 11.5h5M13 13l-5 1.5M14 14.5l3 1.3M16 15.2l2.5 1.2M5 16.5h15M10.5 3.5h.01M10.5 5h.01",
    // Winged plate boots: wings, spur, trim
    80: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2M8 7h5M8 11h5M8 8L3.5 5.5M8.5 10.5L2.5 9M8 6L4 2.5M8 9.2L2 7.5M10.5 3v.01M5 17.5h15M19 17l2 .5",
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
