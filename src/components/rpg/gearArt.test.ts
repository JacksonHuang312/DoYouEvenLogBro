import { describe, expect, it } from "vitest";
import { ITEMS } from "@/lib/game/catalogData";
import { LEVEL_BANDS } from "@/lib/game/config";
import { ACCESSORY_ART } from "./accessoryArt";
import { BAND_ART, CLASS_ART, PIECE_TYPES, UNIQUE_ART, bandOfLevel, gearArt } from "./gearArt";
import { WEAPON_ART } from "./weaponArt";

describe("gear art", () => {
  it("draws every band for each piece type it covers, with no empty layers", () => {
    const sets = { loose: BAND_ART, accessory: ACCESSORY_ART, weapon: WEAPON_ART, ...Object.fromEntries(Object.entries(CLASS_ART).map(([c, v]) => [c, v!.art])) };
    for (const [set, pieces] of Object.entries(sets)) {
      for (const [piece, bands] of Object.entries(pieces)) {
        expect(PIECE_TYPES, piece).toContain(piece);
        for (const b of LEVEL_BANDS) {
          expect(bands[b].length, `${set} ${piece} ${b}`).toBeGreaterThan(3);
          for (const [tone, d] of bands[b]) {
            expect("bsmtakhledp".includes(tone), `${set} ${piece} ${b} tone ${tone}`).toBe(true);
            expect(d, `${set} ${piece} ${b}`).toMatch(/^M/);
          }
        }
      }
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
    expect(gearArt({ slot: "ring", itemLevel: 45 })?.source).toBe("accessory:ring:40");
    expect(gearArt({ slot: "weapon", weapon: "staff", itemLevel: 45 })).toBeNull();
  });
});
