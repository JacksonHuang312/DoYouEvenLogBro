import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Vanguard armor (the warrior tank, GAME_DESIGN.md 13.15): heavy plate from crude iron to a dark temple
 * suit, in the AFK Arena warrior mould. One silhouette per piece, with a different crest, trim and gem per
 * band; the palette carries the material (iron, steel, blue enamel, gold, dark).
 */

export const VANGUARD_PALETTE: Record<Band, Palette> = {
  1: { light: "#cfd2d8", base: "#7b7f88", dark: "#363942", trim: "#9a7440" },
  20: { light: "#eaf0f7", base: "#9ea9b8", dark: "#444c5b", trim: "#4a78c8" },
  40: { light: "#f4f8fd", base: "#b4bfcd", dark: "#4a5568", trim: "#4f8cf0" },
  60: { light: "#fbe6a8", base: "#c39a4e", dark: "#5e4020", trim: "#f6d980" },
  80: { light: "#a8b2d8", base: "#434a66", dark: "#141829", trim: "#a888f4" },
};

const helmet = (band: Band): Layer[] => {
  const base = `
    b M5.8 12.8C5.8 7.8 8.5 4 12 4s6.2 3.8 6.2 8.8v5.8L15.6 21H8.4l-2.6-2.4z
    s M12.9 4c3.2.9 5.3 4.2 5.3 8.8v5.8L15.6 21h-2.7z
    k M7.2 11.4h9.6v1.5H7.2z
    k M10 14.5v4.2M12 14.5v4.6M14 14.5v4.2
    h M7.6 7c.8-1.4 2-2.3 3.5-2.7-1 1.2-1.5 2.6-1.7 4.4-1.4 0-2.2-.8-1.8-1.7z
    m M7.5 21h9
  `;
  const extra: Record<Band, string> = {
    1: `
      t M5.9 8.8h12.2v1.2H5.9z
      l M12 4.2v4.6
      p M7.4 9.4h.01M16.6 9.4h.01M12 9.4h.01M6.7 15.5h.01M17.3 15.5h.01
    `,
    20: `
      m M11.2 3.8h1.6v7.6h-1.6z
      t M6 8.6h12v1.2H6zM6.4 15.2h11.2v1H6.4z
      l M8.6 15.2L8 19.5M15.4 15.2l.6 4.3
      p M7.3 9.2h.01M16.7 9.2h.01
    `,
    40: `
      t M12 4C10.6 2.4 8.6 2 6.8 2.6c1 .6 1.6 1.4 2 2.4zM12 4c1.4-1.6 3.4-2 5.2-1.4-1 .6-1.6 1.4-2 2.4z
      m M11.2 3.8h1.6v7.6h-1.6z
      t M6 8.2h12v1.4H6z
      a M12 6.2l1 1.1-1 1.1-1-1.1z
      p M7.2 9h.01M16.8 9h.01
    `,
    60: `
      t M12 4V1.2M10.8 2.4h2.4M9 4.8L6.8 2.2M15 4.8l2.2-2.6
      t M11.2 5.4h1.6v5.6h-1.6zM9.4 7.2h5.2v1.4H9.4z
      a M12 17.8l1.2 1.3-1.2 1.4-1.2-1.4z
      t M6 14h12v1H6z
      p M7 12.4h.01M17 12.4h.01M7.4 15.8h.01M16.6 15.8h.01
    `,
    80: `
      t M6 9C4 8.4 2.6 6.4 2.4 3.4c2 .3 3.4 1.6 4.2 3.5zM18 9c2-.6 3.4-2.6 3.6-5.6-2 .3-3.4 1.6-4.2 3.5z
      t M12 4V2M9.4 5.2L8 2.6M14.6 5.2L16 2.6
      a M7.8 11.5h3.2v1H7.8zM13 11.5h3.2v1H13z
      t M6 14.4h12v1H6z
      l M8.8 15.4l1 4M15.2 15.4l-1 4
      p M7 8.6h.01M17 8.6h.01
    `,
  };
  return art(base + extra[band]);
};

const chestplate = (band: Band): Layer[] => {
  const base = `
    s M3.5 11.8l.8 4.7h3.1l.1-4.7zM20.5 11.8l-.8 4.7h-3.1l-.1-4.7z
    b M8 6h8v10.2l1.2 1.5V21H6.8v-3.3L8 16.2z
    m M9.2 3.5h5.6l1.2 2.5H8z
    m M3.4 11.5C3.4 7.4 5.2 5.4 8.2 5.8L8.4 11.5zM20.6 11.5c0-4.1-1.8-6.1-4.8-5.7l-.2 5.7z
    s M12.6 6H16v10.2l1.2 1.5V21h-4.6z
    l M12 6v15M8 11.2h8M7 18h10
    h M4.6 9.5c.2-1.6 1-2.6 2.2-3-.9 1-1.2 2.2-1.2 3.6zM9 7l-.2 4.4
  `;
  const extra: Record<Band, string> = {
    1: `
      l M8.2 6.6l7.6 4.4M15.8 6.6L8.2 11
      p M5.4 8.3h.01M18.6 8.3h.01M9.4 14.4h.01M14.6 14.4h.01M12 19.5h.01
    `,
    20: `
      t M8 14h8v1.2H8zM3.9 9.7l3.7.4M20.1 9.7l-3.7.4
      p M5.4 8.3h.01M18.6 8.3h.01M9.5 8.6h.01M14.5 8.6h.01
    `,
    40: `
      a M10.4 11.6h3.2V21h-3.2z
      t M8 14h8v1.2H8zM3.9 9.7l3.7.4M20.1 9.7l-3.7.4M11.2 12.4h1.6v3.6h-1.6z
      p M5.4 8.3h.01M18.6 8.3h.01M9.5 8.6h.01M14.5 8.6h.01
    `,
    60: `
      t M4.8 6.6L3.4 3l3.6 2.4zM19.2 6.6L20.6 3 17 5.4zM11.3 8h1.4v6h-1.4zM9.4 10h5.2v1.4H9.4z
      a M12 15.6l1.2 1.3-1.2 1.4-1.2-1.4z
      t M8 14h8v1.2H8zM7 19.4h10v1H7z
      p M5.4 8.6h.01M18.6 8.6h.01
    `,
    80: `
      t M4.8 6.6L2.8 2.2 6.8 5.4zM8 5.4L7.2 1.6l2.2 3.8zM19.2 6.6l2-4.4-4 3.2zM16 5.4l.8-3.8-2.2 3.8z
      a M12 7.6l2.4 2.9L12 14.4l-2.4-3.9z
      t M8 16.6h8v1.2H8zM3.9 9.7l3.7.4M20.1 9.7l-3.7.4M7 20h10v1H7z
      p M5.4 8.6h.01M18.6 8.6h.01M9 18.4h.01M15 18.4h.01
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
      s M6.6 17.2h9v1.4h-9z
      p M8.6 10.9h.01M12.3 10.9h.01M16 10.9h.01M7.8 19.6h.01M14.6 19.6h.01
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
      a M11 18.8l1.2 1.3-1.2 1.4-1.2-1.4z
      p M8.6 11.4h.01M12.3 11.4h.01M16 11.4h.01
    `,
    80: `
      t M8.8 9.6L9.4 6.2l.6 3.4zM11.8 9.6l.6-3.6.6 3.6zM14.8 9.6l.6-3.2.6 3.2zM5.5 16.8h11.2v1H5.5z
      a M11 18.4l1.2 1.3-1.2 1.4-1.2-1.4z
      p M8.4 11.4h.01M12.3 11.4h.01M16 11.4h.01
    `,
  };
  return art(base + extra[band]);
};

const leggings = (band: Band): Layer[] => {
  const base = `
    b M7 3h10l1.2 18H14l-2-10-2 10H5.8z
    s M13.4 3H17l1.2 18H14l-1.8-9.5z
    m M6.3 4h11.4l.5 2.6H5.8zM5.8 6.6h12.4l.4 2.6H5.4z
    m M6.8 11l3.4.5-.4 3.2H6.9zM17.2 11l-3.4.5.4 3.2h2.9z
    s M6.7 16.4h3.7l-.3 4.6H6.4zM13.6 16.4h3.7l.3 4.6h-3.7z
    l M12 4v5M8.4 16.4v4.6M15.6 16.4v4.6
    h M7 5l-.1 1.2M7.6 11.7l-.3 2
  `;
  const extra: Record<Band, string> = {
    1: `
      s M6.8 3h10.4v1H6.8z
      p M7.4 7.8h.01M16.6 7.8h.01M8.5 12.8h.01M15.5 12.8h.01
    `,
    20: `
      t M5.4 9.2h13.2v.9H5.4zM6.4 16h4v.8h-4zM13.6 16h4v.8h-4z
      p M7.4 7.8h.01M16.6 7.8h.01M8.5 12.8h.01M15.5 12.8h.01
    `,
    40: `
      t M5.4 9.2h13.2v1H5.4zM6.4 16h4v.9h-4zM13.6 16h4v.9h-4z
      a M11.2 4.6h1.6v1.6h-1.6z
      p M7.4 7.8h.01M16.6 7.8h.01M8.5 12.8h.01M15.5 12.8h.01
    `,
    60: `
      t M5.4 9.2h13.2v1.2H5.4zM6.4 16h4v1h-4zM13.6 16h4v1h-4zM6.3 4h11.4v.8H6.3z
      a M12 4.4l1.2 1.3-1.2 1.4-1.2-1.4z
      p M7.4 7.8h.01M16.6 7.8h.01M8.5 12.8h.01M15.5 12.8h.01
    `,
    80: `
      t M7 12L4.8 10.8l2.6 2.8zM17 12l2.2-1.2-2.6 2.8zM5.4 9.2h13.2v1.2H5.4zM6.4 16h4v1h-4zM13.6 16h4v1h-4z
      a M12 4.4l1.2 1.3-1.2 1.4-1.2-1.4z
      p M7.4 7.8h.01M16.6 7.8h.01
    `,
  };
  return art(base + extra[band]);
};

const boots = (band: Band): Layer[] => {
  const base = `
    b M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2z
    m M8 3h5v2.4H8zM8 5.4h5v2.6H8zM8 8h5v2.6H8z
    m M13 12.6l5.4 2.2.3 1.6-5.6-2.2zM14.6 14.2l3.2 1.4-.4 1.6-3-1.4z
    s M12 3h1v9l6 3a2 2 0 0 1 1 1.8V19h-5.4z
    m M5 16.4h15v2.6H5z
    s M4.6 19h15.4v2.2H4.6z
    l M5 17.7h15M10 12v2.4
    h M8.6 3.4v1.6M8.6 5.8v1.6M5.6 17l1.6-.2
  `;
  const extra: Record<Band, string> = {
    1: `
      p M10.5 4.2h.01M10.5 6.7h.01M10.5 9.2h.01M7 17.8h.01M17.5 17.8h.01
    `,
    20: `
      t M8 5.2h5v.6H8zM8 7.8h5v.6H8zM5 16.4h15v.8H5z
      p M10.5 4.2h.01M10.5 6.7h.01M7 17.8h.01M17.5 17.8h.01
    `,
    40: `
      t M8 5.2h5v.7H8zM8 7.8h5v.7H8zM5 16.4h15v.9H5z
      a M10.5 3.8l.9 1-.9 1-.9-1z
      p M7 17.8h.01M17.5 17.8h.01
    `,
    60: `
      t M8 5.2h5v.8H8zM8 7.8h5v.8H8zM5 16.4h15v1H5zM4.6 19h15.4v.8H4.6z
      a M10.5 11.2l.9 1-.9 1-.9-1z
      p M7 17.8h.01M17.5 17.8h.01
    `,
    80: `
      t M8 3L6.4 .8 9.4 2.6zM13 3l1.6-2.2-3 1.8zM5 16.4h15v1H5zM18 17.6l2.4.8
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
