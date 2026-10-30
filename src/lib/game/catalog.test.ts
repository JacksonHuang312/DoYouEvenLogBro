import { describe, expect, test } from "vitest";
import { BASE_ITEMS, bandLabel, bandOf, baseItem, basesFor, SETS, setDef } from "./catalog";
import { ITEMS, SETS as SET_ENTRIES } from "./catalogData";
import {
  ACCESSORY_EFFECTS,
  ARMOR_SLOTS,
  ATTRIBUTES,
  CLASS_IDS,
  LEVEL_BANDS,
  MYTHIC_EFFECTS,
  SLOTS,
  WEAPON_TYPES,
  WEAPONS,
  isAccessory,
  isWeapon,
  type Focus,
} from "./config";

/** The catalog rules (GAME_DESIGN.md 5 and 13.5). Add items in catalogData.ts and this test checks them. */

const validFocus = (f: Focus) => {
  const entries = Object.entries(f);
  return (
    entries.length > 0 &&
    entries.every(([k, v]) => (ATTRIBUTES as readonly string[]).includes(k) && Number.isInteger(v) && v > 0) &&
    entries.reduce((n, [, v]) => n + (v as number), 0) === 100
  );
};

describe("catalog entries", () => {
  test("ids are unique and slots are valid", () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(SLOTS, i.id).toContain(i.slot);
      expect(i.name.trim(), i.id).not.toBe("");
    }
    expect(new Set(SET_ENTRIES.map((s) => s.id)).size).toBe(SET_ENTRIES.length);
  });

  test("loose armor has several items per armor slot", () => {
    for (const slot of ARMOR_SLOTS) expect(BASE_ITEMS.filter((b) => b.kind === "loose" && b.slot === slot).length, slot).toBeGreaterThan(1);
  });

  test("focus is whole percents adding up to 100", () => {
    for (const i of ITEMS) if (i.focus) expect(validFocus(i.focus), i.id).toBe(true);
    for (const s of SET_ENTRIES) expect(validFocus(s.focus), s.id).toBe(true);
    for (const w of WEAPON_TYPES) expect(validFocus(WEAPONS[w].focus), w).toBe(true);
    for (const b of BASE_ITEMS) expect(validFocus(b.focus), b.id).toBe(true);
  });
});

describe("set rules", () => {
  test("only armor is in a set", () => {
    for (const i of ITEMS) if (i.set) expect(ARMOR_SLOTS as readonly string[], i.id).toContain(i.slot);
  });

  test("a set is five pieces, one per armor slot, sharing the set's focus and band", () => {
    for (const set of SET_ENTRIES) {
      const pieces = ITEMS.filter((i) => i.set === set.id);
      expect(pieces.map((p) => p.slot).sort(), set.id).toEqual([...ARMOR_SLOTS].sort());
      for (const p of pieces) {
        expect(p.focus, `${p.id} takes its focus from the set`).toBeUndefined();
        expect(baseItem(p.id)!.focus, p.id).toEqual(set.focus);
        expect(baseItem(p.id)!.band, p.id).toBe(set.band);
      }
    }
    for (const i of ITEMS) if (i.set) expect(setDef(i.set), i.id).toBeDefined();
  });

  test("one set per class in each level band: 15 sets", () => {
    expect(SETS).toHaveLength(LEVEL_BANDS.length * CLASS_IDS.length);
    for (const band of LEVEL_BANDS) {
      expect(SETS.filter((s) => s.band === band).map((s) => s.classId).sort(), `band ${band}`).toEqual([...CLASS_IDS].sort());
    }
  });

  test("every set carries a 5-piece effect from ACCESSORY_EFFECTS", () => {
    for (const s of SETS) {
      expect(Object.keys(ACCESSORY_EFFECTS), s.id).toContain(s.effect.id);
      expect(s.effect.value, s.id).toBeGreaterThan(0);
    }
  });
});

describe("weapon rules", () => {
  test("one weapon per type in each level band, never in a set, with the type's focus", () => {
    for (const type of WEAPON_TYPES) {
      const bands = BASE_ITEMS.filter((b) => b.weapon === type && !b.mythic).map((b) => b.band);
      expect(bands.sort((a, b) => a! - b!), type).toEqual([...LEVEL_BANDS]);
    }
    for (const b of BASE_ITEMS.filter((b) => isWeapon(b.slot))) {
      expect(b.weapon, b.id).not.toBeNull();
      expect(b.setId, b.id).toBeNull();
      expect(b.focus, b.id).toEqual(WEAPONS[b.weapon!].focus);
    }
    for (const b of BASE_ITEMS) if (b.weapon) expect(b.slot, b.id).toBe("weapon");
  });

  test("each weapon type suits one class", () => {
    expect(WEAPON_TYPES.map((t) => WEAPONS[t].classId).sort()).toEqual([...CLASS_IDS].sort());
  });

  test("a sword has more ATK than a staff, a shield more DEF than either", () => {
    expect(WEAPONS.sword.focus.atk!).toBeGreaterThan(WEAPONS.staff.focus.atk!);
    expect(WEAPONS.shield.focus.def!).toBeGreaterThan(WEAPONS.sword.focus.def ?? 0);
    expect(WEAPONS.shield.focus.def!).toBeGreaterThan(WEAPONS.staff.focus.def ?? 0);
  });
});

describe("mythic rules", () => {
  const mythics = BASE_ITEMS.filter((b) => b.mythic);

  test("each Mythic is standalone, with its own unique effect; armor and accessories are 100% one attribute", () => {
    expect(mythics.length).toBeGreaterThan(0);
    const effects = new Set<string>();
    for (const m of mythics) {
      expect(m.setId, m.id).toBeNull();
      expect(m.band, m.id).toBeNull();
      if (!m.weapon) expect(Object.values(m.focus), m.id).toEqual([100]);
      expect(Object.keys(MYTHIC_EFFECTS), m.id).toContain(m.effect);
      expect(effects.has(m.effect!), `${m.id} reuses ${m.effect}`).toBe(false);
      effects.add(m.effect!);
    }
    expect([...effects].sort()).toEqual(Object.keys(MYTHIC_EFFECTS).sort());
  });

  test("one Mythic weapon per type", () => {
    for (const type of WEAPON_TYPES) expect(mythics.filter((m) => m.weapon === type), type).toHaveLength(1);
  });
});

describe("accessory rules", () => {
  test("every accessory has an effect that exists, and no effect touches coins or XP", () => {
    for (const b of BASE_ITEMS.filter((b) => b.kind === "accessory")) expect(Object.keys(ACCESSORY_EFFECTS), b.id).toContain(b.effect);
    for (const id of Object.keys(ACCESSORY_EFFECTS)) expect(id).not.toMatch(/coin|xp|exp/i);
    for (const i of ITEMS) if (i.effect) expect(i.effect).not.toMatch(/coin|xp/i);
  });

  test("every accessory slot has several items, never in a set or a band", () => {
    for (const slot of SLOTS.filter(isAccessory)) {
      const list = BASE_ITEMS.filter((b) => b.kind === "accessory" && b.slot === slot);
      expect(list.length, slot).toBeGreaterThan(1);
      for (const b of list) expect([b.setId, b.band], b.id).toEqual([null, null]);
    }
  });
});

describe("level bands and drop pools", () => {
  test("bandOf finds the band an item level falls in", () => {
    expect([1, 19, 20, 39, 40, 79, 80, 100].map(bandOf)).toEqual([1, 1, 20, 20, 40, 60, 80, 80]);
    expect(bandLabel(20)).toBe("Levels 20-39");
    expect(bandLabel(80)).toBe("Levels 80-100");
  });

  test("set pieces and weapons drop in their band only; loose armor and accessories at any level", () => {
    for (const level of [1, 25, 99]) {
      for (const kind of ["set", "weapon"] as const) {
        const list = basesFor(kind, level);
        expect(list.length, `${kind} ${level}`).toBeGreaterThan(0);
        for (const b of list) expect(b.band, b.id).toBe(bandOf(level));
      }
      expect(basesFor("loose", level)).toHaveLength(BASE_ITEMS.filter((b) => b.kind === "loose").length);
      expect(basesFor("accessory", level)).toHaveLength(BASE_ITEMS.filter((b) => b.kind === "accessory").length);
      expect(basesFor("mythic", level)).toHaveLength(BASE_ITEMS.filter((b) => b.mythic).length);
    }
  });
});

describe("kept ids", () => {
  test("items from before the item rework still exist in their old slot", () => {
    for (const family of ["ironbound", "wayfarer", "steelguard", "warden", "titans-vow", "unbroken"]) {
      for (const slot of ARMOR_SLOTS) expect(baseItem(`${family}-${slot}`), `${family}-${slot}`).toMatchObject({ slot });
    }
    expect(baseItem("ironbound-helmet")!.setId).toBeNull();
    expect(baseItem("unbroken-gloves")!.mythic).toBe(true);
    expect(baseItem("titans-vow-helmet")!.setId).toBe("titans-vow");
    expect(baseItem("steelguard-helmet")!.band).toBe(20);
  });

  test("an item with no focus falls back to its slot's usual split", () => {
    expect(baseItem("ironbound-helmet")!.focus).toEqual({ hp: 70, def: 30 });
    expect(baseItem("wayfarer-gloves")!.focus).toEqual({ atk: 70, hp: 30 });
  });
});
