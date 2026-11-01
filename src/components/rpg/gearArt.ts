import { ITEMS, SETS } from "@/lib/game/catalogData";
import { LEVEL_BANDS, type ClassId, type Slot, type WeaponType } from "@/lib/game/config";
import { art, type Band, type Layer, type Palette, type PieceArt, type PieceType } from "./gearLayers";
import { ACCESSORY_ART, ACCESSORY_PALETTE } from "./accessoryArt";
import { CLERIC_ART, CLERIC_PALETTE } from "./clericArt";
import { STRIKER_ART, STRIKER_PALETTE } from "./strikerArt";
import { WEAPON_ART, WEAPON_PALETTE } from "./weaponArt";
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

/** Material per level band: cloth, leather, chain, plate, ornate. */
export const PALETTE: Record<Band, Palette> = {
  1: { light: "#e8d7a8", base: "#b79d68", dark: "#6b5636", trim: "#8f7a4d" },
  20: { light: "#c98f5a", base: "#8b5a34", dark: "#472c18", trim: "#d2a84a" },
  40: { light: "#c9d3de", base: "#7f8b99", dark: "#3d4651", trim: "#c0803c" },
  60: { light: "#f0f4f9", base: "#a8b3c1", dark: "#4a5362", trim: "#e0bd5c" },
  80: { light: "#aeb9d6", base: "#586078", dark: "#222739", trim: "#f2cc55" },
};

/** Shared art per piece type, one picture per level band (LEVEL_BANDS order). Missing types fall back. */
export const BAND_ART: PieceArt = {
  helmet: {
    // Cloth hood, tied at the throat
    1: art(`
      b M12 3C8 3 5.5 7 5.5 12.5L4.5 19.5 8 18l1 3h6l1-3 3.5 1.5-1-7C18.5 7 16 3 12 3z
      k M8.8 11c0-2.2 1.4-3.6 3.2-3.6s3.2 1.4 3.2 3.6v4.6H8.8z
      s M14.5 5c2.5 2 3.5 5 3.5 8l1.5 6.5-3.5-1.5z
      h M8 5.5c1-1 2-1.5 3-1.6-1.5 1.8-2.3 4-2.6 6.5-1 0-1.3-3-.4-4.9z
      l M7 13.5L6.2 18M17 13.5l.8 4.5M12 3V1.8
      t M9.5 17h5v2h-5z
      l M12 17v2M10.5 19.6l-.8 1.6M13.5 19.6l.8 1.6
      p M12 1.6h.01
    `),
    // Leather cap with a nose guard, ear flaps and rivets
    20: art(`
      b M5 14C5 8.5 8 5 12 5s7 3.5 7 9z
      s M3 14h18l-1 2.5H4z
      b M5.5 16.5l1 3.5 2-1v-2.5zM18.5 16.5l-1 3.5-2-1v-2.5z
      s M10.5 14h3v5.5l-1.5 1-1.5-1z
      h M7.5 9c.8-1.5 2-2.5 3.5-2.8-1 1.5-1.4 3-1.5 5.3-1.5 0-2.4-1.2-2-2.5z
      l M12 5v9M8.7 6.3L9.5 14M15.3 6.3L14.5 14
      t M12 3.6a1.1 1.1 0 1 0 .01 0z
      p M7 13h.01M17 13h.01M12 8h.01M12 11h.01M7.6 17.5h.01M16.4 17.5h.01
    `),
    // Open steel cap over a chain coif, with a nasal
    40: art(`
      b M5 11.5C5 7.5 8 4 12 4s7 3.5 7 7.5V21l-3-1.8-4 2-4-2L5 21z
      k M8.8 11h6.4v4.6c0 1.2-1.4 2.2-3.2 2.2s-3.2-1-3.2-2.2z
      m M6 11C6 7 8.5 4.5 12 4.5S18 7 18 11z
      t M11.2 5v8h1.6V5z
      h M7.8 8c.8-1.4 2-2.3 3.5-2.7-1 1.2-1.5 2.6-1.7 4.4-1.4 0-2.2-.8-1.8-1.7z
      d M6.8 14h.01M6.8 16.5h.01M17.2 14h.01M17.2 16.5h.01M8.2 18.5h.01M15.8 18.5h.01M12 19.8h.01M6.8 19h.01M17.2 19h.01
      l M6 11h12
      p M8 8h.01M16 8h.01
    `),
    // Closed plate helm: visor, breaths, plume
    60: art(`
      a M12 4c0-2 1.6-3.3 4.4-3.5-.8 1.8-.6 3.1-2.2 4.4-.6.4-1.5.4-2.2-.9zM12 4C11 2.6 9.8 2 8.2 2.2 9 3.4 9.6 4 10.6 4.6z
      b M5.5 13C5.5 8 8.2 4 12 4s6.5 4 6.5 9v5.5L16 21H8l-2.5-2.5z
      m M5.5 11.4h13V15h-13z
      k M7 12h10v1.4H7z
      s M12.8 4c3.4 1 5.7 4.4 5.7 9v5.5L16 21h-3.2z
      m M11.2 4h1.6v7.4h-1.6z
      k M8.6 16v3.6M10.5 16v4M13.5 16v4M15.4 16v3.6
      h M7.5 7c.8-1.4 2-2.3 3.5-2.7-1 1.2-1.5 2.6-1.7 4.4-1.4 0-2.2-.8-1.8-1.7z
      t M7.5 21h9
      p M6.7 13.2h.01M17.3 13.2h.01
    `),
    // Crowned great helm: horns, gem, barred visor
    80: art(`
      t M5.6 9.5C3.6 9 2.2 7 2 3.6c2 .3 3.4 1.7 4.3 3.7zM18.4 9.5c2-.5 3.4-2.5 3.6-5.9-2 .3-3.4 1.7-4.3 3.7z
      b M5.5 13.5C5.5 8.5 8.2 5 12 5s6.5 3.5 6.5 8.5V18.5L16 21.5H8l-2.5-3z
      s M12.8 5c3.4 1 5.7 4 5.7 8.5V18.5L16 21.5h-3.2z
      t M7 7l.9-4.8 2.6 2.4L12 1.8l1.5 2.8 2.6-2.4.9 4.8z
      a M12 7.2l1.2 1.4L12 10.4l-1.2-1.8z
      k M7.2 12h9.6v1.6H7.2z
      t M11.2 13.6h1.6V21.4h-1.6z
      l M9.4 15.5l1.8.8M14.6 15.5l-1.8.8M9.4 18l1.8.8M14.6 18l-1.8.8
      h M7.6 8.6c.8-1.4 2-2.2 3.4-2.5-.8 1-1.2 2.2-1.4 3.8-1.3 0-2.1-.5-2-1.3z
      p M7 7.2h.01M17 7.2h.01
    `),
  },
  chestplate: {
    // Cloth tunic with a belt
    1: art(`
      b M8 4.5l4 1.8 4-1.8 4 2.6-1.8 5.2-2.2-1V20.5H8V11.3l-2.2 1L4 7.1z
      s M14.2 9.5l1.8.8v10.2h-2.4z
      k M9.8 4.7l2.2 3 2.2-3-2.2-1.2z
      h M9 8.2l-1 3v7.5h1.2z
      l M12 7.7v3M11 8.5h2M10 18.5v2M14 18.5v2M5.2 11.7l1.2.7M18.8 11.7l-1.2.7
      t M8 15.3h8v1.8H8z
      m M11.2 15.1h1.6v2.2h-1.6z
    `),
    // Leather jerkin: straps, laces, hem tabs
    20: art(`
      b M8 4.5l4 1.8 4-1.8 4 2.6-1.8 5.2-2.2-1V20.5H8V11.3l-2.2 1L4 7.1z
      s M14.4 9.6l1.6.6v10.3h-2.4zM8.4 4.9l1.6 5.8M15.6 4.9L14 10.7
      k M11.6 6.4h.8v13.4h-.8z
      l M10.3 7.5l3.4 2.6M13.7 7.5l-3.4 2.6M10.3 11.5l3.4 2.6M13.7 11.5l-3.4 2.6
      s M8 16.2h8v2H8z
      t M11 16h2v2.4h-2z
      s M8 20.5v1.5h2.4v-1.5zM10.8 20.5v1.5h2.4v-1.5zM13.6 20.5v1.5H16v-1.5z
      h M8.9 8.5l-.9 3v4.4h1z
      p M6.5 8.2h.01M17.5 8.2h.01M5.2 11h.01M18.8 11h.01
    `),
    // Chain hauberk: long sleeves, belt, toothed hem
    40: art(`
      b M8 4.5l4 1.8 4-1.8 4.5 2.8-1.2 6h-3.3V20H8v-6.7H4.7l-1.2-6z
      s M14.4 8.8l1.6.8V20h-2.4z
      m M9.5 4.7L12 7.2l2.5-2.5-2.5-1z
      s M8 20l1 1.8 1.5-1.8 1.5 1.8 1.5-1.8 1.5 1.8 1-1.8z
      d M10 9.5h.01M14 9.5h.01M12 11h.01M10 12.5h.01M14 12.5h.01M6.5 8.8h.01M17.5 8.8h.01M6 10.8h.01M18 10.8h.01M10 17.8h.01M14 17.8h.01M12 18.8h.01M5.2 12.4h.01M18.8 12.4h.01
      t M8 14.4h8v1.6H8zM3.7 13.3h3.4M16.9 13.3h3.4
      m M11.2 14.3h1.6v1.8h-1.6z
      h M8.6 8l-.8 3v2h1.2z
    `),
    // Plate cuirass: gorget, pauldrons, vambraces, faulds
    60: art(`
      s M3.5 11.8l.8 4.7h3.1l.1-4.7zM20.5 11.8l-.8 4.7h-3.1l-.1-4.7z
      b M8 6h8v10.2l1.2 1.5V21H6.8v-3.3L8 16.2z
      m M9.2 3.5h5.6l1.2 2.5H8z
      m M3.4 11.5C3.4 7.4 5.2 5.4 8.2 5.8L8.4 11.5zM20.6 11.5c0-4.1-1.8-6.1-4.8-5.7l-.2 5.7z
      l M12 6v15M8 11.2h8M8 14h8M7 18h10
      s M12.6 6H16v10.2l1.2 1.5V21h-4.6z
      h M4.6 9.5c.2-1.6 1-2.6 2.2-3-.9 1-1.2 2.2-1.2 3.6zM9 7l-.2 4.4M9.4 14.3v1.4
      p M5.4 8.3h.01M18.6 8.3h.01M9.4 8.6h.01M14.6 8.6h.01
    `),
    // Ornate plate: spiked pauldrons, chest gem, gilded trim
    80: art(`
      t M4.8 6.6L2.8 2.6 6.8 5.6zM8 5.4L7.2 1.8l2.2 3.6zM19.2 6.6l2-4-4 3zM16 5.4l.8-3.6-2.2 3.6z
      s M3.5 11.8l.8 4.7h3.1l.1-4.7zM20.5 11.8l-.8 4.7h-3.1l-.1-4.7z
      b M8 6h8v10.2l1.2 1.5V21H6.8v-3.3L8 16.2z
      m M9.2 3.5h5.6l1.2 2.5H8z
      s M3.4 11.5C3.4 7.4 5.2 5.4 8.2 5.8L8.4 11.5zM20.6 11.5c0-4.1-1.8-6.1-4.8-5.7l-.2 5.7z
      t M8 17h8v1.4H8zM3.9 9.7l3.7.4M20.1 9.7l-3.7.4M7 20h10v1H7z
      a M12 7.6l2.4 2.9L12 14.4l-2.4-3.9z
      l M12 6V7M12 15v6M9.2 15.5h5.6
      h M4.6 9.5c.2-1.6 1-2.6 2.2-3-.9 1-1.2 2.2-1.2 3.6z
      p M5.4 8.6h.01M18.6 8.6h.01M9 17.7h.01M15 17.7h.01
    `),
  },
  gloves: {
    // Cloth wraps
    1: art(`
      b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
      s M15.8 7.5v7l-2 3V21H12v-3.5l2-3z
      l M8 8.2V10M11 4.6V10M14 5.6V10M8 10h9
      s M6.6 16.4l8.6 1.8.4-1.6-8.6-1.8zM6.6 19.4h9v1.6h-9z
      h M5.6 9V8.4M8.6 5.8V8M11.6 5.6V7.4
      e M6.4 12.5l8.6 1.2M5.4 10.6l2.2.8
    `),
    // Leather gloves: cuff strap, buckle, stitching
    20: art(`
      b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
      s M15.8 7.5v7l-2 3V21H12v-3.5l2-3z
      l M8 8.2V10M11 4.6V10M14 5.6V10M8 10h9
      s M6.5 17.2h9.2V21H6.5z
      t M10.4 17.6h2v2.8h-2z
      h M5.6 9V8.4M8.6 5.8V8M11.6 5.6V7.4
      d M9.5 6h.01M12.5 5.3h.01M15.5 6.6h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01
      p M7.6 19h.01M14.4 19h.01
    `),
    // Chain mittens, riveted cuff
    40: art(`
      b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
      s M15.8 7.5v7l-2 3V21H12v-3.5l2-3z
      d M9.5 6h.01M12.5 5.3h.01M15.5 6.6h.01M9.5 8.5h.01M12.5 8h.01M15.5 9.3h.01M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 14h.01M12 14h.01M15 14h.01
      t M6.5 17.2h9.2V21H6.5z
      p M8 19h.01M10.2 19h.01M12.4 19h.01M14.4 19h.01
      h M5.6 9V8.4M8.6 5.8V8
      l M8 10h9
    `),
    // Plate gauntlets: finger lames, flared cuff
    60: art(`
      b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
      m M7.6 9.6h9.4v2.6H7.6z
      m M8.2 6.4h2.6v1.6H8.2zM11.2 5.8h2.6v1.6h-2.6zM14.2 6.6h2.6v1.6h-2.6z
      s M15.4 8v6.5l-1.6 3V21H12v-3.5l1.8-3z
      m M5.5 16.8h11.2l-1.2 4.4H6.8z
      l M7.6 14h8M9 16.8v4.4M12 16.8v4.4
      h M6 9.3V8.6M8.8 4.8V6
      p M8.6 10.9h.01M12.3 10.9h.01M16 10.9h.01M7.8 19h.01M14.6 19h.01
    `),
    // Spiked gauntlets
    80: art(`
      b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
      s M7.6 9.6h9.4v2.6H7.6z
      t M8.8 9.6L9.4 6.4l.6 3.2zM11.8 9.6l.6-3.4.6 3.4zM14.8 9.6l.6-3 .6 3z
      s M8.2 6.4h2.6v1.6H8.2zM11.2 5.8h2.6v1.6h-2.6zM14.2 6.6h2.6v1.6h-2.6z
      s M5.5 16.8h11.2l-1.2 4.4H6.8z
      t M5.5 16.8h11.2v1H5.5z
      a M11.1 18.3l1.2 1.3-1.2 1.4-1.2-1.4z
      h M6 9.3V8.6M8.8 4.8V6
      p M8.4 11h.01M12.3 11h.01M16 11h.01M7.6 19.8h.01M14.8 19.8h.01
    `),
  },
  leggings: {
    // Cloth trousers with a drawstring
    1: art(`
      b M7 3h10l1.2 18H14l-2-10-2 10H5.8z
      s M13.4 3H17l1.2 18H14l-1.8-9.5z
      s M6.8 3h10.4v2.6H6.8z
      l M10 5.6v2M14 5.6v2M12 3v3M6.8 12.5L10 13M17.4 12.5L14 13
      s M5.9 18h4.1l-.2 3H5.8zM14 18h4.1l.1 3H14z
      h M8 6.5L7.2 17M9.5 8l-.2 4
      t M11.2 5.4h1.6v1.6h-1.6z
    `),
    // Leather trousers with knee patches
    20: art(`
      b M7 3h10l1.2 18H14l-2-10-2 10H5.8z
      s M13.4 3H17l1.2 18H14l-1.8-9.5z
      s M6.8 3h10.4v2.6H6.8z
      t M11.2 3.4h1.6v1.8h-1.6z
      m M7.3 11h3.4v3.8H7.3zM13.3 11h3.4v3.8h-3.4z
      s M5.9 18h4.1l-.2 3H5.8zM14 18h4.1l.1 3H14z
      d M8 7.8h.01M16 7.8h.01M7.6 16.8h.01M16.4 16.8h.01M9 6.8h.01M15 6.8h.01
      h M8 6.5L7.2 10M8 15.5l-.6 2
      l M12 11v4
    `),
    // Chain chausses under a mail skirt
    40: art(`
      b M6.8 8L5.8 21H10l2-10 2 10h4.2L17.2 8z
      b M6 3h12l1.6 6H4.4z
      s M13.2 3H18l1.6 6H14.8z
      s M6 3h12v2.2H6z
      t M11.2 3.2h1.6v2.2h-1.6z
      l M12 5.4V9
      d M8.8 7.5h.01M12 7h.01M15.2 7.5h.01M8.6 12h.01M8.2 15h.01M7.6 18h.01M15.4 12h.01M15.8 15h.01M16.4 18h.01M6.4 6.4h.01M17.6 6.4h.01
      t M6.2 19h3.8M14 19h3.8
      h M7.6 4.4L6.8 7.4M7.4 10l-.8 6
    `),
    // Plate cuisses: lames, knee cops, greaves
    60: art(`
      b M7 3h10l1.2 18H14l-2-10-2 10H5.8z
      s M13.4 3H17l1.2 18H14l-1.8-9.5z
      m M6.3 4h11.4l.5 2.6H5.8zM5.8 6.6h12.4l.4 2.6H5.4z
      m M6.8 11l3.4.5-.4 3.2H6.9zM17.2 11l-3.4.5.4 3.2h2.9z
      s M6.7 16.4h3.7l-.3 4.6H6.4zM13.6 16.4h3.7l.3 4.6h-3.7z
      l M12 4v5M8.4 16.4v4.6M15.6 16.4v4.6
      h M7 5l-.1 1.2M7.6 11.7l-.3 2
      p M7.4 7.8h.01M16.6 7.8h.01M8.5 12.8h.01M15.5 12.8h.01
    `),
    // Ornate: flared tassets, knee spikes, trim
    80: art(`
      s M7 9l-1.4 12h4.4l2-9.5 2 9.5h4.4L17 9z
      b M6 3h12l2 6.4H4z
      t M7 12l-2.2-1.2 2.6 2.8zM17 12l2.2-1.2-2.6 2.8z
      s M13.2 3H18l2 6.4h-5.2z
      t M6 3h12v1.4H6zM4 8.2h16v1.2H4z
      a M12 4.2l1.3 1.5L12 7.6l-1.3-1.9z
      m M7.4 13h2.8l-.3 2.8H7.5zM13.8 13h2.8l-.2 2.8h-2.4z
      t M6.2 18.6h3.8M14 18.6h3.8
      l M12 8v3.4
      h M6.6 4.8L5.8 8M7 14.5L6.2 19
      p M5.6 6.2h.01M18.4 6.2h.01
    `),
  },
  boots: {
    // Cloth slippers with wraps
    1: art(`
      b M9 7.5h4v5.5l6 2.5a2 2 0 0 1 1 1.7V19H5v-2.5l4-2z
      s M11.8 7.5H13v5.5l6 2.5a2 2 0 0 1 1 1.7V19h-6.5z
      s M8.6 7h4.8v2.2H8.6z
      s M4.6 19h15.4v2H4.6z
      l M9 10.5h4M9 12l4-.7M8.5 15.5l3 1M11 18h6
      h M9.6 9.6v3.2M6 16.4l2.4-1.2
      p M10.2 7.1h.01
    `),
    // Laced leather boots with a fold-over cuff
    20: art(`
      b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
      s M11.8 3H13v9l6 3a2 2 0 0 1 1 1.8V19h-6z
      s M7 3h7v2.6H7z
      l M8 6.6h5M8 8.6h5M8 10.6h5M9 14.5l1.5-1M15 15.6l2 1
      s M4.6 19h15.4v2.2H4.6z
      p M7.6 7.6h.01M13.4 7.6h.01M7.6 9.6h.01M13.4 9.6h.01M7.6 11.6h.01M13.4 11.6h.01
      h M8.6 6l-.1 4M5.8 17.4L7 16
      t M16 15.6l1 .5M17.4 16.2l1 .4
    `),
    // Riveted boots: buckle straps, mail shaft
    40: art(`
      b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
      s M11.8 3H13v9l6 3a2 2 0 0 1 1 1.8V19h-6z
      s M7.5 6.5h6v1.8h-6zM7.5 10.5h6v1.8h-6z
      t M9.4 6.2h1.8v2.4H9.4zM9.4 10.2h1.8v2.4H9.4z
      d M9.5 4.4h.01M11.5 4.4h.01M10.5 3.8h.01M8.8 14.5h.01M12 15h.01M15 16.2h.01M17.8 17h.01
      s M4.6 19h15.4v2.2H4.6z
      t M5 19h15
      h M8.6 3.6l-.1 2.2M5.8 17.4L7 16
      p M18 16.5h.01
    `),
    // Plate greaves and sabatons
    60: art(`
      b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
      m M8 3h5v2.4H8zM8 5.4h5v2.6H8zM8 8h5v2.6H8z
      m M13 12.6l5.4 2.2.3 1.6-5.6-2.2zM14.6 14.2l3.2 1.4-.4 1.6-3-1.4z
      s M12 3h1v9l6 3a2 2 0 0 1 1 1.8V19h-5.4z
      m M5 16.4h15v2.6H5z
      s M4.6 19h15.4v2.2H4.6z
      l M5 17.7h15M10 12v2.4
      h M8.6 3.4v1.6M8.6 5.8v1.6M5.6 17l1.6-.2
      p M10.5 4.2h.01M10.5 6.7h.01M10.5 9.2h.01M7 17.8h.01M17.5 17.8h.01
    `),
    // Winged plate boots
    80: art(`
      t M8 7.5L3 4.5l1.6 3.7-2 1.4 5.4 1.2zM8 5.8L4.2 2.4l.4 3.2z
      b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
      s M12 3h1v9l6 3a2 2 0 0 1 1 1.8V19h-5.4z
      m M8 7h5v1.6H8zM8 10.6h5v1.6H8z
      a M10.5 4.6l.9 1-.9 1-.9-1z
      s M4.6 19h15.4v2.2H4.6z
      t M5 17.4h15M19 17.4l2 .6M5 19h15
      h M5.8 17l1.6-.8M8.6 8.4v1.6
      p M7 17.4h.01M10 17.4h.01M13 17.4h.01M16 17.4h.01
    `),
  },
};

/** Art for individual items, by base id. Mythics only. */
export const UNIQUE_ART: Record<string, Layer[]> = {};

/** Set armor is drawn per class (GAME_DESIGN.md 13.15); loose armor, accessories and weapons share the neutral art. */
export const CLASS_ART: Partial<Record<ClassId, { art: PieceArt; palette: Record<Band, Palette> }>> = {
  vanguard: { art: VANGUARD_ART, palette: VANGUARD_PALETTE },
  striker: { art: STRIKER_ART, palette: STRIKER_PALETTE },
  cleric: { art: CLERIC_ART, palette: CLERIC_PALETTE },
};

const classOfSet = new Map(SETS.map((s) => [s.id, s.classId]));
const classOfBase = new Map(ITEMS.filter((i) => i.set).map((i) => [i.id, classOfSet.get(i.set!)!]));

export const bandOfLevel = (level: number): Band => [...LEVEL_BANDS].reverse().find((b) => level >= b) ?? LEVEL_BANDS[0];

export const pieceOf = (slot: Slot, weapon?: string | null): PieceType | null =>
  slot === "weapon" ? ((weapon as WeaponType | null | undefined) ?? null) : slot;

/** The art for an item, or null if there is none for it yet. */
export function gearArt(item: { baseId?: string; slot: Slot; weapon?: string | null; itemLevel?: number }): {
  layers: Layer[];
  palette: Palette;
  /** Names the palette, so the icon's gradient has a unique id. */
  key: string;
  source: string;
} | null {
  const band = bandOfLevel(item.itemLevel ?? 1);
  const own = item.baseId ? UNIQUE_ART[item.baseId] : undefined;
  if (own) return { layers: own, palette: PALETTE[80], key: "unique", source: `unique:${item.baseId}` };
  const piece = pieceOf(item.slot, item.weapon);
  if (!piece || item.itemLevel == null) return null;
  const cls = item.baseId ? classOfBase.get(item.baseId) : undefined;
  const classArt = cls ? CLASS_ART[cls] : undefined;
  const classLayers = classArt?.art[piece]?.[band];
  if (cls && classArt && classLayers) return { layers: classLayers, palette: classArt.palette[band], key: `${cls}-${band}`, source: `${cls}:${piece}:${band}` };
  const weapon = WEAPON_ART[piece]?.[band];
  if (weapon) return { layers: weapon, palette: WEAPON_PALETTE[band], key: `wpn-${band}`, source: `weapon:${piece}:${band}` };
  const accessory = ACCESSORY_ART[piece]?.[band];
  if (accessory) return { layers: accessory, palette: ACCESSORY_PALETTE[band], key: `acc-${band}`, source: `accessory:${piece}:${band}` };
  const layers = BAND_ART[piece]?.[band];
  return layers ? { layers, palette: PALETTE[band], key: `n-${band}`, source: `shared:${piece}:${band}` } : null;
}
