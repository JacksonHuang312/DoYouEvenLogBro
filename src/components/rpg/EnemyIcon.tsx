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
  sentinel: "M8 21V8l4-5 4 5v13zM5 21h14M12 11v5",
  stalker: "M6 4c2 6 2 10 0 16M12 4c2 6 2 10 0 16M18 4c2 6 2 10 0 16",
  warden: "M6 21v-8a6 6 0 0 1 12 0v8zM6 8L3 3M18 8l3-5M9 14h6",
  regular: "M12 3l9 9-9 9-9-9zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
};

/** Enemies with their own art, by id. Anything missing falls back to its kind. */
export const OWN_ART: Record<string, string> = {
  // Chapter bosses
  "warden-kell": "M4 21V11a8 8 0 0 1 16 0v10zM4 21h16M12 3v5M8 21V10.5M16 21V10.5M9 15.5h6V20H9zM10 15.5V14a2 2 0 0 1 4 0v1.5M12 17v1.5",
  "cinder-abbot": "M12 1.5c2 2 3 3.5 3 5.2a3 3 0 0 1-6 0c0-1 .5-1.8 1.2-2.7.4.6.8.9 1.3.9.4-1 .5-2 .5-3.4zM5 22c0-6 1-10 7-10s7 4 7 10zM9 18a3 3.5 0 0 1 6 0M12 12v2.5M9 22v-2M15 22v-2",
  "mother-brine": "M2 16c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0c1.2 1.2 2 1.4 3.5.5M2 21c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0c1.2 1.2 2 1.4 3.5.5M5 12c0-5 4-9 9-9 3 0 5 2 5 4s-2 3-3.5 2.5c-1.2-.4-1.3-1.8-.3-2.5M5 12c2 1.2 4.5 1.2 7 0",
  "iron-prospector": "M3 10c1-5 5-7 9-7s8 2 9 7c-3-3-6-3.5-9-3.5S6 7 3 10zM12 6.5V21M10 21h4M10.5 12h3M10.5 15h3M10.5 18h3M17 17l2-2 2 2-2 3z",
  "king-molar": "M7 5l1-3 2 2 2-3 2 3 2-2 1 3M7 8c0-2 1.5-3 3-3 1 0 1.5.5 2 .5s1-.5 2-.5c1.5 0 3 1 3 3 0 4-1.5 6-2 9l-.5 5c-1 0-2-1-2.5-4l-.5-3-.5 3c-.5 3-1.5 4-2.5 4l-.5-5C8.5 14 7 12 7 8z",
  // Weekly bosses
  ironmaw: "M2 10c3-5 17-5 20 0l-2.5 4.5-2-5-2 6-2-5.5-2 6-2-5.5-2 6-2-5-2.5 4.5zM3 15c3 7 15 7 18 0M5.5 15.5l1.5 3 2-3M16.5 15.5l1.5 3 1.5-2.5",
  grond: "M6 12V8.5a1.8 1.8 0 0 1 3.5 0V8a1.8 1.8 0 0 1 3.5 0 1.8 1.8 0 0 1 3.5 0v.5a1.8 1.8 0 0 1 3.5 0V15c0 3-2 5-5 5H12c-2.5 0-4-1.5-5-3.5L5 13.5A1.8 1.8 0 0 1 8 12zM9.5 8.5V12M13 8V12M16.5 8.5V12M8 22h9M3 3l2 2M21 3l-2 2M12 1v2",
  vexa: "M2 19h20M5 19c1-2 3-3 7-3s6 1 7 3M8 16c1-5 2-9 4-13 1.5 4 3 8 4 13M8.7 13h6.6M10.5 16v-1.5h3V16M12 3c2-1.5 4 0 4 2",
  stoneback: "M2 19c0-3 2-5 4-6l2-5 3 3 3-6 3 5 3-2 3 4c1 2 2 4 2 7zM2 19h20M8 8l1 4M12 5l-.5 5M15 8l1 3M6 13l3 1M18 12l-2 2",
  "marrow-queen": "M6 8l1-5 3 3 2-4 2 4 3-3 1 5zM6 8h12M7 9.5v3.5c0 1 1 2 2 2.5V19h6v-3.5c1-.5 2-1.5 2-2.5V9.5M10.7 12.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM15.7 12.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM11 17v2M13 17v2M12 14.5l-.7 1.2h1.4z",
  "iron-choir": "M5 18c0-6 1-10 7-10s7 4 7 10zM3.5 18h17M12 8V5M10.5 5h3M9.5 20.5a2.5 2.5 0 0 0 5 0M8 14h8M2 8c-1 2-1 4 0 6M22 8c1 2 1 4 0 6",
  rattlefang: "M7 3c3 1 7 1 10 0-.5 6-2 11-5 18C9 14 7.5 9 7 3zM9 5.5c1 .4 2 .5 3 .5M2 7h3M1 11h4M2 15h3M19 8l2 1M19 12l2 .5",
  gutterking: "M12 1.5l2.5 3.5v10h-5V5zM12 5v9M6.5 15h11M10.5 15v4.5h3V15M11 19.5v1.5h2v-1.5M5 5v2M19 8v2M4 11v1.5",
  halvard: "M12 5.5a2.2 2.2 0 1 0 .01 0M12 7.7V21M8 11h8M4 15c0 4 3.5 6 8 6s8-2 8-6M2.5 17l1.5-2 2 1.5M21.5 17l-1.5-2-2 1.5",
  "sister-ash": "M4 22c0-9 2-18 8-18s8 9 8 18zM8.5 13a3.5 4.5 0 0 1 7 0v2a3.5 4 0 0 1-7 0zM12 18v3.5M10.5 19.5h3M3 6l1 1M20 5l-1 1M19 10h2",
  "quarry-titan": "M3 21h18v-6H3zM5 15V9h14v6M8 9V4h8v5M10 6.5h1M13 6.5h1M9 12h6M7 18v3M12 15v3M12 18h-5M17 18v3",
  "pale-coach": "M3 16V8h13l4 4v4M3 8V5.5C3 4.5 4 4 5 4h9c1 0 2 .5 2 1.5V8M7 8v8M12 8v8M10 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM7 16v6M4 19h6M17 16v6M14 19h6",
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
