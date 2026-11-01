import type { Band, Layer, Palette, PieceArt } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Accessory art (rings, necklaces, belts and charms, GAME_DESIGN.md 13.15). Accessories belong to no class,
 * so each band is one themed look shared by all four pieces, in the same fantasy tiers as the armor:
 *   1  Tribal: bone, fur and leather cord, a wolf fang
 *   20 Knight: silver, a signet cross and a shield
 *   40 Sapphire: silver set with blue crystal
 *   60 Dusk: bronze with a ruby and horns
 *   80 Nightblade: black thorns, gold and a glowing gem (the rarity colour)
 * A "*" after a tone mirrors that layer across the middle.
 */

export const ACCESSORY_PALETTE: Record<Band, Palette> = {
  1: { light: "#ece6d6", base: "#aaa391", dark: "#4a443a", trim: "#8f6038" },
  20: { light: "#f4f7fa", base: "#adb7c3", dark: "#454f5b", trim: "#c9d2dd" },
  40: { light: "#f6f9fd", base: "#bcc7d6", dark: "#4b5870", trim: "#6aa2f7" },
  60: { light: "#f4d79c", base: "#c18b49", dark: "#59391a", trim: "#d8473f" },
  80: { light: "#a2a8bf", base: "#2b2d3d", dark: "#08090e", trim: "#dbae45" },
};

const RING: Record<Band, string> = {
  // A bone band bound with cord, set with a wolf fang
  1: `
    b M12 8.6a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8z
    k M12 11.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z
    m M12 1.4c1.6 2 2.8 4 3 6.6-1 .8-2 1.2-3 1.2s-2-.4-3-1.2c.2-2.6 1.4-4.6 3-6.6z
    t M8.4 7.6h7.2v1.4H8.4z
    t M6.6 14.2l2.2.8-.4 1.4-2.2-.8zM17.4 14.2l-2.2.8.4 1.4 2.2-.8zM6.2 17.6l2.4.2-.2 1.4-2.4-.2zM17.8 17.6l-2.4.2.2 1.4 2.4-.2z
    e M8.4 13.6c.6-1.6 2-2.8 3.6-3
    l M12 3.4v4.4
    h M10.4 4.6c.4-.8.8-1.4 1.4-2-.2 1.2-.2 2.4-.2 3.6-.8 0-1.2-.6-1.2-1.6z
  `,
  // A silver band with a square signet bearing a cross
  20: `
    b M12 8.6a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8z
    k M12 11.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z
    m M7.4 2.6h9.2l1.4 6.2H6z
    s M12.6 2.6h4l1.4 6.2h-5.4z
    t M11.2 3.6h1.6v4.2h-1.6zM9.4 5h5.2v1.4H9.4z
    t M7 8.8h10v1.2H7z
    e M8.4 13.6c.6-1.6 2-2.8 3.6-3
    p M7.6 4.2h.01M16.4 4.2h.01M7.8 7.6h.01M16.2 7.6h.01
    h M8.2 3.6c1-.4 2-.4 3.2-.2-.6.8-.8 1.6-.8 2.6-1.2 0-2-.6-2.4-2.4z
  `,
  // A silver band set with a big blue crystal in claws
  40: `
    b M12 9.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4z
    k M12 12.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z
    t M7.2 9.4l2.6-.4.6 1.8-2.4.6zM16.8 9.4l-2.6-.4-.6 1.8 2.4.6z
    a M12 1.4l4.4 3.4-1.8 4.6H9.4L7.6 4.8z
    l M7.6 4.8h8.8M12 1.4L10.6 9.4M12 1.4l1.4 8M9.6 4.8l1 4.6M14.4 4.8l-1 4.6
    h M9 4c.8-.8 1.8-1.4 3-1.6-.8.8-1.2 1.8-1.4 3-1 0-1.6-.6-1.6-1.4z
    p M6 6h.01M18 6h.01M4.8 3.6h.01M19.2 3.6h.01
  `,
  // A bronze band with a ruby in a horned setting
  60: `
    b M12 9.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4z
    k M12 12.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z
    m* M8.4 6.6L5 2.6l4.2 1.8z
    m M7.8 5.4a4.2 4.2 0 1 1 8.4 0 4.2 4.2 0 0 1-8.4 0z
    t M12 2.6a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z
    l M10.8 4l2 .6M7 9.8c1.6.8 3.2 1.2 5 1.2s3.4-.4 5-1.2
    h M10.2 3.6c.4-.6 1-.8 1.6-.8-.4.6-.6 1.2-.6 2-.8 0-1.2-.4-1-1.2z
    p M7 15h.01M17 15h.01M12 21h.01
  `,
  // A black thorned band with a glowing gem in gold claws
  80: `
    t* M6.4 11.6L3.2 9.2l4.2.4zM5.8 15.6L2.4 14.8l3.8-1.2zM6.6 19.4L3.4 20l3-2.4z
    b M12 9.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4z
    k M12 12.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z
    t M7.6 9.8l2.2-.8.6 1.8-2.2.8zM16.4 9.8l-2.2-.8-.6 1.8 2.2.8z
    a M12 1.4l3.8 3.8L12 10 8.2 5.2z
    l M8.2 5.2h7.6M12 1.4v8.6
    e M8 15c.8-2.2 2.6-3.6 5-3.8
    h M9.4 4.4c.8-.8 1.6-1.2 2.6-1.4-.6.8-.8 1.6-.8 2.6-1 0-1.6-.4-1.8-1.2z
    p M5 6h.01M19 6h.01
  `,
};

const NECKLACE: Record<Band, string> = {
  // A leather cord with beads and a wolf fang
  1: `
    t M3 2.2c.4 8.4 3.8 12.8 9 12.8s8.6-4.4 9-12.8l-1.8-.2c-.4 7.4-3.2 11.2-7.2 11.2s-6.8-3.8-7.2-11.2z
    p M4.4 6h.01M5.6 9.4h.01M8 12.2h.01M16 12.2h.01M18.4 9.4h.01M19.6 6h.01
    m M12 14c1.4 1.8 2.2 3.8 2.4 6.4-.8.8-1.6 1.2-2.4 1.2s-1.6-.4-2.4-1.2c.2-2.6 1-4.6 2.4-6.4z
    t M10.4 13h3.2v1.8h-3.2z
    l M12 15.6v4.4M10.6 13.8h2.8
    h M10.8 15.6c.4-.6.8-1 1.2-1.4-.2 1-.2 2-.2 3-.8 0-1.2-.6-1-1.6z
    d M7 13.6h.01M17 13.6h.01
  `,
  // A silver chain with a shield pendant bearing a cross
  20: `
    m M3 2.2c.4 8.4 3.8 12.8 9 12.8s8.6-4.4 9-12.8l-1.8-.2c-.4 7.4-3.2 11.2-7.2 11.2s-6.8-3.8-7.2-11.2z
    l M4.8 6.4l1.2.6M6.2 9.8l1.2.8M9 12.4l1 .6M19.2 6.4L18 7M17.8 9.8l-1.2.8M15 12.4l-1 .6
    b M12 14.2l4.4 1.4v4.2c0 1.6-1.8 3-4.4 4-2.6-1-4.4-2.4-4.4-4v-4.2z
    s M12.6 14.4l3.8 1.2v4.2c0 1.4-1.6 2.6-3.8 3.6z
    t M11.2 16h1.6v5.4h-1.6zM9.4 17.6h5.2v1.4H9.4z
    m M10.4 12.6h3.2v1.8h-3.2z
    h M8.6 16c.8-.6 1.8-.8 2.6-.8-.6.8-.8 1.8-.8 3-.8-.2-1.4-1-1.8-2.2z
    p M8.4 20.4h.01M15.6 20.4h.01
  `,
  // A silver chain with a pendant blue crystal teardrop
  40: `
    m M3 2.2c.4 8.4 3.8 12.8 9 12.8s8.6-4.4 9-12.8l-1.8-.2c-.4 7.4-3.2 11.2-7.2 11.2s-6.8-3.8-7.2-11.2z
    l M4.8 6.4l1.2.6M6.2 9.8l1.2.8M9 12.4l1 .6M19.2 6.4L18 7M17.8 9.8l-1.2.8M15 12.4l-1 .6
    t M10.2 12.8h3.6l.6 1.8h-4.8z
    a M12 14.4l3.4 4.4L12 23.4l-3.4-4.6z
    l M8.6 18.8h6.8M12 14.4v9M10.2 16.6l1.8 2.2 1.8-2.2
    h M9.8 17.4c.6-.8 1.4-1.4 2.2-1.6-.6 1-.8 2-.8 3.2-1 0-1.6-.6-1.4-1.6z
    p M4 4.6h.01M20 4.6h.01M5.4 8h.01M18.6 8h.01
  `,
  // A bronze chain with a round amulet, a ruby and small horns
  60: `
    b M3 2.2c.4 8.4 3.8 12.8 9 12.8s8.6-4.4 9-12.8l-1.8-.2c-.4 7.4-3.2 11.2-7.2 11.2s-6.8-3.8-7.2-11.2z
    l M4.8 6.4l1.2.6M6.2 9.8l1.2.8M9 12.4l1 .6M19.2 6.4L18 7M17.8 9.8l-1.2.8M15 12.4l-1 .6
    m* M8.4 15.2L5.6 12.4l3.6 1z
    b M12 14.2a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8z
    t M12 15.8l1.9 2.3-1.9 2.5-1.9-2.5z
    s M12.6 14.2a4.4 4.4 0 0 1 0 8.8 4.4 4.4 0 0 0-1-8.7z
    l M12 14.2v1.6M12 20.6v2.4
    h M9.2 16.4c.6-.8 1.4-1.2 2.2-1.4-.6.8-.8 1.6-.8 2.6-.8 0-1.2-.4-1.4-1.2z
    p M3.8 4.6h.01M20.2 4.6h.01
  `,
  // A black chain with a gold winged pendant and a glowing gem
  80: `
    s M3 2.2c.4 8.4 3.8 12.8 9 12.8s8.6-4.4 9-12.8l-1.8-.2c-.4 7.4-3.2 11.2-7.2 11.2s-6.8-3.8-7.2-11.2z
    d M4.8 6.4h.01M6.2 9.8h.01M9 12.4h.01M19.2 6.4h.01M17.8 9.8h.01M15 12.4h.01
    t* M10.4 17.6C8 16.6 5.6 17 4 19c2.4-.4 4 .2 6.2 1.6z
    t* M10.4 20.2C8.4 20 6.6 20.8 5.6 22.6c2-.4 3.4-.2 5 .6z
    t M10.2 12.8h3.6l.6 1.8h-4.8z
    a M12 14.8l1.8 2.8-1.8 4.2-1.8-4.2z
    l M12 14.8v7M10.2 17.6h3.6
    h M10.6 16.6c.4-.6.8-1 1.4-1.2-.4.8-.6 1.6-.6 2.4-.8 0-1-.6-.8-1.2z
    p M3.6 4.6h.01M20.4 4.6h.01
  `,
};

const BELT: Record<Band, string> = {
  // A leather belt bound with cord, a bone ring buckle, a pouch and a hanging fang
  1: `
    b M2 9.4h20v5.2H2z
    s M2 12.6h20v2H2z
    t M3.6 9.4v5.2M6.4 9.4v5.2M17.6 9.4v5.2M20.4 9.4v5.2
    m M9.4 8h5.2v8H9.4z
    k M10.8 9.6h2.4v4.8h-2.4z
    b M15.8 14.6h5l.4 5.4h-5.8z
    t M15.6 14.6h5.4v1.4h-5.4z
    m M5.4 14.6c.8 1.4 1.2 2.8 1.2 4.6-.6.4-1.2.4-1.8 0 0-1.8.2-3.2.6-4.6z
    l M2 9.4h20M18.4 17.6h.01
    h M3 10.2h4M10 8.8h3.6
    p M11.8 8.8h.01
  `,
  // A studded leather belt with a plain silver buckle
  20: `
    b M2 9.4h20v5.2H2z
    s M2 12.6h20v2H2z
    p M3.6 12h.01M6 12h.01M8 12h.01M16 12h.01M18 12h.01M20.4 12h.01
    m M8.4 7.4h7.2v9.2H8.4z
    k M10 9.2h4v5.6h-4z
    t M11.6 10h.8v4h-.8z
    t M2 9.4h20v1H2z
    s M15.8 14.6h3.8v5h-3.8z
    m M15.8 14.6h3.8v1.2h-3.8z
    h M3 10.4h4.6M9.2 8.2h3.8
    e M8.6 7.8h6.8
  `,
  // A blue-enamelled plate belt with a gem buckle
  40: `
    b M2 9.2h20v5.6H2z
    s M2 12.8h20v2H2z
    t M3 10h4.4v3.6H3zM16.6 10H21v3.6h-4.4z
    m M8 6.6h8l2 2.4v6l-2 2.4H8l-2-2.4v-6z
    k M9.6 8.6h4.8v6.8H9.6z
    a M12 9.4l1.8 2.2-1.8 3.2-1.8-3.2z
    l M7 10.8h.01M5 11.8v1M19 11.8v1
    h M3.6 10.6h3M9 7.4h4
    p M7.2 9h.01M16.8 9h.01M7.2 15h.01M16.8 15h.01
    t M8 6.6h8v1H8z
  `,
  // Overlapping bronze plates with a sun buckle and hanging tassels
  60: `
    b M2 9.2h20v5.6H2z
    t M3 9.8h3.6l.8 4.4H3.8zM8 9.8h3.6l.4 4.4H8.4zM12.4 9.8H16l-.4 4.4h-3.6zM16.6 9.8h3.6l-.8 4.4h-3.6z
    m M12 5.6a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8z
    s M12.6 5.6a6.4 6.4 0 0 1 0 12.8 6.4 6.4 0 0 0 0-12.8z
    t M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z
    k M12 9.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z
    t M5 14.8l-.6 4.8M7 14.8l.4 4.2M19 14.8l.6 4.8M17 14.8l-.4 4.2
    l M12 5.6v-1.6M12 18.4v1.6M5.6 12H4M20 12h-1.6
    h M8.6 9c.8-1.4 2-2.2 3.4-2.4-1 1-1.4 2-1.4 3.4-1 0-1.6-.4-2-1z
    p M3.8 12h.01M20.2 12h.01
  `,
  // A black spiked belt with a gold buckle, a glowing gem and ragged crimson strips
  80: `
    s M4.4 14.6l-.8 6.4 2.2-1.4.8 2zM18 14.6l1 7 2.2-1.6.4-3.4z
    t M4.6 14.6l-.4 4.6 1.8-.8.6 1.8.2-5.6zM18.6 14.6l.6 5.6 1.6-1.4.4-4.2z
    b M2 9.2h20v5.6H2z
    s M2 12.8h20v2H2z
    t M3.4 9.2L2.6 6.4 5 9.2zM7 9.2L6.6 5.8 9 9.2zM15 9.2l.4-3.4 2.4 3.4zM19 9.2l.8-2.8 1.6 2.8z
    t M8.4 6.4h7.2l1.6 2.6v6L15.6 18H8.4L6.8 15V9z
    k M9.8 8.2h4.4v7.6H9.8z
    a M12 8.8l1.8 2.6-1.8 3.6-1.8-3.6z
    l M7.6 9.8l.01.01M16.4 9.8h.01
    e M8.8 7.4h6.4
    p M5 12h.01M19 12h.01M3.8 12h.01M20.2 12h.01
  `,
};

const CHARM: Record<Band, string> = {
  // A feather bound with leather and beads, hanging on a cord
  1: `
    t M12 .6v3.2M10.4 .6h3.2
    b M12 3.4C8 7.4 7.4 14.4 12 22.4c4.6-8 4-15 0-19z
    s M12.4 3.6c3.6 4 3.8 10.8-.4 18.6-.2-.4 1.6-14.8.4-18.6z
    l M12 5v16M12 8l-2.6 2.4M12 11l-3 2.8M12 14l-2.6 2.6M12 8l2.6 2.4M12 11l3 2.8M12 14l2.6 2.6
    t M10.4 18.4h3.2v1.4h-3.2zM10.6 16.6h2.8v1.2h-2.8z
    m M9.4 22.8l1.6-1.2M14.6 22.8l-1.6-1.2
    p M8.4 20.4h.01M15.6 20.4h.01
    h M10 7.6c.6-1.2 1.4-2 2.2-2.4-.6 1.6-.8 3.2-.8 5-1 0-1.6-.8-1.4-2.6z
  `,
  // A silver holy cross with a small gem
  20: `
    m M10.6 .6h2.8v2.2h-2.8z
    b M10.2 3h3.6v6.4H20v3.6h-6.2V23h-3.6V13H4V9.4h6.2z
    s M12.6 3h1.2v6.4H20v3.6h-6.2V23h-1.2z
    t M10.2 3h3.6v1H10.2zM4 9.4h6.2v1H4zM13.8 9.4H20v1h-6.2zM10.2 22h3.6v1h-3.6z
    a M12 9.8l1.6 1.8-1.6 2-1.6-2z
    l M12 4v4M12 14v8M5 11.2h4M15 11.2h4
    h M10.8 4c.6-.2 1.2-.2 1.8 0-.4 1-.4 2-.4 3.2-.8 0-1.2-.6-1.4-1.6z
    p M6 11.2h.01M18 11.2h.01M12 20h.01
  `,
  // A blue crystal star in a silver frame
  40: `
    m M10.6 .6h2.8v2.2h-2.8z
    b M12 2.6l2.8 6.6 7 .4-5.6 4.6 1.8 7.2-6-4-6 4 1.8-7.2L2.2 9.6l7-.4z
    a M12 5.4l1.8 4.2 4.4.4-3.6 3 1.2 4.6-3.8-2.6-3.8 2.6 1.2-4.6-3.6-3 4.4-.4z
    l M12 5.4v10.4M7.2 11.4h9.6M8.4 8l7.2 7.6M15.6 8l-7.2 7.6
    h M10.2 8c.6-.8 1.2-1.4 2-1.6-.6 1-.8 2-.8 3.2-1 0-1.4-.8-1.2-1.6z
    t M12 21.6l.01.01
    p M3 5h.01M21 5h.01M4 19h.01M20 19h.01
  `,
  // A bronze sun medallion with a ruby heart and rays
  60: `
    m M10.6 .6h2.8v2h-2.8z
    t M12 2.6l1.4 3.2 3.2-1.4-.6 3.4 3.4.2-2.2 2.6 2.6 2.2-3.4.6 1 3.2-3.2-1.2-.6 3.4-2.2-2.6-2.2 2.6-.6-3.4-3.2 1.2 1-3.2-3.4-.6 2.6-2.2L4.2 8.4l3.4-.2-.6-3.4 3.2 1.4z
    b M12 6.4a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6z
    s M12.6 6.4a5.8 5.8 0 0 1 0 11.6 5.8 5.8 0 0 0-1.2-11.4z
    t M12 15.6l-3-3c-.8-1 -.4-2.6 1-2.8 1-.1 1.6.6 2 1.2.4-.6 1-1.3 2-1.2 1.4.2 1.8 1.8 1 2.8z
    l M12 6.4v-1M12 18v1M6.2 12.2h-1M17.8 12.2h1
    h M8.4 9.6c.6-1.2 1.6-1.8 2.8-2-.8.8-1.2 1.8-1.2 3-1 0-1.4-.4-1.6-1z
    p M12 21.4h.01M7 20h.01M17 20h.01
  `,
  // A black and gold halo with a glowing crimson eye
  80: `
    t M10.6 .4h2.8v2h-2.8z
    t M12 2.6c5 0 9 2.4 9 5.4s-4 5.4-9 5.4-9-2.4-9-5.4 4-5.4 9-5.4zM12 4.6c-3.6 0-6.4 1.4-6.4 3.4s2.8 3.4 6.4 3.4 6.4-1.4 6.4-3.4-2.8-3.4-6.4-3.4z
    b M12 11.4c3 0 5.6 1 5.6 2.8v3.4L12 23l-5.6-5.4v-3.4c0-1.8 2.6-2.8 5.6-2.8z
    s M12.6 11.4c2.8.2 5 1.2 5 2.8v3.4L12.6 22.4z
    k M8.4 14.6c1-.8 2.2-1.2 3.6-1.2s2.6.4 3.6 1.2c-1 1-2.2 1.6-3.6 1.6s-2.6-.6-3.6-1.6z
    a M12 13.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z
    t M12 17.4l1.2 2.4h-2.4zM3.4 6.2L1.4 4.4l3 .6zM20.6 6.2l2-1.8-3 .6z
    l M12 17.4v4.8
    p M6.4 9.4h.01M17.6 9.4h.01M12 6.4h.01
  `,
};

const BANDS: Band[] = [1, 20, 40, 60, 80];
const per = (set: Record<Band, string>) =>
  Object.fromEntries(BANDS.map((b) => [b, art(set[b])])) as Record<Band, Layer[]>;

export const ACCESSORY_ART: PieceArt = {
  ring: per(RING),
  necklace: per(NECKLACE),
  belt: per(BELT),
  charm: per(CHARM),
};
