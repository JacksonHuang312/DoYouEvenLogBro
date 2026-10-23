import { describe, expect, test } from "vitest";
import { baseItem } from "./catalog";
import { newGameState, type GameState } from "./claim";
import { ARMOR_SLOTS } from "./config";
import { newItem, type OwnedItem } from "./items";
import {
  powerView,
  restockLabel,
  scrapOf,
  setProgress,
  shopView,
  slotViews,
  titlesView,
  toggledTitles,
} from "./itemsView";
import { emptyShop, shopStock, type ShopDoc } from "./shop";
import { DAY, T0 } from "./test-helpers";
import { TITLE_IDS, type AchievementProgress, type TitleId } from "./titles";

const UTC = "UTC";
const WEEK = "2026-10-11";

function owned(baseId: string, patch: Partial<OwnedItem> = {}, id = `i-${baseId}`): OwnedItem {
  const made = newItem(baseItem(baseId)!, "shop", T0);
  if (!made.ok) throw new Error(made.error);
  return { ...made.value, id, ...patch };
}
const game = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  coins: 10_000,
  level: 30,
  materials: { scrap: 500 },
  ...patch,
});
const slotOf = (state: GameState | null, inv: OwnedItem[], slot: string) => slotViews(state, inv, T0).find((s) => s.slot === slot)!;

describe("slotViews", () => {
  test("one entry per slot, strongest first, with the equipped one found", () => {
    const inv = [owned("ironbound-boots"), owned("warden-boots"), owned("wayfarer-boots")];
    const boots = slotOf(game({ equipped: { boots: "i-wayfarer-boots" } }), inv, "boots");
    expect(boots.items.map((i) => i.baseId)).toEqual(["warden-boots", "wayfarer-boots", "ironbound-boots"]);
    expect(boots.equipped?.baseId).toBe("wayfarer-boots");
    expect(slotViews(game(), inv, T0).map((s) => s.slot)).toEqual([...ARMOR_SLOTS]);
    expect(slotOf(game(), inv, "helmet").items).toEqual([]);
  });

  test("ignores removed items, and works with no game state yet", () => {
    const gone = owned("ironbound-boots", { removed: { reason: "sold", at: T0, coins: 40, scrap: 0 } });
    expect(slotViews(null, [gone], T0).every((s) => s.items.length === 0)).toBe(true);
  });

  test("labels: Equipped, Named, Ascended; and the level lock on gated items", () => {
    const named = owned("titans-vow-helmet");
    const ascended = owned("warden-gloves", { rarity: "legendary", plus: 1 });
    const state = game({ level: 10, equipped: { helmet: named.id } });
    const helmet = slotOf(state, [named, ascended], "helmet").items[0];
    expect(helmet.tags).toEqual(["Equipped", "Named"]);
    expect(helmet.locked).toEqual({ level: 15 });
    const gloves = slotOf(state, [named, ascended], "gloves").items[0];
    expect(gloves.tags).toEqual(["Ascended"]);
    expect(gloves.equip).toEqual({ enabled: false, reason: "Legendary gear needs level 15" });
  });

  test("equip is on for an item you can wear, off for the one already worn", () => {
    const a = owned("ironbound-boots", {}, "a");
    expect(slotOf(game({ equipped: { boots: "a" } }), [a], "boots").items[0].equip).toEqual({ enabled: false, reason: null });
    expect(slotOf(game(), [a], "boots").items[0].equip.enabled).toBe(true);
  });

  test("upgrade shows the step, the cost and what it would give; or why it is off", () => {
    const rare = owned("steelguard-gloves");
    const up = slotOf(game(), [rare], "gloves").items[0].upgrade!;
    expect(up).toMatchObject({ label: "Rare +0 → Rare +1", coins: 250, scrap: 8, enabled: true, costLabel: "250 coins + 8 scrap" });
    expect(up.powerAfter).toBeGreaterThan(10);
    expect(slotOf(game({ coins: 10 }), [rare], "gloves").items[0].upgrade).toMatchObject({ enabled: false, reason: "Not enough coins" });
    expect(slotOf(game({ materials: {} }), [rare], "gloves").items[0].upgrade).toMatchObject({ enabled: false, reason: "Not enough scrap" });
  });

  test("promotion step and the top of the ladder", () => {
    const promo = owned("steelguard-gloves", { plus: 2 });
    expect(slotOf(game(), [promo], "gloves").items[0].upgrade?.label).toBe("Rare +2 → Epic +0");
    const named = owned("titans-vow-gloves", { plus: 2 });
    const up = slotOf(game(), [named], "gloves").items[0].upgrade!;
    expect(up).toMatchObject({ mythicCore: 1, enabled: false, reason: "Needs a Mythic Core (boss drop)" });
    expect(up.costLabel).toBe("4,000 coins + 80 scrap + 1 Mythic Core");
    const top = slotOf(game(), [owned("unbroken-gloves", { plus: 2 })], "gloves").items[0];
    expect(top.upgrade).toBeNull();
    expect(top.maxedNote).toBe("Fully upgraded");
    const unnamed = slotOf(game(), [owned("warden-gloves", { rarity: "legendary", plus: 2 })], "gloves").items[0];
    expect(unnamed.maxedNote).toBe("Unnamed gear stops at Legendary +2");
  });

  test("sell and salvage: price and yield, off while equipped, named cannot be sold", () => {
    const a = owned("wayfarer-boots", {}, "a");
    const free = slotOf(game(), [a], "boots").items[0];
    expect(free.sell).toEqual({ price: 115, enabled: true, reason: null });
    expect(free.salvage).toEqual({ scrap: 15, enabled: true, reason: null });
    const worn = slotOf(game({ equipped: { boots: "a" } }), [a], "boots").items[0];
    expect(worn.sell).toMatchObject({ enabled: false, reason: "Unequip it first" });
    expect(worn.salvage).toMatchObject({ enabled: false, reason: "Unequip it first" });
    const named = slotOf(game(), [owned("titans-vow-boots")], "boots").items[0];
    expect(named.sell.enabled).toBe(false);
    expect(named.sell.price).toBeNull();
    expect(named.salvage).toMatchObject({ scrap: 150, enabled: true });
  });
});

describe("setProgress", () => {
  test("counts equipped pieces per set, best first, with the tiers reached", () => {
    const pieces = (set: string, n: number) => ARMOR_SLOTS.slice(0, n).map((s) => ({ baseId: `${set}-${s}` }));
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
  test("calibrating: nothing is known yet", () => {
    expect(powerView(null, game(), [])).toEqual({ body: null, gear: null, bonus: null, battle: null });
  });

  test("body, counted gear against its cap, the bonus bucket and battle power", () => {
    const helm = owned("steelguard-helmet");
    const state = game({ equipped: { helmet: helm.id }, titles: { earned: { centurion: T0 }, equipped: ["centurion"], slots: 1 } });
    const p = powerView(200, state, [helm]);
    expect(p.body).toBe(200);
    expect(p.gear).toMatchObject({ counted: 10, cap: 85.7, capped: false });
    expect(p.bonus).toMatchObject({ total: 0.03, cap: 0.25 });
    expect(p.battle).toBe(216.3);
  });

  test("no gear: battle is body power; a weak body caps the gear", () => {
    expect(powerView(150, game(), []).battle).toBe(150);
    const full = ARMOR_SLOTS.map((s) => owned(`unbroken-${s}`));
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

  test("six offers with their price, affordability and level lock", () => {
    const v = shopView("alice", null, game({ coins: 600, level: 5 }), T0, UTC);
    expect(v.weekId).toBe(WEEK);
    expect(v.offers).toHaveLength(6);
    for (const o of v.offers) {
      expect(o.canAfford).toBe(600 >= o.price);
      expect(o.reason).toBe(o.canAfford ? null : "Not enough coins");
      expect(o.locked).toEqual(o.rarity === "epic" ? { level: 8 } : null);
    }
  });

  test("a bought offer is marked and cannot be bought again", () => {
    const stock = shopStock("alice", WEEK, 0);
    const v = shopView("alice", doc({ bought: { "0:1": "shop-x" } }), game(), T0, UTC);
    expect(v.offers[1]).toMatchObject({ bought: true, reason: null, baseId: stock[1].baseId });
    expect(v.offers[0].bought).toBe(false);
  });

  test("reroll: price, then the next one, then none left", () => {
    expect(shopView("alice", null, game(), T0, UTC).reroll).toMatchObject({ cost: 100, enabled: true, label: "Reroll for 100 coins" });
    expect(shopView("alice", doc({ rerolls: 1 }), game(), T0, UTC).reroll.cost).toBe(200);
    expect(shopView("alice", doc({ rerolls: 2 }), game(), T0, UTC).reroll).toMatchObject({ cost: null, enabled: false, label: "No rerolls left" });
    expect(shopView("alice", null, game({ coins: 50 }), T0, UTC).reroll).toMatchObject({ enabled: false, reason: "Not enough coins" });
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
    const state = game({ titles: { earned: { calibrated: T0, centurion: T0 }, equipped: ["centurion"], slots: 1 } });
    const v = titlesView(state, progress({ regular: [3, 4, false], questmaster: [1, 3, false] }));
    expect(v.rows).toHaveLength(8);
    expect(v.rows.slice(0, 4).map((r) => r.id)).toEqual(["centurion", "calibrated", "regular", "questmaster"]);
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
    const state = game({ titles: { earned: { calibrated: T0, centurion: T0 }, equipped: ["calibrated"], slots: 2 } });
    expect(toggledTitles(state, "centurion")).toEqual({ ok: true, titles: ["calibrated", "centurion"] });
    expect(toggledTitles(state, "calibrated")).toEqual({ ok: true, titles: [] });
    expect(toggledTitles(state, "regular")).toEqual({ ok: false, reason: "Not earned yet" });
  });
});
