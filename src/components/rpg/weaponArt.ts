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
    b M13.4 1.8C16.4 5 16.8 9.4 14.8 14H9.8c-.8-4.8.6-9.2 3.6-12.2z
    s M13.4 1.8C16.4 5 16.8 9.4 14.8 14H12.6c1.6-3.8 1.6-8-.2-12.2z
    m M13.4 1.8C10.4 4.6 9 9 9.8 14h1.2c-.6-4 .4-8 2.4-12.2z
    t M8 14h8v1.8H8z
    t M10.6 15.8h2.8v5.2h-2.8z
    l M10.6 17.2h2.8M10.6 18.8h2.8M10.6 20.4h2.8M12 3.6c1 2.6 1.2 6 0 9
    m M10 21h4v1.6h-4z
    d M13.4 8h.01M12.2 11h.01M14 5.6h.01
  `,
  // A straight steel longsword with a crossguard and a round pommel
  20: `
    @rotate 45
    b M12 1l2.4 3.6V14H9.6V4.6z
    s M12 1l2.4 3.6V14H12z
    l M12 3.4v10.2
    m M6 13.6h12v2H6z
    t M5.6 13.2h1.6v2.8H5.6zM16.8 13.2h1.6v2.8h-1.6z
    t M10.8 15.6h2.4v5h-2.4z
    l M10.8 17h2.4M10.8 18.6h2.4
    b M12 20.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z
    e M10.4 5l.6 8.6
    h M10.4 4.6l.8-1.4v9
  `,
  // A broad blade with glowing runes, a winged guard and a gem pommel
  40: `
    @rotate 45
    b M12 .8l3.8 4.4V14H8.2V5.2z
    s M12 .8l3.8 4.4V14H12z
    a M12 4.6l1.1 1.5-1.1 1.5-1.1-1.5zM12 8.8l1.1 1.5-1.1 1.5-1.1-1.5z
    l M12 2.4v10.8M9.4 6l1.4 1.6M14.6 6l-1.4 1.6M9.4 10.2l1.4 1.6M14.6 10.2l-1.4 1.6
    t M4.8 13l3.4.6v2.6L4.8 17.4zM19.2 13l-3.4.6v2.6l3.4 1.2z
    m M8.2 13.6h7.6v2.6H8.2z
    t M12 14.2l.9 1-.9 1-.9-1z
    b M10.8 16.2h2.4v4.4h-2.4z
    l M10.8 17.6h2.4M10.8 19.2h2.4
    a M12 20.4l1.5 1.4-1.5 1.8-1.5-1.8z
    h M9.4 5.6l.4-.6V13H9.4z
    p M5.6 15h.01M18.4 15h.01
  `,
  // A curved dark saber with a fang-shaped crescent guard
  60: `
    @rotate 45
    b M10.2 1.2C15.6 3.8 17.6 9.6 15.4 14.2H10.6c1-4.4.4-9-.4-13z
    s M11.4 1.8c3.8 2.4 5 8 4 12.4h-3.4c1.4-4.2 1-8.8-.6-12.4z
    m M10.2 1.2c-.6 4-.4 8.6.4 13h1c-.8-4.2-.8-9 .2-12.2z
    l M13 4c1 3 1.2 6.6 0 9.4
    m M5.4 12.6c2 .4 4.4 1.4 6.6 2.8 2.2-1.4 4.6-2.4 6.6-2.8-.4 2.6-1.8 4.2-3.4 4.6H8.8c-1.6-.4-3-2-3.4-4.6z
    t M5 12.2l2 1-1 1.6zM19 12.2l-2 1 1 1.6z
    t M10.8 17.2h2.4v3.8h-2.4z
    l M10.8 18.4h2.4M10.8 19.8h2.4
    t M12 21l1.6 1.2L12 24l-1.6-1.8z
    a M12 13.8l1 1.2-1 1.4-1-1.4z
    h M11 3.4c.4 3 .4 6.2.2 9.4h-.8c-.6-3.2-.4-6.4.6-9.4z
  `,
  // A jagged black curved greatblade with glowing gems and a golden crown guard
  80: `
    @rotate 45
    b M13.6 .6c3.8 3.4 4.8 9 3 14.8H9.8l1-1.8-2 .2 1-2-2 .2 1.2-2.4-1.8-.2C8 5.4 10.6 2.4 13.6.6z
    s M14.6 1.4c3 3.4 3.4 8.6 1.8 14H13c1.8-4.6 1.4-10-.4-14z
    m M13.6.6C10.6 2.4 8 5.4 7.6 9.4l1.8.2-1.2 2.4 2 -.2-1 2 2-.2-1 1.8h1.4c-.6-3.8-.2-9.4 2.6-14.8z
    l M13 3c1.6 3.4 2 7.4.4 11.6M10.6 7.4l2 .6M10.4 10.4l2.4.4
    a M12.8 11.4l1.4 1.8-1.4 2-1.4-2zM13.6 6.4l.9 1.2-.9 1.3-.9-1.3z
    t M7.4 15.4h10l1 2.4H6.6z
    t M5.8 15l1.8.4-.6 2.6zM18.2 15l-1.8.4.6 2.6z
    s M10.8 17.8h2.4v3.6h-2.4z
    l M10.8 19h2.4M10.8 20.4h2.4
    a M12 21.2l1.6 1.2-1.6 1.4-1.6-1.4z
    e M9.6 4.2c-.6 1-.8 2-.8 3.2
    p M7 16.6h.01M17 16.6h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const WEAPON_ART: PieceArt = {
  sword: per(SWORD),
};
