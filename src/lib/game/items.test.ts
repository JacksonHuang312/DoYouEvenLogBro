import { describe, expect, test } from "vitest";
import { BASE_ITEMS, baseItem, SETS } from "./catalog";
import { newGameState, type GameState } from "./claim";
import { EQUIP_LEVEL, GEAR, RARITIES, SALVAGE, SLOTS, type Rarity } from "./config";
import {
  applyUpgrade,
  dropOutcome,
  equipItem,
  equippedItems,
  isAscended,
  newItem,
  piecePower,
  removeItem,
  sellPrice,
  setBonusPct,
  unequipSlot,
  upgradeStep,
  type OwnedItem,
} from "./items";
import { T0 } from "./test-helpers";

const UTC = "UTC";

/** An owned item of a base, at a rarity and plus an upgrade could reach. */
function owned(baseId: string, patch: Partial<OwnedItem> = {}, id = `i-${baseId}`): OwnedItem {
  const made = newItem(baseItem(baseId)!, "shop", T0);
  if (!made.ok) throw new Error(made.error);
  return { ...made.value, id, ...patch };
}

const rich = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  coins: 100_000,
  level: 30,
  materials: { scrap: 10_000, mythicCore: 5 },
  ...patch,
});

describe("catalog", () => {
  test("every set has one piece per slot, and named sets start at Legendary or Mythic", () => {
    for (const set of SETS) {
      const pieces = BASE_ITEMS.filter((b) => b.setId === set.id);
      expect(pieces.map((p) => p.slot).sort(), set.id).toEqual([...SLOTS].sort());
      expect(set.named, set.id).toBe(set.rarity === "legendary" || set.rarity === "mythic");
    }
    expect(new Set(BASE_ITEMS.map((b) => b.id)).size).toBe(BASE_ITEMS.length);
  });

  test("there is a set at every rarity", () => {
    expect(SETS.map((s) => s.rarity).sort()).toEqual([...RARITIES].sort());
  });
});

describe("piecePower", () => {
  const at = (rarity: Rarity, plus: number, originRarity: Rarity = rarity) => piecePower({ rarity, plus, originRarity });

  test("base power by rarity, plus 4% of it per step", () => {
    expect(at("common", 0)).toBe(3);
    expect(at("rare", 1)).toBeCloseTo(10.4);
    expect(at("epic", 2)).toBeCloseTo(16.2);
    expect(at("mythic", 0)).toBe(32);
  });

  test("full sets: Epic 75, Legendary 110, Mythic 160", () => {
    expect(5 * at("epic", 0)).toBe(75);
    expect(5 * at("legendary", 0)).toBe(110);
    expect(5 * at("mythic", 0)).toBe(160);
  });

  test("an ascended Legendary is 85% of native at +0 and 92% at +2, so a maxed one loses to a fresh native", () => {
    expect(at("legendary", 0, "epic")).toBeCloseTo(0.85 * 22);
    expect(at("legendary", 2, "epic")).toBeCloseTo(0.92 * 22 * 1.08);
    expect(at("legendary", 2, "epic")).toBeLessThan(at("legendary", 0));
  });

  test("the penalty also applies to a named Legendary promoted to Mythic", () => {
    expect(isAscended({ rarity: "mythic", originRarity: "legendary" })).toBe(true);
    expect(at("mythic", 2, "legendary")).toBeLessThan(at("mythic", 0));
    expect(at("mythic", 0, "legendary")).toBeGreaterThan(at("legendary", 2));
  });

  test("climbing within the unnamed tiers has no penalty", () => {
    expect(isAscended({ rarity: "epic", originRarity: "common" })).toBe(false);
    expect(at("epic", 1, "common")).toBe(at("epic", 1));
  });

  test("every upgrade step raises power, from any start to the top", () => {
    for (const base of BASE_ITEMS) {
      let item = owned(base.id);
      let steps = 0;
      for (let step = upgradeStep(item); step.ok; step = upgradeStep(item)) {
        const next = { ...item, ...step.value.to };
        expect(piecePower(next), `${base.id} → ${next.rarity} +${next.plus}`).toBeGreaterThan(piecePower(item));
        item = next;
        steps++;
      }
      // Unnamed gear tops out at Legendary +2, named gear at Mythic +2.
      expect(item.rarity, base.id).toBe(base.rarity === "legendary" || base.rarity === "mythic" ? "mythic" : "legendary");
      expect(item.plus).toBe(GEAR.maxPlus);
      expect(steps).toBeGreaterThan(0);
    }
  });
});

describe("upgradeStep", () => {
  test("+0 → +1 → +2, then the next rarity at +0", () => {
    const rare = owned("steelguard-gloves");
    expect(upgradeStep(rare)).toMatchObject({ ok: true, value: { kind: "plus", to: { rarity: "rare", plus: 1 } } });
    expect(upgradeStep({ ...rare, plus: 2 })).toMatchObject({ ok: true, value: { kind: "promote", to: { rarity: "epic", plus: 0 } } });
  });

  test("unnamed Epic +2 becomes an ascended Legendary, which stops at +2", () => {
    const epic = owned("warden-boots", { plus: 2 });
    expect(upgradeStep(epic)).toMatchObject({ ok: true, value: { to: { rarity: "legendary", plus: 0 } } });
    expect(upgradeStep({ ...epic, rarity: "legendary", plus: 2 })).toMatchObject({ ok: false, error: "Unnamed gear stops at Legendary +2" });
  });

  test("named Legendary +2 → Mythic needs a Mythic Core; Mythic +2 is the top", () => {
    const named = owned("titans-vow-helmet", { plus: 2 });
    const step = upgradeStep(named);
    expect(step).toMatchObject({ ok: true, value: { to: { rarity: "mythic", plus: 0 } } });
    expect(step.ok && step.value.cost.mythicCore).toBe(1);
    expect(upgradeStep(owned("unbroken-helmet", { plus: 2 }))).toMatchObject({ ok: false });
  });
});

describe("applyUpgrade", () => {
  const item = owned("ironbound-gloves");
  const expected = { rarity: "common" as const, plus: 0 };

  test("pays the cost and raises the item", () => {
    const state = rich({ coins: 100, materials: { scrap: 5 } });
    const r = applyUpgrade({ state, item, expected, now: T0 + 1 });
    expect(r).toMatchObject({ ok: true, value: { state: { coins: 60, materials: { scrap: 3 } }, item: { rarity: "common", plus: 1 } } });
    expect(r.ok && "id" in r.value.item).toBe(false);
  });

  test("a retry with the old expected level is refused, so it can't upgrade twice", () => {
    expect(applyUpgrade({ state: rich(), item: { ...item, plus: 1 }, expected, now: T0 })).toMatchObject({ ok: false, status: 409 });
  });

  test("short on coins, scrap or a Mythic Core is a 402", () => {
    expect(applyUpgrade({ state: rich({ coins: 39 }), item, expected, now: T0 })).toMatchObject({ ok: false, status: 402, error: "Not enough coins" });
    expect(applyUpgrade({ state: rich({ materials: { scrap: 1 } }), item, expected, now: T0 })).toMatchObject({ ok: false, status: 402, error: "Not enough scrap" });
    const named = owned("titans-vow-boots", { plus: 2 });
    expect(
      applyUpgrade({ state: rich({ materials: { scrap: 999 } }), item: named, expected: { rarity: "legendary", plus: 2 }, now: T0 }),
    ).toMatchObject({ ok: false, status: 402, error: "Needs a Mythic Core (boss drop)" });
  });

  test("promoting a named Legendary spends the Mythic Core", () => {
    const named = owned("titans-vow-boots", { plus: 2 });
    const r = applyUpgrade({ state: rich(), item: named, expected: { rarity: "legendary", plus: 2 }, now: T0 });
    expect(r).toMatchObject({ ok: true, value: { state: { materials: { mythicCore: 4 } }, item: { rarity: "mythic", plus: 0, originRarity: "legendary" } } });
  });

  test("an equipped item can't be upgraded into a rarity the level can't equip; an unequipped one can", () => {
    const rare = owned("steelguard-boots", { plus: 2 });
    const expectedRare = { rarity: "rare" as const, plus: 2 };
    const equipped = rich({ level: EQUIP_LEVEL.epic - 1, equipped: { boots: rare.id } });
    expect(applyUpgrade({ state: equipped, item: rare, expected: expectedRare, now: T0 })).toMatchObject({ ok: false, status: 409 });
    expect(applyUpgrade({ state: { ...equipped, equipped: {} }, item: rare, expected: expectedRare, now: T0 })).toMatchObject({ ok: true });
  });

  test("a removed item can't be upgraded", () => {
    const gone = { ...item, removed: { reason: "sold" as const, at: T0, coins: 40, scrap: 0 } };
    expect(applyUpgrade({ state: rich(), item: gone, expected, now: T0 })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("equipping", () => {
  test("level gates by current rarity: Epic 8, Legendary 15, Mythic 25", () => {
    const cases: [string, Rarity, number][] = [
      ["warden-helmet", "epic", 8],
      ["titans-vow-helmet", "legendary", 15],
      ["unbroken-helmet", "mythic", 25],
    ];
    for (const [baseId, rarity, level] of cases) {
      const item = owned(baseId);
      expect(item.rarity).toBe(rarity);
      expect(equipItem(rich({ level: level - 1 }), item, T0), rarity).toMatchObject({ ok: false, error: `${rarity[0].toUpperCase()}${rarity.slice(1)} gear needs level ${level}` });
      expect(equipItem(rich({ level }), item, T0), rarity).toMatchObject({ ok: true, value: { equipped: { helmet: item.id } } });
    }
    expect(equipItem(rich({ level: 1 }), owned("steelguard-helmet"), T0)).toMatchObject({ ok: true });
  });

  test("equipping replaces the slot's item; equipping again changes nothing", () => {
    const a = owned("ironbound-boots", {}, "a");
    const b = owned("wayfarer-boots", {}, "b");
    const once = equipItem(rich(), a, T0);
    const twice = once.ok && equipItem(once.value, b, T0);
    expect(twice && twice.ok && twice.value.equipped).toEqual({ boots: "b" });
    const again = twice && twice.ok && equipItem(twice.value, b, T0);
    expect(again && again.ok && again.value.equipped).toEqual({ boots: "b" });
  });

  test("unequip clears a slot (and an empty slot stays empty)", () => {
    const state = rich({ equipped: { boots: "a", gloves: "b" } });
    expect(unequipSlot(state, "boots", T0).equipped).toEqual({ gloves: "b" });
    expect(unequipSlot(state, "helmet", T0).equipped).toEqual({ boots: "a", gloves: "b" });
  });

  test("equippedItems skips removed items and ids that don't fit the slot", () => {
    const boots = owned("ironbound-boots", {}, "a");
    const gloves = owned("ironbound-gloves", { removed: { reason: "sold", at: T0, coins: 40, scrap: 0 } }, "b");
    const state = rich({ equipped: { boots: "a", gloves: "b", helmet: "a" } });
    expect(equippedItems(state, [boots, gloves]).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("selling and salvage", () => {
  test("sell price is 25% of the origin rarity's value, rounded to 5", () => {
    expect(sellPrice(owned("ironbound-helmet"))).toBe(40);
    expect(sellPrice(owned("wayfarer-helmet"))).toBe(115);
    expect(sellPrice(owned("steelguard-helmet"))).toBe(250);
    expect(sellPrice(owned("warden-helmet"))).toBe(625);
    // An upgraded item still sells by where it started, so upgrading then selling never profits.
    expect(sellPrice(owned("ironbound-helmet", { rarity: "epic", plus: 2 }))).toBe(40);
    expect(sellPrice(owned("warden-helmet", { rarity: "legendary" }))).toBe(625);
  });

  test("named items can't be sold, only salvaged", () => {
    const named = owned("titans-vow-gloves");
    expect(sellPrice(named)).toBeNull();
    expect(removeItem(rich(), named, "sold", T0)).toMatchObject({ ok: false, status: 409 });
    expect(removeItem(rich({ materials: {} }), named, "salvaged", T0)).toMatchObject({
      ok: true,
      value: { state: { materials: { scrap: SALVAGE.legendary } }, removal: { reason: "salvaged", scrap: 150, coins: 0 } },
    });
  });

  test("selling pays coins and marks the item removed", () => {
    const r = removeItem(rich({ coins: 10 }), owned("steelguard-boots"), "sold", T0 + 5);
    expect(r).toMatchObject({ ok: true, value: { state: { coins: 260 }, item: { removed: { reason: "sold", at: T0 + 5, coins: 250 } } } });
  });

  test("salvage yield goes by current rarity", () => {
    const r = removeItem(rich({ materials: { scrap: 1 } }), owned("ironbound-boots", { rarity: "rare", plus: 1 }), "salvaged", T0);
    expect(r).toMatchObject({ ok: true, value: { state: { materials: { scrap: 1 + SALVAGE.rare } } } });
  });

  test("an equipped item has to be unequipped first", () => {
    const item = owned("ironbound-boots");
    expect(removeItem(rich({ equipped: { boots: item.id } }), item, "sold", T0)).toMatchObject({ ok: false, error: "Unequip it first" });
  });

  test("an item can't be removed twice", () => {
    const gone = owned("ironbound-boots", { removed: { reason: "sold", at: T0, coins: 40, scrap: 0 } });
    expect(removeItem(rich(), gone, "salvaged", T0)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("dropOutcome (Phase 5 boss drops)", () => {
  test("a base you already own turns into scrap, never coins", () => {
    const have = [owned("titans-vow-helmet")];
    expect(dropOutcome({ baseId: "titans-vow-helmet", rarity: "legendary" }, have)).toEqual({ kind: "salvage", scrap: SALVAGE.legendary });
    expect(dropOutcome({ baseId: "titans-vow-boots", rarity: "legendary" }, have)).toEqual({ kind: "item" });
  });

  test("a sold or salvaged copy doesn't count as owned", () => {
    const gone = [owned("titans-vow-helmet", { removed: { reason: "salvaged", at: T0, coins: 0, scrap: 150 } })];
    expect(dropOutcome({ baseId: "titans-vow-helmet", rarity: "legendary" }, gone)).toEqual({ kind: "item" });
  });
});

describe("sets", () => {
  const pieces = (setId: string, n: number) => SLOTS.slice(0, n).map((slot) => ({ baseId: `${setId}-${slot}` }));

  test("+8% at 3 pieces, +20% at 5 (not both)", () => {
    expect(setBonusPct(pieces("warden", 2))).toBe(0);
    expect(setBonusPct(pieces("warden", 3))).toBe(0.08);
    expect(setBonusPct(pieces("warden", 4))).toBe(0.08);
    expect(setBonusPct(pieces("warden", 5))).toBe(0.2);
  });

  test("pieces of different sets don't add up, and unknown bases belong to no set", () => {
    expect(setBonusPct([...pieces("warden", 2), { baseId: "ironbound-leggings" }, { baseId: "ironbound-boots" }])).toBe(0);
    expect(setBonusPct([{ baseId: "gone-1" }, { baseId: "gone-2" }, { baseId: "gone-3" }])).toBe(0);
  });
});

describe("newItem", () => {
  test("starts at the base's rarity, +0, named when it starts at Legendary or Mythic", () => {
    expect(newItem(baseItem("warden-gloves")!, "shop", T0)).toMatchObject({ ok: true, value: { originRarity: "epic", rarity: "epic", plus: 0, named: false, removed: null, slot: "gloves" } });
    expect(newItem(baseItem("unbroken-gloves")!, "boss", T0)).toMatchObject({ ok: true, value: { named: true, originRarity: "mythic" } });
  });

  test("a higher rarity or plus (the admin script) must be reachable by upgrading", () => {
    const iron = baseItem("ironbound-helmet")!;
    expect(newItem(iron, "admin", T0, { rarity: "legendary", plus: 2 })).toMatchObject({ ok: true, value: { originRarity: "common", rarity: "legendary" } });
    expect(newItem(iron, "admin", T0, { rarity: "mythic" })).toMatchObject({ ok: false });
    expect(newItem(baseItem("unbroken-helmet")!, "admin", T0, { rarity: "legendary" })).toMatchObject({ ok: false });
    expect(newItem(iron, "admin", T0, { plus: 3 })).toMatchObject({ ok: false });
  });
});
