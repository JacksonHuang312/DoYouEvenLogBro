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
  "warden-kell":
    "M4 21V11a8 8 0 0 1 16 0v10zM12 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 15v3",
  "cinder-abbot":
    "M12 2c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-5 1 1 1.5 2 2.5 2C12 6 12 4 12 2zM6 21h12M8 21l1-4h6l1 4",
  "mother-brine":
    "M2 7c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0c1.5-1.5 3-1.8 6 0M2 12c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0c1.5-1.5 3-1.8 6 0M2 17c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0c1.5-1.5 3-1.8 6 0",
  "iron-prospector": "M4 8c2-4 14-4 16 0M4 8l2 1M20 8l-2 1M12 5v16M9 21h6",
  "king-molar":
    "M6 4c2-1 4 0 6 0s4-1 6 0c1 5-1 8-2 11l-1 6c-1 0-2-1-2.5-5L12 12l-.5 4c-.5 4-1.5 5-2.5 5l-1-6C7 12 5 9 6 4z",
  // Weekly bosses
  ironmaw:
    "M3 11c3-5 15-5 18 0M3 11l2.5 4L8 11l2 4 2-4 2 4 2-4 2.5 4L21 11M5 20c4 2 10 2 14 0",
  grond:
    "M7 11V7a2 2 0 0 1 4 0V6a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v7c0 4-3 7-7 7s-6-2-7-5l-2-3a2 2 0 0 1 3-2zM11 8v3M15 8v3",
  vexa: "M3 19h18M7 19c1-5 3-9 6-15 1 4 3 9 4 15M8.5 15h7",
  stoneback: "M2 20l6-10 4 5 3-7 7 12zM8 10l2 3M15 8l-1 3",
  "marrow-queen":
    "M5 5a1.5 1.5 0 1 1 2.5 2L17 16.5a1.5 1.5 0 1 1 1.5 2.5 1.5 1.5 0 0 1-2.5-1.5L7 8A1.5 1.5 0 0 1 5 5zM19 5a1.5 1.5 0 1 0-2.5 2L7 16.5A1.5 1.5 0 1 0 5.5 19 1.5 1.5 0 0 0 8 17.5L17 8A1.5 1.5 0 0 0 19 5z",
  "iron-choir": "M5 17c0-5 1-9 7-9s7 4 7 9zM4 17h16M12 4v4M10 20a2 2 0 0 0 4 0",
  rattlefang: "M6 4h12l-2 7-4 10-4-10zM2 8h2M2 12h2",
  gutterking: "M12 2l3 4v9H9V6zM7 15h10M12 15v7",
  halvard: "M12 4v.01M12 6v15M7 11h10M4 15c0 4 3 6 8 6s8-2 8-6",
  "sister-ash":
    "M5 21c0-10 2-18 7-18s7 8 7 18zM9 12a3 4 0 0 1 6 0v3a3 3 0 0 1-6 0z",
  "quarry-titan": "M4 21h16v-5H4zM6 16v-5h12v5M9 11V6h6v5",
  "pale-coach":
    "M3 15h18M5 15V8h10l3 4v3M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM19 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
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
