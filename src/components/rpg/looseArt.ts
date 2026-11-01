import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Loose armor (Ironbound, Patchwork, Scrapper, Wayfarer, Drifter, Hunter: no set and no class, GAME_DESIGN.md
 * 13.15), drawn in the same chunky style as the class sets. One adventurer's kit per band, each band with
 * its own silhouettes:
 *   1  Patchwork: quilted padded cloth with patches
 *   20 Studded: studded leather with buckles
 *   40 Mail: chain mail over leather
 *   60 Half-plate: a steel barbute, breastplate and plates over mail
 *   80 Gilded: dark plate with gold filigree, wings and a gem
 * A "*" after a tone mirrors that layer across the middle.
 */

export const LOOSE_PALETTE: Record<Band, Palette> = {
  1: { light: "#e8d7a8", base: "#b79d68", dark: "#5e4b2e", trim: "#8f6a44" },
  20: { light: "#c98f5a", base: "#8b5a34", dark: "#41281a", trim: "#cfd5dc" },
  40: { light: "#c9d3de", base: "#7f8b99", dark: "#363e48", trim: "#8f5d37" },
  60: { light: "#f0f4f9", base: "#a8b3c1", dark: "#454e5c", trim: "#7f8b99" },
  80: { light: "#aeb9d6", base: "#4c5370", dark: "#191c2c", trim: "#f2cc55" },
};

const GLOSS = "h M6.4 5.8c1.2-2 3.2-3.2 5.4-3.5-2 2-2.8 4-3 6.4-1.6 0-2.8-1.4-2.4-2.9z";

const HELMET: Record<Band, string> = {
  // A quilted arming cap with a patch and a chin strap
  1: `
    b M12 2.6c4.4 0 7.4 3.4 7.4 8.2v5.6c0 2.6-1.6 4.6-4 5.6H8.6c-2.4-1-4-3-4-5.6v-5.6c0-4.8 3-8.2 7.4-8.2z
    s M13.4 2.8c3.6.6 6 3.8 6 8v5.6c0 2.6-1.6 4.6-4 5.6h-2z
    k M8.2 10.4c1-1 2.4-1.4 3.8-1.4s2.8.4 3.8 1.4v5c0 1.6-1.6 3-3.8 3.4-2.2-.4-3.8-1.8-3.8-3.4z
    l M12 2.8v6.2M8 4.4l1.4 4.8M16 4.4l-1.4 4.8M4.8 10h3M16.2 10h3M5 13.6h3M16 13.6h3
    t M15.2 4.2h3v3h-3z
    t M8.6 19.8h6.8v1.6H8.6z
    l M16.7 4.2v3M15.2 5.7h3
    ${GLOSS}
  `,
  // A studded leather cap with ear flaps and a brim
  20: `
    b* M3.8 15l.8 5.2 3-1.4.2-3.8z
    b M4.2 13.4C4.2 7.6 7.6 3.6 12 3.6s7.8 4 7.8 9.8z
    s M13 3.7c3.8.6 6.8 4.4 6.8 9.7h-6.8z
    s M3 12.4h18v2.6H3z
    t M11 2.2h2v2h-2z
    l M12 4v8.4M8.4 5l1 7.4M15.6 5l-1 7.4
    t M3 13.2h18v.8H3z
    p M6.2 10h.01M7.4 7.4h.01M10.2 5.4h.01M13.8 5.4h.01M16.6 7.4h.01M17.8 10h.01M5.6 17.4h.01M18.4 17.4h.01
    ${GLOSS}
  `,
  // A mail coif under a steel skullcap, with a nasal
  40: `
    b M4.4 11C4.4 6.4 7.6 2.8 12 2.8s7.6 3.6 7.6 8.2v11l-3.6-1.6-4 1.8-4-1.8-3.6 1.6z
    s M13.6 3c3.6.8 6 4 6 8v11l-3.6-1.6-2.4 1.1z
    k M8.4 11.6h7.2v4c0 1.4-1.6 2.6-3.6 2.6s-3.6-1.2-3.6-2.6z
    m M5.4 10.8C5.4 6.8 8.4 3.6 12 3.6s6.6 3.2 6.6 7.2z
    t M11.2 4.4h1.6v9h-1.6z
    l M5.4 10.8h13.2
    d M6.2 13h.01M6.2 15.4h.01M6.2 17.8h.01M17.8 13h.01M17.8 15.4h.01M17.8 17.8h.01M8.2 19.6h.01M12 20.6h.01M15.8 19.6h.01M7.4 11.6h.01M16.6 11.6h.01
    p M7.4 8.6h.01M16.6 8.6h.01
    h M7 7.6c.8-1.6 2.2-2.8 4-3.2-1.2 1.4-1.8 3-2 4.8-1.4.2-2.2-.6-2-1.6z
  `,
  // A steel barbute with a Y-shaped face opening and a ridge
  60: `
    b M12 2.2c4.6 0 7.6 3.4 7.6 8.4v6.4c0 2.6-1.4 4.4-3.4 5H7.8c-2-.6-3.4-2.4-3.4-5v-6.4c0-5 3-8.4 7.6-8.4z
    s M13.4 2.3c3.8.6 6.2 4 6.2 8.3v6.4c0 2.6-1.4 4.4-3.4 5h-2.8z
    k M7.6 9h2.8l1.6 3.4L13.6 9h2.8l-2.8 5.8v7.2h-3.2v-7.2z
    m M11.2 2.3h1.6v6.6h-1.6z
    l M5.4 17.6c1 1.4 2.2 2.4 3.6 3M18.6 17.6c-1 1.4-2.2 2.4-3.6 3
    p M6.4 12h.01M17.6 12h.01M6.6 15.6h.01M17.4 15.6h.01
    ${GLOSS}
  `,
  // A gilded close helm with gold wings, a gem and a barred visor
  80: `
    t* M5.2 10C2.6 9 1.2 6.6 1.4 3.4c1.2.8 2.2 1.4 3.4 1.6-.6.8-.6 1.6 0 2.4.6-.4 1.2-.6 1.8-.6z
    b M12 2.6c4.4 0 7.2 3.4 7.2 8.2v6.4l-2.8 4.8H7.6l-2.8-4.8v-6.4c0-4.8 2.8-8.2 7.2-8.2z
    s M13.4 2.8c3.4.6 5.8 3.8 5.8 8v6.4l-2.8 4.8h-3z
    t M4.8 9.4h14.4v1.6H4.8z
    k M7 12.4h10v1.6H7z
    k M9.4 15v4.4M12 15v5M14.6 15v4.4
    t M11 2.8h2v6.6h-2z
    a M12 10.2l.9 1-.9 1-.9-1z
    l M7 16.4l1.4 3.6M17 16.4l-1.4 3.6
    p M6 13.2h.01M18 13.2h.01M8.6 7h.01M15.4 7h.01
    h M7.4 6.8c.8-1.6 2-2.6 3.4-3-1 1.2-1.4 2.4-1.6 4-1.2.2-2-.2-1.8-1z
  `,
};

const CHESTPLATE: Record<Band, string> = {
  // A quilted padded gambeson with patches and a belt
  1: `
    b M6.8 4.6l5.2 1.8 5.2-1.8 4 3.4-1.8 5.4-2.2-.8V21H6.8v-8.4l-2.2.8L2.8 8z
    s M12.6 6.2l4.6-1.6 4 3.4-1.8 5.4-2.2-.8V21h-4.6z
    k M9.6 5l2.4 3 2.4-3-2.4-.8z
    l M12 8v13M8.6 9v12M15.4 9v12M6.8 12.6h10.4M6.8 16h10.4M4.4 8.8l1.6 3.8M19.6 8.8L18 12.6
    t M14.2 13.2h2.8v2.6h-2.8zM7.4 9.4h2.6v2.4H7.4z
    s M6.8 17.4h10.4v1.8H6.8z
    m M11 17.2h2v2.2h-2z
    h M8 8l-.4 4.4M3.8 8.4l1 2.6
    p M15.6 14.5h.01M8.7 10.6h.01
  `,
  // A studded leather jerkin with round shoulder caps and a buckled belt
  20: `
    b M7.2 5.4h9.6l1.2 4.2-1 4 .6 7.4H6.4l.6-7.4-1-4z
    s M12.6 5.4h4.2l1.2 4.2-1 4 .6 7.4h-5z
    m* M2.6 10.2C2.6 7 4.4 5 7.2 5l1 1.4-.4 4.6L4 12.4c-.8-.4-1.4-1.2-1.4-2.2z
    k M10.2 5.6l1.8 3.2 1.8-3.2z
    l M12 8.8v12
    t M6.6 15.2h10.8v2H6.6z
    m M10.8 15h2.4v2.4h-2.4z
    p M8.4 9h.01M8.6 11.4h.01M8.8 13.6h.01M15.6 9h.01M15.4 11.4h.01M15.2 13.6h.01M8.6 19h.01M15.4 19h.01M4.4 8.2h.01M19.6 8.2h.01
    h M8 6.6l-.6 4.4M3.6 8.6c.4-1 1-1.8 1.8-2.2
  `,
  // A mail hauberk with long sleeves, a leather belt and a toothed hem
  40: `
    b M7.4 4.6l4.6 1.6 4.6-1.6 4.8 2.8-1.2 6.6h-3V20H6.8v-6H3.8l-1.2-6.6z
    s M12.6 6l4-1.4 4.8 2.8-1.2 6.6h-3V20h-4.6z
    m M9 4.6L12 7.4l3-2.8-3-1.4z
    s M6.8 20l.9 1.8 1.3-1.8 1.3 1.8 1.3-1.8 1.4 1.8 1.3-1.8 1.3 1.8 1.3-1.8 .9 1.8.2-1.8z
    t M6.8 14.6h10.4v1.8H6.8z
    m M11 14.4h2v2.2h-2z
    d M9.4 9h.01M12 9.6h.01M14.6 9h.01M9.4 11.6h.01M12 12.2h.01M14.6 11.6h.01M9.4 18.2h.01M12 18.6h.01M14.6 18.2h.01M5 9h.01M19 9h.01M4.8 11.6h.01M19.2 11.6h.01
    h M8.2 7.6l-.4 5.6M3.6 8l.8 3.4
  `,
  // A steel breastplate with rounded pauldrons over mail sleeves, and faulds
  60: `
    s* M2.4 11.4l1 5h3l.2-5z
    d* M3.8 13.2h.01M5.6 13.2h.01M3.8 15h.01M5.6 15h.01
    b M7 5.4h10l1.6 4.4-1.6 5H6.4l-1.6-5z
    s M12.6 5.4H17l1.6 4.4-1.6 5h-4.4z
    m M9.2 3h5.6l1.2 2.4H8z
    m* M1.6 10.2C1.6 6.6 3.8 4.4 7.2 4.6l.8 1.6-.4 5-5 1.4c-.6-.6-1-1.4-1-2.4z
    m M6.6 14.8h10.8l.6 2.4H6z
    m M6 17.2h12l.6 2.4H5.4z
    s M12.6 14.8h4.8l.6 2.4h-5.4zM12.6 17.2H18l.6 2.4h-6z
    l M12 5.4v9.4M7.4 9.6c3 1 6.2 1 9.2 0
    p M4 7.6h.01M20 7.6h.01M9 7.4h.01M15 7.4h.01
    h M8 6.4l-.8 4.6M2.8 8.4c.4-1.4 1.4-2.4 2.8-2.8
  `,
  // Gilded dark plate with filigree, a gem and a short cape behind
  80: `
    s M4.6 7.4L3 21.6l2.6-.8 1.2 1.4V9zM19.4 7.4L21 21.6l-2.6-.8-1.2 1.4V9z
    b M6.8 5.6h10.4l1.4 4.6-1.6 4 .8 7H6.2l.8-7-1.6-4z
    s M12.6 5.6h4.6l1.4 4.6-1.6 4 .8 7h-5.2z
    m M9 3.2h6l1.2 2.4H7.8z
    b* M1.6 10.4C1.6 6.6 3.8 4.2 7.2 4.4l.8 1.6-.4 5.4L2.8 13c-.8-.6-1.2-1.6-1.2-2.6z
    t* M2 10.6l5.8.6M2.6 12.4l5 .4
    t M6.8 15.6h10.4v1.4H6.8zM7.8 9.4h8.4M8.6 9.4l3.4 3.4 3.4-3.4
    a M12 10.6l1.4 1.6-1.4 2-1.4-2z
    e M8.6 18.6c1.2.8 2.2 1.2 3.4 1.2s2.2-.4 3.4-1.2M12 5.8v3.4
    p M4.2 7.4h.01M19.8 7.4h.01M9 19.6h.01M15 19.6h.01
    h M8 6.8l-.6 4.4M2.8 8.4c.4-1.4 1.4-2.4 2.8-2.8
  `,
};

const GLOVE_BASE = `
  b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
  s M15.4 4.6c.9.2 1.6 1 1.6 1.9v8l-2 3V21h-1.6v-3.8l2-3.2z
  l M8 8.2V10M11 4.6V10M14 5.6V10M8 10h9
  h M6 9.3V8.6M8.8 4.8V6
`;

const GLOVES: Record<Band, string> = {
  // A patched work glove with a rolled cuff
  1: `${GLOVE_BASE}
    t M10.4 11.4h3v3h-3z
    l M11.9 11.4v3M10.4 12.9h3
    s M6.2 16.6h10.4v4.6H6.2z
    t M6.2 16.6h10.4v1.4H6.2z
    p M8 7h.01M12.4 6.8h.01
  `,
  // A studded leather gauntlet with a wide studded cuff
  20: `${GLOVE_BASE}
    b M5 15.6h13.4l-1.4 5.8H6.4z
    s M12 15.6h6.4L17 21.4h-5z
    p M7.4 17.6h.01M10 17.6h.01M12.8 17.6h.01M15.6 17.6h.01M7.8 19.8h.01M15.2 19.8h.01M8.8 11.6h.01M11.6 11.6h.01M14.4 11.6h.01
  `,
  // A mail mitten with a leather cuff and strap
  40: `
    b M7 21v-6L5.2 12.6V8c0-2 1.4-3.6 3.4-3.6H13c2.4 0 4 1.6 4 3.8v7.4l-2 3.4V21z
    s M13.8 4.5c1.9.3 3.2 1.7 3.2 3.7v7.4l-2 3.4V21h-1.6v-4l1.6-3z
    b M5.2 12.6c-1.6-.4-2.4-1.6-2.2-3.2.2-1 1-1.4 1.8-.8l1 1.4z
    d M8.6 6.6h.01M11 6.4h.01M13.4 6.6h.01M8.6 9h.01M11 8.8h.01M13.4 9h.01M8.6 11.4h.01M11 11.2h.01M13.4 11.4h.01M8.8 13.8h.01M11.2 13.6h.01M13.6 13.8h.01
    t M6 16h11v5.2H6z
    s M6 18.4h11v1.2H6z
    m M10.4 18h2.2v2h-2.2z
    h M6.4 7.4c.4-1.2 1.2-2 2.2-2.4
  `,
  // An hourglass plate gauntlet with articulated fingers and a flared cuff
  60: `${GLOVE_BASE}
    m M5.4 7.6h2.8v1.4H5.4zM8.2 4.4h2.6v1.4H8.2zM11.2 3.8h2.6v1.4h-2.6zM14.2 4.6h2.6V6h-2.6z
    m M7.4 9.6h9.6v3H7.4z
    m M4.4 15.4h14.4l-1.6 6H6z
    s M12.4 15.4h6.4l-1.6 6h-4.8z
    l M7 18.2h10.4
    p M8.6 11.1h.01M12.2 11.1h.01M15.8 11.1h.01
  `,
  // A gilded dark gauntlet with a gold knuckle crown and a gem
  80: `${GLOVE_BASE}
    t M7.4 9.2l1.2-2 1.2 2 1.2-2.4 1.2 2.4 1.2-2.4 1.2 2.4 1.2-2 1.2 2v2.4H7.4z
    a M12 15.8l1.2 1.4-1.2 1.6-1.2-1.6z
    t M4.8 15h14l-1.6 6.4H6.4z
    s M12.6 15h6.2l-1.6 6.4h-4.6z
    a M12 17l1 1.2-1 1.4-1-1.4z
    e M6.4 19.6h10.8
    p M8.6 12.6h.01M15.4 12.6h.01
  `,
};

/** Leggings are a pair: the left leg is drawn and mirrored. */
const LEGGINGS: Record<Band, string> = {
  // Patched quilted trousers with a cord belt
  1: `
    b* M3 3.4h7.8l.4 8.6-.8 9.6H4.4l-1.2-9.6z
    s* M7.8 3.4h3l.4 8.6-.8 9.6H8z
    t M2.8 3.4h18.4v2.2H2.8z
    l* M5.2 6.6l-.6 13M8.2 6.6v13M3.4 10.6h7.6M3.6 15h7.2
    t* M4.6 11.6h2.6v2.6H4.6z
    l M11 5.6l-.6 2.6M13 5.6l.6 2.6
    h* M4.4 6l-.6 4.4
  `,
  // Studded leather chaps with a belt, straps and knee pads
  20: `
    b* M3.2 3.4h7.6l.4 8.6-.8 9.6H4.6l-1.2-9.6z
    s* M7.8 3.4h3l.4 8.6-.8 9.6H8z
    t M3 3.4h18v2.2H3z
    m M10.6 3.2h2.8v2.6h-2.6z
    b* M3.6 10.4h7v3.8h-7z
    p* M4.6 11.4h.01M6.4 11.4h.01M8.2 11.4h.01M4.6 13.2h.01M6.4 13.2h.01M8.2 13.2h.01M5.2 7.4h.01M5.6 17.8h.01
    t* M4 16.4h6.4v1.2H4z
    h* M4.6 6l-.4 4
  `,
  // Mail chausses under a leather belt and short tassets
  40: `
    b* M3.2 6h7.8l.4 6-.8 9.6H4.6l-1.2-9.6z
    s* M7.8 6h3.2l.4 6-.8 9.6H8z
    t M2.6 2.8h18.8v2.4H2.6z
    m M10.6 2.6h2.8v2.8h-2.8z
    t* M3 5.2h7.6l-.4 3.6H3.2z
    d* M5 10.6h.01M7.6 10.6h.01M5.2 13.2h.01M7.6 13.2h.01M5.4 15.8h.01M7.6 15.8h.01M5.6 18.4h.01M7.8 18.4h.01
    l* M7 5.2v3.6
    h* M4.4 9.6l-.4 4
  `,
  // Plate cuisses with knee cops over mail, and plate greaves
  60: `
    b* M3.2 3h7.8l.4 9-.8 9.6H4.6l-1.2-9.6z
    s* M7.8 3h3.2l.4 9-.8 9.6H8z
    m* M2.8 3h8.4l.2 5.4c-1.4 1.2-3 1.8-4.4 1.8S4 9.6 2.8 8.4z
    m* M3.6 9.6a3 3 0 1 1 6 0 3 3 0 0 1-6 0z
    d* M5 13.6h.01M7.6 13.6h.01M5.2 15.4h.01M7.6 15.4h.01
    m* M4 16.6h6.8l-.4 5H4.6z
    l* M7.2 16.6v5M3 5.6h8.2
    p* M6.6 9.6h.01
    h* M4 4l-.4 3.4M4.8 17.6l-.2 3
  `,
  // Gilded dark plate leggings with flared tassets and a gem
  80: `
    s* M3.4 9.6h7.6l.2 3-.8 9H4.6l-1.2-9z
    b* M2.4 3h8.8l.6 7.2-3.2 1.4-4.2-1z
    s* M7.6 3h3.6l.6 7.2-3.2 1.4z
    t M2.4 3h19.2v1.6H2.4z
    a M12 4.8l1.3 1.5-1.3 1.8-1.3-1.8z
    t* M2.6 9.4l4.4 1 4.4-1v1.2l-4.4 1.2-4.4-1.2z
    m* M4 15.2h6.4l-.4 2.6H4.4z
    t* M3.8 17.8h6.8v1H3.8z
    e* M5.4 5l.6 4M5 12.6l.6 2
    p* M4.6 20.4h.01M8.6 20.4h.01
  `,
};

/** Boots are a pair: one behind in shadow, one in front. */
const BOOT = (x: number, y: number) =>
  `M${x + 8} ${y + 3}h5.6v9l6 3a2.4 2.4 0 0 1 1.4 2.2V${y + 20}H${x + 4.4}v-3.6l3.6-2.2z`;

const BOOTS: Record<Band, string> = {
  // Cloth-wrapped shoes tied with cord
  1: `
    s M5 6.4h5.4v5.6l5.4 2.4c1.2.6 1.8 1.4 1.8 2.6v2.2H1.6v-3.4l3.4-2z
    b M8 7.2h5.6v5.6l5.4 2.4c1.2.6 1.8 1.4 1.8 2.6V20H4.4v-3.4l3.6-2z
    s M12.6 7.2h1v5.6l5.4 2.4c1.2.6 1.8 1.4 1.8 2.6V20h-6z
    l M8 9.4l5.6 1.2M8 11.8l5.6-1M8.4 14.2l5 1.2M10.4 15.8l6 1.6
    t M7.6 7h6.4v1.6H7.6z
    s M4 20h17.2v2H4z
    h M8.6 9.8v3M5.4 17.4l2-.6
  `,
  // Studded leather boots with two buckled straps
  20: `
    s ${BOOT(-3, -0.8)}
    b ${BOOT(0, 0)}
    s M12.6 3h1v9l6 3a2.4 2.4 0 0 1 1.4 2.2V20h-6z
    t M7.6 6h6.4v1.6H7.6zM7.6 10h6.4v1.6H7.6z
    m M9.8 5.8h1.8V8H9.8zM9.8 9.8h1.8V12H9.8z
    p M9 14.6h.01M11.4 15h.01M14 15.8h.01M16.6 16.8h.01
    s M4 20h17.2v2H4z
    h M8.6 3.6v1.6M5.4 17.4l2-.6
  `,
  // Mail-covered boots with a leather cuff and a leather toe
  40: `
    s ${BOOT(-3, -0.8)}
    b ${BOOT(0, 0)}
    s M12.6 3h1v9l6 3a2.4 2.4 0 0 1 1.4 2.2V20h-6z
    t M7.4 2.4h6.8v3H7.4z
    t M14.4 13.4l5.2 2.6a2.4 2.4 0 0 1 1.4 2.2V20h-6.6z
    d M9 7h.01M11.4 7h.01M9 9.4h.01M11.4 9.4h.01M9 11.8h.01M11.4 11.8h.01M7.6 15.4h.01M10.2 15.4h.01M12.6 15.6h.01
    s M4 20h17.2v2H4z
    h M8.4 6v5M5.4 17.4l2-.6
  `,
  // Steel sabatons with lames and a plated shin
  60: `
    s ${BOOT(-3, -0.8)}
    b ${BOOT(0, 0)}
    s M12.6 3h1v9l6 3a2.4 2.4 0 0 1 1.4 2.2V20h-6z
    m M7.6 2.6h6.4v2.8H7.6zM7.8 5.4h6v2.8h-6zM8 8.2h5.6V11H8z
    m M13.6 12.8l5.6 2.6.2 1.6-5.8-2.6zM15.4 14.6l3.6 1.6-.4 1.6-3.4-1.6z
    m M4.4 16.6h16.6v3.4H4.4z
    l M4.6 18.2H21
    s M4 20h17.2v2H4z
    p M7 18.4h.01M18 18.4h.01M10.8 4h.01M10.8 6.8h.01
    h M8.4 3.2v1.6M8.4 6v1.6
  `,
  // Gilded dark boots with gold wings and a gem
  80: `
    t M8 7.6L3 4.8l1.6 3.6-2 1.4 5.4 1.2zM8 5.8L4.4 2.6l.4 3.2z
    b ${BOOT(0, 0)}
    s M12.6 3h1v9l6 3a2.4 2.4 0 0 1 1.4 2.2V20h-6z
    m M7.6 2.6h6.4v2.4H7.6z
    t M7.6 2.6h6.4v.8H7.6zM8 9.6h5.6v1H8zM4.4 17h16.6v1.2H4.4z
    a M10.8 6.2l1 1.1-1 1.2-1-1.2z
    s M4 20h17.2v2H4z
    e M14 13.4l5 2.4
    p M7 18.8h.01M12 18.8h.01M17 18.8h.01
    h M8.4 4.2v4
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const LOOSE_ART: PieceArt = {
  helmet: per(HELMET),
  chestplate: per(CHESTPLATE),
  gloves: per(GLOVES),
  leggings: per(LEGGINGS),
  boots: per(BOOTS),
};
