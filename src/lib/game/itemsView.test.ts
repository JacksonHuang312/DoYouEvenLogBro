import { describe, expect, test } from "vitest";
import { baseItem } from "./catalog";
import { newGameState, type GameState } from "./claim";
import { ARMOR_SLOTS, POSITIONS } from "./config";
import { effectValue, newItem, type OwnedItem } from "./items";
import {
  powerView,
  rarityWithPlus,
  restockLabel,
  scrapOf,
  setProgress,
  shopView,
  bestGear,
  focusLabel,
  positionViews,
  titlesView,
  toggledTitles,
} from "./itemsView";
import { emptyShop, shopStock, type ShopDoc } from "./shop";
import { DAY, T0 } from "./test-helpers";
import { TITLE_IDS, type AchievementProgress, type TitleId } from "./titles";

const UTC = "UTC";
const WEEK = "2026-10-11";

/** Common at level 1 unless the patch says otherwise (unique Mythics are Mythic). */
function owned(baseId: string, patch: Partial<OwnedItem> = {}, id = `i-${baseId}`): OwnedItem {
  const base = baseItem(baseId)!;
  const made = newItem(base, "shop", T0, { rarity: base.mythic ? "mythic" : "common", itemLevel: 1 });
  if (!made.ok) throw new Error(made.error);
  return { ...made.value, id, ...patch };
}
const game = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  coins: 10_000,
  level: 100,
  materials: { scrap: 500 },
  ...patch,
});
/** A position's cards as plain items (armor positions are named like their slot). */
const slotOf = (state: GameState | null, inv: OwnedItem[], position: string) => {
  const view = positionViews(state, inv, T0).find((s) => s.position === position)!;
  return { ...view, items: view.cards.map((c) => c.item) };
};

describe("positionViews", () => {
  test("one entry per position; the worn item first, then the rest strongest first", () => {
    const inv = [owned("ironbound-boots"), owned("warden-boots", { rarity: "epic" }), owned("wayfarer-boots")];
    const boots = slotOf(game({ equipped: { boots: "i-wayfarer-boots" } }), inv, "boots");
    expect(boots.items.map((i) => i.baseId)).toEqual(["wayfarer-boots", "warden-boots", "ironbound-boots"]);
    expect(boots.equipped?.baseId).toBe("wayfarer-boots");
    expect(boots.owned).toBe(3);
    expect(positionViews(game(), inv, T0).map((s) => s.position)).toEqual([...POSITIONS]);
    expect(slotOf(game(), inv, "helmet").items).toEqual([]);
  });

  test("ignores removed items, and works with no game state yet", () => {
    const gone = owned("ironbound-boots", { removed: { reason: "sold", at: T0, coins: 40, scrap: 0 } });
    expect(positionViews(null, [gone], T0).every((s) => s.cards.length === 0 && s.owned === 0)).toBe(true);
  });

  test("labels and the level lock on an item above your level", () => {
    const worn = owned("titans-vow-helmet", { rarity: "legendary", itemLevel: 30 });
    const high = owned("warden-gloves", { rarity: "common", itemLevel: 50 });
    const state = game({ level: 40, equipped: { helmet: worn.id } });
    const helmet = slotOf(state, [worn, high], "helmet").items[0];
    expect(helmet).toMatchObject({ tags: ["Equipped"], locked: null, itemLevel: 30 });
    const gloves = slotOf(state, [worn, high], "gloves").items[0];
    expect(gloves).toMatchObject({ tags: [], locked: { level: 50 } });
    expect(gloves.equip).toEqual({ enabled: false, reason: "Needs level 50" });
  });

  test("compare arrows: power against what is worn in the position, the whole power with nothing worn", () => {
    const a = owned("ironbound-boots", { rarity: "rare", itemLevel: 50 }, "a");
    const b = owned("wayfarer-boots", { rarity: "common", itemLevel: 50 }, "b");
    const views = slotOf(game({ equipped: { boots: "a" } }), [a, b], "boots").items;
    expect(views.find((v) => v.id === "a")!.compare).toBeNull();
    expect(views.find((v) => v.id === "b")!.compare).toBeCloseTo(4 - 5.2);
    expect(slotOf(game(), [b], "boots").items[0].compare).toBeCloseTo(4);
  });

  test("a weapon shows its type, the class it suits and its effects; the class's own weapon shows the bonus in its power", () => {
    const sword = owned("recruits-blade", { rarity: "legendary", itemLevel: 50 }, "s");
    const asCleric = slotOf(game({ classId: "cleric" }), [sword], "weapon").items[0];
    const asStriker = slotOf(game({ classId: "striker" }), [sword], "weapon").items[0];
    expect(asCleric.power).toBeCloseTo(4 * 1.75 * 2);
    expect(asStriker.power).toBeCloseTo(4 * 1.75 * 2 * 1.1, 1);
    expect(asCleric.weapon).toBe("Sword · Striker weapon (+10% power)");
    expect(asCleric.effect).toBe("Crit damage +10%");
    expect(slotOf(game(), [owned("kingsbane")], "weapon").items[0].effect).toBe("Crit damage +12.5% · Crits charge your ultimate twice as fast");
  });

  test("reforge: to your level for scrap, off without the scrap, absent at your level", () => {
    const low = owned("steelguard-helmet", { rarity: "epic", itemLevel: 20 }, "h");
    const r = slotOf(game({ level: 30 }), [low], "helmet").items[0].reforge!;
    expect(r).toMatchObject({ to: 30, scrap: 30, enabled: true, label: "Reforge to level 30 for 30 scrap" });
    expect(slotOf(game({ level: 30, materials: { scrap: 2 } }), [low], "helmet").items[0].reforge).toMatchObject({ enabled: false, reason: "Not enough scrap" });
    expect(slotOf(game({ level: 20 }), [low], "helmet").items[0].reforge).toBeNull();
  });

  test("equip is on for an item you can wear, off for the one already worn", () => {
    const a = owned("ironbound-boots", {}, "a");
    expect(slotOf(game({ equipped: { boots: "a" } }), [a], "boots").items[0].equip).toEqual({ enabled: false, reason: null });
    expect(slotOf(game(), [a], "boots").items[0].equip.enabled).toBe(true);
  });

  test("upgrade shows the step, the cost and what it would give; or why it is off", () => {
    const rare = owned("steelguard-gloves", { rarity: "rare", itemLevel: 50 });
    const view = slotOf(game(), [rare], "gloves").items[0];
    const up = view.upgrade!;
    expect(up).toMatchObject({ label: "Rare → Rare (+1)", coins: 250, scrap: 8, enabled: true, costLabel: "250 coins + 8 scrap" });
    expect(up.powerAfter).toBeGreaterThan(view.power);
    expect(slotOf(game({ coins: 10 }), [rare], "gloves").items[0].upgrade).toMatchObject({ enabled: false, reason: "Not enough coins" });
    expect(slotOf(game({ materials: {} }), [rare], "gloves").items[0].upgrade).toMatchObject({ enabled: false, reason: "Not enough scrap" });
  });

  test("a Legendary +2 turns Mythic with a Core; anything else stops at +2", () => {
    const legendary = owned("titans-vow-gloves", { rarity: "legendary", plus: 2 });
    const up = slotOf(game(), [legendary], "gloves").items[0].upgrade!;
    expect(up).toMatchObject({ label: "Legendary (+2) → Mythic", mythicCore: 1, enabled: false, reason: "Needs a Mythic Core (boss drop)" });
    expect(up.costLabel).toBe("4,000 coins + 80 scrap + 1 Mythic Core");
    for (const item of [owned("unbroken-gloves", { plus: 2 }), owned("steelguard-gloves", { rarity: "epic", plus: 2 })]) {
      const top = slotOf(game(), [item], "gloves").items[0];
      expect(top.upgrade).toBeNull();
      expect(top.maxedNote).toBe("Fully upgraded");
    }
  });

  test("sell and salvage: price and yield, off while equipped, Legendary cannot be sold", () => {
    const a = owned("wayfarer-boots", { rarity: "uncommon", itemLevel: 50 }, "a");
    const free = slotOf(game(), [a], "boots").items[0];
    expect(free.sell).toEqual({ price: 115, enabled: true, reason: null });
    expect(free.salvage).toEqual({ scrap: 15, enabled: true, reason: null });
    const worn = slotOf(game({ equipped: { boots: "a" } }), [a], "boots").items[0];
    expect(worn.sell).toMatchObject({ enabled: false, reason: "Unequip it first" });
    expect(worn.salvage).toMatchObject({ enabled: false, reason: "Unequip it first" });
    const named = slotOf(game(), [owned("titans-vow-boots", { rarity: "legendary", itemLevel: 50 })], "boots").items[0];
    expect(named.sell.enabled).toBe(false);
    expect(named.sell.price).toBeNull();
    expect(named.salvage).toMatchObject({ scrap: 150, enabled: true });
  });

  test("a worn salvage charm raises the scrap shown, and its effect reads as active", () => {
    const cog = owned("tinkers-cog", { rarity: "epic" }, "cog");
    const view = slotOf(game({ equipped: { charm1: "cog" } }), [owned("wayfarer-boots", { rarity: "uncommon", itemLevel: 50 }, "a"), cog], "boots").items[0];
    expect(view.salvage.scrap).toBe(Math.round(15 * (1 + effectValue("salvageYield", "epic"))));
    expect(slotOf(game(), [cog], "charm1").items[0].effect).not.toMatch(/not active/);
  });
});

describe("setProgress", () => {
  test("counts equipped pieces per set, best first, with the tiers reached", () => {
    const pieces = (set: string, n: number) => ARMOR_SLOTS.slice(0, n).map((s) => ({ baseId: `${set}-${s}`, rarity: "legendary" as const }));
    const sets = setProgress([...pieces("warden", 3), ...pieces("steelguard", 2)]);
    expect(sets.map((s) => [s.name, s.count, s.active])).toEqual([
      ["Warden", 3, true],
      ["Steelguard", 2, false],
    ]);
    expect(sets[0].tiers.map((t) => t.reached)).toEqual([true, false]);
    expect(sets[0].tiers[0].label).toBe("3 pieces: +8% gear power");
    expect(setProgress([])).toEqual([]);
  });
});

describe("powerView", () => {
  test("before body power loads, nothing is known yet", () => {
    expect(powerView(null, game(), [])).toEqual({ body: null, gear: null, bonus: null, battle: null });
  });

  test("body, counted gear against its cap, the bonus bucket and battle power", () => {
    const helm = owned("steelguard-helmet", { rarity: "rare", itemLevel: 50 });
    const state = game({ equipped: { helmet: helm.id }, titles: { earned: { centurion: T0 }, equipped: ["centurion"], slots: 1 } });
    const p = powerView(200, state, [helm]);
    expect(p.body).toBe(200);
    expect(p.gear).toMatchObject({ counted: 5.2, cap: 85.7, capped: false });
    expect(p.bonus).toMatchObject({ total: 0.03, cap: 0.25 });
    expect(p.battle).toBe(211.4);
  });

  test("no gear: battle is body power; a weak body caps the gear", () => {
    expect(powerView(150, game(), []).battle).toBe(150);
    const full = ARMOR_SLOTS.map((s) => owned(`unbroken-${s}`, { itemLevel: 100 }));
    const state = game({ equipped: Object.fromEntries(full.map((i) => [i.slot, i.id])) });
    expect(powerView(100, state, full).gear).toMatchObject({ capped: true, counted: 42.9 });
  });

  test("scrap", () => {
    expect(scrapOf(game())).toBe(500);
    expect(scrapOf(null)).toBe(0);
  });
});

describe("shopView", () => {
  const doc = (patch: Partial<ShopDoc> = {}): ShopDoc => ({ ...emptyShop(WEEK, UTC, T0), ...patch });

  test("six offers with their price and affordability, all at the user's level", () => {
    const v = shopView("alice", null, game({ coins: 600, level: 5 }), T0, UTC);
    expect(v.weekId).toBe(WEEK);
    expect(v.offers).toHaveLength(6);
    for (const o of v.offers) {
      expect(o.canAfford).toBe(600 >= o.price);
      expect(o.reason).toBe(o.canAfford ? null : "Not enough coins");
      expect(o.itemLevel).toBe(5);
    }
  });

  test("a bought offer is marked and cannot be bought again", () => {
    const stock = shopStock("alice", WEEK, 0, 100);
    const v = shopView("alice", doc({ bought: { "0:1": "shop-x" } }), game(), T0, UTC);
    expect(v.offers[1]).toMatchObject({ bought: true, reason: null, baseId: stock[1].baseId });
    expect(v.offers[0].bought).toBe(false);
  });

  test("reroll: price, then the next one, then none left", () => {
    expect(shopView("alice", null, game(), T0, UTC).reroll).toMatchObject({ cost: 100, enabled: true, label: "Reroll for 100 coins" });
    expect(shopView("alice", doc({ rerolls: 1 }), game(), T0, UTC).reroll.cost).toBe(200);
    expect(shopView("alice", doc({ rerolls: 2 }), game(), T0, UTC).reroll).toMatchObject({ cost: null, enabled: false, label: "No rerolls left" });
    expect(shopView("alice", null, game({ coins: 50 }), T0, UTC).reroll).toMatchObject({ enabled: false, reason: "Not enough coins" });
    // A reroll charm's discount, as the server applies it.
    expect(shopView("alice", null, game(), T0, UTC, 0.15).reroll).toMatchObject({ cost: 85, label: "Reroll for 85 coins" });
  });

  test("a new week starts clean; the stock follows the reroll count", () => {
    const next = shopView("alice", doc(), game(), T0 + 7 * DAY, UTC);
    expect(next.weekId).toBe("2026-10-18");
    expect(shopView("alice", doc({ rerolls: 1 }), game(), T0, UTC).offers.map((o) => o.baseId)).not.toEqual(
      shopView("alice", doc(), game(), T0, UTC).offers.map((o) => o.baseId),
    );
  });

  test("restock countdown to Sunday 00:00", () => {
    expect(restockLabel(WEEK, T0, UTC)).toBe("3d 12h");
    expect(restockLabel(WEEK, Date.UTC(2026, 9, 17, 18, 30), UTC)).toBe("5h 30m");
    expect(restockLabel(WEEK, Date.UTC(2026, 9, 17, 23, 51), UTC)).toBe("9m");
  });
});

describe("titlesView", () => {
  const progress = (over: Partial<Record<TitleId, [number, number, boolean]>> = {}) =>
    Object.fromEntries(
      TITLE_IDS.map((id) => {
        const [p, t, met] = over[id] ?? [0, 10, false];
        return [id, { progress: p, target: t, met } satisfies AchievementProgress];
      }),
    ) as Record<TitleId, AchievementProgress>;

  test("eight rows; equipped and earned first, then closest to done", () => {
    const state = game({ titles: { earned: { firstSteps: T0, centurion: T0 }, equipped: ["centurion"], slots: 1 } });
    const v = titlesView(state, progress({ regular: [3, 4, false], questmaster: [1, 3, false] }));
    expect(v.rows).toHaveLength(8);
    expect(v.rows.slice(0, 4).map((r) => r.id)).toEqual(["centurion", "firstSteps", "regular", "questmaster"]);
    expect(v.rows[2]).toMatchObject({ progress: "3 / 4", earned: false, action: null });
    expect(v.rows[0]).toMatchObject({ equipped: true, progress: "Earned", action: { label: "Unequip", enabled: true } });
    expect(v.rows[1].action).toMatchObject({ label: "Equip", enabled: false, reason: "Slots full. Unequip one first" });
    expect(v.bonus).toBe("+3%");
  });

  test("no progress yet: rows are listed without it", () => {
    const v = titlesView(game(), null);
    expect(v.rows.every((r) => r.progress === null && r.fraction === null)).toBe(true);
    expect(v.bonus).toBe("+0%");
  });

  test("unbroken with the days but too few scheduled workouts says so", () => {
    const v = titlesView(game(), progress({ unbroken: [28, 28, false] }));
    expect(v.rows.find((r) => r.id === "unbroken")!.progress).toBe("Needs 8+ scheduled workouts in the 28 days");
  });

  test("slots: one to start, the next costs 500, none after three", () => {
    expect(titlesView(game(), null).slots).toMatchObject({ used: 0, total: 1, max: 3, next: { cost: 500, enabled: true } });
    expect(titlesView(game({ coins: 100 }), null).slots.next).toMatchObject({ enabled: false, reason: "Not enough coins" });
    expect(titlesView(game({ titles: { earned: {}, equipped: [], slots: 3 } }), null).slots.next).toBeNull();
  });

  test("toggledTitles equips into a free slot, unequips, and refuses unearned or full", () => {
    const state = game({ titles: { earned: { firstSteps: T0, centurion: T0 }, equipped: ["firstSteps"], slots: 2 } });
    expect(toggledTitles(state, "centurion")).toEqual({ ok: true, titles: ["firstSteps", "centurion"] });
    expect(toggledTitles(state, "firstSteps")).toEqual({ ok: true, titles: [] });
    expect(toggledTitles(state, "regular")).toEqual({ ok: false, reason: "Not earned yet" });
  });
});

describe("stacks and accessories", () => {
  const copies = (baseId: string, n: number, patch: Partial<OwnedItem> = {}) =>
    Array.from({ length: n }, (_, i) => owned(baseId, patch, `c${i}-${baseId}`));

  test("unequipped copies with the same base, rarity, plus and item level are one card with a count", () => {
    const inv = [
      ...copies("ironbound-boots", 3, { itemLevel: 50 }),
      owned("ironbound-boots", { plus: 1, itemLevel: 50 }, "plus1"),
      owned("ironbound-boots", { itemLevel: 51 }, "lv51"),
      owned("wayfarer-boots", { rarity: "uncommon", itemLevel: 50 }),
    ];
    const boots = positionViews(game(), inv, T0).find((p) => p.position === "boots")!;
    expect(boots.owned).toBe(6);
    expect(boots.cards.map((c) => [c.item.baseId, c.item.plus, c.item.itemLevel, c.count])).toEqual([
      ["wayfarer-boots", 0, 50, 1],
      ["ironbound-boots", 1, 50, 1],
      ["ironbound-boots", 0, 51, 1],
      ["ironbound-boots", 0, 50, 3],
    ]);
  });

  test("an equipped copy is its own card and the rest of the stack stays; actions act on one copy", () => {
    const inv = copies("ironbound-boots", 3);
    const boots = positionViews(game({ equipped: { boots: "c1-ironbound-boots" } }), inv, T0).find((p) => p.position === "boots")!;
    expect(boots.owned).toBe(3);
    expect(boots.cards.map((c) => [c.item.id, c.count, c.item.equipped])).toEqual([
      ["c1-ironbound-boots", 1, true],
      ["c0-ironbound-boots", 2, false],
    ]);
    expect(boots.cards[0].item.tags).toContain("Equipped");
    // The stack's copy can be sold even though another copy is worn.
    expect(boots.cards[1].item.sell.enabled).toBe(true);
  });

  test("each item shows its focus, from its set, itself or the slot", () => {
    const inv = [owned("warden-helmet"), owned("patchwork-helmet"), owned("ironbound-helmet")];
    const helmets = slotOf(game(), inv, "helmet").items;
    expect(helmets.find((i) => i.baseId === "warden-helmet")!.focus).toBe("HP 100");
    expect(helmets.find((i) => i.baseId === "patchwork-helmet")!.focus).toBe("HP 100");
    expect(helmets.find((i) => i.baseId === "ironbound-helmet")!.focus).toBe("HP 70 / DEF 30");
    expect(focusLabel({ def: 30, hp: 70 })).toBe("HP 70 / DEF 30");
  });

  test("rings and charms get two positions that share one owned count", () => {
    const rings = [owned("copper-band", {}, "a"), owned("bronze-signet", {}, "b"), owned("silver-loop", {}, "c")];
    const state = game({ equipped: { ring2: "b" } });
    const views = positionViews(state, rings, T0);
    const ring1 = views.find((p) => p.position === "ring1")!;
    const ring2 = views.find((p) => p.position === "ring2")!;
    expect([ring1.owned, ring2.owned]).toEqual([3, 3]);
    expect(ring1.equipped).toBeNull();
    expect(ring2.equipped?.id).toBe("b");
    // The sheet for ring 1 lists the ring worn in ring 2 first, labelled with its position, and cannot equip it again.
    expect(ring1.cards[0].item).toMatchObject({ id: "b", position: "ring2", equip: { enabled: false } });
    expect(ring1.cards[0].item.tags).toContain("Equipped · Ring 2");
    expect(ring1.cards.slice(1).every((c) => c.item.equip.enabled)).toBe(true);
    expect(views.find((p) => p.position === "necklace")!.owned).toBe(0);
  });

  test("an accessory shows its power, focus and effect", () => {
    const ring = slotOf(game(), [owned("sunforged-ring", { rarity: "legendary", itemLevel: 50 })], "ring1").items[0];
    expect(ring).toMatchObject({ power: 2.8, focus: "ATK 80 / DEF 20", slot: "ring" });
    expect(ring.effect).toBe("Crit chance +2.5%");
    const charm = slotOf(game(), [owned("lucky-pebble", { itemLevel: 50 })], "charm2").items[0];
    expect(charm).toMatchObject({ power: 1.6, focus: "ATK 33 / HP 34 / DEF 33" });
    expect(slotOf(game(), [owned("unbroken-gloves")], "gloves").items[0].effect).toBe("Every 4th attack is a critical hit");
    expect(slotOf(game(), [owned("ironbound-gloves")], "gloves").items[0].effect).toBeNull();
  });

  test("accessory power counts toward battle power and the gear cap", () => {
    const ring = owned("sunforged-ring", { rarity: "legendary", itemLevel: 50 }, "r");
    const state = game({ equipped: { ring1: "r" } });
    expect(powerView(500, state, [ring]).gear).toMatchObject({ counted: 2.8, capped: false });
    expect(powerView(5, state, [ring]).gear).toMatchObject({ counted: 2.1, capped: true });
  });
});

describe("bestGear", () => {
  test("picks the strongest wearable piece per position, two rings, and leaves what is right alone", () => {
    const inv = [
      owned("ironbound-boots", { rarity: "common", itemLevel: 40 }, "weak"),
      owned("wayfarer-boots", { rarity: "epic", itemLevel: 40 }, "strong"),
      owned("drifter-boots", { rarity: "mythic", itemLevel: 90 }, "too-high"),
      owned("copper-band", { rarity: "rare", itemLevel: 40 }, "r1"),
      owned("bronze-signet", { rarity: "epic", itemLevel: 40 }, "r2"),
      owned("silver-loop", { rarity: "common", itemLevel: 1 }, "r3"),
    ];
    const state = game({ level: 50, equipped: { boots: "weak", ring2: "r1" } });
    const best = bestGear(state, inv);
    expect(best.moves).toEqual([
      { itemId: "strong", position: "boots" },
      { itemId: "r2", position: "ring1" },
    ]);
    expect(best.gain).toBeGreaterThan(0);
    const after = game({ level: 50, equipped: { boots: "strong", ring1: "r2", ring2: "r1" } });
    expect(bestGear(after, inv)).toEqual({ moves: [], gain: 0 });
  });

  test("takes a set's pieces when the set bonus beats stronger loose pieces", () => {
    const set = ARMOR_SLOTS.map((s) => owned(`warden-${s}`, { rarity: "rare", itemLevel: 50 }, `set-${s}`));
    const loose = owned("ironbound-helmet", { rarity: "epic", itemLevel: 50 }, "loose");
    const moves = bestGear(game(), [...set, loose]).moves;
    expect(moves.find((m) => m.position === "helmet")?.itemId).toBe("set-helmet");
    expect(moves).toHaveLength(5);
  });

  test("the class's own weapon wins a close call", () => {
    const sword = owned("recruits-blade", { rarity: "rare", itemLevel: 50 }, "sword");
    const staff = owned("willow-staff", { rarity: "rare", itemLevel: 50 }, "staff");
    expect(bestGear(game({ classId: "cleric" }), [sword, staff]).moves).toEqual([{ itemId: "staff", position: "weapon" }]);
    expect(bestGear(game({ classId: "striker" }), [sword, staff]).moves).toEqual([{ itemId: "sword", position: "weapon" }]);
  });
});

describe("rarityWithPlus", () => {
  test("hides +0 and shows the upgrade level in brackets once upgraded", () => {
    expect(rarityWithPlus("mythic", 0)).toBe("Mythic");
    expect(rarityWithPlus("mythic", 1)).toBe("Mythic (+1)");
    expect(rarityWithPlus("rare", 2)).toBe("Rare (+2)");
  });
});

describe("rerolls left", () => {
  test("counts the rerolls left of the week's total", () => {
    expect(shopView("alice", null, game(), T0, UTC).reroll).toMatchObject({ left: 2, total: 2 });
    expect(shopView("alice", { ...emptyShop(WEEK, UTC, T0), rerolls: 1 }, game(), T0, UTC).reroll).toMatchObject({ left: 1, total: 2 });
    expect(shopView("alice", { ...emptyShop(WEEK, UTC, T0), rerolls: 2 }, game(), T0, UTC).reroll).toMatchObject({ left: 0, total: 2 });
  });
});

describe("focusLabel order", () => {
  test("always attack, then health, then defense, whatever the sizes", () => {
    expect(focusLabel({ hp: 20, atk: 80 })).toBe("ATK 80 / HP 20");
    expect(focusLabel({ def: 80, atk: 20 })).toBe("ATK 20 / DEF 80");
    expect(focusLabel({ def: 50, hp: 30, atk: 20 })).toBe("ATK 20 / HP 30 / DEF 50");
    expect(focusLabel({ def: 60, hp: 40 })).toBe("HP 40 / DEF 60");
  });

  test("leaves out a stat at 0 or missing, and shows a single stat alone", () => {
    expect(focusLabel({ hp: 100, atk: 0, def: 0 })).toBe("HP 100");
    expect(focusLabel({ def: 100 })).toBe("DEF 100");
    expect(focusLabel({})).toBe("");
  });
});
