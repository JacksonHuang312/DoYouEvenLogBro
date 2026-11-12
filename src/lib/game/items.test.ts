import { describe, expect, test } from "vitest";
import { BASE_ITEMS, baseItem } from "./catalog";
import { newGameState, type GameState } from "./claim";
import { ARMOR_SLOTS, AUTO_SALVAGE_BELOW, GEAR, MYTHIC_PROMOTION, RARITIES, REFORGE_SCRAP_PER_LEVEL, SALVAGE, type Rarity } from "./config";
import {
  applyReforge,
  applyUpgrade,
  autoSalvageOf,
  defaultPosition,
  effectValue,
  equipItem,
  equippedItems,
  equippedPosition,
  itemLevelOf,
  levelPower,
  newItem,
  piecePower,
  reforgeCost,
  removeItem,
  salvageBelow,
  salvagesBelow,
  salvageYield,
  setAutoSalvage,
  sellPrice,
  setBonusPct,
  unequipPosition,
  upgradeStep,
  type OwnedItem,
} from "./items";
import { T0 } from "./test-helpers";

const UTC = "UTC";

/** An owned item of a base: Common at level 1 unless the patch says otherwise (unique Mythics are Mythic). */
function owned(baseId: string, patch: Partial<OwnedItem> = {}, id = `i-${baseId}`): OwnedItem {
  const base = baseItem(baseId)!;
  const made = newItem(base, "shop", T0, { rarity: base.mythic ? "mythic" : "common", itemLevel: 1 });
  if (!made.ok) throw new Error(made.error);
  return { ...made.value, id, ...patch };
}

const rich = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  coins: 100_000,
  level: 100,
  materials: { scrap: 10_000, mythicCore: 5 },
  ...patch,
});

describe("piecePower", () => {
  const at = (rarity: Rarity, plus: number, itemLevel = 50, slot?: "ring" | "weapon") => piecePower({ rarity, plus, itemLevel, slot });

  test("an armor piece's power climbs with item level on a curve: about 1.5 at 20, 4 at 50, 10.5 at 100", () => {
    expect(levelPower(1)).toBeCloseTo(0.5406);
    expect(levelPower(20)).toBeCloseTo(1.54);
    expect(levelPower(50)).toBeCloseTo(4);
    expect(levelPower(100)).toBeCloseTo(10.5);
    expect(at("common", 0, 50)).toBeCloseTo(4);
  });

  test("rarity multiplies it: Common 1, Uncommon 1.15, Rare 1.3, Epic 1.5, Legendary 1.75, Mythic 2", () => {
    expect(RARITIES.map((r) => at(r, 0) / at("common", 0))).toEqual(RARITIES.map((r) => GEAR.rarityMultiplier[r]));
    expect(RARITIES.map((r) => GEAR.rarityMultiplier[r])).toEqual([1, 1.15, 1.3, 1.5, 1.75, 2]);
  });

  test("a Legendary is worth roughly a Common about 20 levels higher", () => {
    const legendary = at("legendary", 0, 50);
    expect(legendary).toBeGreaterThan(at("common", 0, 65));
    expect(legendary).toBeLessThan(at("common", 0, 80));
  });

  test("each plus adds 4%; accessories are 40% of armor, the weapon twice it", () => {
    expect(at("rare", 1)).toBeCloseTo(at("rare", 0) * 1.04);
    expect(at("epic", 2)).toBeCloseTo(at("epic", 0) * 1.08);
    expect(at("rare", 0, 50, "ring")).toBeCloseTo(at("rare", 0) * 0.4);
    expect(at("rare", 0, 50, "weapon")).toBeCloseTo(at("rare", 0) * 2);
  });

  test("an item from before item levels counts as level 1", () => {
    expect(itemLevelOf({})).toBe(1);
    expect(piecePower({ rarity: "rare", plus: 0 })).toBeCloseTo(levelPower(1) * 1.3);
  });

  test("every upgrade step raises power, from any start to the top", () => {
    for (const base of BASE_ITEMS) {
      for (const rarity of base.mythic ? (["mythic"] as Rarity[]) : (["common", "legendary"] as Rarity[])) {
        let item = owned(base.id, { rarity, itemLevel: 40 });
        let steps = 0;
        for (let step = upgradeStep(item); step.ok; step = upgradeStep(item)) {
          const next = { ...item, ...step.value.to };
          expect(piecePower(next), `${base.id} → ${next.rarity} +${next.plus}`).toBeGreaterThan(piecePower(item));
          item = next;
          steps++;
        }
        // A Legendary tops out as a Mythic +2; everything else at its own rarity +2.
        expect(item.rarity, base.id).toBe(rarity === "legendary" ? "mythic" : rarity);
        expect(item.plus).toBe(GEAR.maxPlus);
        expect(steps).toBeGreaterThan(0);
      }
    }
  });
});

describe("upgradeStep", () => {
  test("+0 → +1 → +2, and rarity never changes below Legendary", () => {
    const rare = owned("steelguard-gloves", { rarity: "rare" });
    expect(upgradeStep(rare)).toMatchObject({ ok: true, value: { kind: "plus", to: { rarity: "rare", plus: 1 } } });
    expect(upgradeStep({ ...rare, plus: 2 })).toMatchObject({ ok: false, error: "Already maxed" });
    expect(upgradeStep(owned("warden-boots", { rarity: "epic", plus: 2 }))).toMatchObject({ ok: false });
  });

  test("a Legendary +2 → Mythic needs a Mythic Core; Mythic +2 is the top", () => {
    const step = upgradeStep(owned("titans-vow-helmet", { rarity: "legendary", plus: 2 }));
    expect(step).toMatchObject({ ok: true, value: { kind: "promote", to: { rarity: "mythic", plus: 0 }, cost: MYTHIC_PROMOTION } });
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
    const legendary = owned("titans-vow-boots", { rarity: "legendary", plus: 2 });
    expect(
      applyUpgrade({ state: rich({ materials: { scrap: 999 } }), item: legendary, expected: { rarity: "legendary", plus: 2 }, now: T0 }),
    ).toMatchObject({ ok: false, status: 402, error: "Needs a Mythic Core (boss drop)" });
  });

  test("promoting a Legendary spends the Mythic Core, and an equipped one can be upgraded at any level", () => {
    const legendary = owned("titans-vow-boots", { rarity: "legendary", plus: 2, itemLevel: 10 });
    const state = rich({ level: 10, equipped: { boots: legendary.id } });
    const r = applyUpgrade({ state, item: legendary, expected: { rarity: "legendary", plus: 2 }, now: T0 });
    expect(r).toMatchObject({ ok: true, value: { state: { materials: { mythicCore: 4 } }, item: { rarity: "mythic", plus: 0, itemLevel: 10 } } });
  });

  test("a removed item can't be upgraded", () => {
    const gone = { ...item, removed: { reason: "sold" as const, at: T0, coins: 40, scrap: 0 } };
    expect(applyUpgrade({ state: rich(), item: gone, expected, now: T0 })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("reforging", () => {
  const item = owned("steelguard-helmet", { rarity: "epic", plus: 1, itemLevel: 20 });

  test("raises the item to the user's level for scrap per level by rarity, keeping rarity and plus", () => {
    const state = rich({ level: 30, materials: { scrap: 100 } });
    const cost = 10 * REFORGE_SCRAP_PER_LEVEL.epic;
    expect(reforgeCost(item, 30)).toBe(cost);
    const r = applyReforge({ state, item, expectedLevel: 20, now: T0 + 1 });
    expect(r).toMatchObject({ ok: true, value: { scrap: cost, to: 30, state: { materials: { scrap: 100 - cost } }, item: { itemLevel: 30, rarity: "epic", plus: 1 } } });
  });

  test("an item at the user's level or above can't be reforged; a retry with the old level is refused", () => {
    expect(applyReforge({ state: rich({ level: 20 }), item, expectedLevel: 20, now: T0 })).toMatchObject({ ok: false, error: "Already at your level" });
    expect(applyReforge({ state: rich({ level: 30 }), item: { ...item, itemLevel: 30 }, expectedLevel: 20, now: T0 })).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  test("short on scrap is a 402; a removed item is a 404", () => {
    expect(applyReforge({ state: rich({ level: 30, materials: { scrap: 1 } }), item, expectedLevel: 20, now: T0 })).toMatchObject({ ok: false, status: 402 });
    const gone = { ...item, removed: { reason: "sold" as const, at: T0, coins: 0, scrap: 0 } };
    expect(applyReforge({ state: rich({ level: 30 }), item: gone, expectedLevel: 20, now: T0 })).toMatchObject({ ok: false, status: 404 });
  });

  test("an item from before item levels reforges from level 1", () => {
    const old = { ...item, itemLevel: undefined as unknown as number };
    expect(applyReforge({ state: rich({ level: 5 }), item: old, expectedLevel: 1, now: T0 })).toMatchObject({ ok: true, value: { to: 5 } });
  });
});

describe("equipping", () => {
  test("you can't wear an item above your level, whatever its rarity", () => {
    for (const rarity of ["common", "legendary", "mythic"] as Rarity[]) {
      const item = owned("titans-vow-helmet", { rarity, itemLevel: 30 });
      expect(equipItem(rich({ level: 29 }), item, T0), rarity).toMatchObject({ ok: false, error: "Needs level 30" });
      expect(equipItem(rich({ level: 30 }), item, T0), rarity).toMatchObject({ ok: true, value: { equipped: { helmet: item.id } } });
    }
  });

  test("a weapon goes in the weapon position only", () => {
    const sword = owned("recruits-blade", {}, "w");
    expect(equipItem(rich(), sword, T0)).toMatchObject({ ok: true, value: { equipped: { weapon: "w" } } });
    expect(equipItem(rich(), sword, T0, "gloves")).toMatchObject({ ok: false });
    expect(equipItem(rich(), owned("ironbound-gloves"), T0, "weapon")).toMatchObject({ ok: false });
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
    expect(unequipPosition(state, "boots", T0).equipped).toEqual({ gloves: "b" });
    expect(unequipPosition(state, "helmet", T0).equipped).toEqual({ boots: "a", gloves: "b" });
  });

  test("equippedItems skips removed items and ids that don't fit the slot", () => {
    const boots = owned("ironbound-boots", {}, "a");
    const gloves = owned("ironbound-gloves", { removed: { reason: "sold", at: T0, coins: 40, scrap: 0 } }, "b");
    const state = rich({ equipped: { boots: "a", gloves: "b", helmet: "a" } });
    expect(equippedItems(state, [boots, gloves]).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("accessories", () => {
  test("a ring goes in a ring position only, and one ring is never in two positions", () => {
    const ring = owned("copper-band", {}, "r1");
    const other = owned("bronze-signet", {}, "r2");
    const first = equipItem(rich(), ring, T0, "ring1");
    expect(first).toMatchObject({ ok: true, value: { equipped: { ring1: "r1" } } });
    expect(equipItem(rich(), ring, T0, "charm1")).toMatchObject({ ok: false });
    expect(equipItem(rich(), ring, T0, "helmet")).toMatchObject({ ok: false });
    expect(equipItem(rich(), owned("ironbound-helmet"), T0, "ring1")).toMatchObject({ ok: false });
    const state = first.ok ? first.value : rich();
    expect(equipItem(state, ring, T0, "ring2")).toMatchObject({ ok: false, error: expect.stringContaining("another position") });
    const both = equipItem(state, other, T0, "ring2");
    expect(both).toMatchObject({ ok: true, value: { equipped: { ring1: "r1", ring2: "r2" } } });
    expect(equipItem(state, ring, T0, "ring1")).toMatchObject({ ok: true, value: { equipped: { ring1: "r1" } } });
  });

  test("without a position an item stays where it is, else takes the first empty position of its slot", () => {
    const a = owned("copper-band", {}, "a");
    const b = owned("bronze-signet", {}, "b");
    const state = rich({ equipped: { ring1: "a" } });
    expect(defaultPosition(rich(), "ring")).toBe("ring1");
    expect(defaultPosition(state, "ring")).toBe("ring2");
    expect(defaultPosition(rich({ equipped: { ring1: "a", ring2: "b" } }), "ring")).toBe("ring1");
    expect(equipItem(state, b, T0)).toMatchObject({ ok: true, value: { equipped: { ring1: "a", ring2: "b" } } });
    expect(equipItem(state, a, T0)).toMatchObject({ ok: true, value: { equipped: { ring1: "a" } } });
    expect(equippedPosition(state, "a")).toBe("ring1");
    expect(equippedPosition(state, "zzz")).toBeNull();
  });

  test("equippedItems finds accessories in their positions, once each, and ignores misplaced ids", () => {
    const ring = owned("copper-band", {}, "r");
    const charm = owned("lucky-pebble", {}, "c");
    const state = rich({ equipped: { ring1: "r", ring2: "r", charm1: "c", necklace: "c" } });
    expect(equippedItems(state, [ring, charm]).map((i) => i.id)).toEqual(["r", "c"]);
  });

  test("effects scale with rarity and are small", () => {
    expect(effectValue("crit", "legendary")).toBeCloseTo(0.025);
    expect(effectValue("crit", "common")).toBeCloseTo(0.005);
    expect(effectValue("crit", "mythic")).toBeLessThan(0.1);
  });
});

describe("selling and salvage", () => {
  test("Common to Epic sell for 25% of their rarity's value, rounded to 5, whatever the level or plus", () => {
    expect(sellPrice(owned("ironbound-helmet"))).toBe(40);
    expect(sellPrice(owned("wayfarer-helmet", { rarity: "uncommon" }))).toBe(115);
    expect(sellPrice(owned("steelguard-helmet", { rarity: "rare", itemLevel: 80 }))).toBe(250);
    expect(sellPrice(owned("warden-helmet", { rarity: "epic", plus: 2 }))).toBe(625);
  });

  test("Legendary and Mythic can't be sold, only salvaged", () => {
    const legendary = owned("titans-vow-gloves", { rarity: "legendary", itemLevel: 50 });
    expect(sellPrice(legendary)).toBeNull();
    expect(sellPrice(owned("unbroken-gloves"))).toBeNull();
    expect(removeItem(rich(), legendary, "sold", T0)).toMatchObject({ ok: false, status: 409 });
    expect(removeItem(rich({ materials: {} }), legendary, "salvaged", T0)).toMatchObject({
      ok: true,
      value: { state: { materials: { scrap: SALVAGE.legendary } }, removal: { reason: "salvaged", scrap: 150, coins: 0 } },
    });
  });

  test("selling pays coins and marks the item removed", () => {
    const r = removeItem(rich({ coins: 10 }), owned("steelguard-boots", { rarity: "rare" }), "sold", T0 + 5);
    expect(r).toMatchObject({ ok: true, value: { state: { coins: 260 }, item: { removed: { reason: "sold", at: T0 + 5, coins: 250 } } } });
  });

  test("salvage pays by rarity and item level: half at level 1, 1.5 times at level 100", () => {
    expect(salvageYield({ rarity: "rare", itemLevel: 50 })).toBe(SALVAGE.rare);
    expect(salvageYield({ rarity: "rare", itemLevel: 1 })).toBe(Math.round(SALVAGE.rare * 0.51));
    expect(salvageYield({ rarity: "legendary", itemLevel: 100 })).toBe(Math.round(SALVAGE.legendary * 1.5));
    expect(salvageYield({ rarity: "common", itemLevel: 1 })).toBeGreaterThanOrEqual(1);
  });

  test("a salvage charm adds its share of the scrap, rounded", () => {
    const r = removeItem(rich({ materials: {} }), owned("ironbound-boots", { rarity: "rare", itemLevel: 50 }), "salvaged", T0, 0.1);
    expect(r).toMatchObject({ ok: true, value: { removal: { scrap: Math.round(SALVAGE.rare * 1.1) } } });
    // Selling never pays scrap, charm or not.
    expect(removeItem(rich(), owned("ironbound-boots"), "sold", T0, 0.5)).toMatchObject({ value: { removal: { scrap: 0 } } });
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

describe("sets", () => {
  const pieces = (setId: string, n: number) => ARMOR_SLOTS.slice(0, n).map((slot) => ({ baseId: `${setId}-${slot}` }));

  test("+8% at 3 pieces, +20% at 5 (not both)", () => {
    expect(setBonusPct(pieces("warden", 2))).toBe(0);
    expect(setBonusPct(pieces("warden", 3))).toBe(0.08);
    expect(setBonusPct(pieces("warden", 4))).toBe(0.08);
    expect(setBonusPct(pieces("warden", 5))).toBe(0.2);
  });

  test("pieces of different sets don't add up, and unknown bases belong to no set", () => {
    expect(setBonusPct([...pieces("warden", 2), { baseId: "steelguard-leggings" }, { baseId: "steelguard-boots" }])).toBe(0);
    expect(setBonusPct(ARMOR_SLOTS.map((s) => ({ baseId: `ironbound-${s}` })))).toBe(0);
    expect(setBonusPct(ARMOR_SLOTS.map((s) => ({ baseId: `unbroken-${s}` })))).toBe(0);
    expect(setBonusPct([{ baseId: "gone-1" }, { baseId: "gone-2" }, { baseId: "gone-3" }])).toBe(0);
  });
});

describe("newItem", () => {
  test("any base at any rarity and item level, +0", () => {
    expect(newItem(baseItem("warden-gloves")!, "shop", T0, { rarity: "common", itemLevel: 45 })).toMatchObject({
      ok: true,
      value: { rarity: "common", itemLevel: 45, plus: 0, removed: null, slot: "gloves" },
    });
    expect(newItem(baseItem("copper-band")!, "boss", T0, { rarity: "legendary", itemLevel: 3 })).toMatchObject({ ok: true });
  });

  test("a unique Mythic is always Mythic; levels are 1 to 100; plus is 0 to 2", () => {
    const iron = baseItem("ironbound-helmet")!;
    expect(newItem(baseItem("unbroken-helmet")!, "admin", T0, { rarity: "legendary", itemLevel: 80 })).toMatchObject({ ok: false });
    expect(newItem(baseItem("unbroken-helmet")!, "admin", T0, { rarity: "mythic", itemLevel: 80 })).toMatchObject({ ok: true });
    expect(newItem(iron, "admin", T0, { rarity: "rare", itemLevel: 0 })).toMatchObject({ ok: false });
    expect(newItem(iron, "admin", T0, { rarity: "rare", itemLevel: 101 })).toMatchObject({ ok: false });
    expect(newItem(iron, "admin", T0, { rarity: "rare", itemLevel: 2.5 })).toMatchObject({ ok: false });
    expect(newItem(iron, "admin", T0, { rarity: "rare", itemLevel: 5, plus: 2 })).toMatchObject({ ok: true });
    expect(newItem(iron, "admin", T0, { rarity: "rare", itemLevel: 5, plus: 3 })).toMatchObject({ ok: false });
  });
});

describe("auto-salvage (13.9)", () => {
  test("off by default; a choice is one of Uncommon to Legendary, and anything else on the doc counts as off", () => {
    expect(autoSalvageOf(rich())).toBeNull();
    expect(autoSalvageOf(setAutoSalvage(rich(), "rare", T0 + 1))).toBe("rare");
    expect(setAutoSalvage(rich(), "rare", T0 + 1).updatedAt).toBe(T0 + 1);
    expect(autoSalvageOf(setAutoSalvage(setAutoSalvage(rich(), "rare", T0), null, T0))).toBeNull();
    expect(autoSalvageOf(rich({ autoSalvage: "mythic" as never }))).toBeNull();
    expect([...AUTO_SALVAGE_BELOW]).toEqual(["uncommon", "rare", "epic", "legendary"]);
  });

  test("below a rarity means strictly lower; Legendary and Mythic never fall under it", () => {
    expect(RARITIES.filter((r) => salvagesBelow(r, "rare"))).toEqual(["common", "uncommon"]);
    expect(RARITIES.filter((r) => salvagesBelow(r, "uncommon"))).toEqual(["common"]);
    expect(RARITIES.filter((r) => salvagesBelow(r, "legendary"))).toEqual(["common", "uncommon", "rare", "epic"]);
    expect(RARITIES.filter((r) => salvagesBelow(r, null))).toEqual([]);
    expect(salvagesBelow("legendary", "mythic" as never)).toBe(false);
  });

  test("the bulk salvage takes every unworn item below the rarity and pays each one's scrap, charm included", () => {
    const common = owned("ironbound-boots", { itemLevel: 50 }, "a");
    const uncommon = owned("wayfarer-boots", { rarity: "uncommon", itemLevel: 50 }, "b");
    const worn = owned("ironbound-helmet", { itemLevel: 50 }, "c");
    const rare = owned("steelguard-boots", { rarity: "rare", itemLevel: 50 }, "d");
    const legendary = owned("titans-vow-gloves", { rarity: "legendary", itemLevel: 50 }, "e");
    const state = rich({ materials: { scrap: 10 }, equipped: { helmet: "c" } });
    const r = salvageBelow(state, [common, uncommon, worn, rare, legendary], "rare", T0 + 9, 0.1);
    expect(r.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(r.scrap).toBe(Math.round(SALVAGE.common * 1.1) + Math.round(SALVAGE.uncommon * 1.1));
    expect(r.state.materials).toMatchObject({ scrap: 10 + r.scrap });
    expect(r.items[0].item.removed).toMatchObject({ reason: "salvaged", at: T0 + 9, scrap: Math.round(SALVAGE.common * 1.1), coins: 0 });
    // Below Legendary takes the Rare too, but never the Legendary or what is worn.
    expect(salvageBelow(state, [common, uncommon, worn, rare, legendary], "legendary", T0).items.map((i) => i.id)).toEqual(["a", "b", "d"]);
  });

  test("a retry changes nothing: items already salvaged are skipped, and an id listed twice counts once", () => {
    const item = owned("ironbound-boots", { itemLevel: 50 }, "a");
    const state = rich({ materials: { scrap: 0 } });
    const first = salvageBelow(state, [item, item], "rare", T0);
    expect(first.items).toHaveLength(1);
    expect(first.scrap).toBe(SALVAGE.common);
    const again = salvageBelow(first.state, [{ id: "a", ...first.items[0].item }], "rare", T0);
    expect(again).toMatchObject({ items: [], scrap: 0 });
    expect(again.state).toBe(first.state);
  });
});
