import { baseItem, setDef, SETS, type BaseItem } from "./catalog";
import { battlePower, weaponClassBonus } from "./battle";
import { gearEffects, SET_EFFECT_PIECES, setEffectValue } from "./effects";
import { classBonusPct } from "./heroClass";
import { newGameState, type GameState } from "./claim";
import {
  ACCESSORY_EFFECTS,
  ACHIEVEMENTS,
  BONUS_BUCKET_CAP,
  MYTHIC_EFFECTS,
  POSITIONS,
  SET_BONUS,
  SHOP,
  TITLES,
  EFFECT_SCALE,
  WEAPON_CLASS_BONUS,
  WEAPONS,
  positionsOf,
  slotOfPosition,
  type AccessoryEffect,
  type ClassId,
  type Focus,
  type MythicEffect,
  type Position,
  type Rarity,
  type Slot,
} from "./config";
import {
  activeSet,
  applyReforge,
  applyUpgrade,
  canEquip,
  effectValue,
  equipItem,
  equippedItems,
  equippedOf,
  equippedPosition,
  itemLevelOf,
  materialsOf,
  pieceSetId,
  pieceFocus,
  piecePower,
  reforgeCost,
  removeItem,
  setCounts,
  upgradeStep,
  type OwnedItem,
} from "./items";
import { shopStock, emptyShop, rerollCost, rerollShop, buyOffer, offerKey, shopItemLevel, type ShopDoc } from "./shop";
import { addDays, dayStartMs, weekId as weekIdOf } from "./time";
import {
  buyTitleSlot,
  slotCost,
  titleBonus,
  titleBonusPct,
  titlesOf,
  TITLE_IDS,
  TITLE_INFO,
  type AchievementProgress,
  type TitleId,
} from "./titles";

/*
 * What the Gear, Shop and Titles tabs show, computed on the client from the game docs the server
 * writes. Pure, so it is unit tested. Whether an action is allowed is asked of the same functions
 * the server runs (a dry run on a copy of the state), so the screen can never disagree with the
 * server about why a button is off.
 */

const round1 = (x: number) => Math.round(x * 10) / 10;
const number = (n: number) => n.toLocaleString("en-US");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const RARITY_LABEL = (r: Rarity) => cap(r);
/** "Epic", or "Epic (+1)" once upgraded: +0 is not shown. */
export const rarityWithPlus = (r: Rarity, plus: number) => (plus > 0 ? `${cap(r)} (+${plus})` : cap(r));
export const SLOT_LABEL: Record<Slot, string> = {
  weapon: "Weapon",
  helmet: "Helmet",
  chestplate: "Chestplate",
  gloves: "Gloves",
  leggings: "Leggings",
  boots: "Boots",
  ring: "Ring",
  necklace: "Necklace",
  belt: "Belt",
  charm: "Charm",
};
/** A worn position's name: Ring 1 and Ring 2 are told apart, the rest are their slot. */
export const POSITION_LABEL: Record<Position, string> = {
  weapon: "Weapon",
  helmet: "Helmet",
  chestplate: "Chestplate",
  gloves: "Gloves",
  leggings: "Leggings",
  boots: "Boots",
  ring1: "Ring 1",
  ring2: "Ring 2",
  necklace: "Necklace",
  belt: "Belt",
  charm1: "Charm 1",
  charm2: "Charm 2",
};

/** The order stats are always shown in, whatever their size. */
const FOCUS_ORDER = ["atk", "hp", "def"] as const;

/** "ATK 80 / HP 20": where an item's power goes, always attack, then health, then defense; a stat at 0 is left out. */
export function focusLabel(focus: Focus): string {
  return FOCUS_ORDER.filter((a) => (focus[a] ?? 0) > 0)
    .map((a) => `${a.toUpperCase()} ${focus[a]}`)
    .join(" / ");
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** "2.5%": one decimal, for effects. */
const pct1 = (x: number) => `${Math.round(x * 1000) / 10}%`;

/**
 * What an item does beyond its power, at its rarity: a weapon type's effects, an accessory's effect,
 * a Mythic's unique effect. Every effect is live: fights use them, and the salvage and reroll charms
 * work outside fights.
 */
function effectLabel(base: BaseItem | undefined, rarity: Rarity): string | null {
  const parts: string[] = [];
  if (base?.weapon) for (const e of WEAPONS[base.weapon].effects) parts.push(`${ACCESSORY_EFFECTS[e.id].label} +${pct1(e.value * EFFECT_SCALE[rarity])}`);
  if (base?.effect && base.effect in ACCESSORY_EFFECTS) {
    const known = base.effect as AccessoryEffect;
    parts.push(`${ACCESSORY_EFFECTS[known].label} +${pct1(effectValue(known, rarity))}`);
  } else if (base?.effect && base.effect in MYTHIC_EFFECTS) {
    parts.push(MYTHIC_EFFECTS[base.effect as MythicEffect].label);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** "Sword · Striker's weapon": a weapon's type and the class it suits. */
function weaponLabel(base: BaseItem | undefined): string | null {
  if (!base?.weapon) return null;
  const w = WEAPONS[base.weapon];
  return `${w.label} · ${cap(w.classId)} weapon (+${pct(WEAPON_CLASS_BONUS)} power)`;
}

// ---- Gear ----

export interface UpgradeView {
  /** "Rare → Rare (+1)" or "Rare (+2) → Epic". */
  label: string;
  coins: number;
  scrap: number;
  mythicCore: number;
  powerAfter: number;
  /** "Upgrade for 600 coins + 15 scrap" */
  costLabel: string;
  enabled: boolean;
  reason: string | null;
}

export interface ReforgeView {
  /** The level it would reach: the user's. */
  to: number;
  scrap: number;
  /** "Reforge to level 34 for 40 scrap" */
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface ItemView {
  id: string;
  baseId: string;
  name: string;
  setName: string | null;
  slot: Slot;
  rarity: Rarity;
  plus: number;
  itemLevel: number;
  /** "Epic" or "Epic (+1)" */
  title: string;
  /** With the class's weapon bonus, when it is the class's own weapon type. */
  power: number;
  /**
   * Power against what is worn in the position the sheet is for (green up, red down): null for the
   * worn item itself. With nothing worn there, the whole power.
   */
  compare: number | null;
  /** "HP 70 / DEF 30" */
  focus: string;
  /** "Sword · Striker weapon (+10% power)", for weapons. */
  weapon: string | null;
  /** A weapon's, accessory's or Mythic's effects, with their strength. */
  effect: string | null;
  equipped: boolean;
  /** Where it is worn, when it is. */
  position: Position | null;
  /** Small text labels: Equipped. */
  tags: string[];
  /** The level needed when the user's level is below its item level. */
  locked: { level: number } | null;
  /** Equip into the position the sheet was opened for. */
  equip: { enabled: boolean; reason: string | null };
  /** Null when the item is at the top of what it can reach. */
  upgrade: UpgradeView | null;
  maxedNote: string | null;
  /** Raise it to the user's level for scrap; null when it is already there. */
  reforge: ReforgeView | null;
  sell: { price: number | null; enabled: boolean; reason: string | null };
  salvage: { scrap: number; enabled: boolean; reason: string | null };
}

const NO_STATE = (now: number) => newGameState(now, "UTC");

/** A piece's power as it counts for this class: its own, plus the weapon bonus for the class's weapon type. */
export const wornPower = (item: OwnedItem, classId: ClassId | null | undefined) => piecePower(item) * (1 + weaponClassBonus(item, classId));

/** One owned copy as shown for `target`, the position being equipped into, against `worn` (what is there). */
function itemView(state: GameState, item: OwnedItem, now: number, target: Position, salvageBonus: number, worn: OwnedItem | null): ItemView {
  const base = baseItem(item.baseId);
  const position = equippedPosition(state, item.id);
  const equipped = position != null;
  const level = itemLevelOf(item);
  const equipTry = equipItem(state, item, now, target);
  const power = wornPower(item, state.classId);

  const step = upgradeStep(item);
  let upgrade: UpgradeView | null = null;
  if (step.ok) {
    const { to, cost } = step.value;
    const attempt = applyUpgrade({ state, item, expected: { rarity: item.rarity, plus: item.plus }, now });
    const parts = [`${number(cost.coins)} coins`, `${number(cost.scrap)} scrap`];
    if (cost.mythicCore) parts.push(`${cost.mythicCore} Mythic Core`);
    upgrade = {
      label: `${rarityWithPlus(item.rarity, item.plus)} → ${rarityWithPlus(to.rarity, to.plus)}`,
      coins: cost.coins,
      scrap: cost.scrap,
      mythicCore: cost.mythicCore ?? 0,
      powerAfter: round1(wornPower({ ...item, rarity: to.rarity, plus: to.plus }, state.classId)),
      costLabel: parts.join(" + "),
      enabled: attempt.ok,
      reason: attempt.ok ? null : attempt.error,
    };
  }

  let reforge: ReforgeView | null = null;
  if (level < state.level) {
    const attempt = applyReforge({ state, item, expectedLevel: level, now });
    const to = Math.min(state.level, 100);
    const scrap = attempt.ok ? attempt.value.scrap : reforgeCost(item, to);
    reforge = {
      to,
      scrap,
      label: `Reforge to level ${to} for ${number(scrap)} scrap`,
      enabled: attempt.ok,
      reason: attempt.ok ? null : attempt.error,
    };
  }

  // Selling and salvaging need the item unequipped; a dry run on a copy tells what else stops them.
  const sellTry = removeItem(state, item, "sold", now);
  const salvageTry = removeItem(state, item, "salvaged", now, salvageBonus);
  const sellPrice = sellTry.ok ? sellTry.value.removal.coins : null;
  const where = position && positionsOf(item.slot).length > 1 ? ` · ${POSITION_LABEL[position]}` : "";

  return {
    id: item.id,
    baseId: item.baseId,
    name: base?.name ?? "Unknown item",
    setName: base?.setId ? (setDef(base.setId)?.name ?? null) : null,
    slot: item.slot,
    rarity: item.rarity,
    plus: item.plus,
    itemLevel: level,
    title: rarityWithPlus(item.rarity, item.plus),
    power: round1(power),
    compare: worn?.id === item.id ? null : round1(power - (worn ? wornPower(worn, state.classId) : 0)),
    focus: focusLabel(pieceFocus(item)),
    weapon: weaponLabel(base),
    effect: effectLabel(base, item.rarity),
    equipped,
    position,
    tags: equipped ? [`Equipped${where}`] : [],
    locked: canEquip(item, state.level) ? null : { level },
    equip: { enabled: !equipped && equipTry.ok, reason: equipped ? null : equipTry.ok ? null : equipTry.error },
    upgrade,
    maxedNote: step.ok ? null : step.error === "Already maxed" ? "Fully upgraded" : step.error,
    reforge,
    sell: { price: sellPrice, enabled: sellTry.ok, reason: sellTry.ok ? null : sellTry.error },
    salvage: { scrap: salvageTry.ok ? salvageTry.value.removal.scrap : 0, enabled: salvageTry.ok, reason: salvageTry.ok ? null : salvageTry.error },
  };
}

/**
 * Copies of one item shown as one card with "×N". Unequipped copies with the same base, rarity,
 * plus and item level stack; an equipped copy is its own card. Equip, upgrade, sell and salvage act on `item`, one copy of the stack.
 */
export interface StackView {
  key: string;
  count: number;
  /** The copy the card's actions act on. */
  item: ItemView;
}

export interface PositionView {
  position: Position;
  slot: Slot;
  label: string;
  /** What is worn here. */
  equipped: ItemView | null;
  /** Copies owned for the slot (not stacks), worn ones included. */
  owned: number;
  /** Worn copies of the slot first, then stacks of the rest, strongest first. */
  cards: StackView[];
}

const stackKey = (i: OwnedItem) => `${i.baseId}|${i.rarity}|${i.plus}|${itemLevelOf(i)}`;
const strongestFirst = (a: ItemView, b: ItemView) => b.power - a.power || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** Every worn position with what is worn there and what else is owned for its slot. */
export function positionViews(state: GameState | null, inventory: OwnedItem[], now: number): PositionView[] {
  const game = state ?? NO_STATE(now);
  const live = inventory.filter((i) => !i.removed);
  // A worn salvage charm adds to the scrap every salvage shows, as on the server.
  const salvageBonus = gearEffects(equippedItems(game, inventory), game.level).salvageYield;
  return POSITIONS.map((position) => {
    const slot = slotOfPosition(position);
    const copies = live.filter((i) => i.slot === slot);
    const worn = live.find((i) => i.id === equippedOf(game)[position]) ?? null;
    const views = copies.map((i) => ({ owned: i, view: itemView(game, i, now, position, salvageBonus, worn) }));
    const wornCards = views.filter((v) => v.view.equipped).map((v) => ({ key: v.owned.id, count: 1, item: v.view }));
    wornCards.sort((a, b) => Number(b.item.position === position) - Number(a.item.position === position) || strongestFirst(a.item, b.item));

    const stacks = new Map<string, StackView>();
    for (const { owned, view } of [...views].sort((a, b) => a.owned.id.localeCompare(b.owned.id))) {
      if (view.equipped) continue;
      const key = stackKey(owned);
      const stack = stacks.get(key);
      if (stack) stack.count++;
      else stacks.set(key, { key, count: 1, item: view });
    }
    const rest = [...stacks.values()].sort((a, b) => strongestFirst(a.item, b.item));
    return {
      position,
      slot,
      label: POSITION_LABEL[position],
      equipped: views.find((v) => v.view.position === position)?.view ?? null,
      owned: copies.length,
      cards: [...wornCards, ...rest],
    };
  });
}

export interface SetProgress {
  name: string;
  count: number;
  /** The best set among the equipped ones: the only one whose bonus applies. */
  active: boolean;
  tiers: { pieces: number; label: string; reached: boolean }[];
}

/** Equipped pieces per set, best set first, with the 3 and 5 piece bonuses (the effect at the lowest rarity worn). */
export function setProgress(equipped: Pick<OwnedItem, "baseId" | "rarity">[]): SetProgress[] {
  const counts = setCounts(equipped);
  const active = activeSet(equipped);
  return SETS.filter((s) => (counts[s.id] ?? 0) > 0)
    .sort((a, b) => counts[b.id] - counts[a.id] || SETS.indexOf(b) - SETS.indexOf(a))
    .map((s) => ({
      name: s.name,
      count: counts[s.id],
      active: active?.setId === s.id,
      tiers: SET_BONUS.map((t) => ({
        pieces: t.pieces,
        label: `${t.pieces} pieces: +${pct(t.gearPct)} gear power${
          t.pieces === SET_EFFECT_PIECES
            ? `, ${ACCESSORY_EFFECTS[s.effect.id].label} +${pct1(setEffectValue(s.effect.value, equipped.filter((i) => pieceSetId(i) === s.id)))}`
            : ""
        }`,
        reached: counts[s.id] >= t.pieces,
      })),
    }));
}

export interface PowerView {
  /** Null until body power has loaded. */
  body: number | null;
  gear: { counted: number; cap: number; raw: number; setPct: number; capped: boolean } | null;
  bonus: { total: number; cap: number; titles: number; capped: boolean } | null;
  /** Body + counted gear, times the bonus bucket. Null until body power has loaded. */
  battle: number | null;
}

/** Battle power from the Stats tab's body power, what's equipped and the equipped titles. */
export function powerView(bodyPower: number | null, state: GameState | null, inventory: OwnedItem[]): PowerView {
  if (bodyPower == null) return { body: null, gear: null, bonus: null, battle: null };
  const game = state ?? NO_STATE(0);
  const p = battlePower({
    body: bodyPower,
    equipped: equippedItems(game, inventory),
    level: game.level,
    classId: game.classId,
    titlePct: titleBonusPct(game),
    classPct: classBonusPct(game),
  });
  return {
    body: round1(bodyPower),
    gear: { counted: round1(p.gear.counted), cap: round1(p.gear.cap), raw: round1(p.gear.boosted), setPct: p.gear.setPct, capped: p.gear.capped },
    bonus: { total: p.bonus.total, cap: BONUS_BUCKET_CAP, titles: p.bonus.titles, capped: p.bonus.capped },
    battle: round1(p.total),
  };
}

// ---- Best gear (13.9) ----

export interface BestGear {
  /** The equips that get there, each to its position; empty when the best is already worn. */
  moves: { itemId: string; position: Position }[];
  /** Gear power gained, before the gear cap. */
  gain: number;
}

const ARMOR_POSITIONS: Position[] = ["helmet", "chestplate", "gloves", "leggings", "boots"];

/** Gear power of a loadout before the cap: the same rules as battle power (sets, the weapon bonus). */
function loadoutPower(game: GameState, items: OwnedItem[]): number {
  return battlePower({ body: Number.MAX_SAFE_INTEGER, equipped: items, level: game.level, classId: game.classId }).gear.boosted;
}

/**
 * The strongest loadout the user can wear, by gear power: the strongest piece for each position, then
 * each set's best pieces in the armor slots instead, if a set bonus beats it. Effects aren't weighed.
 * Items already worn in a ring or charm position stay where they are.
 */
export function bestGear(state: GameState | null, inventory: OwnedItem[]): BestGear {
  const game = state ?? NO_STATE(0);
  const live = inventory.filter((i) => !i.removed && canEquip(i, game.level));
  const worn = equippedOf(game);
  const ranked = (filter: (i: OwnedItem) => boolean) =>
    live.filter(filter).sort((a, b) => wornPower(b, game.classId) - wornPower(a, game.classId) || a.id.localeCompare(b.id));

  const pick = new Map<Position, OwnedItem>();
  for (const slot of new Set(POSITIONS.map(slotOfPosition))) {
    const positions = positionsOf(slot);
    const best = ranked((i) => i.slot === slot).slice(0, positions.length);
    // Keep chosen items where they are worn; the rest fill the free positions in order.
    const placed = new Set<OwnedItem>();
    for (const p of positions) {
      const there = best.find((i) => i.id === worn[p]);
      if (there) {
        pick.set(p, there);
        placed.add(there);
      }
    }
    const rest = best.filter((i) => !placed.has(i));
    for (const p of positions) if (!pick.has(p) && rest.length) pick.set(p, rest.shift()!);
  }

  let bestPick = pick;
  let bestPower = loadoutPower(game, [...pick.values()]);
  for (const set of SETS) {
    const alt = new Map(pick);
    for (const p of ARMOR_POSITIONS) {
      const piece = ranked((i) => i.slot === p && pieceSetId(i) === set.id)[0];
      if (piece) alt.set(p, piece);
    }
    const power = loadoutPower(game, [...alt.values()]);
    if (power > bestPower + 1e-9) {
      bestPick = alt;
      bestPower = power;
    }
  }

  const current = loadoutPower(game, equippedItems(game, inventory));
  const moves = [...bestPick].filter(([p, i]) => worn[p] !== i.id).map(([position, i]) => ({ itemId: i.id, position }));
  return { moves, gain: moves.length ? round1(bestPower - current) : 0 };
}

export const scrapOf = (state: GameState | null) => materialsOf(state ?? {}).scrap ?? 0;
export const mythicCoresOf = (state: GameState | null) => materialsOf(state ?? {}).mythicCore ?? 0;

// ---- Shop ----

export interface OfferView {
  index: number;
  key: string;
  baseId: string;
  name: string;
  setName: string | null;
  slot: Slot;
  rarity: Rarity;
  /** "HP 70 / DEF 30" */
  focus: string;
  /** "Sword · Striker weapon (+10% power)", for weapons. */
  weapon: string | null;
  /** The item level it comes at: the user's. */
  itemLevel: number;
  price: number;
  /** "Bought" once this offer was taken; the item is the user's. */
  bought: boolean;
  canAfford: boolean;
  /** Why Buy is off, if it is. */
  reason: string | null;
}

export interface ShopView {
  weekId: string;
  /** The stock the server will sell against: the week and reroll count it expects back. */
  rerolls: number;
  offers: OfferView[];
  restocks: string;
  reroll: { cost: number | null; enabled: boolean; reason: string | null; label: string; left: number; total: number };
}

/** "3d 4h", "5h 12m" or "9m": time until the shop restocks (Sunday 00:00 in the game's time zone). */
export function restockLabel(weekId: string, now: number, timeZone: string): string {
  const ms = Math.max(0, dayStartMs(addDays(weekId, 7), timeZone) - now);
  const minutes = Math.ceil(ms / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** This week's stock with what's bought, what the user can afford, and the reroll. */
/** `rerollDiscount` is the worn rerollDiscount effect (see `gearEffects`), as the server applies it. */
export function shopView(
  uid: string,
  doc: ShopDoc | null,
  state: GameState | null,
  now: number,
  timeZone: string,
  rerollDiscount = 0,
): ShopView {
  const week = weekIdOf(now, timeZone);
  const game = state ?? NO_STATE(now);
  const shop = doc ?? emptyShop(week, timeZone, now);
  const offers = shopStock(uid, week, shop.rerolls, game.level).map((o): OfferView => {
    const base = baseItem(o.baseId);
    const bought = shop.bought[offerKey(shop.rerolls, o.index)] != null;
    const attempt = buyOffer({ uid, doc: shop, state: game, index: o.index, expectedRerolls: shop.rerolls, expectedBaseId: o.baseId, now });
    return {
      index: o.index,
      key: o.key,
      baseId: o.baseId,
      name: base?.name ?? "Unknown item",
      setName: base?.setId ? (setDef(base.setId)?.name ?? null) : null,
      slot: base?.slot ?? "helmet",
      rarity: o.rarity,
      focus: base ? focusLabel(base.focus) : "",
      weapon: weaponLabel(base),
      itemLevel: shopItemLevel(game.level),
      price: o.price,
      bought,
      canAfford: game.coins >= o.price,
      reason: bought ? null : attempt.ok ? null : attempt.error,
    };
  });
  const cost = rerollCost(shop, rerollDiscount);
  const attempt = rerollShop(shop, game, shop.rerolls, now, rerollDiscount);
  return {
    weekId: week,
    rerolls: shop.rerolls,
    offers,
    restocks: restockLabel(week, now, timeZone),
    reroll: {
      cost,
      enabled: attempt.ok,
      reason: attempt.ok ? null : attempt.error,
      label: cost == null ? "No rerolls left" : `Reroll for ${number(cost)} coins`,
      left: Math.max(0, SHOP.rerollCosts.length - shop.rerolls),
      total: SHOP.rerollCosts.length,
    },
  };
}

// ---- Titles ----

export interface TitleRow {
  id: TitleId;
  name: string;
  description: string;
  /** "+3%" */
  bonus: string;
  earned: boolean;
  equipped: boolean;
  /** 0 to 1, for the bar. Null until the server has answered with progress. */
  fraction: number | null;
  /** "12 / 28", or why a nearly met achievement isn't. */
  progress: string | null;
  /** Equip or unequip: enabled, and why not. */
  action: { label: "Equip" | "Unequip"; enabled: boolean; reason: string | null } | null;
}

export interface TitlesView {
  slots: { used: number; total: number; max: number; next: { cost: number; enabled: boolean; reason: string | null } | null };
  /** The equipped titles' share of battle power, "+7%". */
  bonus: string;
  bucketNote: string;
  rows: TitleRow[];
}

/** The titles to equip after toggling `id`, or why it can't be done. */
export function toggledTitles(state: GameState | null, id: TitleId): { ok: true; titles: TitleId[] } | { ok: false; reason: string } {
  const t = titlesOf(state ?? {});
  if (t.earned[id] == null) return { ok: false, reason: "Not earned yet" };
  if (t.equipped.includes(id)) return { ok: true, titles: t.equipped.filter((x) => x !== id) };
  if (t.equipped.length >= t.slots) return { ok: false, reason: "Slots full. Unequip one first" };
  return { ok: true, titles: [...t.equipped, id] };
}

function progressText(id: TitleId, p: AchievementProgress): string {
  if (!p.met && p.progress >= p.target && id === "unbroken") {
    return `Needs ${ACHIEVEMENTS.unbroken.minSlots}+ scheduled workouts in the ${ACHIEVEMENTS.unbroken.days} days`;
  }
  return `${number(Math.min(p.progress, p.target))} / ${number(p.target)}`;
}

/** The eight titles with progress (from POST /api/titles, null until it answers), equipped ones first. */
export function titlesView(state: GameState | null, progress: Record<TitleId, AchievementProgress> | null): TitlesView {
  const game = state ?? NO_STATE(0);
  const t = titlesOf(game);
  const cost = slotCost(game);
  const buy = cost == null ? null : buyTitleSlot(game, t.slots, 0);
  const rows = TITLE_IDS.map((id): TitleRow => {
    const earned = t.earned[id] != null;
    const equipped = t.equipped.includes(id);
    const p = progress?.[id] ?? null;
    const toggle = toggledTitles(game, id);
    return {
      id,
      name: TITLE_INFO[id].name,
      description: TITLE_INFO[id].description,
      bonus: `+${pct(titleBonus(id))}`,
      earned,
      equipped,
      fraction: earned ? 1 : p ? Math.min(1, p.progress / p.target) : null,
      progress: earned ? "Earned" : p ? progressText(id, p) : null,
      action: earned
        ? { label: equipped ? "Unequip" : "Equip", enabled: toggle.ok, reason: toggle.ok ? null : toggle.reason }
        : null,
    };
  }).sort(
    (a, b) =>
      Number(b.equipped) - Number(a.equipped) ||
      Number(b.earned) - Number(a.earned) ||
      (b.fraction ?? 0) - (a.fraction ?? 0) ||
      TITLE_IDS.indexOf(a.id) - TITLE_IDS.indexOf(b.id),
  );
  return {
    slots: {
      used: t.equipped.length,
      total: t.slots,
      max: TITLES.maxSlots,
      next: cost == null ? null : { cost, enabled: buy?.ok ?? false, reason: buy && !buy.ok ? buy.error : null },
    },
    bonus: `+${pct(titleBonusPct(game))}`,
    bucketNote: `Titles and class bonuses share one pool, capped at +${pct(BONUS_BUCKET_CAP)}.`,
    rows,
  };
}
