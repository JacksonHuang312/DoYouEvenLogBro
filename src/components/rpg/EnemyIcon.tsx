import { enemyByName, type EnemyKind } from "@/lib/game/enemyIcons";

/*
 * Flat line-art emblems (24×24, one stroke, one colour), drawn as symbols rather than creatures
 * (GAME_DESIGN.md 7.1 and 13.15). Lookup: the enemy's own art, else its kind's, else the default.
 */

/** Fallbacks: one per boss type and endless tower type. */
const KIND: Record<EnemyKind, string> = {
  plain: "M5 19L17 7M14 6l3 1 1 3M19 19L7 7M10 6L7 7 6 10",
  brute: "M5 4h10v7H5zM15 7.5h4M10 11v10M7.5 21h5",
  bleeder:
    "M12 3C8 9 6 12 6 15a6 6 0 0 0 12 0c0-3-2-6-6-12zM9.5 15.5A2.5 2.5 0 0 0 12 18",
  timer: "M6 3h12M6 21h12M7 3v3l5 6-5 6v3M17 3v3l-5 6 5 6v3",
  mixed: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 3v18M4 12h16",
  sentinel: "M7 21V8h2V5h2v3h2V5h2v3h2v13M5 21h14M12 12.5v4M10 19h4",
  stalker:
    "M6 4c2 6 2 10 0 16M12 4c2 6 2 10 0 16M18 4c2 6 2 10 0 16M4 21h.01M10 22h.01M16 21h.01",
  warden: "M6 21v-8a6 6 0 0 1 12 0v8zM6 8L3 3M18 8l3-5M9 14h6",
  regular: "M12 3l9 9-9 9-9-9zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
};

/** Enemies with their own art, by id. Anything missing falls back to its kind. */
export const OWN_ART: Record<string, string> = {
  // Chapter bosses
  "warden-kell":
    "M4 21V11a8 8 0 0 1 16 0v10zM4 21h16M12 3v5M8 21V10.5M16 21V10.5M9 15.5h6V20H9zM10 15.5V14a2 2 0 0 1 4 0v1.5M12 17v1.5",
  "cinder-abbot":
    "M12 1.5c2 2 3 3.5 3 5.2a3 3 0 0 1-6 0c0-1 .5-1.8 1.2-2.7.4.6.8.9 1.3.9.4-1 .5-2 .5-3.4zM5 22c0-6 1-10 7-10s7 4 7 10zM9 18a3 3.5 0 0 1 6 0M12 12v2.5M9 22v-2M15 22v-2",
  "mother-brine":
    "M2 16c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0c1.2 1.2 2 1.4 3.5.5M2 21c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0c1.2 1.2 2 1.4 3.5.5M5 12c0-5 4-9 9-9 3 0 5 2 5 4s-2 3-3.5 2.5c-1.2-.4-1.3-1.8-.3-2.5M5 12c2 1.2 4.5 1.2 7 0",
  "iron-prospector":
    "M3 10c1-5 5-7 9-7s8 2 9 7c-3-3-6-3.5-9-3.5S6 7 3 10zM12 6.5V21M10.5 17h3M10.5 19h3M17 17l2-2 2 2-2 3z",
  "king-molar":
    "M7 5l1-3 2 2 2-3 2 3 2-2 1 3M7 8c0-2 1.5-3 3-3 1 0 1.5.5 2 .5s1-.5 2-.5c1.5 0 3 1 3 3 0 4-1.5 6-2 9l-.5 5c-1 0-2-1-2.5-4l-.5-3-.5 3c-.5 3-1.5 4-2.5 4l-.5-5C8.5 14 7 12 7 8z",
  // Weekly bosses
  ironmaw:
    "M3 12C3 6 8 3 14 3c3 0 5 1 7 3M4 11l3-.7 1.3 4.2L10 9.9l2-.5 1.3 4.1L15 9l2-.5 1.2 3.5L19.5 8l1.5-.5M4 13l5 1.5 1.3-3.5 1.2 4 2.5.8 1.3-3.3 1.2 3.7 1.5.5 1-2.7 1 3.2 1 .3M3 12c0 6 5 9 11 9 3 0 5-1 7-4M5 12h.01M13 6h.01",
  grond:
    "M6 12V8.5a1.8 1.8 0 0 1 3.5 0V8a1.8 1.8 0 0 1 3.5 0 1.8 1.8 0 0 1 3.5 0v.5a1.8 1.8 0 0 1 3.5 0V15c0 3-2 5-5 5H12c-2.5 0-4-1.5-5-3.5L5 13.5A1.8 1.8 0 0 1 8 12zM9.5 8.5V12M13 8V12M16.5 8.5V12M8 22h9M3 3l2 2M21 3l-2 2M12 1v2",
  vexa: "M2 19h20M5 19c1-2 3-3 7-3s6 1 7 3M8 16c1-5 2-9 4-13 1.5 4 3 8 4 13M8.7 13h6.6M10.5 16v-1.5h3V16M12 3c2-1.5 4 0 4 2",
  stoneback:
    "M3 21l1-9 4-6 5-3 5 3 4 6 1 9zM8 6l2 6M18 6l-3 6M4 12l4 1M21 12l-4 1M7 12.5h4M13 12.5h4M8 15h2M14 15h2M10 18h4M19 1.5h3l-3 3h3",
  "marrow-queen":
    "M6 8l1-5 3 3 2-4 2 4 3-3 1 5zM6 8h12M7 9.5v3.5c0 1 1 2 2 2.5V19h6v-3.5c1-.5 2-1.5 2-2.5V9.5M10.7 12.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM15.7 12.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM11 17v2M13 17v2M12 14.5l-.7 1.2h1.4z",
  "iron-choir":
    "M5 18c0-6 1-10 7-10s7 4 7 10zM3.5 18h17M12 8V5M10.5 5h3M9.5 20.5a2.5 2.5 0 0 0 5 0M8 14h8M2 8c-1 2-1 4 0 6M22 8c1 2 1 4 0 6",
  rattlefang:
    "M3 4h18M5 4c0 6 2 11 4 15 .7-4 1-9 1-15M14 4c0 6 .3 11 1 15 2-4 4-9 4-15",
  gutterking:
    "M12 1.5l2.5 3.5v10h-5V5zM12 5v9M6.5 15h11M10.5 15v4.5h3V15M11 19.5v1.5h2v-1.5M5 5v2M19 8v2M4 11v1.5",
  halvard:
    "M12 5.5a2.2 2.2 0 1 0 .01 0M12 7.7V21M8 11h8M4 15c0 4 3.5 6 8 6s8-2 8-6M2.5 17l1.5-2 2 1.5M21.5 17l-1.5-2-2 1.5",
  "sister-ash":
    "M4 22c0-9 2-18 8-18s8 9 8 18zM8.5 13.5v-2a3.5 3.5 0 0 1 7 0v2zM8.5 13.5h7M12 16.5v4.5M10.2 18.3h3.6M3 6l1 1M20 5l-1 1M19 10h2",
  "quarry-titan":
    "M5 17V7l3-3 3 1.5L14 3l3 2.5 2 3.5v8zM8 10h2M13 10h2M10 14h4M5 12.5h3M16 6l-2 2.5M7 17v4h3v-4M14 17v4h3v-4",
  "pale-coach":
    "M4 15V7c0-2 1-3 3-3h10c2 0 3 1 3 3v8zM2 15h20M7 7h4v4H7zM13 7h4v4h-4zM9 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6 17v4M4 19h4M18 17v4M16 19h4M21.5 4v3",
  "gatewatch-brann":
    "M6 21V11a6 6 0 0 1 12 0v10zM6 12h12M12 12v9M8.5 15.5H10M14 15.5h1.5M12 5V2M12 2c2 0 3 1 3 2.5",
  mossjaw:
    "M2 8h14c3 0 5 2 6 4H2zM2 16h14c3 0 5-1 6-3M4 12v2.5L5.5 13 7 15l1.5-2L10 15.5l1.5-2.5 1.5 2.5M5 8V5.5M9 8V5M13 8V6M17.5 10.2a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z",
  tallow:
    "M9 8h6v13H9zM12 8V6M12 1.5c1.5 1.5 2.5 2.5 2.5 3.5a2.5 2.5 0 0 1-5 0c0-1 1-2 2.5-3.5zM9 12c-1.5 1-1.5 3 0 4M15 14c1.2 1 1.2 3 0 4M7 21.5h10",
  "anvil-sow":
    "M3 7h13l5 2.5-1 2-4 .5-2 2.5V17h2v3H8v-3h2v-3L8 11H3zM18.5 9.5v.01M6 7v4",
  "kettle-hag":
    "M5 10h14l-1 8c0 2-2 3-4 3h-4c-2 0-4-1-4-3zM4 10h16M3 10l-1 3M21 10l1 3M9 9V3M12 9V4M15 9V3M7.5 5h3M10.5 6h3M13.5 5h3",
  "clockwork-duelist":
    "M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM18 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 4h4M12 4v5M6 9h12M6 9c0 2 2 2 2 0M18 9c0 2-2 2-2 0M11 9h2l-.3 11L12 22l-.7-2z",
  bonepile:
    "M6 10a6 6 0 0 1 12 0c0 2-1 3-2 3.5V16H8v-2.5C7 13 6 12 6 10zM10.8 10a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zM15.8 10a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zM10.5 16v-1.5M13.5 16v-1.5M3 19l18 3M3 22l18-3",
  "mire-saint":
    "M8 3.5a4 1.6 0 1 0 8 0 4 1.6 0 1 0-8 0zM15 9.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6 22c0-6 1-9.5 6-9.5s6 3.5 6 9.5zM4 12v2M20 14v2M9 22v-3M15 22v-2.5",
  "lantern-thief":
    "M9 5a3 3 0 0 1 6 0M8 5h8l1 3H7zM7 8h10v10H7zM7 18l-1 2h12l-1-2M12 10.5c1.5 1.5 2 2.5 2 3.5a2 2 0 0 1-4 0c0-1 .5-2 2-3.5z",
  "gravel-warden":
    "M6 21V8l3-3h6l3 3v13zM6 9h12M9.5 13a2.5 2.5 0 1 1 5 0c0 1-.7 1.7-1.5 2v2.5h-2V15c-.8-.3-1.5-1-1.5-2zM3 21h18M3 17h.01M21 18h.01",
  "splinter-abbess":
    "M12 2v6l-1.5 2 1.5 2v10M7 8h10M3 5l3 2M21 5l-3 2M4 14l3-1M20 14l-3-1M9 22h6",
  hookline: "M15 3v11a5 5 0 1 1-10 0v-2M5 12l-2 2.5M5 12l2 2.5M12.5 3h5",
  "copper-colossus":
    "M9 2h6v5H9zM10.5 4.5h3M4 10a3 3 0 0 1 5-2M20 10a3 3 0 0 0-5-2M8 8h8v8H8zM8 16l-1 6h3l1-6M16 16l1 6h-3l-1-6M8 9l-4 2v7h3M16 9l4 2v7h-3M12 10v5",
  "ninefold-viper":
    "M6 20h10c3 0 4-2 4-3.5S18 13 15 13H9c-3 0-4-2-4-3.5S7 6 10 6h4M14 4h2c2 0 3 1 3 2s-1 2-3 2h-2zM19 6h2.5M21.5 6l1-1M21.5 6l1 1M16 5.5h.01M6 20c-2 0-3-1-3-2",
  "dusk-courier":
    "M6 11a6 6 0 0 1 12 0M3 11h18M12 2v2M4.5 5L6 6.5M19.5 5L18 6.5M6 14h12v7H6zM6 14l6 4.5 6-4.5",
  "barrow-knight": "M2 21c1-5 4-8 10-8s9 3 10 8zM12 2v14M9 6h6M11 16h2",
  "weeping-plate":
    "M7 3l5 2 5-2 4 4-2 5v9H5v-9L3 7zM12 5v5M12 12c-1.5 2-2 3-2 4a2 2 0 0 0 4 0c0-1-.5-2-2-4z",
  thornmother:
    "M8 4c0 4 2 6 4 6s4-2 4-6c-1 1-2 1.5-2 1.5L12 3l-2 2.5S9 5 8 4zM12 10v12M12 13l-2-1M12 19l-2-1M12 17l2-1M12 15c-3 0-4-2-4-3 2 0 4 1 4 3zM12 20c3 0 4-2 4-3-2 0-4 1-4 3z",
  "quickstep-reaver":
    "M4 20L15 9c2-2 4-3 6-3-1 3-2 5-4 7L6 22M3 18l3 3M20 20L9 9C7 7 5 6 3 6c1 3 2 5 4 7l11 9M21 18l-3 3",
  "iron-abbot":
    "M12 1v3M7 10a5 5 0 0 1 10 0zM7 10h10l-1.5 5h-7zM9 12.5h6M10 15l-1 3h6l-1-3M9 21h6M12 6.5v.01",
  saltmarrow:
    "M12 3l4 2v5l-4 2-4-2V5zM8 5l4 2 4-2M12 7v5M5 14l3-1.5 3 1.5v4l-3 1.5L5 18zM13 17l3-1.5 3 1.5v3l-3 1.5-3-1.5z",
  "bell-tyrant":
    "M8 6l1-3 1.5 1.5L12 2l1.5 2.5L15 3l1 3zM6 17c0-5 1-9 6-9s6 4 6 9zM4.5 17h15M10 19.5a2 2 0 0 0 4 0",
  "glass-fencer":
    "M12 2l2 14h-4zM8 16h8M12 16v4M10 22h4M4 6l3 2M20 6l-3 2M5 12l2-1M19 12l-2-1M12 5l1 3-1.5 2 1.5 3",
  "rot-shepherd":
    "M9 22V8a5 5 0 1 1 10 0v1M6 22h6M17 15a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0zM20 18a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0zM15 19a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0z",
  "siege-ox":
    "M7 9C3 9 2 6 2 3M17 9c4 0 5-3 5-6M7 8h10c1 2 1 5 0 8l-2 3H9l-2-3c-1-3-1-6 0-8zM9 13h.01M15 13h.01M10 16h.01M14 16h.01M12 19v1.5M13.5 21.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  "ember-twins":
    "M7 2c2 2.5 3.5 5 3.5 8a3.5 3.5 0 0 1-7 0c0-1.5.7-2.5 1.5-3.7.5.6 1 .9 1.7.9C7 5.5 7 4 7 2zM17 2c2 2.5 3.5 5 3.5 8a3.5 3.5 0 0 1-7 0c0-1.5.7-2.5 1.5-3.7.5.6 1 .9 1.7.9C17 5.5 17 4 17 2zM3 17h8M13 17h8M5 20h4M15 20h4",
  "hollow-prior":
    "M3 8c3-1 6-1 9 1 3-2 6-2 9-1v8c-3-1-6-1-9 1-3-2-6-2-9-1zM12 9v8M12 17v4M8 21h8M6 11h3M15 11h3M6 13.5h3M15 13.5h3",
  "blackwater-leech":
    "M3 14c0-3 3-5 7-5h5c3 0 6 2 6 5s-3 5-6 5H9c-3 0-6-2-6-5zM9 9.3v9.4M13 9v10M17 9.5v9M6.5 14a1.5 1.5 0 1 1-3 0M19 21c.6.8 1 1.3 1 1.8a1 1 0 0 1-2 0c0-.5.4-1 1-1.8z",
  "last-gate":
    "M4 21V9a8 8 0 0 1 16 0v12zM4 14h16M8 3v18M12 1v20M16 3v18M7 21l1 2 1-2M11 21l1 2 1-2M15 21l1 2 1-2",
  "unbroken-throne":
    "M7 3h10v11H7zM7 8H4v6h3M17 8h3v6h-3M5 14h14v4H5zM7 18v3M17 18v3M9 3V1.5M12 3V1M15 3V1.5M12 6l2 2-2 2-2-2z",
  "rust-rat":
    "M4 16c0-4 3-6 7-6 3 0 5 1 7 3l3 1-3 2c-1 2-4 3-8 3-3 0-6-1-6-3zM15 9a2 2 0 1 1 3.5 1.5M18.5 13.5v.01M4 16C1 15 1 19 4 20",
  "gate-guard":
    "M4 14a6 6 0 1 0 12 0 6 6 0 0 0-12 0zM10 8v12M4 14h12M19 3v18M17.5 6L19 3l1.5 3",
  "scrap-hound":
    "M7 6C4 5 3 8 3 12c0 1 1 2 2 1l2-3M17 6c3-1 4 2 4 6 0 1-1 2-2 1l-2-3M7 6c1-2 4-3 5-3s4 1 5 3v8c0 3-2 6-5 6s-5-3-5-6zM9.5 10h.01M14.5 10h.01M9.5 15h5l-1 2h-3zM12 12v3",
  "ash-imp":
    "M7 7L5 2M17 7l2-5M6 10c0-3 2.5-5 6-5s6 2 6 5v3c0 4-3 7-6 7s-6-3-6-7zM6 10l-3-2 1 4M18 10l3-2-1 4M8.5 11l2 1M15.5 11l-2 1M9 16l1.5 1.5L12 16l1.5 1.5L15 16M20 21h.01M4 20h.01",
  "cinder-monk":
    "M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM5 22c0-6 2-10 7-10s7 4 7 10zM12 14c1 1 1.6 2 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.6-1.8 1.6-2.8zM9.5 19.5h5",
  "ember-hound":
    "M2 9l3 3h8l2-4h4l3 3v2l-4 1-1 7h-2l-1-6H8l-1 6H5l-1-8M14 8l1-3 2 3M19 11h.01M2 9c-1-2 0-4 2-5 0 1 1 2 1 3",
  "bog-lurker":
    "M11 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM17 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2 14c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0 3 1.5 5 0M5 18c2-1 4-1 6 0s4 1 6 0M3 14V4M21 14V5M4.5 14V8",
  "drowned-squire":
    "M7 20V9a5 5 0 0 1 10 0v11zM7 11h10M12 11v4M9 14h.01M15 14h.01M5 20c-1-3 1-4 0-7M19 20c1-3-1-4 0-7M10 22v-1.5M14 22v-2",
  "eel-swarm":
    "M2 6l2.5-2L7 6l-2.5 2zM7 6c3-3 5 3 8 0s4-1 6 0M2 12l2.5-2L7 12l-2.5 2zM7 12c3-3 5 3 8 0s4-1 6 0M2 18l2.5-2L7 18l-2.5 2zM7 18c3-3 5 3 8 0s4-1 6 0",
  "scrap-golem":
    "M8 3h8v5H8zM12 3V1M10 5.5h1M13.5 5.5h1M12 8v1M6 9h12v8H6zM14 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6 10H3v6M18 10l3 3-2 3M8 17v4M16 17v4M7 21h2M15 21h2",
  "waste-rider":
    "M9 18a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM23 18a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM5 18l5-8h5l4 8M10 10l-1-3H7M15 10l1-4h3",
  "rail-wraith":
    "M6 18V9a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10.5 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM15.5 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2 23l5-3M22 23l-5-3M5 21.5h14",
  "tooth-knight":
    "M6 4c2-1 4 0 6 0s4-1 6 0c1 5-1 8-2 11l-1 6c-1 0-2-1-2.5-5L12 12l-.5 4c-.5 4-1.5 5-2.5 5l-1-6C7 12 5 9 6 4zM8 8h8M12 8v3M12 4V1",
  "bone-herald": "M2 10h6l10-5v14L8 14H2zM18 8c2 1 3 2.5 3 4s-1 3-3 4M5 14v4h3",
  "grave-hound":
    "M7 12V7L4 3l1 6M17 12V7l3-4-1 6M7 7c1-2 3-3 5-3s4 1 5 3v5M9.5 8h.01M14.5 8h.01M11 10h2l-1 1.5zM5 22v-5a7 7 0 0 1 14 0v5zM12 15v4M10.5 16.5h3",
};

/** The enemy's icon in the current text color. Decorative: its name is always beside it. */
export function EnemyIcon({
  name,
  size = 40,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const enemy = enemyByName(name);
  const d = (enemy && OWN_ART[enemy.id]) || KIND[enemy?.kind ?? "regular"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-rpg-text-2 ${className}`}
      data-enemy-icon={enemy?.id ?? "default"}
    >
      <path d={d} />
    </svg>
  );
}
