import type { Rarity, Slot } from "@/lib/game/config";
import { GearIcon } from "./GearIcon";
import { RARITY_TEXT } from "./rarity";

/**
 * A gear icon on its rarity tile (GAME_DESIGN.md 7.1, 13.15): a dark square glowing in the rarity colour,
 * with a thin border in it, and a few sparkles for Legendary and Mythic. `level` and `count` show as small
 * corner badges.
 */
export function ItemTile({
  slot,
  weapon,
  baseId,
  itemLevel,
  rarity,
  size = 48,
  level,
  count,
  empty = false,
  className = "",
}: {
  slot: Slot;
  weapon?: string | null;
  baseId?: string;
  itemLevel?: number;
  rarity: Rarity;
  size?: number;
  level?: number;
  count?: number;
  /** An empty slot: no item, a dim tile. */
  empty?: boolean;
  className?: string;
}) {
  const sparkle = !empty && (rarity === "legendary" || rarity === "mythic");
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${empty ? "text-rpg-muted" : RARITY_TEXT[rarity]} ${className}`}
      style={{
        width: size,
        height: size,
        background: empty
          ? "#0e0f11"
          : "radial-gradient(circle at 50% 36%, color-mix(in srgb, currentColor 46%, #0c0d10) 0%, #0c0d10 80%)",
        border: `1px solid color-mix(in srgb, currentColor ${empty ? 35 : 75}%, transparent)`,
        boxShadow: empty
          ? "none"
          : "inset 0 0 10px color-mix(in srgb, currentColor 30%, transparent), 0 0 8px color-mix(in srgb, currentColor 24%, transparent)",
      }}
      data-item-tile={empty ? "empty" : rarity}
    >
      <span className={empty ? "opacity-50" : ""}>
        <GearIcon slot={slot} weapon={weapon} baseId={baseId} itemLevel={empty ? undefined : itemLevel} size={Math.round(size * 0.78)} />
      </span>
      {sparkle && (
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" fill="currentColor">
          <path d="M3.5 3.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7zM20 15l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" />
        </svg>
      )}
      {level != null && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-rpg-bg px-1 text-[9px] font-semibold leading-tight text-rpg-text-2 ring-1 ring-rpg-line">
          Lv {level}
        </span>
      )}
      {count != null && count > 1 && (
        <span className="absolute -right-1 -top-1 bg-rpg-bg px-1 text-[10px] font-semibold leading-tight text-rpg-text ring-1 ring-rpg-line">
          ×{count}
        </span>
      )}
    </span>
  );
}
