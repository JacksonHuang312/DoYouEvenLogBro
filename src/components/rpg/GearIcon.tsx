import type { Slot } from "@/lib/game/config";
import { gearArt } from "./gearArt";
import { SlotIcon } from "./SlotIcon";

/**
 * An item's icon in the current text color: pass the rarity's text class as `className`. Own art by id, else
 * its piece type and level band, else the plain slot icon (GAME_DESIGN.md 13.15).
 */
export function GearIcon({
  slot,
  weapon,
  baseId,
  itemLevel,
  size = 28,
  className = "",
}: {
  slot: Slot;
  weapon?: string | null;
  baseId?: string;
  itemLevel?: number;
  size?: number;
  className?: string;
}) {
  const art = gearArt({ slot, weapon, baseId, itemLevel });
  if (!art) return <SlotIcon slot={slot} size={size} className={className} />;
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
      className={`shrink-0 ${className}`}
      data-gear-icon={art.source}
    >
      <path d={art.d} />
    </svg>
  );
}
