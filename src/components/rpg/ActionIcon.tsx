import type { ActionIconId } from "@/lib/game/battleView";

/** Flat line-art for a fight action (24×24, one stroke, GAME_DESIGN.md 7.1), drawn like the enemy icons. */
const PATHS: Record<ActionIconId, string> = {
  slash: "M19 5L8 16M19 5h-4M19 5v4M6 14l4 4M4 20l3-3",
  guard: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4",
  powerStrike: "M13 2L5 14h6l-2 8 10-13h-7z",
  mend: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z",
  bastion: "M5 21V7h3v2h2V7h4v2h2V7h3v14zM10 21v-4a2 2 0 0 1 4 0v4M5 12h14",
  execution: "M6 21L14 5M14 5c3-3 7-2 7 2-3 1-5 1-7 3zM12 9c2 0 3 .5 4 1.5",
  radiance:
    "M12 8a4 4 0 1 0 .01 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  claw: "M6 4c2 6 2 10 0 16M12 4c2 6 2 10 0 16M18 4c2 6 2 10 0 16",
  heavy: "M5 4h10v7H5zM15 7.5h4M10 11v10M7.5 21h5",
};

export function ActionIcon({
  id,
  size = 24,
  className = "",
}: {
  id: ActionIconId;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
