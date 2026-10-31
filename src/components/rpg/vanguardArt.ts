import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Vanguard armor (the warrior tank, GAME_DESIGN.md 13.15), in the AFK Arena warrior mould: big rounded
 * pauldrons, a closed helm with a narrow visor, greaves and boots drawn as pairs. The bands follow that
 * game's tiers: crude furred iron, guardian steel, polished vanguard plate, dusk plate with bronze bands,
 * and a near-black temple suit with gold glints and a glowing core. The palette carries the material.
 */

export const VANGUARD_PALETTE: Record<Band, Palette> = {
  1: { light: "#d2cdc4", base: "#62646e", dark: "#25262d", trim: "#e8e2d3" },
  20: { light: "#eef2f5", base: "#8f99a5", dark: "#394049", trim: "#bcc7d3" },
  40: { light: "#f7f9fd", base: "#bac4d2", dark: "#4e5970", trim: "#8fb0ee" },
  60: { light: "#cdd2dc", base: "#6d727e", dark: "#25282f", trim: "#c8924d" },
  80: { light: "#8a92b6", base: "#2d3042", dark: "#0b0d16", trim: "#d6ab44" },
};

const helmet = (band: Band): Layer[] => {
  const base = `
    b M12 2.5c4.2 0 7 3.2 7 7.8 0 3-.6 5.2-1.8 7.2l-3.4 4H10.2l-3.4-4C5.6 15.5 5 13.3 5 10.3 5 5.7 7.8 2.5 12 2.5z
    s M13.5 2.6c3.6.5 5.5 3.5 5.5 7.7 0 3-.6 5.2-1.8 7.2l-3.4 4H12z
    k M7.3 10.2c1.5-.7 3.2-1 4.7-1s3.2.3 4.7 1l-.5 2.2c-1.4-.5-2.8-.7-4.2-.7s-2.8.2-4.2.7z
    l M7 13.5l3 3.5v4M17 13.5l-3 3.5v4
    m M10.2 21.5h3.6
    h M7.3 6c1-1.8 2.7-2.8 4.5-3-1.8 1.8-2.5 4-2.7 6.2-1.4 0-2.3-1.7-1.8-3.2z
  `;
  const extra: Record<Band, string> = {
    1: `
      t M5 13.6c-1.4 1.4-1.6 2.8-.4 4.2.4-1 1.2-1.6 2-2zM19 13.6c1.4 1.4 1.6 2.8.4 4.2-.4-1-1.2-1.6-2-2z
      s M5.4 8.6h13.2v1H5.4z
      p M7.4 7h.01M16.6 7h.01M12 14.4v.01M12 16.6v.01
    `,
    20: `
      m M11.1 2.6h1.8v6.8h-1.8z
      l M12 12.4v6.6
      k M9.6 14.6h-1M14.4 14.6h1M10.2 17h-1M13.8 17h1
      p M6.9 11.6h.01M17.1 11.6h.01
    `,
    40: `
      m M11.1 2.6h1.8v6.8h-1.8z
      t M5.2 9.4l1.6.5M18.8 9.4l-1.6.5M6 7.6l1.4.6M18 7.6l-1.4.6
      l M12 12.4v7
      p M6.9 11.8h.01M17.1 11.8h.01M12 11.2h.01
    `,
    60: `
      t M5 8.4h14v1.4H5z
      l M12 12.4v7
      p M7.6 14.4h.01M9 16.4h.01M16.4 14.4h.01M15 16.4h.01M7 11.6h.01M17 11.6h.01
      t M11 8.4h2v1.4h-2z
    `,
    80: `
      t M12 3.4L10.6.8 12 1.8 13.4.8z
      t M12 2.6l-2.2-2.5L12 1.1l2.2-1z
      a M7.5 10.4c1.4-.5 2.8-.8 4.5-.8s3.1.3 4.5.8l-.3 1.3c-1.4-.4-2.7-.6-4.2-.6s-2.8.2-4.2.6z
      t M6.2 7.2l1.5.7M17.8 7.2l-1.5.7M11.2 13h1.6v7h-1.6z
      p M7 12.2h.01M17 12.2h.01
    `,
  };
  return art(base + extra[band]);
};

const chestplate = (band: Band): Layer[] => {
  const base = `
    b M7.5 6.5h9l1.5 4.5-.8 6.5-1.7 3.5H8.5L6.8 17.5 6 11z
    s M12.3 6.5h4.2l1.5 4.5-.8 6.5-1.7 3.5h-3.2z
    m M9 3.6h6l1.2 2.9H7.8z
    l M12 6.5V21M7.2 12.5c3 1 7 1 9.6 0M7.8 16c2.5.8 5.8.8 8.4 0
    m M1.8 11c0-4 2.4-6.6 6-6.4l.6 1.8-.4 6L4 13.8C2.6 13.4 1.8 12.4 1.8 11zM22.2 11c0-4-2.4-6.6-6-6.4l-.6 1.8.4 6 4 2.4c1.4-.4 2.2-1.4 2.2-2.8z
    s M17 5.2l-.5.4.4 6.2 3.4 2c1.3-.5 1.9-1.4 1.9-2.8 0-3.5-1.8-5.6-5.2-5.8z
    l M3.2 9c1.4.5 3 .5 4.6-.2M3 11.4c1.6.6 3.4.5 5-.3M20.8 9c-1.4.5-3 .5-4.6-.2M21 11.4c-1.6.6-3.4.5-5-.3
    h M8 7.5l-.9 4.5.4 2.5M3.4 7.4c.8-1 1.8-1.5 3-1.6-1.2 1-1.6 2.2-1.6 3.4z
  `;
  const extra: Record<Band, string> = {
    1: `
      t M7.6 4c1 1.3 2.2 1.3 3 0 1 1.3 2.2 1.3 3 0 1 1.3 2.2 1.3 3 0l-.6 2.6H8.2z
      s M7.2 15.8h9.6v1.2H7.2z
      p M3.4 8h.01M20.6 8h.01M9 12h.01M15 12h.01M9.6 19h.01M14.4 19h.01
    `,
    20: `
      t M7.2 15.8h9.6v1.3H7.2z
      p M3.4 8h.01M20.6 8h.01M9.6 8.6h.01M14.4 8.6h.01
    `,
    40: `
      t M7.2 15.8h9.6v1.3H7.2zM2 11.6l6 .9M22 11.6l-6 .9
      p M3.4 8h.01M20.6 8h.01M9.6 8.6h.01M14.4 8.6h.01
    `,
    60: `
      t M7.2 15.8h9.6v1.5H7.2zM2.2 12.2l5.8.8.3-1.4-5.6-.9zM21.8 12.2l-5.8.8-.3-1.4 5.6-.9z
      t M11.3 8h1.4v5.4h-1.4zM9.6 9.7h4.8v1.4H9.6z
      p M3.4 8h.01M20.6 8h.01
    `,
    80: `
      t M3.6 5.8L2 2.2 6.2 4.8zM20.4 5.8L22 2.2 17.8 4.8zM9.6 3.8L9 1.2l1.8 2zM14.4 3.8L15 1.2l-1.8 2z
      a M12 8l2.3 2.8L12 14.6l-2.3-3.8z
      t M7.2 15.8h9.6v1.5H7.2zM2.2 12.2l5.8.8.3-1.4-5.6-.9zM21.8 12.2l-5.8.8-.3-1.4 5.6-.9z
      p M3.4 8h.01M20.6 8h.01M9.4 19.4h.01M14.6 19.4h.01
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
      t M8.8 9.6L9.4 6.2l.6 3.4zM11.8 9.6l.6-3.6.6 3.6zM14.8 9.6l.6-3.2.6 3.2zM5.5 16.8h11.2v1H5.5z
      a M11 18.4l1.2 1.3-1.2 1.4-1.2-1.4z
      p M8.4 11.4h.01M12.3 11.4h.01M16 11.4h.01
    `,
  };
  return art(base + extra[band]);
};

/** Greaves, drawn as a pair of leg guards with knee cops and shin ridges. */
const leggings = (band: Band): Layer[] => {
  const base = `
    b M4 3h6l.4 9-1 9.5H5.2l-1.4-9.5zM20 3h-6l-.4 9 1 9.5h4.2l1.4-9.5z
    s M7.2 3h3l.4 9-1 9.5H7.3zM17 3h3l.2 9.5-1.4 9.5H17z
    m M3.8 3h6.4l.1 4c-1 1-2.3 1.4-3.3 1.4S4.7 8 3.7 7zM20.2 3h-6.4l-.1 4c1 1 2.3 1.4 3.3 1.4s2.5-.4 3.5-1.4z
    m M4.8 18.6h4.8l-.2 2.9H5.4zM14.4 18.6h4.8l-.2 2.9h-3.6z
    l M7 8.6l.3 9.6M17 8.6l-.3 9.6M5.2 13.4h4.8M14 13.4h4.8
    h M5.4 4.4l-.5 3.6M15.4 4.4l-.5 3.6M5.8 10l-.3 6M15.6 10l-.3 6
  `;
  const extra: Record<Band, string> = {
    1: `
      t M3.6 2.6c.8 1.3 1.8 1.3 2.4 0 .8 1.3 1.8 1.3 2.4 0 .8 1.3 1.6 1.3 2 0v1.8H3.6zM20.4 2.6c-.8 1.3-1.8 1.3-2.4 0-.8 1.3-1.8 1.3-2.4 0-.8 1.3-1.6 1.3-2 0v1.8h6.8z
      p M6 15.6h.01M18 15.6h.01
    `,
    20: `
      t M3.8 12.6h6.4v1H3.8zM13.8 12.6h6.4v1h-6.4z
      p M6.6 6h.01M17.4 6h.01
    `,
    40: `
      t M3.8 12.6h6.4v1.1H3.8zM13.8 12.6h6.4v1.1h-6.4z
      a M6.6 5.2l1 1.1-1 1.1-1-1.1zM17.4 5.2l1 1.1-1 1.1-1-1.1z
      p M6 16h.01M18 16h.01
    `,
    60: `
      t M3.8 12.6h6.4v1.3H3.8zM13.8 12.6h6.4v1.3h-6.4zM4.8 18.6h4.8v.8H4.8zM14.4 18.6h4.8v.8h-4.8z
      p M6.6 6h.01M17.4 6h.01M6 16h.01M18 16h.01
    `,
    80: `
      t M3.8 3L2 1.2 5 2.6zM10.2 3L12 1.2 9 2.6zM20.2 3L22 1.2 19 2.6zM13.8 3L12 1.2 15 2.6zM3.8 12.6h6.4v1.3H3.8zM13.8 12.6h6.4v1.3h-6.4z
      a M6.6 5.2l1 1.1-1 1.1-1-1.1zM17.4 5.2l1 1.1-1 1.1-1-1.1z
      p M6 16h.01M18 16h.01
    `,
  };
  return art(base + extra[band]);
};

/** Boots, drawn as a pair: one behind in shadow, one in front. */
const boots = (band: Band): Layer[] => {
  const base = `
    s M5 2h5v9l6 3a2 2 0 0 1 1 1.8V18H2v-3l3-2z
    b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
    s M12 3h1v9l6 3a2 2 0 0 1 1 1.8V19h-5.4z
    m M8 3h5v2.4H8zM8 5.4h5v2.6H8z
    m M13 12.6l5.4 2.2.3 1.6-5.6-2.2zM14.6 14.2l3.2 1.4-.4 1.6-3-1.4z
    m M5 16.4h15v2.6H5z
    s M4.6 19h15.4v2.2H4.6z
    l M5 17.7h15M10 10.2v3
    h M8.6 3.4v1.6M8.6 5.8v1.6M5.6 17l1.6-.2
  `;
  const extra: Record<Band, string> = {
    1: `
      t M7.4 2.4c.8 1.3 1.8 1.3 2.4 0 .8 1.3 1.8 1.3 2.4 0 .8 1.3 1.4 1.3 1.8 0V4.8H7.4z
      p M10.5 8.4h.01M10.5 10.4h.01M7 17.8h.01M17.5 17.8h.01
    `,
    20: `
      t M8 8.4h5v.7H8zM5 16.4h15v.8H5z
      p M10.5 8.6h.01M10.5 10.6h.01M7 17.8h.01M17.5 17.8h.01
    `,
    40: `
      t M8 8.4h5v.8H8zM5 16.4h15v.9H5z
      a M10.5 4.1l.9 1-.9 1-.9-1z
      p M7 17.8h.01M17.5 17.8h.01
    `,
    60: `
      t M8 8.4h5v.9H8zM5 16.4h15v1H5zM4.6 19h15.4v.8H4.6z
      p M10.5 4.2h.01M10.5 6.7h.01M7 17.8h.01M17.5 17.8h.01
    `,
    80: `
      t M8 3L6.4 .8 9.4 2.6zM13 3l1.6-2.2-3 1.8zM8 8.4h5v.9H8zM5 16.4h15v1H5zM18 17.6l2.4.8
      a M10.5 11.2l.9 1-.9 1-.9-1z
      p M7 17.8h.01M17.5 17.8h.01
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
