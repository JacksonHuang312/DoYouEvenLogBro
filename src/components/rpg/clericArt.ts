import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Cleric armor (the healer, GAME_DESIGN.md 13.15), in the AFK Arena mage mould: soft, flowing cloth (robes,
 * capes, hoods and pointed hats), short cuffed boots, magic shown by small ornaments (stars, gems, gold
 * trim, crosses). Each band is its own set with its own silhouettes:
 *   1  Novice: a brown pointed hood with teal lining, a cape-robe, cuffed boots
 *   20 Conjurer: a teal bent cowl, a laced brown robe under a teal cape, boots with teal cuffs
 *   40 Dawn: a cream wide-brim hat with a gold band, white and gold robes, white boots
 *   60 High Caster: a black-navy witch hat with a silver star, a buttoned navy coat, black boots
 *   80 Seraph: a purple hood with a glowing gold cross and halo, a gold-trimmed cloak and black tabard
 * A "*" after a tone mirrors that layer across the middle.
 */

export const CLERIC_PALETTE: Record<Band, Palette> = {
  1: { light: "#dcc4a0", base: "#8c6444", dark: "#3c291b", trim: "#3f9096" },
  20: { light: "#d4a27a", base: "#8e5c3e", dark: "#3b2417", trim: "#3d9d9a" },
  40: { light: "#fffbf0", base: "#e7dcc0", dark: "#8c7e62", trim: "#dbb450" },
  60: { light: "#7d8db4", base: "#2e3b5e", dark: "#0e1324", trim: "#d2d9e8" },
  80: { light: "#ad98de", base: "#3c2b6a", dark: "#0e091e", trim: "#f2c852" },
};

const HELMET: Record<Band, string> = {
  // A brown pointed hood with a teal lining and a tassel
  1: `
    b M12 .6c1 2.4 2 3 3.6 4.4 2 1.4 3.4 3.6 3.4 6.2v2.2l1.4 7H4.6l1.4-7v-2.2c0-2.6 1.4-4.8 3.4-6.2C11 3.6 11 3 12 .6z
    s M12.6 1c.8 2.2 1.6 2.8 3 4 2 1.4 3.4 3.6 3.4 6.2v2.2l1.4 7h-6z
    t M8.2 10c.8-2 2.2-3 3.8-3s3 1 3.8 3v6c-1 1-2.4 1.6-3.8 1.6s-2.8-.6-3.8-1.6z
    k M9 10.6c.6-1.4 1.8-2.2 3-2.2s2.4.8 3 2.2v4.6c-.8.8-1.8 1.2-3 1.2s-2.2-.4-3-1.2z
    m M11 18.2h2v2.2h-2z
    l M6.6 12l-.6 6M17.4 12l.6 6M12 .8v4
    t M11.4 20.6l-.6 2.4h2.4l-.6-2.4z
    h M7.6 7c.8-1.6 2-2.6 3.4-3-1 1.4-1.6 3-1.8 5-1.2 0-1.8-1-1.6-2z
  `,
  // A tall teal cowl with a bent tip over a brown collar
  20: `
    b M5.6 16.4h12.8l1.6 5H4z
    t M12 2c1.4-1 3-1.4 4.6-.6-.6.8-1.6 1.2-2.4 1.8 2.8 1.8 4.4 4.2 4.4 7.2v3l1.2 3H4.8l1.2-3v-3c0-3.6 2.6-6.4 6-8.4z
    s M12.6 3.2c2.8 1.8 4 4 4 7v3l1.2 3h-5.6z
    k M8.6 9.6c.8-1.8 2-2.6 3.4-2.6s2.6.8 3.4 2.6v4.6c-1 .8-2.2 1.2-3.4 1.2s-2.4-.4-3.4-1.2z
    l M7 10l-1 6M17 10l1 6M8 18.4h8M9.6 17v4M14.4 17v4
    m M11 16.6h2v1.6h-2z
    p M10 19.6h.01M14 19.6h.01M12 19.6h.01
    h M7.8 6.8c.8-1.6 2-2.6 3.4-3-1 1.4-1.6 3-1.8 5-1.2 0-1.8-1-1.6-2z
  `,
  // A cream wide-brimmed pointed hat with a gold band and a gem
  40: `
    b M12 1.6l4.4 7.2c.4 1.2.6 2.4.6 3.6H7c0-1.2.2-2.4.6-3.6z
    s M12.6 2.2l3.8 6.6c.4 1.2.6 2.4.6 3.6h-4.4z
    b M1.8 14.4c3-1.8 6.2-2.6 10.2-2.6s7.2.8 10.2 2.6c-3 2-6.4 3-10.2 3s-7.2-1-10.2-3z
    s M12 17.4c3.8 0 7.2-1 10.2-3-2-1.2-4.2-2-6.6-2.4-.6 2.6-2 4.4-3.6 5.4z
    t M7 11h10v1.6H7z
    a M12 10.2l1.2 1.2-1.2 1.4-1.2-1.4z
    l M4.8 14.6c2.2 1.2 4.6 1.8 7.2 1.8s5-.6 7.2-1.8M12 2.4v8
    h M8.4 8c.8-1.4 1.6-2.4 2.8-3-.6 1.6-.8 3-.8 4.8-1.2 0-1.8-.8-2-1.8z
    p M3.6 14.4h.01M20.4 14.4h.01M9 14.9h.01M15 14.9h.01
  `,
  // A black-navy witch hat with a bent tip, a wide curled brim and a silver star
  60: `
    b M12 1.2c1.6 1 2.4 2.6 3.2 5l2.2 6.4H6.6l2.2-6.4c.8-2.4 1.6-4 3.2-5z
    s M12.8 1.6c1.4 1.2 2 2.6 2.6 4.6l2 6.4h-4.6z
    b M1.4 15c2.6-2.4 6.2-3.4 10.6-3.4s8 1 10.6 3.4c-1 2.6-5.6 4.2-10.6 4.2S2.4 17.6 1.4 15z
    s M12 19.2c5 0 9.6-1.6 10.6-4.2-1-1-2.2-1.8-3.6-2.4-.8 3.2-3.4 5.8-7 6.6z
    t M6.8 10.2h10.4l.4 2H6.4z
    m M12 5.4l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z
    l M3 15.4c2.8 1.6 5.8 2.4 9 2.4s6.2-.8 9-2.4
    e M10 3.4L9 6.6M3.6 14.6c1.4-.8 3-1.4 4.8-1.8
    h M9 5c.6-1.2 1.4-2 2.4-2.6-.4 1.4-.6 2.6-.6 4-1 0-1.6-.6-1.8-1.4z
    p M5 16.6h.01M19 16.6h.01
  `,
  // A purple hood over a black void with a glowing gold cross, under a gold halo
  80: `
    t M3.4 7.4c0-3.4 4-6 8.6-6s8.6 2.6 8.6 6h-1.6c0-2.6-3.2-4.4-7-4.4s-7 1.8-7 4.4z
    b M12 3.2c-4 0-6.8 3-6.8 7.2 0 1.8.4 3.2 1 4.6l-2 6h15.6l-2-6c.6-1.4 1-2.8 1-4.6 0-4.2-2.8-7.2-6.8-7.2z
    s M12.6 3.3c3.8.3 6.2 3.2 6.2 7.1 0 1.8-.4 3.2-1 4.6l2 6h-6.4z
    k M8.2 8.8c.8-1.8 2-2.6 3.8-2.6s3 .8 3.8 2.6v7.4H8.2z
    t M11.2 7.6h1.6v6.4h-1.6zM9.2 9.6h5.6v1.5H9.2z
    t M6.2 14.6c.6-1.4 1-2.8 1-4.4M17.8 14.6c-.6-1.4-1-2.8-1-4.4M4 21l2-.2M20 21l-2-.2
    a M12 19.2l1.2 1.2-1.2 1.4-1.2-1.4z
    m M10.4 17.6h3.2v1h-3.2z
    h M7.6 6c1-1.6 2.2-2.6 3.8-3-1.2 1.4-1.8 3-2 5-1.2 0-1.8-1-1.8-2z
    p M5 5.4h.01M19 5.4h.01M12 2.6h.01
  `,
};

const CHESTPLATE: Record<Band, string> = {
  // A cape-robe in brown cloth with a teal front and a rope belt
  1: `
    s* M5 8L2 15.4l2.6.6 2-2.4z
    b M7.4 5l4.6 1.4L16.6 5l2.4 3-1 14H6L5 8z
    s M12.4 6.4L16.6 5l2.4 3-1 14h-5.6z
    t M10.8 6.8h2.4l1 15.2H9.8z
    t M6.4 12.2h11.2v1.4H6.4z
    m M11 11.8h2v2.2h-2z
    l M7 8l.6 12M17 8l-.6 12M11 14.6v7
    t M10.4 22l.4 1.2h2.4l.4-1.2z
    h M8 6.8l-.6 5.4M3.6 11l1.2 2.4
    p M10.8 8.6h.01M13.2 8.6h.01
  `,
  // A laced brown robe under a teal cape
  20: `
    b M7.4 5l4.6 1.4L16.6 5l2.4 3-1 14H6L5 8z
    s M12.4 6.4L16.6 5l2.4 3-1 14h-5.6z
    k M10.8 7l1.2 6 1.2-6z
    t M4.4 8.6C5 6 8 4.6 12 4.6s7 1.4 7.6 4L18.4 13 12 11.4 5.6 13z
    s M12 4.6c3.2 0 5.8 1.2 7.4 3.4L18.4 13 12 11.4z
    l M9.6 13.6l2.4 1.2 2.4-1.2M9.6 16l2.4 1.2 2.4-1.2M9.6 18.4l2.4 1.2 2.4-1.2M12 11.6v10.4
    m M10.6 11.4h2.8v1.4h-2.8z
    p M8 21h.01M16 21h.01M6.4 14h.01M17.6 14h.01
    h M8 6l-.6 4.4M6.2 9.4l.8 2.4
  `,
  // A cream robe with gold trim, wide sleeves, a blue sash and a gold hem
  40: `
    s* M5.4 8.6L1.4 17.4l3.6 1.2 2.4-5.6z
    b M7.6 4.6L12 6l4.4-1.4 3.2 2.6-.6 4.4-1 .2L18 22H6l-.4-10.6L4.4 11l-.6-3.8z
    s M12.6 6.2l3.8-1.6 3.2 2.6-.6 4.4-1 .2L18 22h-5.4z
    t M11.2 6.2h1.6V22h-1.6zM6 20.2h12V22H6z
    a M7 12.6h10v2H7z
    t* M1.6 15.6l3.2 1.2-.6 1.6-3.4-1.2z
    t M10 3.6l2 2.6 2-2.6z
    l M7.6 8.4L7 20M16.4 8.4L17 20M9.6 17h.01M14.4 17h.01
    h M8.2 7l-.4 4.4.4 2.4
    p M9.2 9.4h.01M14.8 9.4h.01M9 19h.01M15 19h.01M12 10.4h.01
  `,
  // A buttoned navy coat with a high silver-edged collar and a star
  60: `
    s* M5.6 8.6L2 17l3.4 1.4 2.2-5.4z
    b M7.4 5l4.6 1.6L16.6 5l2.4 3.4-.6 4.6 1 9H4.6l1-9-.6-4.6z
    s M12.6 6.6L16.6 5l2.4 3.4-.6 4.6 1 9h-6.8z
    m M8.6 3.2L12 5.6l3.4-2.4.8 3L12 8.4 7.8 6.2z
    t M11.4 6.6h1.2V22h-1.2zM4.6 20.6h14.8V22H4.6z
    m M12 12.4l.9 2 2.1.2-1.6 1.4.5 2.1-1.9-1.1-1.9 1.1.5-2.1-1.6-1.4 2.1-.2z
    t M6.6 13h10.8v1.2H6.6z
    l M7.6 8l-.4 12M16.4 8l.4 12
    p M12 8.4h.01M12 10.2h.01M12 18.8h.01M7 15.6h.01M17 15.6h.01
    h M8 7.4l-.6 4.6.4 2.4
  `,
  // A gold-edged purple cloak over a black tabard with a gold cross and a gem
  80: `
    b M3 22l1.4-12C5 6 8 4 12 4s7 2 7.6 6L21 22z
    s M12.6 4.1C16.4 4.4 19 6.4 19.6 10L21 22h-8.4z
    k M9.6 7.6h4.8l1.2 14.4H8.4z
    t M11.2 10.4h1.6v8h-1.6zM9.2 12.6h5.6v1.5H9.2z
    t M3 22l1.4-12c.2-1.6.8-2.8 1.6-3.8M21 22l-1.4-12c-.2-1.6-.8-2.8-1.6-3.8M3 21h18v1H3z
    t M8.4 20.6h7.2l.4 1.4H8z
    a M12 5.6l1.2 1.2L12 8.2l-1.2-1.4z
    m M10.8 15.8h2.4v1.6h-2.4zM9.2 3.6h5.6l1 2H8.2z
    l M6.2 11l-1 10M17.8 11l1 10
    h M6.8 8c.6-1.6 1.6-2.6 3-3-.8 1.4-1 3-1 5-1.2 0-2-.8-2-2z
    p M5.4 8.4h.01M18.6 8.4h.01M9.6 20h.01M14.4 20h.01
  `,
};

const HAND = `
  b M7.4 21v-5L5.4 12V8.4a1.4 1.4 0 0 1 2.8 0V5a1.4 1.4 0 0 1 2.8 0V4a1.4 1.4 0 0 1 2.8 0v1.4a1.4 1.4 0 0 1 2.8 0V14l-1.8 3v4z
  s M15.2 4.8c.9.2 1.6.9 1.6 1.9V14l-1.8 3v4h-1.6v-4.2l1.8-3.2z
  l M8.2 9.6V12M11 5.6V10M13.8 6V10M7.2 12h9.6
  h M6 9V8M8.8 5.4V7
`;

const GLOVES: Record<Band, string> = {
  // A cloth mitten with a thumb and a teal cuff
  1: `
    b M7.4 21v-5.4L5.6 12.6V8.2c0-2.4 1.6-4 3.6-4H14c2 0 3.2 1.4 3.2 3.4V14l-1.8 3v4z
    s M14.8 4.4c1.4.4 2.4 1.6 2.4 3.2V14l-1.8 3v4h-1.6v-4.2l1.6-3z
    b M5.6 12.6c-1.6-.4-2.4-1.6-2.2-3.2.2-1 1-1.4 1.8-.8l1 1.4z
    l M8.4 7.6c1.6-.6 4.6-.6 6.6 0M9 10.6c1.4.4 3.6.4 5 0
    t M5.8 15.6h11.6v5.2H5.8z
    s M11.6 15.6h5.8v5.2h-5.8z
    l M7.4 17.4h8.2M7.4 19h8.2
    h M6.6 7.4c.4-1.2 1.2-2 2.2-2.4M4.4 10l.6.8
    p M10 5.8h.01M13 5.8h.01
  `,
  // A brown glove with a teal flared cuff and a button
  20: `${HAND}
    t M5 15.4h13.4l-1.4 5.8H6.4z
    s M11.8 15.4h6.6L17 21.2h-5.2z
    m M10.6 17.4h2.2v2.2h-2.2z
    l M6 17.4l11 .4
    p M9 8.6h.01M12.2 8.6h.01
  `,
  // A long white glove with gold rings, small wings and a gem
  40: `${HAND}
    t M6.8 16L3.6 14.2l1 3.4zM16.8 16l3.2-1.8-1 3.4z
    b M6.8 14.4h10l-.6 8.8H7.4z
    s M12.4 14.4h4.4l-.6 8.8h-3.8z
    t M6.8 14.4h10v1.2h-10zM7.1 18.4h9.4v1.1H7.1zM7.3 21.8h9v1.2h-9z
    a M11.8 16.2l.9 1-.9 1.1-.9-1.1z
    p M9.4 9.2h.01M12.2 9.2h.01
  `,
  // A navy glove with pointed fingertips and a silver star cuff
  60: `
    b M7.4 21v-5L5.4 12l.2-4.6 1.4-2.4 1.4 2.6.2-3.4 1.4-2.8 1.4 2.8.2-1.4 1.4-2.4 1.4 2.4.2 1.4 1.2-2 1.2 2.4V14l-1.8 3v4z
    s M15 5.2l1.2-2 1.2 2.4V14l-1.8 3v4h-1.6v-4.2l1.8-3.2z
    l M8.4 7.6V11M11.2 4.8V10M14 5.2V10M7.2 12h9.6
    t M6 15.4h11.4l-1 5.8H7z
    s M11.8 15.4h5.6l-1 5.8h-4.6z
    m M11.6 16.4l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z
    h M6 9V8M9.6 4.8l.4 1.4
    p M8.6 9.4h.01M11.4 8.4h.01
  `,
  // A black glove with a gold winged bracer and a gold cross
  80: `
    t M5.6 15.2C3.6 14.4 2 15 1 16.6c1.6-.2 2.8 0 4.2.8zM5.8 17.8c-1.6-.4-3-.2-4 1 1.4.2 2.6.4 3.8 1zM17.8 15.2c2-.8 3.6-.2 4.6 1.4-1.6-.2-2.8 0-4.2.8zM17.6 17.8c1.6-.4 3-.2 4 1-1.4.2-2.6.4-3.8 1z
    ${HAND}
    t M5.4 14.4h12.6l-1.2 7H6.6z
    s M11.8 14.4h6.2l-1.2 7h-5z
    k M9.6 16.2h4.4v3.6H9.6z
    t M11.4 16h1.2v4h-1.2zM10 17.4h4v1.2h-4z
    a M12 9.6l.8 1-.8 1.1-.8-1.1z
    p M8.6 11.4h.01M15.4 11.4h.01
  `,
};

/** Leggings are a robe skirt, the hem of the robe. */
const LEGGINGS: Record<Band, string> = {
  // A knee-length tunic skirt tied with a rope, over dark trousers
  1: `
    s* M8 13.4h3.2l-.2 8.4H8.2z
    b M6.6 3h10.8l2.4 11.2c-2.4 1-5.2 1.4-7.8 1.4s-5.4-.4-7.8-1.4z
    s M12.6 3h4.8l2.4 11.2c-2 .8-4.4 1.2-6.6 1.4z
    t M6.4 3.2h11.2v2H6.4z
    t M10.6 5.2l-.8 3.6 1.4-.4.4-3.2zM13.4 5.2l.8 3.6-1.4-.4-.4-3.2z
    l M9 6.4l-2.6 7.4M15 6.4l2.6 7.4M12 6v8.6
    t M4.4 13.4c2.4 1 5 1.4 7.6 1.4s5.2-.4 7.6-1.4l.2.9c-2.4 1-5.2 1.5-7.8 1.5s-5.4-.5-7.8-1.5z
    h M7.4 6l-2 7
    p M8 11h.01M16 11h.01
  `,
  // Two long panels split down the front, a teal sash with hanging tails
  20: `
    b M6.4 3h5.2l-.8 18.8H2.4z
    b M12.4 3h5.2l4 18.8h-8.4z
    s M15 3h2.6l4 18.8h-5.8z
    k M11.6 3h.8l.6 18.8h-2z
    t M6.2 3.2h11.6v2.6H6.2z
    t M10.2 5.8l-.8 6 1.6-.6.4-5.4zM13.8 5.8l.8 6-1.6-.6-.4-5.4z
    l M8.6 7.4l-3 13M17.2 7.4l2.6 13
    t M2.4 20.4h8.4v1.4H2.4zM13.2 20.4h8.4v1.4h-8.4z
    m M10.6 3.4h2.8v2.2h-2.8z
    h M7.2 6l-2.6 12.6
  `,
  // A two-tiered white skirt with gold hems, a blue sash and tassels
  40: `
    b M4.4 10.4c2.4.8 5 1.2 7.6 1.2s5.2-.4 7.6-1.2l2.4 10.2-2 1-1.8-.8-2 1-2.2-.8-2 .8-2.2-.8-2 .8-1.8-1-2 .8z
    s M14 11.4c2-.2 3.8-.5 5.6-1l2.4 10.2-2 1-1.8-.8-2 1z
    b M6.4 3h11.2l1.8 7.6c-2.2.8-4.8 1.2-7.4 1.2s-5.2-.4-7.4-1.2z
    s M13.2 3h4.4l1.8 7.6c-1.8.6-3.8 1-6 1.2z
    a M6.2 3.2h11.6v2.2H6.2z
    t M4.6 10.2c2.4.8 5 1.2 7.4 1.2s5-.4 7.4-1.2v1.2c-2.4.8-5 1.2-7.4 1.2s-5-.4-7.4-1.2z
    t M11.2 5.4h1.6v5.8h-1.6zM11.2 12.6h1.6v8h-1.6z
    t M12 7l1 1.4-1 1.4-1-1.4z
    l M8.4 5.6l-1.4 4.8M15.6 5.6l1.4 4.8M7.6 13l-1.6 7M16.4 13l1.6 7
    h M7.6 5l-1.4 4.4M5.6 12.6l-1.4 6
    p M5.8 21.4h.01M9.8 21.6h.01M14.2 21.6h.01M18.2 21.4h.01
  `,
  // A long narrow navy robe skirt with a dagged hem, silver trim and a star
  60: `
    b M7.2 3h9.6l1.6 17.4-1.8 2.2-1.6-1.6-1.6 2-1.4-2-1.6 2-1.6-2-1.6 1.6-1.8-2.2z
    s M12.8 3h4l1.6 17.4-1.8 2.2-1.6-1.6-1.6 2-.6-.9z
    k M11 5.4h2l1 15.2h-4z
    t M7 3.2h10v2.2H7z
    t M7 5.4l-1.4 15M17 5.4l1.4 15
    m M12 10l.8 1.8 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z
    l M9.4 6.4l-1.4 14M14.6 6.4l1.4 14
    h M8.2 6l-1 12
    p M8.8 16h.01M15.2 16h.01M12 4.3h.01
  `,
  // A black tattered tabard with a gold cross and a gold hem
  80: `
    b M6 3h12l3.4 18.6-2-1-1.4 1.6-1.8-1.8-1.6 1.8-1.6-1.8-1.8 1.8-1.4-1.6-2 1z
    s M12.4 3H18l3.4 18.6-2-1-1.4 1.6-1.8-1.8-1.6 1.8z
    t M5.8 3.2h12.4v2H5.8z
    k M9.4 5.4h5.2l1.6 15.4-1.4-1.2-1.4 1.6-1.4-1.6-1.4 1.6-1.4-1.6-1.4 1.2z
    t M11.2 8.2h1.6v8h-1.6zM8.8 10.4h6.4v1.5H8.8z
    t M6.4 20.6l-1.8-.4 1-3.2M17.6 20.6l1.8-.4-1-3.2
    a M12 5.4l1 1-1 1.2-1-1.2z
    p M8 6.6h.01M16 6.6h.01M12 18.2h.01
    h M7.2 7l-1.8 12
  `,
};

const SHAFT = (x: number, y: number) =>
  `M${x + 8} ${y + 6}h6v6.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V${y + 20}H${x + 5}v-3.4l3-2z`;

/** Boots are short and cuffed, drawn as a pair (one behind in shadow, one in front). */
const BOOTS: Record<Band, string> = {
  // Low cloth shoes with a turned-down cuff
  1: `
    s M5 9.2h6v3.6l5.2 2.4c1.2.6 1.8 1.4 1.8 2.6v1.4H2v-3.4l3-2z
    b M8 10h6v3.6l5.2 2.4c1.2.6 1.8 1.4 1.8 2.6V20H5v-3.4l3-2z
    s M13 10h1v3.6l5.2 2.4c1.2.6 1.8 1.4 1.8 2.6V20h-6.4z
    t M7.4 9h7.2v2.6H7.4z
    l M14.2 15.2l3.8 1.6M8.4 13.4h5.4
    s M4.6 20h17.2v2H4.6z
    h M8.6 12.2v2M6 17l1.8-.6
    p M10.4 15.4h.01M12 15.8h.01
  `,
  // Brown boots with a flared teal cuff and ties
  20: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M14 6h1v6.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M6.8 3.4h9.4l-.8 5.2H7.6z
    s M11.4 3.4h4.8l-.8 5.2h-4z
    l M8.4 10.4l2 2M12.4 10.4l-2 2M8.4 13l2 2M12.4 13l-2 2
    s M4.6 20h17.2v2H4.6z
    h M8.2 4.2v3M6 17l1.8-.6
    p M10 9.6h.01
  `,
  // White boots with winged gold cuffs and a light-blue band
  40: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M14 6h1v6.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M7.6 6.2L4.2 3.6l1.2 4.6zM14.4 6.2l3.4-2.6-1.2 4.6z
    a M7.4 4.2h7.8v3.6H7.4z
    t M7.4 7.8h7.8v1.2H7.4zM4.6 18h17.2v1.2H4.6z
    t M13.6 13.4l5 2 .4 1.4-5.4-2zM10.4 11l1 .6-1 .6-1-.6z
    s M4.6 20h17.2v2H4.6z
    h M8.4 5.2v1.6M6 17l1.8-.6
    p M9 14.6h.01M11.6 15.2h.01
  `,
  // Tall black knee boots with buckled straps, a silver star and a pointed toe
  60: `
    s M5 1.2h6v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6v2.4H2v-3.4l3-2z
    b M8 2h6v10.4l5.6 2.4c1.6.6 2.6 1.6 2.8 3.2l-1 .4V20H5v-3.4l3-2z
    s M13 2h1v10.4l5.6 2.4c1.6.6 2.6 1.6 2.8 3.2l-1 .4V20h-6.6z
    m M7.6 1.6h6.8v1.8H7.6z
    t M7.8 5.6h6.4v1.4H7.8zM7.8 9.6h6.4V11H7.8z
    m M10.2 5.4h1.6v1.8h-1.6zM10.2 9.4h1.6v1.8h-1.6z
    m M11 13l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z
    t M4.6 18h17.2v1.2H4.6z
    s M4.6 20h17.2v2H4.6z
    h M8.6 3.4v8M6 17l1.8-.6
    p M9 16.6h.01M15.6 16.4h.01
  `,
  // Dark purple boots with gold bands, a gem and curled gold toes
  80: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M14 6h1v6.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M7.6 5.4h7.4v1.6H7.6zM7.8 10.2h7v1.4h-7zM4.6 17.6h17.2v1.2H4.6z
    t M20.4 15c1.6.4 2.8 1.4 3 3-1-.6-1.8-.8-2.6-.6zM3.6 16l-2.2.8 1.2 1.8z
    a M10.4 7.6l1 1.1-1 1.2-1-1.2z
    s M4.6 20h17.2v2H4.6z
    e M9 12.4l3 2.4M13.6 13.4l4 1.8
    h M8.4 6.6v3M6 17l1.8-.6
    p M9 14.8h.01M11.8 15.4h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const CLERIC_ART: PieceArt = {
  helmet: per(HELMET),
  chestplate: per(CHESTPLATE),
  gloves: per(GLOVES),
  leggings: per(LEGGINGS),
  boots: per(BOOTS),
};
