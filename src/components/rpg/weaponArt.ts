import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Weapon art (swords, staves and shields, GAME_DESIGN.md 13.15). Weapons are open to every class, so each
 * type has one picture per level band, in the fantasy tiers of the armor. Pictures are drawn upright and
 * turned on the tile with "@rotate". Swords (the Striker's weapon):
 *   1  Recruit's Blade: a crude curved knife with a bound grip
 *   20 Steel Longsword: a straight blade with a crossguard
 *   40 Runed Broadsword: a broad blade with glowing runes and a winged guard
 *   60 Duskfang Saber: a long wavy steel blade with a winding gold inlay and a jagged guard
 *   80 Sunsteel Greatsword: a long white-gold holy blade with a winged crossguard and a jewelled grip
 */

export const WEAPON_PALETTE: Record<Band, Palette> = {
  1: { light: "#d6cdbf", base: "#847f78", dark: "#37332f", trim: "#8f5d37" },
  20: { light: "#f2f5f8", base: "#adb6c2", dark: "#454d59", trim: "#7d4c2b" },
  40: { light: "#f6f9fd", base: "#b9c5d7", dark: "#47536d", trim: "#6aa2f7" },
  60: { light: "#eef0f4", base: "#a9aeb8", dark: "#4b505c", trim: "#c9a84a" },
  80: { light: "#fffaf0", base: "#d6dbe5", dark: "#6b7080", trim: "#e3be5a" },
};

const SWORD: Record<Band, string> = {
  // A crude curved knife with a leather-bound grip
  1: `
    @rotate 45
    b M13.4-1.4c1.8 5.4 2 11.6.6 17.6h-3.8c-.8-6.2 0-12 3.2-17.6z
    s M13.4-1.4c1.8 5.4 2 11.6.6 17.6h-1.8c1.4-5.4 1.2-11.6 1.2-17.6z
    m M13.4-1.4c-3.2 5.6-4 11.4-3.2 17.6h.8c-.6-5.8.2-11.6 2.4-17.6z
    t M8.8 16.2h6.8v1.4H8.8z
    t M10.8 17.6h2.8v5h-2.8z
    l M10.8 18.9h2.8M10.8 20.2h2.8M10.8 21.5h2.8M12.6 1.6c.8 4.2.8 8.8 0 12.6
    m M10.4 22.6h3.6v1.6h-3.6z
    d M12.8 7h.01M11.8 11h.01
  `,
  // A straight steel longsword with a crossguard and a round pommel
  20: `
    @rotate 45
    b M12-3.4l1.7 2.6V16h-3.4V-.8z
    s M12-3.4l1.7 2.6V16H12z
    l M12-1.4V15
    e M10.9-.4V15
    m M7 16h10v1.5H7z
    t M6.4 15.6h1.4v2.4H6.4zM16.2 15.6h1.4v2.4h-1.4z
    t M10.9 17.5h2.2v5h-2.2z
    l M10.9 18.8h2.2M10.9 20.2h2.2M10.9 21.6h2.2
    b M12 22.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z
  `,
  // A broad blade with glowing runes, a winged guard and a gem pommel
  40: `
    @rotate 45
    b M12-3.8l2.4 3V16H9.6V-.8z
    s M12-3.8l2.4 3V16H12z
    a M12 .6l.9 1.2-.9 1.2-.9-1.2zM12 5l.9 1.2-.9 1.2-.9-1.2zM12 9.4l.9 1.2-.9 1.2-.9-1.2z
    l M12-1.6V14.6M10.4 3.2l1 1M13.6 3.2l-1 1M10.4 7.6l1 1M13.6 7.6l-1 1
    t M5.6 15.2l4 .6v2.2L6 19zM18.4 15.2l-4 .6v2.2l3.6 1z
    m M9.6 15.8h4.8V18H9.6z
    t M12 15.9l.7.9-.7.9-.7-.9z
    b M10.8 18h2.4v4.2h-2.4z
    l M10.8 19.4h2.4M10.8 20.8h2.4
    a M12 22l1.4 1.4-1.4 1.8-1.4-1.8z
    e M10.4-.4V15
    p M6.4 17h.01M17.6 17h.01
  `,
  // A long wavy steel blade with a winding gold inlay, a small jagged guard and a plain metal grip
  60: `
    @rotate 45
    @scale 0.9
    b M11 16l-.6-2.4-1-2.2L11 8.6l-.4-3.2.6-2.8.2-2.6.6-4.6.8 4 1 1.8-.8 2.2.6 2.8.8 1.8-1.4 3 .2 2.4-.2 2.6z
    s M12-4.6l.8 4 1 1.8-.8 2.2.6 2.8.8 1.8-1.4 3 .2 2.4-.2 2.6h-1l.2-3 .4-2.6 1-2.8-.6-2.6.6-3.2-.6-2.4z
    t M11.8 15.4L11.2 12.8 10.8 10.6 12 8 11.8 5.4 12.4 2.8 12.6.2h.5L12.9 2.8 12.3 5.4 12.5 8 11.3 10.6 11.7 12.8 12.3 15.4z
    m M9.2 17.2l.4-1.6 1-.8.6.8.6-1.2.6 1.2.6-.8 1 .8.4 1.6z
    m M13.6 15.2l1.8-1.6-.2 2.2z
    m M11 17.2h2v6.8h-2z
    s M12.2 17.2h.8v6.8h-.8z
    l M11 18.4h2M11 22.8h2
    m M10.8 24h2.4v1.4h-2.4z
    h M10.6 12.6l.6-2.8M11.2 5.6l.2-2.6
  `,
  // A long holy blade with a gold fuller, a white winged crossguard and a jewelled grip
  80: `
    @rotate 45
    @scale 0.9
    m* M10.6 14.6C8 15 5.6 14 4.4 11.6c1.2.4 2.2.4 3.2 0-.8-.6-1.4-1.4-1.6-2.4 1.8.8 3.4 2.4 4.6 5.4z
    l* M6 12.4l2.2.6M7.2 10.6l1.6 1.4
    t* M4.6 12.2l-2.2 1 2.4.4z
    b M12-4.4l1.4 2.2v16.8h-2.8V-2.2z
    s M12-4.4l1.4 2.2v16.8H12z
    t M11.7-1.4h.6V14h-.6z
    e M11 -1.6V13.6
    t M10.2 14.2h3.6v2.2h-3.6z
    a M12 14.4l.9.9-.9 1-.9-1z
    m M11 16.4h2v1.6h-2zM11 20h2v1.6h-2z
    a M11 18h2v2h-2zM11 21.6h2v1.6h-2z
    t M12 23.2l1.2 1.4-1.2 1.8-1.2-1.8z
  `,
};

/** Staves (the Cleric's weapon) have their own materials: wood, then moonwood, gold and white-gold. */
export const STAFF_PALETTE: Record<Band, Palette> = {
  1: { light: "#dcbd8e", base: "#8a643f", dark: "#3e2a17", trim: "#6f9a4e" },
  20: { light: "#e2c69c", base: "#7a5636", dark: "#352315", trim: "#cfd6de" },
  40: { light: "#f0f4fa", base: "#a2b2ca", dark: "#3f4c66", trim: "#dfe4ec" },
  60: { light: "#f6dd9a", base: "#b98d45", dark: "#4d3516", trim: "#c0303f" },
  80: { light: "#fff6dc", base: "#e0c272", dark: "#6e5420", trim: "#7a55c8" },
};

/*
 * Staves:
 *   1  Willow Staff: a gnarled branch with a knot, two leaves and a cloth grip
 *   20 Pilgrim's Staff: a walking crook with iron bands and a hanging bell
 *   40 Moonwood Staff: pale wood with a silver crescent cradling a crystal
 *   60 Lumen Rod: a gold rod with a spiked sun ring, a glowing orb and crimson tassels
 *   80 Seraph Scepter: white-gold with a halo, white wings, a cross and a glowing gem
 */
const STAFF: Record<Band, string> = {
  1: `
    @rotate 45
    @scale 0.86
    b M11.2 4.6c.6 5.4 0 11 .2 22h2c-.2-10.8.6-16.4-.2-22z
    s M12.6 4.6c.6 5.6-.2 11.2 0 22h.8c-.2-10.8.6-16.4-.2-22z
    b M12-1.6c1.8 0 3 1.4 3 3.2 0 1.6-1 2.8-2.4 3.2h-1.6C9.6 4.4 9 3.2 9 1.6c0-1.8 1.2-3.2 3-3.2z
    k M11.4.8a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0z
    t M13.6 3.4c1.6-1.6 3.6-1.8 5-.8-1.4 1.6-3.4 2-5 .8zM10.6 6c-1.8-1-3.6-.6-4.6.6 1.6 1 3.4 1 4.6-.6z
    s M10.8 15.4h2.8v4h-2.8z
    l M10.8 16.6h2.8M10.8 18h2.8M11.8 8l.6 3M12 21.6l-.4 2.6
    m M11.2 26.2h2.2v1.2h-2.2z
    h M10.2.4c.2-.8.8-1.4 1.6-1.6
  `,
  20: `
    @rotate 45
    @scale 0.86
    b M11.2 6V2.2c0-2.8 2-4.6 4.4-4.6s4.2 1.8 4.2 4.2c0 2-1.4 3.4-3 3.4l-.2-1.6c.8 0 1.6-.8 1.6-1.8 0-1.6-1.2-2.6-2.6-2.6s-2.8 1.2-2.8 3V6z
    b M11.2 6h1.6v20.8h-1.6z
    s M12.2 6h.6v20.8h-.6z
    t M10.8 5.4h2.4v1.4h-2.4zM10.8 12.6h2.4V14h-2.4zM10.8 24.6h2.4V26h-2.4z
    m M16.4 4.4c1 0 1.6.8 1.6 1.8v1.4h-3.2V6.2c0-1 .6-1.8 1.6-1.8z
    k M16 7.6h.8v.8H16z
    l M16.4 3.2v1.2
    s M10.8 16.6h2.4v3.6h-2.4z
    h M13 -1c.6-.6 1.4-1 2.2-1
  `,
  40: `
    @rotate 45
    @scale 0.86
    b M11.2 5.4h1.6v21.4h-1.6z
    s M12.2 5.4h.6v21.4h-.6z
    m M12-3.4a5.2 5.2 0 1 0 4.6 7.6 4.2 4.2 0 1 1-4.6-7.6z
    a M12.6.4l1.4 1.6-1.4 1.8-1.4-1.8z
    t M10.6 5.2h2.8v1.4h-2.8z
    l M11.2 9l1.6 1.4M11.2 12l1.6 1.4M11.2 15l1.6 1.4M11.2 18l1.6 1.4
    t M10.8 21h2.4v1.4h-2.4z
    p M16.6-1.6h.01M17.6 1.2h.01
    h M8.4 0c.2-1.4 1-2.4 2.2-3
  `,
  60: `
    @rotate 45
    @scale 0.86
    b M11.2 7.4h1.6v19.4h-1.6z
    s M12.2 7.4h.6v19.4h-.6z
    t M8 4.6l-1.2 4.4 1.2.4 1-4.2zM16 4.6l1.2 4.4-1.2.4-1-4.2z
    m M12-4.8l1 2h-2zM12 7.6l1-2h-2zM6.2 1.4l2 1v-2zM17.8 1.4l-2 1v-2z
    b M12-2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4z
    k M12-1.2a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z
    a M12-.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z
    m M10.6 6.6h2.8v1.6h-2.8z
    t M10.8 16h2.4v3.6h-2.4z
    l M10.8 17.2h2.4M10.8 18.4h2.4
    m M11 25.8h2v1.4h-2z
    h M9 -.8c.4-1 1.2-1.6 2-1.8
  `,
  80: `
    @rotate 45
    @scale 0.8
    m* M10.4 7.6C7.6 8.2 4.8 7.4 3 5.2c1.2 0 2.2-.2 3-.6-1.2-.4-2.2-1.2-2.8-2.4 1.4.2 2.6 0 3.4-.4-.8-.8-1.2-1.8-1.2-3 2.4 1.2 4.4 3.4 5.6 6.4z
    l* M5.2 5.4l2.6.2M5.8 3l2.4.8M7.2.8l1.6 1.6
    t M12-1.8l1 1.8h-2z
    t M12 0a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z
    k M12 1.4a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z
    b M11 1.2h2v7h-2zM8.8 3.6h6.4v2H8.8z
    a M12 3.6l1 1-1 1.2-1-1.2z
    b M11.2 9.4h1.6v15.6h-1.6z
    s M12.2 9.4h.6v15.6h-.6z
    t M10.8 11h2.4v1.2h-2.4zM10.8 22h2.4v1.2h-2.4z
    m M10.8 15.4h2.4v3.6h-2.4z
    t M12 25l1 1.6h-2z
  `,
};

/** Shields (the Vanguard's weapon): wood, steel, dark iron, elven silver, black. */
export const SHIELD_PALETTE: Record<Band, Palette> = {
  1: { light: "#dcae70", base: "#9a6438", dark: "#4a2c16", trim: "#8a909a" },
  20: { light: "#eef2f6", base: "#a3adba", dark: "#414955", trim: "#b8423a" },
  40: { light: "#a2aab8", base: "#4e5562", dark: "#1c1f26", trim: "#c58a3e" },
  60: { light: "#f6f2e6", base: "#cbc3ad", dark: "#6e6650", trim: "#2f8f98" },
  80: { light: "#8a8fa6", base: "#25262f", dark: "#07070b", trim: "#b3243a" },
};

/*
 * Shields, drawn upright:
 *   1  Wooden Buckler: a round plank shield with an iron rim, a bar and a boss
 *   20 Iron Kite Shield: a steel kite with a red cross and rivets
 *   40 Tower Shield: a tall dark iron shield with a crown of spikes and a thorned bronze cross around a glowing gem
 *   60 Ironwall Aegis: an elven silver shield with notched sides, teal enamel, a gold spine and an oval gem
 *   80 Titan's Bulwark: a black horned shield with a silver crest, a crimson spine and a crimson gem
 */
const SHIELD: Record<Band, string> = {
  1: `
    t M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6z
    b M12 3.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8z
    s M12 3.6a8.4 8.4 0 0 1 0 16.8 5.6 8.4 0 0 0 0-16.8z
    l M8.4 4.2v15.6M15.6 4.2v15.6
    t M3.6 10.8h16.8v2.4H3.6z
    m M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z
    s M12 8.4a3.6 3.6 0 0 1 0 7.2 2.2 3.6 0 0 0 0-7.2z
    d M12 3h.01M12 21h.01M3 12h.01M21 12h.01M5.6 5.6h.01M18.4 5.6h.01M5.6 18.4h.01M18.4 18.4h.01
    h M5.6 8.4c1-2 2.6-3.4 4.6-4.2M10.4 9.8c.4-.6 1-.8 1.6-.8
  `,
  20: `
    b M12 1.6c4 0 7.4 1 9 2.4-.2 7.6-3.4 14-9 18.4C6.4 18 3.2 11.6 3 4c1.6-1.4 5-2.4 9-2.4z
    s M12 1.6c4 0 7.4 1 9 2.4-.2 7.6-3.4 14-9 18.4z
    t M10.6 2h2.8v19.4h-2.8zM3.6 7.4h16.8v2.6H3.6z
    l M4.6 5c.4 6.4 3 11.6 7.4 15.4M19.4 5c-.4 6.4-3 11.6-7.4 15.4
    m M12 6.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z
    d M5 4.6h.01M8.4 3.4h.01M15.6 3.4h.01M19 4.6h.01M6 12.6h.01M18 12.6h.01M8.6 17.2h.01M15.4 17.2h.01
    h M5 5.6c.4 4 1.6 7.4 3.4 10M11.2 7.4c.2-.4.6-.6 1-.6
  `,
  40: `
    t M4 4.4L5 1l1.6 2.6L8.4.4 10 3l2-2.6L14 3l1.6-2.6 1.8 3.2L19 1l1 3.4z
    b M4 4.2h16v13.6c0 1.6-1 2.6-2.4 3.4L12 23l-5.6-1.8C5 20.4 4 19.4 4 17.8z
    s M12.6 4.2H20v13.6c0 1.6-1 2.6-2.4 3.4L12.6 22.8z
    l M5.2 5.4v12.2c0 1.2.8 2 1.8 2.6l5 1.6 5-1.6c1-.6 1.8-1.4 1.8-2.6V5.4z
    t M11 5.4h2v15h-2zM6.4 9.6h11.2v2H6.4z
    t* M8.4 9.6l-.8-1.6 1.6.8zM8.4 11.6l-.8 1.6 1.6-.8zM12 15.4l-1.4.8 1.4.8z
    a M12 8.4a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z
    h M5.6 6v8.4M11.4 9c.2-.4.4-.6.8-.6
    p M5.6 19h.01M18.4 19h.01
  `,
  60: `
    b M12 1l3 3.6c2.4.2 4.4 1 5.6 2.4-1.6.2-2.6 1.2-2.6 2.6s1 2.4 2.6 2.6L12 23 3.4 12.2c1.6-.2 2.6-1.2 2.6-2.6S5 7.2 3.4 7c1.2-1.4 3.2-2.2 5.6-2.4z
    s M12 1l3 3.6c2.4.2 4.4 1 5.6 2.4-1.6.2-2.6 1.2-2.6 2.6s1 2.4 2.6 2.6L12 23z
    t M12 4.2l2.4 2.6c1.8.2 3.2.8 4 1.6-1 .6-1.6 1.6-1.6 2.6L12 20.2l-4.8-9.2c0-1-.6-2-1.6-2.6.8-.8 2.2-1.4 4-1.6z
    m M11.4 4.6h1.2v15.2h-1.2z
    a M12 7.2c1.2 0 2 1.2 2 2.8s-.8 2.8-2 2.8-2-1.2-2-2.8.8-2.8 2-2.8z
    e M8.4 8.4l1.6 1.6M15.6 8.4L14 10M9.6 14l1.4 2.6M14.4 14L13 16.6
    h M10.6 8.6c.2-.6.6-1 1.2-1.2M5.4 6.8c1-.6 2.2-1 3.4-1.2
    p M12 2.6h.01
  `,
  80: `
    t* M3.4 12.4l-2.2.8 2.6 1.2zM4.8 16.6l-2 1.4 2.8.4z
    b M12 1.6l2.4 2.4 3.2-2.4 1.6 3 2.4-.8-.6 4.6c0 6.4-3.6 11.6-9 15-5.4-3.4-9-8.6-9-15l-.6-4.6 2.4.8 1.6-3 3.2 2.4z
    s M12 1.6l2.4 2.4 3.2-2.4 1.6 3 2.4-.8-.6 4.6c0 6.4-3.6 11.6-9 15z
    t M11.2 4h1.6v17h-1.6z
    l M5 8.4c.2 5 2.8 9.4 7 12.4M19 8.4c-.2 5-2.8 9.4-7 12.4
    m M12 7.4l2.6 2.2 3-1-1.6 2.4 1.6 2.4-3-1L12 14.6l-2.6-2.2-3 1 1.6-2.4-1.6-2.4 3 1z
    t M12 9.2l1.6 1.8L12 13l-1.6-2z
    h M5.4 7.4c.2 2.4.8 4.4 1.8 6.2
    p M6.8 5.6h.01M17.2 5.6h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

/** Each weapon type's palette by band; anything missing uses WEAPON_PALETTE. */
export const WEAPON_PALETTES: Partial<Record<string, Record<Band, Palette>>> = { staff: STAFF_PALETTE, shield: SHIELD_PALETTE };

export const WEAPON_ART: PieceArt = {
  sword: per(SWORD),
  staff: per(STAFF),
  shield: per(SHIELD),
};
