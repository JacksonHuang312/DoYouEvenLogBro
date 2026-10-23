import { describe, expect, test } from "vitest";
import { BASE_ITEMS, baseItem, SETS, setDef } from "./catalog";
import { ITEMS, SETS as SET_ENTRIES } from "./catalogData";
import { ACCESSORY_EFFECTS, ARMOR_SLOTS, ATTRIBUTES, NAMED_RARITIES, RARITIES, SLOTS, isAccessory, type Focus } from "./config";

/** The catalog rules (GAME_DESIGN.md 5 and 10). Add items in catalogData.ts and this test checks them. */

const validFocus = (f: Focus) => {
  const entries = Object.entries(f);
  return (
    entries.length > 0 &&
    entries.every(([k, v]) => (ATTRIBUTES as readonly string[]).includes(k) && Number.isInteger(v) && v > 0) &&
    entries.reduce((n, [, v]) => n + (v as number), 0) === 100
  );
};

describe("catalog entries", () => {
  test("ids are unique, slots and rarities are valid", () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(SLOTS, i.id).toContain(i.slot);
      expect(RARITIES, i.id).toContain(i.rarity);
      expect(i.name.trim(), i.id).not.toBe("");
    }
    expect(new Set(SET_ENTRIES.map((s) => s.id)).size).toBe(SET_ENTRIES.length);
  });

  test("every rarity has items, and Common and Uncommon have several per armor slot", () => {
    for (const r of RARITIES) expect(ITEMS.some((i) => i.rarity === r), r).toBe(true);
    for (const r of ["common", "uncommon"] as const) {
      for (const slot of ARMOR_SLOTS) {
        expect(ITEMS.filter((i) => i.rarity === r && i.slot === slot).length, `${r} ${slot}`).toBeGreaterThan(1);
      }
    }
  });

  test("focus is whole percents adding up to 100", () => {
    for (const i of ITEMS) if (i.focus) expect(validFocus(i.focus), i.id).toBe(true);
    for (const s of SET_ENTRIES) expect(validFocus(s.focus), s.id).toBe(true);
    for (const b of BASE_ITEMS) expect(validFocus(b.focus), b.id).toBe(true);
  });
});

describe("set rules", () => {
  test("only Rare, Epic and Legendary armor is in a set; Common, Uncommon, Mythic and accessories are loose", () => {
    for (const i of ITEMS) {
      if (!i.set) continue;
      expect(["rare", "epic", "legendary"], i.id).toContain(i.rarity);
      expect(isAccessory(i.slot), i.id).toBe(false);
    }
    for (const b of BASE_ITEMS) {
      if (["common", "uncommon", "mythic"].includes(b.rarity)) expect(b.setId, b.id).toBeNull();
    }
  });

  test("a set is five pieces, one per armor slot, all at the set's rarity, sharing the set's focus", () => {
    for (const set of SET_ENTRIES) {
      expect(["rare", "epic", "legendary"], set.id).toContain(set.rarity);
      const pieces = ITEMS.filter((i) => i.set === set.id);
      expect(pieces.map((p) => p.slot).sort(), set.id).toEqual([...ARMOR_SLOTS].sort());
      for (const p of pieces) {
        expect(p.rarity, p.id).toBe(set.rarity);
        expect(p.focus, `${p.id} takes its focus from the set`).toBeUndefined();
        expect(baseItem(p.id)!.focus, p.id).toEqual(set.focus);
      }
    }
    for (const i of ITEMS) if (i.set) expect(setDef(i.set), i.id).toBeDefined();
  });

  test("there are at least two sets at Rare, Epic and Legendary", () => {
    for (const r of ["rare", "epic", "legendary"]) expect(SETS.filter((s) => s.rarity === r).length, r).toBeGreaterThanOrEqual(2);
  });

  test("Rare and Epic sets are unnamed, Legendary sets are named", () => {
    for (const s of SETS) expect(s.named, s.id).toBe(s.rarity === "legendary");
    for (const b of BASE_ITEMS) expect(NAMED_RARITIES.includes(b.rarity), b.id).toBe(b.rarity === "legendary" || b.rarity === "mythic");
  });
});

describe("mythic rules", () => {
  const mythics = ITEMS.filter((i) => i.rarity === "mythic");

  test("each Mythic is standalone, 100% one attribute, with its own unique effect", () => {
    expect(mythics.length).toBeGreaterThan(0);
    const effects = new Set<string>();
    for (const m of mythics) {
      expect(m.set, m.id).toBeUndefined();
      expect(Object.values(m.focus ?? {}), m.id).toEqual([100]);
      expect(m.effect, m.id).toBeTruthy();
      expect(effects.has(m.effect!), `${m.id} reuses ${m.effect}`).toBe(false);
      effects.add(m.effect!);
      expect(ITEMS.filter((i) => i.effect === m.effect), m.effect).toHaveLength(1);
    }
  });
});

describe("accessory rules", () => {
  test("every accessory has an effect that exists, and no effect touches coins or XP", () => {
    for (const i of ITEMS.filter((i) => isAccessory(i.slot) && i.rarity !== "mythic")) {
      expect(Object.keys(ACCESSORY_EFFECTS), i.id).toContain(i.effect);
    }
    for (const id of Object.keys(ACCESSORY_EFFECTS)) expect(id).not.toMatch(/coin|xp|exp/i);
    for (const i of ITEMS) if (i.effect) expect(i.effect).not.toMatch(/coin|xp/i);
  });

  test("every accessory slot has an item at each rarity from Common to Legendary", () => {
    for (const slot of SLOTS.filter(isAccessory)) {
      for (const r of ["common", "uncommon", "rare", "epic", "legendary"]) {
        expect(ITEMS.some((i) => i.slot === slot && i.rarity === r), `${slot} ${r}`).toBe(true);
      }
    }
  });
});

describe("kept ids", () => {
  test("items from before the catalog rules still exist in their old slot and rarity", () => {
    const slots = ["helmet", "chestplate", "gloves", "leggings", "boots"] as const;
    const families = { ironbound: "common", wayfarer: "uncommon", steelguard: "rare", warden: "epic", "titans-vow": "legendary", unbroken: "mythic" } as const;
    for (const [family, rarity] of Object.entries(families)) {
      for (const slot of slots) expect(baseItem(`${family}-${slot}`), `${family}-${slot}`).toMatchObject({ slot, rarity });
    }
    expect(baseItem("ironbound-helmet")!.setId).toBeNull();
    expect(baseItem("wayfarer-boots")!.setId).toBeNull();
    expect(baseItem("unbroken-gloves")!.setId).toBeNull();
    expect(baseItem("titans-vow-helmet")!.setId).toBe("titans-vow");
  });

  test("an item with no focus falls back to its slot's usual split", () => {
    expect(baseItem("ironbound-helmet")!.focus).toEqual({ hp: 70, def: 30 });
    expect(baseItem("wayfarer-gloves")!.focus).toEqual({ atk: 70, hp: 30 });
  });
});
