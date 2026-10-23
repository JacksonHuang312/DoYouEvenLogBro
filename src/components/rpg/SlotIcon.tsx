import type { Slot } from "@/lib/game/config";

/** Flat line-art path per slot (24×24), from design/Gear.dc.html. */
const PATHS: Record<Slot, string> = {
  helmet: "M5 13a7 7 0 0 1 14 0v5H5zM12 6v12M5 14h5M14 14h5M8 4l4-2 4 2",
  chestplate: "M8 3l4 2 4-2 4 3-2 5v10H6V11L4 6zM12 5v16M8 11h8",
  gloves: "M7 21v-6l-2-4V6.5a1.5 1.5 0 0 1 3 0V10M8 10V4.5a1.5 1.5 0 0 1 3 0V10M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4",
  leggings: "M7 3h10l1 7-2 11h-3l-1-9-1 9H8L6 10zM7 7h10",
  boots: "M8 3h5v9l6 3a2 2 0 0 1 1 1.8V19H5v-3l3-2zM5 19v2h15v-2",
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
