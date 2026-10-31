import { describe, expect, it } from "vitest";
import { ITEMS } from "@/lib/game/catalogData";
import { LEVEL_BANDS } from "@/lib/game/config";
import { BAND_ART, PIECE_TYPES, UNIQUE_ART, bandOfLevel, gearArt } from "./gearArt";

describe("gear art", () => {
  it("draws every band for each piece type it covers", () => {
    for (const [piece, bands] of Object.entries(BAND_ART)) {
      expect(PIECE_TYPES, piece).toContain(piece);
      for (const b of LEVEL_BANDS) expect(bands[b], `${piece} ${b}`).toBeTruthy();
    }
  });

  it("only has unique art for Mythics that exist", () => {
    const mythics = new Set(ITEMS.filter((i) => i.mythic).map((i) => i.id));
    for (const id of Object.keys(UNIQUE_ART)) expect(mythics.has(id), id).toBe(true);
  });

  it("looks art up by id, then by piece type and the item's level band", () => {
    expect(bandOfLevel(19)).toBe(1);
    expect(bandOfLevel(20)).toBe(20);
    expect(bandOfLevel(100)).toBe(80);
    expect(gearArt({ slot: "helmet", itemLevel: 45 })?.source).toBe("shared:helmet:40");
    expect(gearArt({ slot: "weapon", itemLevel: 45 })).toBeNull();
    expect(gearArt({ slot: "ring", itemLevel: 45 })).toBeNull();
  });
});
