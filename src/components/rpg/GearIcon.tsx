import type { Slot } from "@/lib/game/config";
import { PALETTE, gearArt, type Palette, type Tone } from "./gearArt";
import { SlotIcon } from "./SlotIcon";

const OUTLINE = "#120e0a";

/** Paint for each tone: fill, stroke, and any extra attributes. */
function paint(tone: Tone, p: Palette, band: number): React.SVGProps<SVGPathElement> {
  const edge = { stroke: OUTLINE, strokeWidth: 0.7 };
  switch (tone) {
    case "b": return { fill: `url(#gear-grad-${band})`, ...edge };
    case "s": return { fill: p.dark, ...edge };
    case "m": return { fill: p.light, ...edge };
    case "t": return { fill: p.trim, ...edge };
    case "a": return { fill: "currentColor", ...edge };
    case "k": return { fill: "#0a0809" };
    case "h": return { fill: "#ffffff", fillOpacity: 0.28 };
    case "l": return { fill: "none", stroke: OUTLINE, strokeOpacity: 0.75, strokeWidth: 0.55 };
    case "e": return { fill: "none", stroke: p.light, strokeOpacity: 0.7, strokeWidth: 0.5 };
    case "d": return { fill: "none", stroke: p.dark, strokeWidth: 1.1 };
    case "p": return { fill: "none", stroke: p.trim, strokeWidth: 1.1 };
  }
}

/**
 * An item's icon: filled, shaded art by its own id, else its piece type and level band, else the plain
 * slot icon (GAME_DESIGN.md 13.15). The rarity shows through `className`'s text colour (the accent layer,
 * and the whole icon when it falls back to the slot icon); put it on an ItemTile for the rarity tile.
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
  const p = PALETTE[art.band];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      data-gear-icon={art.source}
    >
      <defs>
        <linearGradient id={`gear-grad-${art.band}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.5" stopColor={p.base} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
      </defs>
      {art.layers.map(([tone, d], i) => (
        <path key={i} d={d} {...paint(tone, p, art.band)} />
      ))}
    </svg>
  );
}
