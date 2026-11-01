import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Weapon art (swords, staves and shields, GAME_DESIGN.md 13.15). Weapons are open to every class, so each
 * type has one picture per level band, in the fantasy tiers of the armor. Pictures are drawn upright and
 * turned on the tile with "@rotate". Swords (the Striker's weapon):
 *   1  Recruit's Blade: a crude curved knife with a bound grip
 *   20 Steel Longsword: a straight blade with a crossguard
 *   40 Runed Broadsword: a broad blade with glowing runes and a winged guard
 *   60 Duskfang Saber: a curved dark saber with a fang-shaped guard
 *   80 Sunsteel Greatsword: a jagged black curved greatblade with glowing gems
 */

export const WEAPON_PALETTE: Record<Band, Palette> = {
  1: { light: "#d6cdbf", base: "#847f78", dark: "#37332f", trim: "#8f5d37" },
  20: { light: "#f2f5f8", base: "#adb6c2", dark: "#454d59", trim: "#7d4c2b" },
  40: { light: "#f6f9fd", base: "#b9c5d7", dark: "#47536d", trim: "#6aa2f7" },
  60: { light: "#c6cad6", base: "#60646f", dark: "#1f2128", trim: "#c68b49" },
  80: { light: "#8e94ac", base: "#272832", dark: "#08080c", trim: "#dbae45" },
};

const SWORD: Record<Band, string> = {
  // A crude curved knife with a leather-bound grip
  1: `
    @rotate 45
    @edge 0.5
    b M13.2 2.6c1.6 4.4 1.8 9.8.6 13.6h-3.6c-.8-5 0-10 3-13.6z
    s M13.2 2.6c1.6 4.4 1.8 9.8.6 13.6h-1.6c1.2-4.2 1-9-.4-13.6z
    m M13.2 2.6c-3 3.6-3.8 8.6-3 13.6h.8c-.6-4.6.2-9.6 2.2-13.6z
    t M9 16.2h6.4v1.3H9z
    t M10.8 17.5h2.8v5h-2.8z
    l M10.8 18.8h2.8M10.8 20.2h2.8M10.8 21.6h2.8M12.6 5c.8 3.4.8 7 0 9.8
    m M10.4 22.5h3.6v1.4h-3.6z
    d M12.8 9h.01M11.8 12.2h.01
  `,
  // A straight steel longsword with a crossguard and a round pommel
  20: `
    @rotate 45
    @edge 0.5
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
    @edge 0.5
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
  // A curved dark saber with a fang-shaped crescent guard
  60: `
    @rotate 45
    @edge 0.5
    b M10.2-3c3.6 3.2 5 10 3.8 19h-3.6c.4-6.4.2-12.6-.2-19z
    s M11.4-2.4c3 3.4 3.8 9.8 2.6 18.4h-1.8c1-6.4.8-12.6-.8-18.4z
    m M10.2-3c-.2 6.4-.2 12.6.2 19h.8c-.6-6.4-.6-12.6-.4-18z
    l M12.8 1.6c1 4 1.2 9 .2 13.2
    m M7 16c1.8.4 3.6 1.2 5 2.2 1.4-1 3.2-1.8 5-2.2-.4 2-1.4 3.2-2.8 3.6h-4.4C8.4 19.2 7.4 18 7 16z
    t M6.6 15.6l2 1-1 1.6zM17.4 15.6l-2 1 1 1.6z
    t M10.8 19.6h2.4v3h-2.4z
    l M10.8 20.8h2.4
    t M12 22.4l1.5 1.2L12 25.2l-1.5-1.6z
    a M12 16.8l.9 1.1-.9 1.3-.9-1.3z
  `,
  // A jagged black curved greatblade with glowing gems and a golden crown guard
  80: `
    @rotate 45
    @edge 0.5
    b M13.6-3.6c2 2.6 2.6 9 1.4 19.6h-4.2l.6-1.4-1.2.1.6-1.5-1.2.1.6-1.8-1.2-.1C9.6 4.8 11.4-.8 13.6-3.6z
    s M14.2-2.4c1.8 3 2 9 .8 18.4h-2c1.2-6 1-12.4-.8-18.4z
    l M13 -1.6c.8 4 1 9 .4 13.6
    a M12.6 11l.9 1.2-.9 1.4-.9-1.4zM13.2 5.4l.6.9-.6 1-.6-1z
    t M8 16h8.4l.7 1.8H7.3z
    t M6.8 15.6l1.4.4-.5 2.2zM17.4 15.6l-1.4.4.5 2.2z
    s M11 17.8h2.4v3.8H11z
    l M11 19h2.4M11 20.4h2.4
    a M12.2 21.8l1.4 1.2-1.4 1.8-1.4-1.8z
    p M8 17h.01M16.4 17h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const WEAPON_ART: PieceArt = {
  sword: per(SWORD),
};
