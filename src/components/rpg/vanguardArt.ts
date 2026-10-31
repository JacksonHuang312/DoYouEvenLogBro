import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Vanguard armor (the warrior tank, GAME_DESIGN.md 13.15), in the AFK Arena warrior mould: chunky,
 * exaggerated plate (big shoulders and chest, a small waist, oversized greaves and boots) drawn as a matched
 * set, so a helm, plate, greaves and boots of one band share a palette and a motif:
 *   1 crude: scavenged dark iron with fur trim and rivets      20 guardian: plain rounded steel
 *   40 vanguard: polished silver with blue enamel              60 dusk: gunmetal with bronze bands and perforations
 *   80 temple: near-black with a gold cross emblem and a glowing core
 */

export const VANGUARD_PALETTE: Record<Band, Palette> = {
  1: { light: "#cfc8bb", base: "#5f5c63", dark: "#24232a", trim: "#e8e2d3" },
  20: { light: "#eef2f5", base: "#8f99a5", dark: "#394049", trim: "#bcc7d3" },
  40: { light: "#f7f9fd", base: "#bac4d2", dark: "#4e5970", trim: "#7fa6f0" },
  60: { light: "#cdd2dc", base: "#6a6f7b", dark: "#23262d", trim: "#cb914c" },
  80: { light: "#8a92b6", base: "#2c2f41", dark: "#0a0c15", trim: "#dcb04a" },
};

/** Helmets: open-faced and swept-back in the middle tiers (a dark face opening under a brow), with a mane at the top of the dusk tier and a wolf-pelt helm for the temple tier. */
const helmet = (band: Band): Layer[] => {
  const dome = `
    b M12 2c4.8 0 8 3.4 8 8.4l-3 .6c-1.3-1-3.2-1.7-5-1.7s-3.7.7-5 1.7l-3-.6C4 5.4 7.2 2 12 2z
    s M12.6 2.1c4.4.4 7.4 3.6 7.4 8.3l-3 .6c-1.1-.9-2.6-1.5-4.4-1.7z
  `;
  const face = `
    k M6.8 11.2c1.3-1 3.3-1.6 5.2-1.6s3.9.6 5.2 1.6v5.2c0 1.8-1.8 3.6-5.2 5.6-3.4-2-5.2-3.8-5.2-5.6z
  `;
  const cheeks = `
    b M4.2 10.2l3.2.8v5.4l2.4 4.8-2.6-.4-3.2-5.2z
    b M19.8 10.2l-3.2.8v5.4l-2.4 4.8 2.6-.4 3.2-5.2z
    s M19.8 10.2l-3.2.8v5.4l-2.4 4.8 2.6-.4 3.2-5.2z
    m M5.4 10.4l6.6-2.2 6.6 2.2-.8 1.8-5.8-1.8-5.8 1.8z
  `;
  const gloss = `
    h M6.4 5.8c1.2-2 3.2-3.2 5.4-3.5-2 2-2.8 4-3 6.4-1.6 0-2.8-1.4-2.4-2.9z
  `;
  if (band === 80) {
    // A snarling wolf-pelt helm: ears, a muzzle with fangs and glowing eyes
    return art(`
      b M4 3l4.4 3.4C9.5 5.8 10.7 5.5 12 5.5s2.5.3 3.6.9L20 3l-.6 8.4c-.2 1.6-1 3-2.2 4.2l-1 1.4 1.2 3.4-2.4-1L12 22l-2.2-2.6-2.4 1 1.2-3.4-1-1.4c-1.2-1.2-2-2.6-2.2-4.2z
      s M12.6 5.6c1 0 2.1.3 3 .8L20 3l-.6 8.4c-.2 1.6-1 3-2.2 4.2l-1 1.4 1.2 3.4-2.4-1L12 22z
      m M5.2 4.6l2.4 2M18.8 4.6l-2.4 2
      l M5.6 7.4l2.8 3M18.4 7.4l-2.8 3M6 12l2.4 1M18 12l-2.4 1M12 5.5v4
      m M9 12h6l-.8 5.6-2.2 1.6-2.2-1.6z
      k M10.6 12.4h2.8L12 14.2z
      a M7.2 9.4l3.4.9-.4 1.6-3.4-.5zM16.8 9.4l-3.4.9.4 1.6 3.4-.5z
      k M10 16.4h4l-.6 1.6h-2.8z
      m M10 17.4l.7 2.4.7-2.4M12.8 17.4l.7 2.4.7-2.4
      t M12 5.5l-1.2 2.4L12 9.4l1.2-1.5z
      h M5.6 4.6l2 2.2M6.4 9.4l1.6 1.4
    `);
  }
  if (band === 1) {
    return art(`
      ${dome}
      t M3.8 12.6c-1.6 1.6-1.8 3.2-.4 4.8.5-1.2 1.4-1.8 2.4-2.2zM20.2 12.6c1.6 1.6 1.8 3.2.4 4.8-.5-1.2-1.4-1.8-2.4-2.2z
      ${face}
      s M4.6 9.4h14.8v1.4H4.6z
      m M11.3 9.8h1.4v6.4h-1.4z
      p M6.6 6.2h.01M17.4 6.2h.01M12 4.2h.01
      ${gloss}
    `);
  }
  const mane = band === 60
    ? `
      t M8.6 3C9.6 1 10.8.4 12 .4s2.4.6 3.4 2.6c-1.2-.8-2.2-1-3.4-1S9.8 2.2 8.6 3zM4 6.6C2 8.2 1.2 10.6 1.6 13.6c1-1 1.8-2 2-3.4.2 2 .8 3.6 1.8 5 .4-1.6.4-3 0-4.4zM20 6.6c2 1.6 2.8 4 2.4 7-1-1-1.8-2-2-3.4-.2 2-.8 3.6-1.8 5-.4-1.6-.4-3 0-4.4z
    `
    : "";
  const crest =
    band === 20
      ? `m M11.2 2.1h1.6v6.8h-1.6z`
      : band === 40
        ? `t M11.2 2.1h1.6v7h-1.6zM4.4 8.8L1.8 6.4 6 7zM19.6 8.8l2.6-2.4L18 7z`
        : `t M11.2 2.1h1.6v7h-1.6z`;
  return art(`
    ${mane}
    ${dome}
    ${face}
    ${cheeks}
    ${crest}
    l M7.4 12.6v3.6M16.6 12.6v3.6
    p M6.4 12.4h.01M17.6 12.4h.01${band === 60 ? "M9 5.4h.01M15 5.4h.01" : ""}
    ${gloss}
  `);
};

const chestplate = (band: Band): Layer[] => {
  const base = `
    b M6 6.4h12l1.2 4-2.8 4.4 1.2 6.7H6.4l1.2-6.7-2.8-4.4z
    s M12.4 6.4H18l1.2 4-2.8 4.4 1.2 6.7h-5.2z
    m M8.8 3h6.4l1.4 3.4H7.4z
    m M.8 11.5C.8 6.6 3.6 3.8 8 4l1 2.4-.6 7.4-5 3C1.8 16 .8 14 .8 11.5zM23.2 11.5c0-4.9-2.8-7.7-7.2-7.5l-1 2.4.6 7.4 5 3c1.6-.4 2.6-2.4 2.6-5.3z
    s M16.6 4.2c4.2.4 6.6 3 6.6 7.3 0 2.9-1 4.9-2.6 5.3l-2.2-1.4z
    l M12 6.4v15M6 11.6c3.8 1.2 8.2 1.2 12 0M7.2 16.4c3 .8 6.6.8 9.6 0
    l M2 9.4c1.8.6 3.8.5 5.8-.4M1.6 12c2 .7 4.2.6 6.2-.4M22 9.4c-1.8.6-3.8.5-5.8-.4M22.4 12c-2 .7-4.2.6-6.2-.4
    h M2.6 8c.8-2 2.4-3 4.6-3.2-1.6 1.2-2.2 2.8-2.4 5-1.6.2-2.4-.8-2.2-1.8zM7.4 8l-.8 3.8.6 2.4
  `;
  const extra: Record<Band, string> = {
    1: `
      t M7.2 3.6c1.1 1.4 2.4 1.4 3.2 0 1.1 1.4 2.4 1.4 3.2 0 1.1 1.4 2.4 1.4 3.2 0l-.8 3H8z
      s M8 16.6h8v1.4H8z
      p M2.8 8h.01M21.2 8h.01M8.6 12.4h.01M15.4 12.4h.01M9.6 19.6h.01M14.4 19.6h.01
    `,
    20: `
      t M7.6 16.6h8.8v1.4H7.6z
      p M2.8 8h.01M21.2 8h.01M9.4 8.8h.01M14.6 8.8h.01
    `,
    40: `
      t M7.6 16.6h8.8v1.4H7.6zM1.4 11.6l6.4 1M22.6 11.6l-6.4 1M11 7h2v8h-2z
      p M2.8 8h.01M21.2 8h.01M9.4 8.8h.01M14.6 8.8h.01
    `,
    60: `
      t M7.6 16.6h8.8v1.6H7.6zM1.6 12.4l6.2.9.4-1.5-6.2-1zM22.4 12.4l-6.2.9-.4-1.5 6.2-1z
      p M2.8 8h.01M21.2 8h.01M9.4 9h.01M14.6 9h.01M8.6 13.6h.01M15.4 13.6h.01M5 10.2h.01M19 10.2h.01
    `,
    80: `
      t M2.8 5.6L1.2 1.8 5.4 4.2zM21.2 5.6l1.6-3.8-4.2 2.4zM10 3.6L9.4 1l1.8 2zM14 3.6l.6-2.6-1.8 2z
      t M11 7.6h2v7h-2zM9 9.6h6v1.8H9z
      a M12 12.4l1.6 1.9-1.6 2.4-1.6-2.4z
      t M7.6 17h8.8v1.5H7.6zM1.6 12.4l6.2.9.4-1.5-6.2-1zM22.4 12.4l-6.2.9-.4-1.5 6.2-1z
      p M2.8 8h.01M21.2 8h.01M9.6 19.8h.01M14.4 19.8h.01
    `,
  };
  return art(base + extra[band]);
};

const gloves = (band: Band): Layer[] => {
  const base = `
    b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
    s M15.4 8v6.5l-1.6 3V21H12v-3.5l1.8-3z
    m M7.6 9.6h9.4v2.6H7.6z
    m M8.2 6.4h2.6v1.6H8.2zM11.2 5.8h2.6v1.6h-2.6zM14.2 6.6h2.6v1.6h-2.6z
    m M5.5 16.8h11.2l-1.2 4.4H6.8z
    l M7.6 14h8M9 16.8v4.4M12 16.8v4.4
    h M6 9.3V8.6M8.8 4.8V6
  `;
  const extra: Record<Band, string> = {
    1: `
      t M5.4 16.6c1 1.3 2 1.3 2.8 0 1 1.3 2 1.3 2.8 0 1 1.3 2 1.3 2.8 0 .8 1 1.6 1 2 0v1.6H5.4z
      p M8.6 10.9h.01M12.3 10.9h.01M16 10.9h.01
    `,
    20: `
      t M5.5 16.8h11.2v1H5.5z
      p M8.6 10.9h.01M12.3 10.9h.01M16 10.9h.01M7.8 19.6h.01M14.6 19.6h.01
    `,
    40: `
      t M5.5 16.8h11.2v1.2H5.5zM7.6 9.6h9.4v.8H7.6z
      a M11 18.4l1.2 1.3-1.2 1.4-1.2-1.4z
      p M8.6 11.2h.01M12.3 11.2h.01M16 11.2h.01
    `,
    60: `
      t M5.5 16.8h11.2v1.4H5.5zM7.6 9.6h9.4v1H7.6zM8.2 6.4h2.6v.7H8.2zM11.2 5.8h2.6v.7h-2.6zM14.2 6.6h2.6v.7h-2.6z
      p M8.6 11.4h.01M12.3 11.4h.01M16 11.4h.01M8 19.8h.01M14.6 19.8h.01
    `,
    80: `
      t M8.8 9.6L9.4 6.2l.6 3.4zM11.8 9.6l.6-3.6.6 3.6zM14.8 9.6l.6-3.2.6 3.2zM5.5 16.8h11.2v1H5.5zM10.6 18.2h1.6v2.6h-1.6zM9.6 19h3.6v.9H9.6z
      p M8.4 11.4h.01M12.3 11.4h.01M16 11.4h.01
    `,
  };
  return art(base + extra[band]);
};

/** Greaves, drawn as an oversized pair of leg guards with knee cops and shin ridges. */
const leggings = (band: Band): Layer[] => {
  const base = `
    b M2.5 2.5h8l.6 9.4-1.2 10H4.8l-2-10zM21.5 2.5h-8l-.6 9.4 1.2 10h4.6l2-10z
    s M7 2.5h4l.6 9.4-1.2 10H7.4zM17.2 2.5h4.3l-.6 9.4-2 10h-1.8z
    m M2.3 2.5h8.8l.1 4.6c-1.4 1.4-3 1.9-4.5 1.9S3.7 8.5 2.3 7.1zM21.7 2.5h-8.8l-.1 4.6c1.4 1.4 3 1.9 4.5 1.9s2.9-.5 4.4-1.9z
    m M3.4 18h7.2l-.5 4.2H4.4zM20.6 18h-7.2l.5 4.2h5.2z
    l M6.8 9l.4 9M17.2 9l-.4 9M3.4 13.4h7M13.6 13.4h7
    h M4.2 4l-.6 4.2M14.8 4l-.6 4.2M4.6 10.4l-.4 6M15 10.4l-.4 6
  `;
  const extra: Record<Band, string> = {
    1: `
      t M2.2 2.2c1 1.5 2.2 1.5 3 0 1 1.5 2.2 1.5 3 0 1 1.5 2 1.5 2.8 0v2.2H2.2zM21.8 2.2c-1 1.5-2.2 1.5-3 0-1 1.5-2.2 1.5-3 0-1 1.5-2 1.5-2.8 0v2.2h8.8z
      p M5.6 15.6h.01M18.4 15.6h.01M6.4 11h.01M17.6 11h.01
    `,
    20: `
      t M3 12.4h7.4v1.1H3zM13.6 12.4H21v1.1h-7.4z
      p M5.8 6h.01M18.2 6h.01
    `,
    40: `
      t M3 12.4h7.4v1.3H3zM13.6 12.4H21v1.3h-7.4z
      a M6.4 4.4l1.3 1.5-1.3 1.5-1.3-1.5zM17.6 4.4l1.3 1.5-1.3 1.5-1.3-1.5z
      p M5.6 16h.01M18.4 16h.01
    `,
    60: `
      t M3 12.4h7.4v1.5H3zM13.6 12.4H21v1.5h-7.4zM3.4 18h7.2v1H3.4zM20.6 18h-7.2v1h7.2z
      p M5.8 6h.01M18.2 6h.01M5.6 15.6h.01M18.4 15.6h.01M8.6 15h.01M15.4 15h.01
    `,
    80: `
      t M3 2.5L1 .6 4.6 1.8zM10.6 2.5L12.6.6 9 1.8zM21 2.5L23 .6 19.4 1.8zM13.4 2.5L11.4.6 15 1.8zM3 12.4h7.4v1.5H3zM13.6 12.4H21v1.5h-7.4z
      t M6.2 14.6h1.2v3.2H6.2zM5.2 15.6h3.2v1H5.2zM16.6 14.6h1.2v3.2h-1.2zM15.6 15.6h3.2v1h-3.2z
      a M6.4 4.4l1.3 1.5-1.3 1.5-1.3-1.5zM17.6 4.4l1.3 1.5-1.3 1.5-1.3-1.5z
    `,
  };
  return art(base + extra[band]);
};

/** Boots, drawn as an oversized pair: one behind in shadow, one in front. */
const boots = (band: Band): Layer[] => {
  const base = `
    s M3.9 1.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V19H.2v-3.6l3.7-2.2z
    b M7.5 2.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20H3.8v-3.6l3.7-2.2z
    s M12.5 2.5h1v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20h-6z
    m M7.5 2.5h6v2.8h-6zM7.5 5.3h6v3h-6z
    m M13.4 13l6 2.4.4 1.8-6.2-2.4zM15.2 14.8l3.6 1.5-.4 1.8-3.4-1.5z
    m M3.8 17h17.8v3H3.8z
    s M3.4 20h18.8v2.2H3.4z
    l M4 18.5h17.6M10 11v3
    h M8.2 3v2M8.2 5.9v2M5 18.2l2-.4
  `;
  const extra: Record<Band, string> = {
    1: `
      t M7.2 2.2c.9 1.5 2 1.5 2.7 0 .9 1.5 2 1.5 2.7 0 .8 1.5 1.5 1.5 1.9 0v2.4H7.2z
      p M10.5 9.4h.01M10.5 11.4h.01M7 18.6h.01M18 18.6h.01
    `,
    20: `
      t M7.5 8.6h6v.8h-6zM3.8 17h17.8v.9H3.8z
      p M10.5 9.8h.01M7 18.6h.01M18 18.6h.01
    `,
    40: `
      t M7.5 8.6h6v.9h-6zM3.8 17h17.8v1H3.8z
      a M10.5 3.8l1 1.1-1 1.1-1-1.1z
      p M7 18.6h.01M18 18.6h.01
    `,
    60: `
      t M7.5 8.6h6v1h-6zM3.8 17h17.8v1.2H3.8zM3.4 20h18.8v.8H3.4z
      p M10.5 4h.01M10.5 6.8h.01M7 18.6h.01M18 18.6h.01M12 18.6h.01
    `,
    80: `
      t M7.6 2.5L5.8 0 9.4 1.8zM13.4 2.5L15.2 0 11.6 1.8zM3.8 17h17.8v1.2H3.8zM21 18.4l2.2.8
      t M9.7 9.4h1.6v3.6H9.7zM8.7 10.4h3.6v1.2H8.7z
      p M7 18.6h.01M18 18.6h.01
    `,
  };
  return art(base + extra[band]);
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (f: (b: Band) => Layer[]) => Object.fromEntries(BANDS.map((b) => [b, f(b)])) as Record<Band, Layer[]>;

export const VANGUARD_ART: PieceArt = {
  helmet: per(helmet),
  chestplate: per(chestplate),
  gloves: per(gloves),
  leggings: per(leggings),
  boots: per(boots),
};
