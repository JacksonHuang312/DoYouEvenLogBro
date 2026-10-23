import type { Rarity } from "@/lib/game/config";

/*
 * Class names by rarity. Written out in full (not built from the rarity) so Tailwind sees them.
 * Rarity color is meaning, not decoration (section 7.1): it appears on names, icons and borders only.
 */

export const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-rpg-common",
  uncommon: "text-rpg-uncommon",
  rare: "text-rpg-rare",
  epic: "text-rpg-epic",
  legendary: "text-rpg-legendary",
  mythic: "text-rpg-mythic",
};

export const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-rpg-common",
  uncommon: "border-rpg-uncommon",
  rare: "border-rpg-rare",
  epic: "border-rpg-epic",
  legendary: "border-rpg-legendary",
  mythic: "border-rpg-mythic",
};
