import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Vanguard armor (the warrior tank, GAME_DESIGN.md 13.15), in the AFK Arena warrior mould: chunky,
 * exaggerated plate. Each band is its own set with its own silhouettes, not a recolour of the last:
 *   1  Wolfskin: a grey wolf-pelt hood, a fur mantle, furred greaves and boots (scavenged, brown leather)
 *   20 Guardian: the classic knight: a closed T-visor helm, layered pauldrons, smooth greaves
 *   40 Vanguard: sleek and angular: a swept open helm with fins, spiked pauldrons, blue enamel
 *   60 Dusk: a flat-topped bucket helm with a mane, a lopsided heavy plate, big bronze knee cops
 *   80 Temple: black plate with crimson trim: a horned helm with a glowing visor, stacked spiked pauldrons, a ragged cape
 * A "*" after a tone mirrors that layer across the middle.
 */

export const VANGUARD_PALETTE: Record<Band, Palette> = {
  1: { light: "#ece8df", base: "#a8a49c", dark: "#4c4a50", trim: "#8a5f3a" },
  20: { light: "#eef2f5", base: "#8f99a5", dark: "#394049", trim: "#bcc7d3" },
  40: { light: "#f7f9fd", base: "#bac4d2", dark: "#4e5970", trim: "#7fa6f0" },
  60: { light: "#cdd2dc", base: "#6a6f7b", dark: "#23262d", trim: "#cb914c" },
  80: { light: "#9aa0b4", base: "#2a2b36", dark: "#08090e", trim: "#b3243a" },
};

const GLOSS = "h M6.4 5.8c1.2-2 3.2-3.2 5.4-3.5-2 2-2.8 4-3 6.4-1.6 0-2.8-1.4-2.4-2.9z";

const HELMET: Record<Band, string> = {
  // A snarling grey wolf pelt worn as a hood
  1: `
    b M4.6 2.2l4.2 3.4c1-.5 2.1-.8 3.2-.8s2.2.3 3.2.8l4.2-3.4.8 8.6-1.4 3.2 1 2.6-2.6-.4-.8 3.2-3.4 1.6H10l-3.4-1.6-.8-3.2-2.6.4 1-2.6L3.8 10.8z
    s M12 4.8c1.1 0 2.2.3 3.2.8l4.2-3.4.8 8.6-1.4 3.2 1 2.6-2.6-.4-.8 3.2-3.4 1.6H12z
    s* M5.6 4.4l2.4 1.8-.2 2.4-2.6-2z
    m M9.4 11h5.2l1 3.2-1.4 2.8h-4.4l-1.4-2.8z
    k M10.8 11.2h2.4L12 12.8z
    k M10 15.8c.8.8 1.3 1 2 1s1.2-.2 2-1l-.3 2.2c-.5.5-1 .7-1.7.7s-1.2-.2-1.7-.7z
    m M10.3 16.4l.4 1.5.5-1.3M12.8 16.5l.5 1.3.4-1.5
    k* M6.8 8.4l3.2 1.2-.2 1.4-3.2-.6z
    l* M6.2 7.2l3.6.9
    l M12 4.8v6M7.4 13.6l-1.2 2.4M16.6 13.6l1.2 2.4
    h M5.2 5l-.4 4M8 6.4l2-.6
  `,
  // A closed knight's helm with a T-shaped visor and a comb
  20: `
    b M12 2c5 0 8.2 3.6 8.2 8.8 0 3.2-.7 5.6-2.1 7.6l-3.8 4.1h-4.6l-3.8-4.1C4.5 16.4 3.8 14 3.8 10.8 3.8 5.6 7 2 12 2z
    s M13.6 2.1c4 .6 6.6 3.8 6.6 8.7 0 3.2-.7 5.6-2.1 7.6l-3.8 4.1H12z
    k M5.6 10.4h12.8v1.8H13v7.8h-2v-7.8H5.6z
    m M11 2.1h2v6.8h-2z
    m M9.8 22h4.4
    l M5.2 14l3.4 4v4M18.8 14l-3.4 4v4
    p M6 8h.01M18 8h.01M7 12.6h.01
    ${GLOSS}
  `,
  // A swept-back open helm with temple fins and a blue crest
  40: `
    b M12 2c4.8 0 8 3.4 8 8.4l-3 .6c-1.3-1-3.2-1.7-5-1.7s-3.7.7-5 1.7l-3-.6C4 5.4 7.2 2 12 2z
    s M12.6 2.1c4.4.4 7.4 3.6 7.4 8.3l-3 .6c-1.1-.9-2.6-1.5-4.4-1.7z
    k M6.8 11.2c1.3-1 3.3-1.6 5.2-1.6s3.9.6 5.2 1.6v5.2c0 1.8-1.8 3.6-5.2 5.6-3.4-2-5.2-3.8-5.2-5.6z
    b* M4.2 10.2l3.2.8v5.4l2.4 4.8-2.6-.4-3.2-5.2z
    m M5.4 10.4l6.6-2.2 6.6 2.2-.8 1.8-5.8-1.8-5.8 1.8z
    t M11.2 2.1h1.6v7h-1.6z
    t* M4.4 8.8L1.8 6.4 6 7z
    l* M7.4 12.6v3.6
    ${GLOSS}
  `,
  // A flat-topped bucket helm with a bronze cross-band and a mane
  60: `
    t M8 3.4C8 1.2 9.8.2 12 .2s4 1 4 3.2c-1.4-.8-2.6-1-4-1s-2.6.2-4 1zM4.4 5.6C2.6 7 1.8 9.4 2.2 12.4c.8-.8 1.4-1.8 1.6-3 .2 2 .6 3.4 1.4 4.6.4-1.6.4-3 .2-4.4zM19.6 5.6c1.8 1.4 2.6 3.8 2.2 6.8-.8-.8-1.4-1.8-1.6-3-.2 2-.6 3.4-1.4 4.6-.4-1.6-.4-3-.2-4.4z
    b M5 4h14v14.5l-2.6 3.5H7.6L5 18.5z
    s M12.6 4H19v14.5L16.4 22h-3.8z
    m M4.4 3h15.2v2H4.4z
    k M6.4 9.6h11.2v1.8H6.4z
    t M5 12.6h14v1.8H5zM11 4h2v5.6h-2z
    k M8 16.4h1.4M10.6 16.4h2.8M14.6 16.4h1.4
    h M6.4 5.6l.2 3.6M7.6 5l3.2.2
    p M6.4 13.5h.01M17.6 13.5h.01M12 11.1h.01
  `,
  // A horned black helm with a glowing visor slit and a crimson crest
  80: `
    m* M6.4 9.4C2.8 8.8 .8 5.6 1 .2c1.2 2.2 3.2 3.4 5.8 4.2zM1 .2c.6 3.4 2.6 5 5.4 5.4
    l* M2.4 3.6l2.4.6M1.8 5.6l2.6.2
    b M12 2.4c3.8 0 6.4 2.6 6.4 6.6v5.4l-2.6 5.6H8.2l-2.6-5.6V9c0-4 2.6-6.6 6.4-6.6z
    s M12.6 2.5c3.4.3 5.8 2.8 5.8 6.5v5.4l-2.6 5.6h-3.2z
    t M11.3 2.4h1.4v5.2h-1.4z
    t M6.8 9.8l5.2.9 5.2-.9v1.8L12 12.6l-5.2-1z
    k M12 13.4v6.2M9.4 14.6l1.6.6M14.6 14.6l-1.6.6M9.4 17l1.6.6M14.6 17l-1.6.6
    t M5.6 13.4h12.8v1H5.6z
    m M9.6 21.6h4.8
    l M6 9.2c.4-1.8 1.4-3 3-3.8M18 9.2c-.4-1.8-1.4-3-3-3.8
    h M7.4 6c1-1.6 2.4-2.6 4.2-3-1.6 1.6-2.2 3.4-2.4 5.6-1.4 0-2.2-1.2-1.8-2.6z
    p M6.6 12.4h.01M17.4 12.4h.01
  `,
};

const CHESTPLATE: Record<Band, string> = {
  // A fur mantle over a leather vest with a round iron plate
  1: `
    b M7 8.6h10l1.2 4-1.8 2.6.8 6.4H6.8l.8-6.4-1.8-2.6z
    s M12.4 8.6H17l1.2 4-1.8 2.6.8 6.4h-4.8z
    m M9.2 14.6a2.8 2.8 0 1 1 5.6 0 2.8 2.8 0 0 1-5.6 0z
    l M8.4 11l7.2 7.6M15.6 11l-7.2 7.6
    s M7.2 18h9.6v1.8H7.2z
    t M2.6 9c0-3 1.6-5 4-5.4 1.2 1 3.2 1.6 5.4 1.6s4.2-.6 5.4-1.6c2.4.4 4 2.4 4 5.4 0 1.6-.6 2.8-1.4 3.6l-.6-1.4-1 1.6-1-1.6-1 1.6-1-1.6-1 1.6-1-1.6-1 1.6-1-1.6-1 1.6-1-1.6-.6 1.4c-.8-.8-1.4-2-1.4-3.6z
    l M5 8.4l.6 2M8 7.8l.6 2.4M16 7.8l-.6 2.4M19 8.4l-.6 2
    p M12 14.6h.01M9.4 19h.01M14.6 19h.01
    h M3.6 7c.6-1.4 1.6-2.2 3-2.4-1 1-1.4 2.2-1.4 3.8z
  `,
  // A smooth breastplate with layered lame pauldrons
  20: `
    b M6.4 6.4h11.2l1.4 4.2-2.2 3.6.8 3.6-1 3.6H7.4l-1-3.6.8-3.6L5 10.6z
    s M12.4 6.4h5.2l1.4 4.2-2.2 3.6.8 3.6-1 3.6h-4.2z
    m M9 3.2h6l1.4 3.2H7.6z
    m* M.8 8.2c0-2 1.6-3.4 4-3.6l3.6.8-.4 2.2zM.8 10.4h7l-.4 2.2H1zM1.4 12.8h6.4l-.6 2.2c-2 0-4-.4-5.4-1.4z
    s* M5 4.6l3.6.8-.4 2.2H4.6z
    m M7.4 17.8h9.2l.8 3.7H6.6z
    l M12 6.4v11.4M8 11.6c2.6.8 5.4.8 8 0M9.5 17.8l-.3 3.6M14.5 17.8l.3 3.6
    p M3 6.4h.01M3 11.4h.01M9.4 8.4h.01M14.6 8.4h.01
    h M8 7.4l-.8 4.4.4 2
  `,
  // Angular plate: spiked pauldrons, a blue inlay and a flared hip
  40: `
    b M7.2 6.4h9.6l1.6 5-3.4 3 .8 7.1H8.2l.8-7.1-3.4-3z
    s M12.2 6.4h4.6l1.6 5-3.4 3 .8 7.1h-3.6z
    m M9.2 3.2h5.6l1.2 3.2H8z
    m* M.6 4.4l7.6.8.4 7.4-3.4 2.6L1.8 12z
    s* M4.2 5l4 .4.4 7.2-1.8 1.4z
    t* M1 4.4L.4 1.6 3.8 3.4z
    t M12 7l1.8 4-1.8 6-1.8-6z
    t M7.4 17.2h9.2v1.4H7.4z
    l M12 6.4v11M3.4 6.6l3.2 6.2
    p M2.4 8.6h.01M9.4 20h.01M14.6 20h.01
    h M8.2 7.2l-.8 4.6.8 1.8
  `,
  // Heavy lopsided plate: a huge round left pauldron, a small right one, a bronze belt
  60: `
    b M6.8 6.6h10.4l1.4 4-1 4.6 1 6.2H6.4l1-6.2-1-4.6z
    s M12.4 6.6h4.8l1.4 4-1 4.6 1 6.2h-5.2z
    m M8.8 3.2h6.4l1.2 3.4H7.6z
    m M.4 12C.4 6.4 3.4 3.8 8 4.2l1 2.6-.6 8.2-5.4 2.4C1.4 16.8.4 14.8.4 12z
    m M23.6 10.5c0-3-1.6-4.8-4.4-4.6l-2.4 1 .4 6 4.6 1.6c1.2-.8 1.8-2 1.8-4z
    t M6.8 15.4h10.4v2H6.8z
    m M10.6 14.8h2.8v3.2h-2.8z
    l M12 6.6v8.6M2 8.6c2 .8 4.2.8 6.2 0M1.4 11.6c2.2 1 4.6 1 6.8 0M3 14.4c1.8.6 3.4.6 5-.2
    p M3.6 8h.01M20.6 8.4h.01M9 9.4h.01M15 9.4h.01M9 19.6h.01M15 19.6h.01
    h M2.4 8.4c.8-2 2.6-3 5-3-1.6 1.2-2.4 3-2.6 5.2z
  `,
  // Black plate with crimson trim: stacked spiked pauldrons, a ragged crimson tabard and cape
  80: `
    t M5 8L2 21.4l2-1 1 2 1.5-1.5 1.5 1.5V10zM19 8l3 13.4-2-1-1 2-1.5-1.5-1.5 1.5V10z
    b M7.4 6.4h9.2l1.4 4.4-1.8 3.8.8 4.2H7.6l.8-4.2-1.8-3.8z
    s M12.4 6.4h4.2l1.4 4.4-1.8 3.8.8 4.2h-4.8z
    t M10.2 11.4h3.6l.6 10.6-2.4-1.4-2.4 1.4z
    m M9 3h6l1.2 3.4H7.8z
    m* M1 9.2C1 5.6 3.2 3.4 6.8 3.6l2 1.6-.4 3.8-7.2.6zM1.2 10.2l7.2-.4-.2 2.8-6.6 1c-.4-1-.5-2.2-.4-3.4zM1.8 13.4l6.2-.6-.2 2.6-4.6 1.2c-.8-.8-1.2-2-1.4-3.2z
    s* M5.2 4.4l3.6.8-.4 3.8-3.4.4zM5.4 10.2l3-.2-.2 2.8-2.8.4z
    t* M1.8 6L.2 3 3.8 4.6zM1.2 9.2L.2 7.6l3 .4zM1.6 12.6L.2 12.4l2.4-.8zM6.6 3.6L6 .8l2.2 2.2z
    t M7.6 16.4h8.8v1.6H7.6z
    m M10.6 17.2a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0z
    t M12 11.8l.9 1-.9 1.1-.9-1.1z
    l M12 6.4v5M8.2 9.4c2.4.8 5.2.8 7.6 0
    p M3.4 7.4h.01M3.2 10.6h.01M9.4 6.2h.01M14.6 6.2h.01
    h M8.2 7.2l-.6 4 .4 1.8
  `,
};

const GAUNTLET = `
  b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
  s M15.4 8v6.5l-1.6 3V21H12v-3.5l1.8-3z
  m M7.6 9.6h9.4v2.6H7.6z
  m M8.2 6.4h2.6v1.6H8.2zM11.2 5.8h2.6v1.6h-2.6zM14.2 6.6h2.6v1.6h-2.6z
  m M5.5 16.8h11.2l-1.2 4.4H6.8z
  l M7.6 14h8M9 16.8v4.4M12 16.8v4.4
  h M6 9.3V8.6M8.8 4.8V6
`;

const GLOVES: Record<Band, string> = {
  // A furred mitten
  1: `
    b M7 21v-6L5.2 12.6V8c0-2 1.4-3.6 3.4-3.6H13c2.4 0 4 1.6 4 3.8v7.4l-2 3.4V21z
    s M13.6 4.4c2 .2 3.4 1.6 3.4 3.8v7.4l-2 3.4V21h-1.6z
    b M5.2 12.6c-1.6-.4-2.4-1.6-2.2-3.2.2-1 1-1.4 1.8-.8l1 1.4z
    l M9 5v5M12 4.6v5M14.8 5.4v4.4
    t M5.4 16.6c1 1.3 2 1.3 2.8 0 1 1.3 2 1.3 2.8 0 1 1.3 2 1.3 2.8 0 .8 1 1.6 1 2 0v1.8H5.4z
    p M8 7.4h.01M11 7h.01M14 7.6h.01
    h M6.4 6.4V9M9 4.8h2
  `,
  20: `${GAUNTLET}
    t M5.5 16.8h11.2v1H5.5z
    p M8.6 10.9h.01M12.3 10.9h.01M16 10.9h.01M7.8 19.6h.01M14.6 19.6h.01
  `,
  // A pointed gauntlet with a blade fin and a gem
  40: `
    b M7 21v-5.5L5 12.4 5.6 8l2.6-4.4 2 3.6 1.6-5 2.2 5 2-3 1.8 4.2L17 14.5l-2 3V21z
    s M13.6 7.2l2-3 1.8 4.2L17 14.5l-2 3V21h-1.6z
    m M7.4 9.8h9.6v2.4H7.4z
    t M17.6 9.6l4.6-3.6-1.4 6.4z
    m M5.5 16.8h11.2l-1.2 4.4H6.8z
    t M5.5 16.8h11.2v1.2H5.5z
    a M11 18.6l1.2 1.3-1.2 1.4-1.2-1.4z
    l M9.6 4.6v5M12 3v5M14.6 4.8v4.8
    h M6.4 9V8M8.6 4.8l1 1.6
  `,
  // A clenched fist: four knuckle plates with bronze studs, a thumb across the front, a flared cuff
  60: `
    b M5.4 9.8c0-1.2.9-2 2-2 .3-1 1.1-1.6 2.1-1.6.8 0 1.4.4 1.8 1 .4-.7 1.1-1.1 2-1.1.8 0 1.5.4 1.9 1 .4-.5 1-.8 1.7-.8 1.3 0 2.3 1 2.3 2.3V15c0 1.7-1.2 3-2.8 3H8.2l-2.8-3.4z
    s M14.3 7.3c.4-.5 1-.8 1.7-.8 1.3 0 2.3 1 2.3 2.3V15c0 1.7-1.2 3-2.8 3h-2z
    m M7.4 8.6h2.4v2.2H7.4zM10.4 7.6h2.4v2.4h-2.4zM13.4 7.6h2.4v2.4h-2.4zM16.2 8.4h1.6v2.2h-1.6z
    l M9.9 8.2v5.4M12.9 7.8v5.8M15.9 8v5.6
    b M4.6 12.4c1.6-.8 3.6-.6 5.2.4l2.2 1.6c.4.9-.1 1.8-1.1 2H7.2L4.6 14.2z
    l M6.4 13.2l3.4.8
    t M5.5 16.8h12.6l-1.2 4.6H6.8z
    m M6.2 17.4h11l-.4 1.4H6.6z
    p M8.6 9.7h.01M11.6 8.8h.01M14.6 8.8h.01M17 9.5h.01M8.4 20.2h.01M15 20.2h.01
    h M6.2 8.8c.4-.6 1-.8 1.6-.8M5.6 12.8l1.6-.4
  `,
  // A black spiked gauntlet with crimson trim and a glowing gem
  80: `${GAUNTLET}
    t M8.6 4.4L8.2 1.2 10 3.8zM11.6 4l-.4-3.4L13 3.6zM14.6 4.8l.4-3.4 1.4 3z
    s M5.5 16.8h11.2l-1.2 4.4H6.8z
    t M5.5 16.8h11.2v1.1H5.5zM7.6 9.6h9.4v.9H7.6z
    t M11 18.4l1.2 1.3-1.2 1.4-1.2-1.4z
    p M8.4 11.4h.01M12.3 11.4h.01M16 11.4h.01
  `,
};

/** Greaves are a pair: the left leg is drawn and mirrored. */
const LEGGINGS: Record<Band, string> = {
  // Short furred leg wraps
  1: `
    b* M3 3.4h7.4l.6 8.6-.8 9.6H4.2L3 12z
    s* M7.4 3.4h3l.6 8.6-.8 9.6H7.4z
    t* M2.6 3c1 1.5 2.2 1.5 3 0 1 1.5 2.2 1.5 3 0 1 1.5 2 1.5 2.6 0v2.4H2.6z
    t* M3.6 21.4c.8-1.4 1.8-1.4 2.6 0 .8-1.4 1.8-1.4 2.6 0 .8-1.4 1.4-1.4 2 0V22H3.6z
    l* M3.4 10.6h7.4M3.6 15h7
    p* M5.6 8h.01M8.4 8h.01M6.4 12.8h.01
    h* M4.2 6.6l-.4 4M4.4 14l-.2 4
  `,
  // Smooth knight greaves with knee cops
  20: `
    b* M2.5 2.5h8l.6 9.4-1.2 10H4.8l-2-10z
    s* M7 2.5h4l.6 9.4-1.2 10H7.4z
    m* M2.3 2.5h8.8l.1 4.6c-1.4 1.4-3 1.9-4.5 1.9S3.7 8.5 2.3 7.1z
    m* M3.4 18h7.2l-.5 4.2H4.4z
    l* M6.8 9l.4 9M3.4 13.4h7
    p* M5.8 5.6h.01M5.6 15.6h.01
    h* M4.2 4l-.6 4.2M4.6 10.4l-.4 6
  `,
  // Angular greaves with a knee spike, side fins and a blue stripe
  40: `
    b* M2.6 3h8l.8 9-.6 9.5H5.4L2 12.4z
    s* M7.4 3h4l.8 9-.6 9.5H7.4z
    m* M3 3h8.2l.1 3.6c-1.4 1.2-3 1.8-4.1 1.8S4.4 7.8 3 6.6z
    t* M6.8 3.2L5.4.4 8.8 2zM2.6 11.6L.4 14.4l2.4 3.4zM3 12.8h8.4v1.2H3z
    a* M6.2 5l1.2 1.3L6.2 7.6 5 6.3z
    m* M4.2 18.4h6.6l-.4 3.4H5z
    l* M7 9.4l.4 8.6
    p* M5.6 16h.01
  `,
  // A heavy tasset plate over thick legs with big round bronze knee cops
  60: `
    b* M2.4 6h8.8l.6 6-.8 9.6H3.6l-1.2-9.6z
    s* M7.2 6h4l.6 6-.8 9.6H7.8z
    m M2.2 2.6h19.6v3.4l-2 1.2H4.2l-2-1.2z
    l M7 3v3.6M12 2.8v4.4M17 3v3.6
    m* M3.4 11a3.2 3.2 0 1 1 6.4 0 3.2 3.2 0 0 1-6.4 0z
    t* M5 11a1.6 1.6 0 1 1 3.2 0 1.6 1.6 0 0 1-3.2 0z
    t* M2.8 16h8.4v1.5H2.8z
    m* M3.4 19h7.2l-.4 2.8H4z
    p* M4.6 4.4h.01M5.6 14.6h.01M9 14.6h.01
  `,
  // Black greaves with a big spiked knee cop, stacked lames and crimson edges
  80: `
    b* M2.6 2.6h8.4l.6 9.4-.8 9.8H4.2l-1.2-9.8z
    s* M7.2 2.6h3.8l.6 9.4-.8 9.8H7.4z
    m* M2.4 3.2h8.6v5.2c-1 1.2-2.6 1.8-4.3 1.8S3.4 9.6 2.4 8.4z
    t* M6.6 3.2L5 .2l3.4 2.4zM2.4 4.6L.2 3.6l1.6 2.6z
    m* M3 10.6h7.6l-.4 2.6H3.4zM3.2 13.4h7.2l-.4 2.6H3.6zM3.4 16.2h6.8l-.4 2.6H3.8z
    t* M3 12.8h7.6M3.2 15.6h7.2M3.4 18.4h6.8
    b* M3.2 18.8h7.8l.4 3H3.8z
    t* M6.4 5.2l1 1.1-1 1.1-1-1.1z
    p* M4.4 11.8h.01M8.6 11.8h.01M4.8 17h.01M9 17h.01
  `,
};

/** Boots are an oversized pair: one behind in shadow, one in front. */
const BOOTS: Record<Band, string> = {
  // Round furred boots
  1: `
    s M3.9 1.8h6.2v8.4l5.8 2.4c1.8.8 2.8 2.4 2.8 4.4V19H.2v-3.6l3.7-2.4z
    b M7.5 3h6.2v8.2l5.8 2.4c1.8.8 2.8 2.4 2.8 4.4V20H3.8v-3.6l3.7-2.4z
    s M12.6 3h1.1v8.2l5.8 2.4c1.8.8 2.8 2.4 2.8 4.4V20h-5.8z
    t M7.2 2.8c.9 1.5 2 1.5 2.7 0 .9 1.5 2 1.5 2.7 0 .8 1.5 1.5 1.5 1.9 0v2.6H7.2z
    t M3.4 17.4c.8 1.4 1.8 1.4 2.4 0 .8 1.4 1.8 1.4 2.4 0 .8 1.4 1.8 1.4 2.4 0 .8 1.4 1.6 1.4 2.2 0v2.8H3.4z
    s M3.4 20h18.8v2.2H3.4z
    l M7.4 9h6M7.4 12h6M12.4 17v2.4
    p M9 14.6h.01M11 14.6h.01
    h M8.4 7.2v2M5 17.4l2-.4
  `,
  // Smooth knight sabatons with lames
  20: `
    s M3.9 1.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V19H.2v-3.6l3.7-2.2z
    b M7.5 2.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20H3.8v-3.6l3.7-2.2z
    s M12.5 2.5h1v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20h-6z
    m M7.5 2.5h6v2.8h-6zM7.5 5.3h6v3h-6z
    m M13.4 13l6 2.4.4 1.8-6.2-2.4zM15.2 14.8l3.6 1.5-.4 1.8-3.4-1.5z
    m M3.8 17h17.8v3H3.8z
    s M3.4 20h18.8v2.2H3.4z
    l M4 18.5h17.6M10 11v3
    p M7 18.6h.01M18 18.6h.01
    h M8.2 3v2M8.2 5.9v2M5 18.2l2-.4
  `,
  // Sleek long boots with a pointed toe, a cuff fin and blue stripes
  40: `
    s M4.6 1.6h5.2v8.8l9 4.4-.8 2.2H.4v-3.4L4.6 11z
    b M8 2.6h5.2v8.8l9 4.4-.8 2.2H3.8v-3.4L8 12z
    s M12.2 2.6h1v8.8l9 4.4-.8 2.2h-9.4z
    t M8 3.4L5.6 1l.4 4zM13.2 3.4L15.6 1l-.4 4z
    m M8 5.2h5.2v1.6H8zM3.8 17.2h18.2l-.4 2.4H3.8z
    t M8 8.4h5.2v1.2H8zM3.8 17h18.2v.9H3.8z
    a M10.6 11.6l1 1.1-1 1.1-1-1.1z
    s M3.4 20h18.8v2.2H3.4z
    l M13 12.6l6.4 3.4M9 14v3
    h M8.8 3.8v3M5.6 17l2-.6
  `,
  // Chunky riveted boots with buckle straps and a bronze sole
  60: `
    s M2.6 1.6h8.8v9.6l5.6 2.2c1.2.5 2 1.6 2 3V19H.4v-4l2.2-1.8z
    b M6.2 2.6h8.6v9.6l5.6 2.2c1.2.5 2 1.6 2 3V20H3.6v-4l2.6-1.8z
    s M12 2.6h2.8v9.6l5.6 2.2c1.2.5 2 1.6 2 3V20h-8.4z
    s M6.2 5.6h8.6v1.8H6.2zM6.2 9.2h8.6V11H6.2z
    t M8.6 5.4h2.2v2.2H8.6zM8.6 9h2.2v2.2H8.6z
    t M3.6 17.2h18.8v1.4H3.6zM3.4 20h18.8v1.2H3.4z
    d M9 14.2h.01M11.4 14.4h.01M13.8 14.8h.01M16.4 15.6h.01M18.6 16.4h.01
    s M3.4 21.2h18.8v1H3.4z
    p M7 18.2h.01M12 18.2h.01M17 18.2h.01
    h M7.4 3.6v1.4M7.4 12l-2 2.4
  `,
  // Black stacked-lame sabatons with a toe spike and crimson edges
  80: `
    s M3.9 1.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V19H.2v-3.6l3.7-2.2z
    b M7.5 2.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20H3.8v-3.6l3.7-2.2z
    s M12.5 2.5h1v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20h-6z
    m M7.5 2.5h6v2.2h-6zM7.7 5.2h5.6v2.2H7.7zM7.9 7.9h5.2v2.2H7.9z
    t M7.5 4.7h6v.7h-6zM7.7 7.4h5.6v.7H7.7zM7.9 10.1h5.2v.7H7.9z
    t M7.8 2.6L6.4.2l3.2 1.4zM13.2 2.6L14.6.2l-3.2 1.4z
    m M13.4 13l6 2.4.4 1.8-6.2-2.4zM15.2 14.8l3.6 1.5-.4 1.8-3.4-1.5z
    t M21.2 16.4l2.6 1.2-2.4.8zM3.8 17h17.8v1.1H3.8z
    t M10.4 12.4l.9 1-.9 1-.9-1z
    s M3.4 20h18.8v2.2H3.4z
    p M7 18.8h.01M12 18.8h.01M17 18.8h.01
    h M8.2 3v1.4M5 18.2l2-.4
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const VANGUARD_ART: PieceArt = {
  helmet: per(HELMET),
  chestplate: per(CHESTPLATE),
  gloves: per(GLOVES),
  leggings: per(LEGGINGS),
  boots: per(BOOTS),
};
