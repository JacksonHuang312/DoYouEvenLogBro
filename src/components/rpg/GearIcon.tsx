import type { Slot } from "@/lib/game/config";
import { gearArt, type Palette, type Tone } from "./gearArt";
import { SlotIcon } from "./SlotIcon";

const OUTLINE = "#1a130d";

/** Paint for each tone: fill, stroke, and any extra attributes. */
function paint(tone: Tone, p: Palette, key: string): React.SVGProps<SVGPathElement> {
  const edge = { stroke: OUTLINE, strokeOpacity: 0.95, strokeWidth: 0.8 };
  switch (tone) {
    case "b": return { fill: `url(#gear-grad-${key})`, ...edge };
    case "s": return { fill: p.dark, ...edge };
    case "m": return { fill: p.light, ...edge };
    case "t": return { fill: p.trim, ...edge };
    case "a": return { fill: "currentColor", ...edge };
    case "k": return { fill: "#0a0809" };
    case "h": return { fill: "url(#gear-gloss)" };
    case "l": return { fill: "none", stroke: OUTLINE, strokeOpacity: 0.65, strokeWidth: 0.5 };
    case "e": return { fill: "none", stroke: p.light, strokeOpacity: 0.75, strokeWidth: 0.4 };
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
  const p = art.palette;
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
        <linearGradient id={`gear-grad-${art.key}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.3" stopColor={p.base} />
          <stop offset="0.75" stopColor={p.base} stopOpacity="0.85" />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
        <radialGradient id="gear-vol" cx="0.42" cy="0.35" r="0.75">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#0b0705" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="gear-gloss" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {art.layers.map(([tone, d, mirror], i) => (
        <g key={i}>
          {[false, ...(mirror ? [true] : [])].map((flip) => (
            <g key={String(flip)} transform={flip ? "translate(24 0) scale(-1 1)" : undefined}>
              <path d={d} {...paint(tone, p, art.key)} />
              {(tone === "b" || tone === "m" || tone === "s") && <path d={d} fill="url(#gear-vol)" />}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}
