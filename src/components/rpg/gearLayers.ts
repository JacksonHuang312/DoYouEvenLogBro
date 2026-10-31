import type { LEVEL_BANDS, Slot, WeaponType } from "@/lib/game/config";

/** A piece type: an armor or accessory slot, or one of the three weapon types. */
export type PieceType = Exclude<Slot, "weapon"> | WeaponType;
export type Band = (typeof LEVEL_BANDS)[number];

/**
 * How a layer is painted:
 *   b body (the palette's shaded gradient)  s shadow  m light metal  t trim  a accent (the rarity colour)
 *   k cavity (near black)  h soft highlight  l dark detail line  e light detail line  d dark dots  p trim dots
 */
export type Tone = "b" | "s" | "m" | "t" | "a" | "k" | "h" | "l" | "e" | "d" | "p";
export type Layer = readonly [Tone, string];

/** One layer per line: a tone, a space, then the path. */
export const art = (s: string): Layer[] =>
  s
    .trim()
    .split("\n")
    .map((l) => {
      const line = l.trim();
      const at = line.indexOf(" ");
      return [line.slice(0, at) as Tone, line.slice(at + 1)] as const;
    });

export interface Palette {
  light: string;
  base: string;
  dark: string;
  trim: string;
}

export type PieceArt = Partial<Record<PieceType, Record<Band, Layer[]>>>;
