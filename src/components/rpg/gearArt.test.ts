import { describe, expect, it } from "vitest";
import { LEVEL_BANDS } from "@/lib/game/config";
import { PALETTE, PIECE_TYPES, PLACEHOLDER_LAYERS, bandOfLevel, gearArt } from "./gearArt";

describe("gear art (placeholder)", () => {
  it("has one valid placeholder picture and a palette for every band", () => {
    expect(PLACEHOLDER_LAYERS.length).toBeGreaterThan(3);
    for (const [tone, d] of PLACEHOLDER_LAYERS) {
      expect("bsmtakhledp".includes(tone), `tone ${tone}`).toBe(true);
      expect(d).toMatch(/^M/);
    }
    for (const b of LEVEL_BANDS) expect(PALETTE[b], `band ${b}`).toBeDefined();
  });

  it("looks the band up from the item's level, or from the named item's own band", () => {
    expect(bandOfLevel(19)).toBe(1);
    expect(bandOfLevel(20)).toBe(20);
    expect(bandOfLevel(100)).toBe(80);
    expect(gearArt({ slot: "helmet", itemLevel: 45 })?.source).toBe("placeholder:helmet:40");
    expect(gearArt({ slot: "ring", itemLevel: 45 })?.source).toBe("placeholder:ring:40");
    expect(gearArt({ slot: "weapon", weapon: "staff", itemLevel: 45 })?.source).toBe("placeholder:staff:40");
    // The views pass a display label as `weapon`; the base id decides the type.
    expect(gearArt({ slot: "weapon", weapon: "Staff · Cleric weapon (+10% power)", baseId: "moonwood-staff", itemLevel: 37 })?.source).toBe("placeholder:staff:40");
    // Named items keep their own band at any level; loose armor follows the level.
    expect(gearArt({ slot: "helmet", baseId: "steelguard-helmet", itemLevel: 63 })?.source).toBe("placeholder:helmet:20");
    expect(gearArt({ slot: "helmet", baseId: "ironbound-helmet", itemLevel: 63 })?.source).toBe("placeholder:helmet:60");
  });

  it("falls back to the plain slot icon for a weapon of no known type", () => {
    expect(gearArt({ slot: "weapon", itemLevel: 45 })).toBeNull();
    expect(gearArt({ slot: "weapon", weapon: "Sword · Striker weapon", itemLevel: 40 })).toBeNull();
    expect(PIECE_TYPES).toContain("helmet");
  });
});
