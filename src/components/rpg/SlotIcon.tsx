import type { Slot } from "@/lib/game/config";

/** Flat line-art path per slot (24×24), from design/Gear.dc.html. */
const PATHS: Record<Slot, string> = {
  helmet: "M5 13a7 7 0 0 1 14 0v5H5zM12 6v12M5 14h5M14 14h5M8 4l4-2 4 2",
  chestplate: "M8 3l4 2 4-2 4 3-2 5v10H6V11L4 6zM12 5v16M8 11h8",
  gloves: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4",
  leggings: "M7 3h10l1 7-2 11h-3l-1-9-1 9H8L6 10zM7 7h10",
  boots: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2",
  ring: "M6 15a6 6 0 1 0 12 0 6 6 0 0 0-12 0zM9.5 9.2L8 6l2-3h4l2 3-1.5 3.2M8 6h8",
  necklace: "M4 3c0 8 3.5 12 8 12s8-4 8-12M12 15v2M12 17l-2.5 2.5L12 23l2.5-3.5z",
  belt: "M2 9h20v6H2zM9 7.5h6v9H9zM12 10.5v3M18 12h1.5M4.5 12H6",
  charm: "M12 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 5.5V8M12 8l5 5-5 9-5-9zM7 13h10",
};

/** The slot's icon, drawn in the current text color: pass the rarity's text class as `className`. */
export function SlotIcon({ slot, size = 28, className = "" }: { slot: Slot; size?: number; className?: string }) {
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
    >
      <path d={PATHS[slot]} />
    </svg>
  );
}
