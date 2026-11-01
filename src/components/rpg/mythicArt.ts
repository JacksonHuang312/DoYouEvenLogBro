import type { Layer, Palette } from "./gearLayers";
import { art } from "./gearLayers";

/*
 * Mythic items each have their own picture and palette (GAME_DESIGN.md 13.15), in the most dramatic tier:
 * spikes, wings, beast faces, gold, glowing gems. No two share a look: Mythics are never a set. The accent
 * layer glows in the Mythic colour.
 *   Revenant's Crown: a bone skull helm with spectral eyes
 *   Thornheart Cuirass: dark plate in a thorny vine around a bleeding heart
 *   Stormfist Gauntlets: storm blue with lightning
 *   Verdant Greaves: living bark with leaves and gold
 *   Timewarden's Treads: bronze clockwork with an hourglass and a gear
 *   Bloodletter Gauntlets: crimson with bone claws and a blood drop
 *   Bulwark Plate: massive steel and gold with a lion's face
 *   Executioner's Ring: black iron with a skull and crossed axes
 *   Oathkeeper Belt: royal blue with a gold lion buckle
 *   Saint's Locket: a gold heart locket under a halo
 *   Dawn Censer: a hanging gold censer pierced with suns, trailing smoke
 *   Kingsbane: a long violet blade with a horned, hooked guard, a silver core and an eye gem
 *   Staff of First Light: white-gold with a radiant star
 *   The Unyielding Wall: a fortress-walled tower shield with a sun boss
 */

const GAUNTLET = `
  b M7 21v-5.5L5 12V8.2a1.5 1.5 0 0 1 3 0V4.6a1.5 1.5 0 0 1 3 0V4a1.5 1.5 0 0 1 3 0v1.6a1.5 1.5 0 0 1 3 0V14.5l-2 3V21z
  s M15.4 4.6c.9.2 1.6 1 1.6 1.9v8l-2 3V21h-1.6v-3.8l2-3.2z
  l M8 8.2V10M11 4.6V10M14 5.6V10
  h M6 9.3V8.6M8.8 4.8V6
`;

const BOOT = `
  s M3.9 1.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V19H.2v-3.6l3.7-2.2z
  b M7.5 2.5h6v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20H3.8v-3.6l3.7-2.2z
  s M12.5 2.5h1v9.5l7 3a2.4 2.4 0 0 1 1.5 2.2V20h-6z
`;

export const MYTHIC_ART: Record<string, { palette: Palette; layers: Layer[] }> = {
  // Revenant's Crown (Last Stand): a bone skull helm with a jagged crown and spectral eyes
  "unbroken-helmet": {
    palette: { light: "#efe8d6", base: "#a89f86", dark: "#3a362e", trim: "#34d0bd" },
    layers: art(`
      b* M6.4 6.2L5.4 1.2l2.6 3.4zM9.2 4.6L9 .4l1.8 3.8z
      b M12 .2l1.2 4h-2.4z
      b M12 3.6c4.6 0 7.6 3.2 7.6 7.8 0 2.4-.8 4.2-2.2 5.6v3.2l-2.2 1.8H8.8l-2.2-1.8V17c-1.4-1.4-2.2-3.2-2.2-5.6 0-4.6 3-7.8 7.6-7.8z
      s M13.4 3.8c3.6.6 6.2 3.6 6.2 7.6 0 2.4-.8 4.2-2.2 5.6v3.2l-2.2 1.8h-1.8z
      s M4.8 7.4c2.2-1.2 4.6-1.8 7.2-1.8s5 .6 7.2 1.8l-.4 1.6c-2.2-1-4.4-1.6-6.8-1.6S7.4 8 5.2 9z
      k M7.2 10.4c1-.6 2.4-.6 3.4.2l-.4 2.6c-1 .4-2.2.2-3-.6zM16.8 10.4c-1-.6-2.4-.6-3.4.2l.4 2.6c1 .4 2.2.2 3-.6z
      t M8.2 11.2h1.4v1.3H8.2zM14.4 11.2h1.4v1.3h-1.4z
      k M11.4 13.6h1.2l-.6 1.4z
      m M8.8 18h6.4v1.8H8.8z
      l M10.4 18v1.8M12 18v1.8M13.6 18v1.8M15.8 5.4l-1 2 .8 1
      a M12 6.2l.8.9-.8 1-.8-1z
      h M6.8 9.6c.6-1.8 1.8-3 3.6-3.6
    `),
  },
  // Thornheart Cuirass (reflects damage): dark plate bound in a thorny vine around a bleeding heart
  "unbroken-chestplate": {
    palette: { light: "#7fae74", base: "#2c4a30", dark: "#0c1a10", trim: "#b0262f" },
    layers: art(`
      b M6.6 5.6h10.8l1.6 4.4-2.4 4 .8 7.2H6.6l.8-7.2-2.4-4z
      s M12.6 5.6h4.8l1.6 4.4-2.4 4 .8 7.2h-4.8z
      b* M1.4 10.2c0-3.6 2.2-5.8 5.6-5.6l1 1.6-.6 5-4.8 1.6c-.8-.6-1.2-1.6-1.2-2.6z
      m* M2.2 6.6L.6 4.2l2.6 1zM4 4.8l-.4-2.8 1.6 2.2zM1.4 9.4L.2 8.4l1.6-.2z
      m M9 2.8h6l1.2 2.8H7.8z
      m M6.4 9.4c2 1.2 3.6 2.8 4.6 4.8 1-2 2.6-3.6 4.6-4.8l.6.8c-1.8 1.2-3.4 2.8-4.4 4.8L12 16l-.2-.2c-1-2-2.6-3.6-4.4-4.8z
      m M8 10.4l-.6-1.4 1.2.8zM16 10.4l.6-1.4-1.2.8zM9.6 12.4l-1 .4 1.2.4zM14.4 12.4l1 .4-1.2.4z
      t M12 19.6l-3.2-3.2c-.9-1-.4-2.8 1-3 1-.1 1.7.6 2.2 1.3.5-.7 1.2-1.4 2.2-1.3 1.4.2 1.9 2 1 3z
      a M12 16l.7.8-.7.8-.7-.8z
      l M7.4 19h9.2
      h M2.6 8.4c.6-1.6 1.8-2.6 3.4-2.8M8 7l-.6 4
    `),
  },
  // Stormfist Gauntlets (every 4th hit crits): a storm-blue gauntlet crackling with lightning
  "unbroken-gloves": {
    palette: { light: "#e6eefc", base: "#5e7aa8", dark: "#1a2640", trim: "#ffd84a" },
    layers: art(`
      t M19.4 2.6l-3 4.6h2.2l-2.6 4.8 5.2-6h-2.4l1.8-3.4zM4.4 3.6L2.8 6.8h1.4L2.6 9.6l3.2-3.8H4.4l1.2-2.2z
      ${GAUNTLET}
      m M7.4 9.4h9.8v2.8H7.4z
      d M8.8 10.8h.01M11 10.8h.01M13.2 10.8h.01M15.6 10.8h.01
      s M4.6 16.4h14l-1.6 5H6.2z
      t M9.6 16.8l-1 2.2h1.4l-.8 2 2.6-2.8h-1.4l.8-1.4zM14 16.8l-1 2.2h1.4l-.8 2 2.6-2.8h-1.4l.8-1.4z
      a M12 13.2l.9 1-.9 1.1-.9-1.1z
    `),
  },
  // Verdant Greaves (regrows below half HP): living bark greaves sprouting leaves, bound in gold
  "unbroken-leggings": {
    palette: { light: "#d8f0a4", base: "#6a8a3c", dark: "#24361a", trim: "#d0a64a" },
    layers: art(`
      b* M3 3h7.8l.4 8.6-.8 9.8H4.2L3 11.6z
      s* M7.8 3h3l.4 8.6-.8 9.8H8z
      l* M4.6 4.6l.6 5-.4 4 .4 6M7 4.6l-.4 4.4.6 4.6-.4 6
      m* M5.8 9c-2-1.2-3.8-1-4.8.4 1.6 1 3.4 1.2 4.8-.4zM8.2 6.8c.6-2.2 2.2-3.2 3.6-3-.4 1.8-1.6 3-3.6 3z
      t* M3.2 13.6h7.6v1.3H3.2zM2.8 3h8.4v1.6H2.8z
      a* M6.8 10.2l1 1-1 1.1-1-1.1z
      t* M4.2 21.2l-1.8 1.4 2.6-.2zM10 21.2l1.6 1.4-2.4-.2z
      h* M4.2 5l-.4 4.6
    `),
  },
  // Timewarden's Treads (the enemy enrages later): bronze clockwork boots with an hourglass and a gear
  "unbroken-boots": {
    palette: { light: "#f6d79a", base: "#b07a36", dark: "#4a2e10", trim: "#e8eef6" },
    layers: art(`
      ${BOOT}
      m M7.5 2.5h6v1.6h-6zM7.5 10.6h6v1.6h-6z
      t M8.6 4.4h3.8l-1.6 2.6 1.6 2.6H8.6l1.6-2.6z
      a M9.8 8.4h1.4l.5.8h-2.4zM10.2 5.4h.6l-.3.6z
      l M10.5 7v1.2
      m M16.2 12.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z
      d M16.2 12.2h.01M16.2 18.2h.01M13.2 15.2h.01M19.2 15.2h.01M14.1 13.1h.01M18.3 13.1h.01M14.1 17.3h.01M18.3 17.3h.01
      k M16.2 14.4a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z
      t M3.8 17h18.4v1.2H3.8z
      s M3.4 20h18.8v2.2H3.4z
      h M8.2 3v1M5 18.2l2-.4
    `),
  },
  "bloodletter-gauntlets": {
    palette: { light: "#f29a9a", base: "#8e1c26", dark: "#2a070b", trim: "#eadfcc" },
    layers: art(`
      ${GAUNTLET}
      t M8.6 4.6L8 .2l1.8 3.8zM11.6 4.2L11.4-.2l1.8 4.2zM14.6 5l.6-4.2 1 4.2zM6 9.2L4.4 5.8 7 8z
      s M7.4 9.4h9.8v2.8H7.4z
      t M7.6 9.6l.8-1.4.8 1.4.8-1.4.8 1.4.8-1.4.8 1.4.8-1.4.8 1.4.8-1.4.8 1.4.8-1.4.4 1.4z
      m M4.6 16.4h14l-1.6 5H6.2z
      s M12.4 16.4h6.2l-1.6 5h-4.6z
      t* M4.8 17L2 15.6l2.2 3z
      a M19.6 12.8c.8 1.2 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.4 1.2-2.6zM12 18.2l1 1.1-1 1.2-1-1.2z
    `),
  },
  "bulwark-plate": {
    palette: { light: "#f2f4f8", base: "#9aa6b8", dark: "#343b48", trim: "#e0b84c" },
    layers: art(`
      b M6.6 6h10.8l1.6 4.4-2.4 4 .8 6.8H6.6l.8-6.8-2.4-4z
      s M12.6 6h4.8l1.6 4.4-2.4 4 .8 6.8h-4.8z
      m* M.6 9C.6 5.6 2.8 3.6 6.4 3.8l1.6 1.6-.4 3.6zM.6 10.2l7.2-.6-.2 2.8-6.4 1.4c-.4-1.2-.6-2.4-.6-3.6zM1.4 14.4l6-.8-.2 2.6-4.4 1.4c-.6-.8-1.2-2-1.4-3.2z
      t* M.8 8.8l7-.6v.8l-7 .6z
      m M9 3h6l1.2 3H7.8z
      t M12 7.4a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4z
      l M8.4 9l1 .6M15.6 9l-1 .6M8 11.6h1.2M16 11.6h-1.2M8.6 14.4l1-.6M15.4 14.4l-1-.6
      m M12 9.2c1.4 0 2.4 1 2.4 2.4 0 1.6-1.2 2.6-2.4 3.2-1.2-.6-2.4-1.6-2.4-3.2 0-1.4 1-2.4 2.4-2.4z
      k M10.8 11.2h.9v.7h-.9zM12.3 11.2h.9v.7h-.9zM11.6 13.2h.8l-.4.6z
      t M8 17.4h8v1.4H8z
      p M9 20h.01M15 20h.01M3 6.6h.01M21 6.6h.01
      h M2 7.4c.6-1.6 1.8-2.6 3.4-2.8M8.2 7l-.6 4
    `),
  },
  "executioners-ring": {
    palette: { light: "#c4c8d2", base: "#3a3d48", dark: "#0c0d12", trim: "#c43232" },
    layers: art(`
      t* M7 9.4L3.8 3.6c1.4-.4 2.6 0 3.4 1.2l.8 1.6-1 .4 1.6 2.6z
      b M12 9.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4z
      k M12 12.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z
      m M12 1.4c2.2 0 3.8 1.6 3.8 3.6 0 1.4-.6 2.4-1.6 3v1.6H9.8V8c-1-.6-1.6-1.6-1.6-3 0-2 1.6-3.6 3.8-3.6z
      a M10 4.6h1.4v1.4H10zM12.6 4.6H14v1.4h-1.4z
      k M11.6 6.6h.8l-.4.8zM10.6 8.6v1M12 8.6v1M13.4 8.6v1
      e M7.8 15c.8-2.2 2.6-3.6 5-3.8
      t* M6.6 14.4l-2.4-.4 2 1.6z
      h M9.6 3c.6-.6 1.4-1 2.2-1
    `),
  },
  "oathkeeper-belt": {
    palette: { light: "#fbe7a8", base: "#c99a3a", dark: "#5a3e12", trim: "#2d4f9c" },
    layers: art(`
      t M2 9.2h20v5.6H2z
      s M2 12.8h20v2H2z
      m M3 9.8h3.4l.6 4.4H3.4zM17.6 9.8H21l-.4 4.4h-3.6z
      b M12 4.6a7.2 7.2 0 1 1 0 14.4 7.2 7.2 0 0 1 0-14.4z
      l M12 4.8v1.8M6.6 7.2l1.2 1.2M17.4 7.2l-1.2 1.2M5 11.8h1.8M19 11.8h-1.8M6.6 16.4l1.2-1.2M17.4 16.4l-1.2-1.2
      m M12 7.8c2 0 3.4 1.6 3.4 3.6 0 2.2-1.6 3.6-3.4 4.4-1.8-.8-3.4-2.2-3.4-4.4 0-2 1.4-3.6 3.4-3.6z
      k M10.4 10.6h1v.8h-1zM12.6 10.6h1v.8h-1zM11.4 13h1.2l-.6.8z
      a M12 16.6l.8.8-.8.9-.8-.9z
      t M5 14.8l-.6 4.8M19 14.8l.6 4.8
      h M7.4 7.8c1-1.4 2.6-2.2 4.4-2.4
    `),
  },
  "saints-locket": {
    palette: { light: "#ffffff", base: "#c8d0de", dark: "#5a6274", trim: "#e8c35a" },
    layers: art(`
      m M3 2.2c.4 7.4 3.4 11.4 7.6 12.2l-.4 1.6C5 15 1.6 10.4 1.2 2.4zM21 2.2c-.4 7.4-3.4 11.4-7.6 12.2l.4 1.6c5.2-1 8.6-5.6 9-13.6z
      t M12 9.6c3.4 0 6 1 6 2.2s-2.6 2.2-6 2.2-6-1-6-2.2 2.6-2.2 6-2.2zm0 1c-2.6 0-4.6.6-4.6 1.2s2 1.2 4.6 1.2 4.6-.6 4.6-1.2-2-1.2-4.6-1.2z
      t M12 23l-4.6-4.6c-1.6-1.6-1-4.4 1.2-4.8 1.6-.3 2.6.6 3.4 1.6.8-1 1.8-1.9 3.4-1.6 2.2.4 2.8 3.2 1.2 4.8z
      s M12 23V15.2c.8-1 1.8-1.9 3.4-1.6 2.2.4 2.8 3.2 1.2 4.8z
      a M12 20.6l-2.6-2.6c-.8-.8-.4-2.2.6-2.4.8-.1 1.4.4 2 1 .6-.6 1.2-1.1 2-1 1 .2 1.4 1.6.6 2.4z
      l M12 15.2v1.4
      p M4.6 7h.01M19.4 7h.01
      h M8.6 15c.4-.6 1-1 1.8-1
    `),
  },
  "dawn-censer": {
    palette: { light: "#ffe9a8", base: "#d89a3c", dark: "#6a3e14", trim: "#f4f2ea" },
    layers: art(`
      t M14.6 4.2c1.6-.8 1.6-2.4.4-3.4M16.4 6c2-1 2.2-3 1-4.4
      l M12 1v6.6M8.6 1.6l1.6 6M15.4 1.6l-1.6 6
      m M11 .4h2v1.6h-2z
      m M7.4 9.6c0-2 2-3.4 4.6-3.4s4.6 1.4 4.6 3.4z
      b M5.6 9.6h12.8c0 4.4-2.8 7.8-6.4 7.8s-6.4-3.4-6.4-7.8z
      s M12.6 9.6h5.8c0 4.2-2.6 7.6-5.8 7.8z
      k M10 7.6h.9v.9H10zM13.1 7.6h.9v.9h-.9zM11.6 6.8h.8v.8h-.8z
      a M12 10.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z
      l M12 9.8v.6M8.6 11.2l.6.4M15.4 11.2l-.6.4
      m M9.6 17.2h4.8l.6 2H9z
      m M8.4 19.2h7.2v1.6H8.4z
      e M5 4.6c-1.6-1.2-1.4-3 .2-3.8M6.6 6.4c-1.4-.8-1.6-2.2-.6-3.2
      h M6.8 11c.4-.8 1-1.2 1.8-1.4
    `),
  },
  kingsbane: {
    palette: { light: "#ecc8f4", base: "#7a2f8e", dark: "#2a0c33", trim: "#f4f0f8" },
    layers: art(`
      @rotate 45
      @scale 0.9
      b M12-4.8l1.4 3.6.3 13h-3.4l.3-13z
      s M12-4.8l1.4 3.6.3 13H12z
      e M12-1.4v1.6M11.6 1.2l.8.6
      b* M10.6 12.2C7.6 11.8 5.6 10 5 7.2c-.2-1 .4-1.6 1.2-1.2-.2 1.6.4 2.8 1.6 3.4-.4-1.2-.2-2.2.6-2.8.4 1.6 1.2 2.6 2.4 3.2z
      b* M10.6 13.4c-2.8.2-4.8 1.4-5.6 3.6 1.2-.4 2.2-.4 3.2.2-.2-.8.2-1.4.8-1.6.2.8.8 1.2 1.6 1.2z
      b M9.4 11.8h5.2l.6 2.4-1.2 2.8h-4l-1.2-2.8z
      t M12 8.6l2.2 3.4-1 1v2.4L12 17.2l-1.2-1.8V13l-1-1z
      k M11.3 12.4h.5v1.8h-.5zM12.2 12.4h.5v1.8h-.5z
      a M12 15.2l.8.9-.8 1-.8-1z
      b M11 17.2h2v5h-2z
      s M12.2 17.2h.8v5h-.8z
      l M11 18.2h2M11 19.2h2M11 20.2h2M11 21.2h2
      b M12 22.2l1.2 1.2-1.2 2.6-1.2-2.6z
      h M10.9-.6l.3-1.6M6.6 8c.2 1 .6 1.6 1.2 2
    `),
  },
  "staff-of-first-light": {
    palette: { light: "#fffbe8", base: "#e8cf86", dark: "#7a5a20", trim: "#ffffff" },
    layers: art(`
      @rotate 45
      @scale 0.8
      t M12-4.4l1.2 4 4-1.2-2.8 3 2.8 3-4-1.2-1.2 4-1.2-4-4 1.2 2.8-3-2.8-3 4 1.2z
      b M12-1.8l.8 2.4 2.4-.8-1.6 2 1.6 2-2.4-.8-.8 2.4-.8-2.4-2.4.8 1.6-2-1.6-2 2.4.8z
      a M12 .6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z
      e M12-6v1M17.4 1.8h1M6.6 1.8h-1
      m M10.8 7h2.4v1.6h-2.4z
      b M11.2 8.6h1.6v16.4h-1.6z
      s M12.2 8.6h.6v16.4h-.6z
      t M10.8 12h2.4v1.2h-2.4zM10.8 21.6h2.4v1.2h-2.4z
      m M10.8 15.4h2.4v3.6h-2.4z
      t M12 25l1 1.6h-2z
    `),
  },
  "unyielding-wall": {
    palette: { light: "#e9e3d4", base: "#8f8676", dark: "#2f2b24", trim: "#e0b84c" },
    layers: art(`
      b M3.6 3.6h2.6v1.6h2.4V3.6h2.2v1.6h2.4V3.6h2.2v1.6h2.4V3.6h2.6v14.2c0 1.6-1 2.8-2.6 3.6L12 23.2l-5.8-1.8c-1.6-.8-2.6-2-2.6-3.6z
      s M12.6 3.6h2.2v1.6h2.4V3.6h2.6v14.2c0 1.6-1 2.8-2.6 3.6l-4.6 1.6z
      l M4.4 9h15.2M4.4 13.4h15.2M4.4 17.6h15.2M8 5.4V9M16 5.4V9M6 9v4.4M12 9v4.4M18 9v4.4M8 13.4v4.2M16 13.4v4.2
      t M3.6 6.4h16.8v1.4H3.6z
      t M12 8.6a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z
      l M12 8.8v1.4M7.8 13.2h1.4M16.2 13.2h-1.4M9 10.2l1 1M15 10.2l-1 1M9 16.2l1-1M15 16.2l-1-1
      a M12 10.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z
      t M3.6 19.8c1 1 1.8 1.4 2.6 1.6L12 23.2l5.8-1.8c.8-.2 1.6-.6 2.6-1.6v1.2c-1 1-1.8 1.4-2.6 1.6L12 24.4l-5.8-1.8c-.8-.2-1.6-.6-2.6-1.6z
      h M4.4 4.4v4M10.8 11.4c.3-.4.7-.6 1.2-.6
    `),
  },
};
