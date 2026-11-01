import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Striker armor (the rogue DPS, GAME_DESIGN.md 13.15), in the AFK Arena rogue mould: light and lean (slim
 * shoulders, a tight torso, tall boots), hoods and masks that hide the face, straps and buckles doing the
 * detail. Each band is its own set with its own silhouettes:
 *   1  Scrapper: burlap cowl, a patched tunic with one strap, plain boots (grey cloth, rust)
 *   20 Mercenary: a red-brown hood, a layered vest with dark sleeves, folded boots with ties
 *   40 Assassin: a fitted pointed cap, a cuirass with shoulder plates and a buckle, dark-cuffed boots
 *   60 Ronin: a wide conical hat, a long navy coat with silver trim and a bandolier, flared hakama
 *   80 Nightblade: a crimson hood over a black faceted helm with a glowing visor, spiked shoulders, a cape
 * A "*" after a tone mirrors that layer across the middle.
 */

export const STRIKER_PALETTE: Record<Band, Palette> = {
  1: { light: "#d2ccbd", base: "#8c887a", dark: "#3f3c37", trim: "#a4593a" },
  20: { light: "#cf8f66", base: "#8f5236", dark: "#3d2218", trim: "#2c2724" },
  40: { light: "#e4ad74", base: "#b56d3a", dark: "#4f2e19", trim: "#a3acb6" },
  60: { light: "#8397bb", base: "#3f4e72", dark: "#121a2d", trim: "#c8d0de" },
  80: { light: "#8d6970", base: "#1d1c25", dark: "#07070b", trim: "#a82339" },
};

const HELMET: Record<Band, string> = {
  // A burlap cowl with a wrapped neck and an eye slit
  1: `
    b M12 2.4c-4 0-6.4 3.2-6.4 7.6v2.4L3.6 20h5l1.4-3h4l1.4 3h5l-2-7.6V10c0-4.4-2.4-7.6-6.4-7.6z
    s M12.6 2.5c3.6.5 5.8 3.5 5.8 7.5v2.4l2 7.6h-5l-1.4-3h-2z
    k M8.6 8.4c.8-.8 2-1.2 3.4-1.2s2.6.4 3.4 1.2v2.4c-1 .5-2.2.8-3.4.8s-2.4-.3-3.4-.8z
    m M8.2 11.8h7.6l.4 4.2-4.2 1.8-4.2-1.8z
    l M9 13.4h6M9.4 15h5.2M12 3v4M6.4 10.4l-.8 5M17.6 10.4l.8 5
    t M14.4 4.6h2.6v2.6h-2.6z
    h M7.4 6c1-1.8 2.4-2.8 4-3-1.6 1.8-2.2 3.6-2.4 5.6-1.4 0-2-1.2-1.6-2.6z
    p M15 5.2h.01M16.4 6.6h.01
  `,
  // A red-brown hood with a dark lining and a scarf
  20: `
    b M12 1.6c-4.6 1.6-7 5-7 9.4l-1 9h4.6l1.2-3h4.4l1.2 3H20l-1-9c0-4.4-2.4-7.8-7-9.4z
    s M12.6 1.8c4.2 1.8 6.4 5 6.4 9.2l1 9h-4.6l-1.2-3h-1.6z
    t M8 9.2c.8-2 2.2-3 4-3s3.2 1 4 3v6.4c-1 1-2.4 1.6-4 1.6s-3-.6-4-1.6z
    k M8.8 9.6c.8-1.6 2-2.4 3.2-2.4s2.4.8 3.2 2.4v5c-1 .8-2 1.2-3.2 1.2s-2.2-.4-3.2-1.2z
    t M7.4 16.4h9.2l.8 3.8H6.6z
    l M12 2v4.4M6.4 12l-.8 6M17.6 12l.8 6M9.6 17.8l.4 2.2M14.4 17.8l-.4 2.2
    h M7.4 6.2c1-1.8 2.4-2.8 4-3-1.6 1.8-2.4 3.6-2.6 5.8-1.4 0-2-1.2-1.4-2.8z
    p M9.2 11.6h.01M14.8 11.6h.01
  `,
  // A fitted pointed cap with a steel crest, nose guard and cheek plates
  40: `
    b M12 1.8c4 .6 6.6 3.6 6.6 8v3.6l-2 4.6-2.4 2.2H9.8l-2.4-2.2-2-4.6V9.8c0-4.4 2.6-7.4 6.6-8z
    s M12.8 1.9c3.6.8 5.8 3.6 5.8 7.9v3.6l-2 4.6-2.4 2.2h-1.4z
    k M8.4 11.4h7.2v3.2l-1.6 3H10l-1.6-3z
    t M11.2 1.8h1.6V9h-1.6zM11.2 9.4h1.6v8h-1.6z
    t* M5.4 8l1.6.6.6 5-1.6-.6z
    s M5.6 9.6h12.8v1.4H5.6z
    l* M7.4 12.4l.4 3.4
    p M6.8 7.4h.01M17.2 7.4h.01M12 20.2h.01
    h M7.4 6c1-1.8 2.4-2.8 4-3-1.6 1.8-2.2 3.6-2.4 5.6-1.4 0-2-1.2-1.6-2.6z
  `,
  // A wide conical straw hat over a high navy collar, with silver trim and a bandolier chain
  60: `
    b M1.6 11.4L12 2.6l10.4 8.8c-3 1.8-6.4 2.6-10.4 2.6s-7.4-.8-10.4-2.6z
    s M12.6 2.9l9.8 8.5c-2.8 1.7-6 2.5-9.8 2.6z
    t M1.6 11.4c3 1.8 6.4 2.6 10.4 2.6s7.4-.8 10.4-2.6v1c-3 1.8-6.4 2.6-10.4 2.6S4.6 14.2 1.6 12.4z
    k M7.6 14.2c1.2.4 2.8.6 4.4.6s3.2-.2 4.4-.6v4.4c-1.2.8-2.8 1.2-4.4 1.2s-3.2-.4-4.4-1.2z
    b M5 17.8l2.6-3.6 4.4 1.6 4.4-1.6 2.6 3.6-2 3.4H7z
    a M9.4 16.4h1.8M12.8 16.4h1.8
    l M12 2.6v11.4M6.6 7.2l1.6 6.2M17.4 7.2l-1.6 6.2M3.8 9.8l3 3.8M20.2 9.8l-3 3.8
    t M7 20.4l1.4-2.4 3.6 1 3.6-1 1.4 2.4z
    p M9 21.8h.01M12 22h.01M15 21.8h.01
  `,
  // A crimson hood over a black faceted helm with a glowing visor
  80: `
    t M12 .8c-4.8 1.4-7.4 5-7.4 9.6L3 17l3.4 2.4 1.4 2.4L12 20.6l4.2 1.2 1.4-2.4L21 17l-1.6-6.6C19.4 5.8 16.8 2.2 12 .8z
    b M12 4.2l3.6 2.2c1.2 1.4 1.8 3 1.8 5v3.6l-2 3.2-3.4 2-3.4-2-2-3.2v-3.6c0-2 .6-3.6 1.8-5z
    s M12.6 4.4l3 1.8c1.2 1.4 1.8 3 1.8 5v3.6l-2 3.2-2.8 1.7z
    m M11.4 4.4h1.2v5.6h-1.2z
    t M8.4 10.6l3.6.8 3.6-.8v1.6L12 13l-3.6-.8z
    e M9 15l3 2 3-2M10 6.4l2 1.6 2-1.6
    l M6.6 8l-1 6M17.4 8l1 6M12 13.4v5.4
    p M9.4 16.6h.01M14.6 16.6h.01M7.4 12.4h.01M16.6 12.4h.01
    h M8.2 7.6c.6-.8 1.4-1.4 2.4-1.8-.6 1-.8 2-.8 3.2-.8 0-1.4-.6-1.6-1.4z
  `,
};

const CHESTPLATE: Record<Band, string> = {
  // A patched burlap tunic with one leather strap
  1: `
    b M7.4 5.4l4.6 1.6 4.6-1.6 3.4 3-1.2 5-1.8-.6v7.4H7v-7.4l-1.8.6-1.2-5z
    s M12.4 7l4.2-1.6 3.4 3-1.2 5-1.8-.6v7.4h-4.6z
    m M8.6 5.6L12 8.6l3.4-3z
    t M8 5.6l9.6 11.4-1.8 1.6L6.6 7.2z
    m M11.2 11.2h2.2v2.2h-2.2z
    t M14.6 14.4h3v3h-3z
    l M14.6 15.9h3M16.1 14.4v3M8.6 17.6h4M8.6 19.6h5
    h M6.6 8.6l-.6 3.4M9 9.4l-.6 6
    p M5.4 9.4h.01M18.6 9.4h.01
  `,
  // A layered red-brown vest over dark sleeves
  20: `
    s* M3.6 7.4l3.8-2 1 10.4-3.4 1.2z
    b M7.6 5.4l4.4 1.4 4.4-1.4 1 14.4H6.6z
    s M12.4 6.8l4-1.4 1 14.4h-5z
    k M10.4 5.8l1.6 6.4 1.6-6.4z
    t M7 5l5 2.4L17 5l-1 3.2-4 1.6L8 8.2z
    t M6.8 15.4h10.4v2H6.8z
    m M10.8 15.2h2.4v2.4h-2.4z
    l M9.6 9.8l-.4 5M14.4 9.8l.4 5M8 18.8h8
    h M8 6.8l-.6 6.4M4.8 8.4l-.4 5.4
    p M3.8 15.6h.01M20.2 15.6h.01
  `,
  // Leather cuirass with metal shoulder plates, lames and a buckled belt
  40: `
    b M7.4 6.2h9.2l1.2 4.2-1.4 3.4.6 6.6H7l.6-6.6-1.4-3.4z
    s M12.4 6.2h4.2l1.2 4.2-1.4 3.4.6 6.6h-4.6z
    m* M3.6 8c0-2 1.4-3.4 3.6-3.4l1 4.2-4 1.4z
    s* M5.6 4.8l2.6-.2 0 4.2-2.6.9z
    t M7.6 12h8.8v1H7.6zM7.4 14.6h9.2v1H7.4zM7.2 17.2h9.6v1H7.2z
    m M9.4 3.4h5.2l1 2.8H8.4z
    t M7 17.6h10v1.8H7z
    m M10.8 17.4h2.4v2.2h-2.4z
    l M12 6.2v5.8
    p M4.8 6.4h.01M19.2 6.4h.01M9 9h.01M15 9h.01
    h M8.2 7.6l-.6 3.6.4 1.4
  `,
  // A long navy coat with a high collar, a bandolier and silver trim
  60: `
    b M7 5.4l5 1.8 5-1.8 2.4 3.2-2 6.4 1.6 6.6H5l1.6-6.6-2-6.4z
    s M12.6 7.2l4.4-1.8 2.4 3.2-2 6.4 1.6 6.6h-6.4z
    m M8.4 3.6l3.6 2.4 3.6-2.4 1 2.4-4.6 2.2L7.4 6z
    t M7.4 6.4l9.4 10.6-1.6 1.4L6 7.8z
    t M6.6 14.4h10.8v2H6.6z
    m M10.8 14.2h2.4v2.4h-2.4z
    t M5 20.2l.8-4.6M19 20.2l-.8-4.6M5.6 8.8l1 5.6M18.4 8.8l-1 5.6
    a M12 8.4l.8 1.2-.8 1.2-.8-1.2z
    l M12 8.6v5.4M8 20v-4M16 20v-4
    p M9 11.4h.01M14.6 12.6h.01M11 15.4h.01M6 11h.01
    h M8 8l-.8 5.4.4 2.4
  `,
  // Black faceted plate with spiked shoulders, a crimson cape, rune and gold lines
  80: `
    t M4.4 6C2.4 10 2 16 1.6 22l4-1.4 1.8 2 1.6-1.8V8zM19.6 6c2 4 2.4 10 2.8 16l-4-1.4-1.8 2-1.6-1.8V8z
    b M7.2 5.8l4.8-1.6 4.8 1.6 1.4 4.8-1.6 4 .8 6.6H7.6l.8-6.6-1.6-4z
    s M12.4 4.4l4.4 1.4 1.4 4.8-1.6 4 .8 6.6h-5z
    m* M2.4 9.2C2.4 6 4.4 4 7.4 4.2l1.4 1.8-.2 4.2z
    t* M3.2 5.4L1.4 2l4.2 2zM6.2 4.2L5.6 1l2.4 2.4z
    t M12 8.4l2 3-2 3.2-2-3.2z
    e M9 7.6l3 2 3-2M8.6 12.6l3.4 2.2 3.4-2.2
    t M7.8 16.4h8.4v1.6H7.8z
    m M10.8 16.2h2.4v2h-2.4z
    l M12 5v3M12 14.6v6M8 11l1 4M16 11l-1 4
    p M3.8 8.4h.01M20.2 8.4h.01M9 19.4h.01M15 19.4h.01
    h M8.4 7l-.6 4.4.4 2
  `,
};

const HAND = `
  b M7.4 21v-5L5.4 12V8.4a1.4 1.4 0 0 1 2.8 0V5a1.4 1.4 0 0 1 2.8 0V4a1.4 1.4 0 0 1 2.8 0v1.4a1.4 1.4 0 0 1 2.8 0V14l-1.8 3v4z
  s M15.2 4.8c.9.2 1.6.9 1.6 1.9V14l-1.8 3v4h-1.6v-4.2l1.8-3.2z
  l M8.2 9.6V12M11 5.6V10M13.8 6V10M7.2 12h9.6
  h M6 9V8M8.8 5.4V7
`;

const GLOVES: Record<Band, string> = {
  // Cloth hand wraps with a loose strip trailing from the wrist
  1: `
    t M7.4 18.2L3 20.4l.8 1.4 4.2-1.6z
    ${HAND}
    t M6.4 14.4l9.8 1.6-.2 1.5-9.8-1.6zM7 17.4l9 .4v1.5l-9-.4zM7.2 19.8h8.4v1.4H7.2z
    t M5.6 10.2l2.4.6-.2 1.2-2.4-.6zM8.4 6.6h2.6v1.2H8.4zM11.2 5.4h2.6v1.2h-2.6zM14 6h2.6v1.2H14z
    p M9.6 10.6h.01M12.4 10.6h.01
  `,
  // A leather glove with a wide flared bucket cuff and a buckle
  20: `
    ${HAND}
    t M4.2 14.4h14.8l-1.8 7.4H6z
    s M12.6 14.4h6.4l-1.8 7.4h-4.6z
    l M5 16.4h13.2
    m M10.4 17.4h2.4v2.6h-2.4z
    p M6.6 19.6h.01M16.4 19.6h.01M8.8 8.6h.01M12.2 8.6h.01
  `,
  // A long steel-plated bracer strapped over a leather glove
  40: `
    ${HAND}
    b M6.6 13h10.4l-.8 10.4H7.4z
    s M12.6 13h4.4l-.8 10.4h-3.6z
    m M8.4 14.4h6.8v5.4l-3.4 1.8-3.4-1.8z
    t M6.7 15.8h10.2v1.2H6.7zM7.1 20.6h9.4v1.2H7.1z
    p M11.8 17h.01M8.6 9.6h.01M12 9.6h.01M15.4 9.6h.01
    h M9 14.8v3
  `,
  // A navy wrap with a pointed silver hand guard and a cord around the finger
  60: `
    ${HAND}
    m M7 13.6l5-6.8 5 6.8-1 2.4H8z
    s M12 6.8l5 6.8-1 2.4h-4z
    a M12 10.6l.8 1-.8 1.1-.8-1.1z
    t M10.9 5.2h2.4v1.1h-2.4z
    l M12 6.8l.01.01M9 13.8h6
    s M6.6 16h10.6v5.4H6.6z
    t M6.6 16h10.6v1H6.6z
    p M8.2 18.8h.01M10.6 19.4h.01M13 18.8h.01M15.4 19.4h.01
  `,
  // A black clawed gauntlet with crimson edges
  80: `${HAND}
    t M8.2 4.6L7.4 1l2.4 3zM11 4.2L10.8.4 12.6 3.8zM13.8 4.6l.8-3.6 1.2 3.4zM16.2 5.6l1.4-2.6.2 3.4z
    t M5.8 15.6h11.6v1.4H5.8z
    m M5.8 17h11.6v3.8H5.8z
    s M11.6 17h5.8v3.8h-5.8z
    t M10.8 18.2l1 1.2-1 1.2-1-1.2z
    p M8.4 12h.01M12 12h.01M15.4 12h.01
  `,
};

/** Leggings are a slim pair: the left leg is drawn and mirrored. */
const LEGGINGS: Record<Band, string> = {
  // Patched trousers tied with rope
  1: `
    b* M3.6 3h7.4l.4 9-.6 9.6H5.2l-1-9.6z
    s* M7.4 3H11l.4 9-.6 9.6H7.6z
    t M3.4 3.2h17.2v1.8H3.4z
    t* M4.4 9.4h3v3h-3z
    l* M3.8 13.4l7 .4M4.6 18h5.8
    l M6 5l.6 2.4M12 5v2.4M18 5l-.6 2.4
    p* M5.4 10.9h.01M6.2 15.4h.01
    h* M4.6 5.4l-.4 5
  `,
  // Leather trousers with a belt, thigh bands and dark boots tops
  20: `
    b* M3.6 3h7.4l.4 9-.6 9.6H5.2l-1-9.6z
    s* M7.4 3H11l.4 9-.6 9.6H7.6z
    t M3.4 3.2h17.2v2H3.4z
    m M10.8 3h2.4v2.2h-2.4z
    t* M3.8 8.4h7.4v1.4H3.8zM4.4 14.6h6.4v1.4H4.4z
    t* M4.6 18h5.8l-.2 3.4H4.8z
    l* M6.4 5.6v2.4M8 10v4
    p* M5 7.2h.01M5.6 12.2h.01
    h* M4.6 10.4l-.2 3.4
  `,
  // Leather trousers with steel knee guards and shin straps
  40: `
    b* M3.6 3h7.4l.4 9-.6 9.6H5.2l-1-9.6z
    s* M7.4 3H11l.4 9-.6 9.6H7.6z
    t M3.4 3.2h17.2v2H3.4z
    m M10.8 3h2.4v2.2h-2.4z
    m* M3.8 8.6h7.2l.1 3.6c-1 .8-2.2 1.2-3.7 1.2s-2.6-.4-3.5-1.2z
    t* M4 16.4h7v1.2H4zM4.2 18.8h6.6v1.2H4.2z
    l* M7.4 13.4l.2 8
    p* M5.2 10.2h.01M9.6 10.2h.01
    h* M4.6 5.8l-.2 2.6
  `,
  // Wide navy hakama trousers with silver trim
  60: `
    b M3.4 3h17.2l1.6 18.6h-6.4L12 12.6l-3.8 9H1.8z
    s M12.6 3h8l1.6 18.6h-6.4l-3.2-9z
    t M3.2 3.2h17.6v2H3.2z
    m M10.8 3h2.4v2.2h-2.4z
    l M6 5.4l-2.6 16M9 6l-2 15.4M18 5.4l2.6 16M15 6l2 15.4M12 12.6v-7
    t M1.8 19.6h6.2v2H1.8zM16 19.6h6.2v2H16z
    p M4 13.4h.01M20 13.4h.01
  `,
  // Black slim leggings with a crimson sash, spiked knees and glowing seams
  80: `
    b* M3.6 3h7.4l.4 9-.6 9.6H5.2l-1-9.6z
    s* M7.4 3H11l.4 9-.6 9.6H7.6z
    t M3.4 3.2h17.2v2.2H3.4zM9.6 5.4l-1.2 6.4 1.6-.4.6-6zM14.4 5.4l1.2 6.4-1.6-.4-.6-6z
    m* M3.6 12.2h7.4l-.2 2.4c-1.2.6-2.4.8-3.5.8s-2.4-.2-3.5-.8z
    t* M3.8 12.4L1.6 11l.6 3.2zM4.4 16.8h6.2l-.2 3.4H4.6z
    t* M7.4 13.4l.8.9-.8.9-.8-.9z
    e* M6 6l.8 5.4M9.4 16v4
    p* M5 18.6h.01M9.4 18.6h.01
  `,
};

/** Boots are the standout piece: tall, cuffed, drawn as a pair (one behind in shadow, one in front). */
const SHAFT = (x: number, y: number) =>
  `M${x + 8.6} ${y + 2}h5v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V${y + 20}H${x + 5}v-3.4l3.6-2z`;

const BOOTS: Record<Band, string> = {
  // Short slouchy soft boots, crumpled at the top
  1: `
    s M5.4 5.6c1.6-.6 3.6-.6 5.4 0l-.2 6 5.4 2.6c1.2.6 1.8 1.4 1.8 2.6v2.4H2v-3.4l3.6-2z
    b M8.4 6.4c1.6-.6 3.6-.6 5.4 0l-.2 6 5.4 2.6c1.2.6 1.8 1.4 1.8 2.6V20H5v-3.4l3.6-2z
    s M12.6 6.2c.4 0 .8.1 1.2.2l-.2 6 5.4 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.8z
    t M8.2 5.6c1.8-.8 4-.8 5.8 0l-.2 1.8c-1.8-.6-3.6-.6-5.4 0z
    l M8.6 9c1.4.6 3.4.6 5 0M8.8 11.4c1.2.4 3 .4 4.6 0M13.6 14.4l3.6 1.6
    s M5 20h16.6v2H5z
    h M9.2 8l-.2 3.6M6.4 17l1.8-.6
    p M11 7.8h.01
  `,
  // Tall folded boots with ties
  20: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M13.6 2h1v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M7.6 2h7v3.4h-7z
    l M8 5.6h6M10 7.4l2.4 2M12.4 7.4l-2.4 2M10 10l2.4 2M12.4 10l-2.4 2
    s M5 20h16.6v2H5z
    t M5 17.4h16.6v1H5z
    h M8.4 3v2M9.4 13l.6 3M6.4 17l1.8-.6
    p M11 6.6h.01
  `,
  // Tall orange-brown boots with a dark cuff, buckles and a steel toe
  40: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M13.6 2h1v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M7.8 2h6.8v3H7.8zM8.2 7.6h6.4v1.6H8.2zM8.4 11h6v1.6h-6z
    m M10.6 7.4h1.6v2h-1.6zM10.6 10.8h1.6v2h-1.6z
    m M13.8 13.4l5.4 2.2.4 1.8-6 -2.4z
    s M5 20h16.6v2H5z
    t M5 17.4h16.6v1H5z
    h M8.6 5.4v1.6M6.4 17l1.8-.6
    p M9.4 14.6h.01M11.4 15.2h.01
  `,
  // Navy boots with silver trim and a curled toe
  60: `
    s ${SHAFT(-3, -0.8)}
    b ${SHAFT(0, 0)}
    s M13.6 2h1v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M8.6 2h5v1.4h-5zM8.6 8.4h5v1h-5zM5 17.2h16.6v1.2H5z
    m M13.4 13.4l5.6 2.4c1.4.4 2.4 1.2 2.6 2.4l-1.4.4-1.4-1.4-5.4-2.2z
    t M18 15.8c1.4.4 3 .8 3.6 2.4
    l M9 4.6l3.8 1.6M9 7l4.2 1M10.4 11l2.6 4
    s M5 20h16.6v2H5z
    a M10.4 5.4l.8 1-.8 1-.8-1z
    h M9.6 3.6v3M6.4 17l1.8-.6
    p M9.4 13h.01M12 13.6h.01
  `,
  // Black pointed boots with crimson edges, a spur and shin spikes
  80: `
    s ${SHAFT(-3, -0.8)}
    t M5.6 2.2L4.4.6l2.8.8zM9.4 1.6l-.2-1.2 1.8 1.2z
    b ${SHAFT(0, 0)}
    s M13.6 2h1v10.4l5.2 2.6c1.2.6 1.8 1.4 1.8 2.6V20h-5.4z
    t M8.6 2h5v1.6h-5zM5 17.2h16.6v1.2H5z
    m M13.4 13.4l6 2.4c1.4.4 2.2 1.2 2.4 2.6l-1.2.4-1.6-1.2-5.4-2.2z
    t M21.6 17.6l2 1.6-2.4.2zM8.8 6.4L7.2 5l2.6.6zM8.8 9.4L7 8.2l2.8.4z
    t M10.6 7.2l.9 1-.9 1-.9-1z
    s M5 20h16.6v2H5z
    e M9.6 11l2.6 4M10 4.8l2.4.6
    p M7 18.8h.01M12 18.8h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const STRIKER_ART: PieceArt = {
  helmet: per(HELMET),
  chestplate: per(CHESTPLATE),
  gloves: per(GLOVES),
  leggings: per(LEGGINGS),
  boots: per(BOOTS),
};
