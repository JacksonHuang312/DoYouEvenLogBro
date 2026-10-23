import { baseItem, setDef, SETS } from "./catalog";
import { battlePower } from "./battle";
import { newGameState, type GameState } from "./claim";
import {
  ACHIEVEMENTS,
  BONUS_BUCKET_CAP,
  EQUIP_LEVEL,
  SET_BONUS,
  SLOTS,
  TITLES,
  type Rarity,
  type Slot,
} from "./config";
import {
  applyUpgrade,
  equipItem,
  equippedItems,
  equippedOf,
  isAscended,
  materialsOf,
  piecePower,
  removeItem,
  setCounts,
  upgradeStep,
  type OwnedItem,
} from "./items";
import { shopStock, emptyShop, rerollCost, rerollShop, buyOffer, offerKey, type ShopDoc } from "./shop";
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
export const SLOT_LABEL: Record<Slot, string> = {
  helmet: "Helmet",
  chestplate: "Chestplate",
  gloves: "Gloves",
  leggings: "Leggings",
  boots: "Boots",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

// ---- Gear ----

export interface UpgradeView {
  /** "Rare +1 → Rare +2" or "Rare +2 → Epic +0". */
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

export interface ItemView {
  id: string;
  baseId: string;
  name: string;
  setName: string | null;
  slot: Slot;
  rarity: Rarity;
  plus: number;
  /** "Epic +1" */
  title: string;
  power: number;
  equipped: boolean;
  named: boolean;
  ascended: boolean;
  /** Small text labels: Equipped, Named, Ascended. */
  tags: string[];
  /** The level needed when the user's level is below it. */
  locked: { level: number } | null;
  equip: { enabled: boolean; reason: string | null };
  /** Null when the item is at the top of what it can reach. */
  upgrade: UpgradeView | null;
  maxedNote: string | null;
  sell: { price: number | null; enabled: boolean; reason: string | null };
  salvage: { scrap: number; enabled: boolean; reason: string | null };
}

const NO_STATE = (now: number) => newGameState(now, "UTC");

function itemView(state: GameState, item: OwnedItem, now: number): ItemView {
  const base = baseItem(item.baseId);
  const equipped = equippedOf(state)[item.slot] === item.id;
  const ascended = isAscended(item);
  const needed = EQUIP_LEVEL[item.rarity];
  const equipTry = equipItem(state, item, now);

  const step = upgradeStep(item);
  let upgrade: UpgradeView | null = null;
  if (step.ok) {
    const { to, cost } = step.value;
    const attempt = applyUpgrade({ state, item, expected: { rarity: item.rarity, plus: item.plus }, now });
    const parts = [`${number(cost.coins)} coins`, `${number(cost.scrap)} scrap`];
    if (cost.mythicCore) parts.push(`${cost.mythicCore} Mythic Core`);
    upgrade = {
      label: `${RARITY_LABEL(item.rarity)} +${item.plus} → ${RARITY_LABEL(to.rarity)} +${to.plus}`,
      coins: cost.coins,
      scrap: cost.scrap,
      mythicCore: cost.mythicCore ?? 0,
      powerAfter: round1(piecePower({ rarity: to.rarity, plus: to.plus, originRarity: item.originRarity })),
      costLabel: parts.join(" + "),
      enabled: attempt.ok,
      reason: attempt.ok ? null : attempt.error,
    };
  }

  // Selling and salvaging need the item unequipped; a dry run on a copy tells what else stops them.
  const sellTry = removeItem(state, item, "sold", now);
  const salvageTry = removeItem(state, item, "salvaged", now);
  const sellPrice = sellTry.ok ? sellTry.value.removal.coins : null;

  return {
    id: item.id,
    baseId: item.baseId,
    name: base?.name ?? "Unknown item",
    setName: base ? (setDef(base.setId)?.name ?? null) : null,
    slot: item.slot,
    rarity: item.rarity,
    plus: item.plus,
    title: `${RARITY_LABEL(item.rarity)} +${item.plus}`,
    power: round1(piecePower(item)),
    equipped,
    named: item.named,
    ascended,
    tags: [...(equipped ? ["Equipped"] : []), ...(item.named ? ["Named"] : []), ...(ascended ? ["Ascended"] : [])],
    locked: state.level < needed ? { level: needed } : null,
    equip: { enabled: !equipped && equipTry.ok, reason: equipped ? null : equipTry.ok ? null : equipTry.error },
    upgrade,
    maxedNote: step.ok ? null : step.error === "Already maxed" ? "Fully upgraded" : step.error,
    sell: { price: sellPrice, enabled: sellTry.ok, reason: sellTry.ok ? null : sellTry.error },
    salvage: { scrap: salvageTry.ok ? salvageTry.value.removal.scrap : 0, enabled: salvageTry.ok, reason: salvageTry.ok ? null : salvageTry.error },
  };
}

export interface SlotView {
  slot: Slot;
  label: string;
  equipped: ItemView | null;
  /** Everything owned for the slot, strongest first. */
  items: ItemView[];
}

/** Each slot with what is equipped and what else is owned for it, strongest first. */
export function slotViews(state: GameState | null, inventory: OwnedItem[], now: number): SlotView[] {
  const game = state ?? NO_STATE(now);
  const live = inventory.filter((i) => !i.removed);
  return SLOTS.map((slot) => {
    const items = live
      .filter((i) => i.slot === slot)
      .map((i) => itemView(game, i, now))
      .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return { slot, label: SLOT_LABEL[slot], equipped: items.find((i) => i.equipped) ?? null, items };
  });
}

export interface SetProgress {
  name: string;
  count: number;
  /** The best set among the equipped ones: the only one whose bonus applies. */
  active: boolean;
  tiers: { pieces: number; label: string; reached: boolean }[];
}

/** Equipped pieces per set, best set first, with the 3 and 5 piece bonuses. */
export function setProgress(equipped: Pick<OwnedItem, "baseId">[]): SetProgress[] {
  const counts = setCounts(equipped);
  return SETS.filter((s) => (counts[s.id] ?? 0) > 0)
    .sort((a, b) => counts[b.id] - counts[a.id] || SETS.indexOf(b) - SETS.indexOf(a))
    .map((s, i) => ({
      name: s.name,
      count: counts[s.id],
      active: i === 0,
      tiers: SET_BONUS.map((t) => ({
        pieces: t.pieces,
        label: `${t.pieces} pieces: +${pct(t.gearPct)} gear power`,
        reached: counts[s.id] >= t.pieces,
      })),
    }));
}

export interface PowerView {
  /** Null while calibrating: body power is not known yet. */
  body: number | null;
  gear: { counted: number; cap: number; raw: number; setPct: number; capped: boolean } | null;
  bonus: { total: number; cap: number; titles: number; capped: boolean } | null;
  /** Body + counted gear, times the bonus bucket. Null while calibrating. */
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
    titlePct: titleBonusPct(game),
  });
  return {
    body: round1(bodyPower),
    gear: { counted: round1(p.gear.counted), cap: round1(p.gear.cap), raw: round1(p.gear.boosted), setPct: p.gear.setPct, capped: p.gear.capped },
    bonus: { total: p.bonus.total, cap: BONUS_BUCKET_CAP, titles: p.bonus.titles, capped: p.bonus.capped },
    battle: round1(p.total),
  };
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
  price: number;
  /** "Bought" once this offer was taken; the item is the user's. */
  bought: boolean;
  canAfford: boolean;
  /** Why Buy is off, if it is. */
  reason: string | null;
  /** Level needed to equip it, when the user is below it. */
  locked: { level: number } | null;
}

export interface ShopView {
  weekId: string;
  /** The stock the server will sell against: the week and reroll count it expects back. */
  rerolls: number;
  offers: OfferView[];
  restocks: string;
  reroll: { cost: number | null; enabled: boolean; reason: string | null; label: string };
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
export function shopView(uid: string, doc: ShopDoc | null, state: GameState | null, now: number, timeZone: string): ShopView {
  const week = weekIdOf(now, timeZone);
  const game = state ?? NO_STATE(now);
  const shop = doc ?? emptyShop(week, timeZone, now);
  const offers = shopStock(uid, week, shop.rerolls).map((o): OfferView => {
    const base = baseItem(o.baseId);
    const bought = shop.bought[offerKey(shop.rerolls, o.index)] != null;
    const attempt = buyOffer({ uid, doc: shop, state: game, index: o.index, expectedRerolls: shop.rerolls, now });
    return {
      index: o.index,
      key: o.key,
      baseId: o.baseId,
      name: base?.name ?? "Unknown item",
      setName: base ? (setDef(base.setId)?.name ?? null) : null,
      slot: base?.slot ?? "helmet",
      rarity: o.rarity,
      price: o.price,
      bought,
      canAfford: game.coins >= o.price,
      reason: bought ? null : attempt.ok ? null : attempt.error,
      locked: game.level < EQUIP_LEVEL[o.rarity] ? { level: EQUIP_LEVEL[o.rarity] } : null,
    };
  });
  const cost = rerollCost(shop);
  const attempt = rerollShop(shop, game, shop.rerolls, now);
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
