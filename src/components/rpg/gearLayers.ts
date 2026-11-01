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
/** A tone, a path, and whether to draw the path mirrored left to right as well (a "*" after the tone), and an optional transform for the whole picture (a first line "@rotate 45"). */
export type Layer = readonly [Tone, string, boolean?, string?];

/** One layer per line: a tone (add "*" to mirror it across the middle), a space, then the path. */
export const art = (s: string): Layer[] => {
  const lines = s.trim().split(/\r?\n/).map((l) => l.trim());
  const rotate = lines[0].startsWith("@rotate ") ? `rotate(${lines.shift()!.slice(8)} 12 12)` : undefined;
  return lines.map((line) => {
    const at = line.indexOf(" ");
    const raw = line.slice(0, at);
    return [raw.replace("*", "") as Tone, line.slice(at + 1), raw.includes("*"), rotate] as const;
  });
};

export interface Palette {
  light: string;
  base: string;
  dark: string;
  trim: string;
}

export type PieceArt = Partial<Record<PieceType, Record<Band, Layer[]>>>;
