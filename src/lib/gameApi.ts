import type { Rarity, Slot, Stat } from "./game/config";
import type { QuestsDoc } from "./game/quests";
import type { ScheduleDoc, WeekdayRoutines } from "./game/schedule";
import { firebase } from "./firebase";
import type { BreaksResponse } from "./server/breaks";
import type { ItemResponse, ShopResponse } from "./server/items";
import type { ClaimQuestResponse, RerollResponse } from "./server/quests";
import type { TitlesResponse } from "./server/titles";
import type { TitleId } from "./game/titles";

/*
 * Client calls to the game routes behind the Quests screen. Unlike the claim queue these are
 * interactive: they need a connection and answer right away, so a failure throws an ApiError the
 * screen can show. The Firestore listeners (useGame.ts) pick up whatever the server wrote.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
  ) {
    super(message);
  }
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = firebase().auth.currentUser;
  if (!user) throw new ApiError("You're signed out. Sign in again and retry.", 401);
  let res: Response;
  try {
    const token = await user.getIdToken();
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("You're offline. Try again when you're back online.", 0);
  }
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(json?.error ?? `Something went wrong (${res.status}).`, res.status);
  return json as T;
}

// ---- Quests ----

/** Makes sure this week's quests exist (the server generates them the first time). Safe to repeat. */
export const loadQuests = () => post<{ quests: QuestsDoc }>("/api/quests", { timeZone: timeZone() });

/** Pays a finished quest. Needed for quests finished by editing a workout; a workout claim pays its own. */
export const claimQuest = (weekId: string, questId: string) =>
  post<ClaimQuestResponse>("/api/quests/claim", { weekId, questId });

/** Rerolls a quest for coins. `expectedRerolls` is the count on screen, so a retry can't charge twice. */
export const rerollQuest = (weekId: string, questId: string, expectedRerolls: number) =>
  post<RerollResponse>("/api/quests/reroll", { weekId, questId, expectedRerolls, timeZone: timeZone() });

// ---- Schedule ----

/** Saves the weekly schedule. It starts tomorrow. */
export const saveSchedule = (days: WeekdayRoutines) => post<ScheduleDoc>("/api/schedule", { days, timeZone: timeZone() });

// ---- Pause and injuries ----

export const startPause = (days: number) => post<BreaksResponse>("/api/pause", { action: "start", days, timeZone: timeZone() });
export const endPause = () => post<BreaksResponse>("/api/pause", { action: "end", timeZone: timeZone() });

export const flagInjury = (stat: Stat, opts: { note?: string; expectedReturn?: string } = {}) =>
  post<BreaksResponse>("/api/injuries", { action: "flag", stat, timeZone: timeZone(), ...opts });
export const renewInjury = (stat: Stat) => post<BreaksResponse>("/api/injuries", { action: "renew", stat, timeZone: timeZone() });
export const clearInjury = (stat: Stat) => post<BreaksResponse>("/api/injuries", { action: "clear", stat, timeZone: timeZone() });
export const setInjuryVisibility = (show: boolean) =>
  post<BreaksResponse>("/api/injuries", { action: "visibility", show, timeZone: timeZone() });

// ---- Shop, items and titles ----

export const buyOffer = (weekId: string, index: number, expectedRerolls: number) =>
  post<ShopResponse>("/api/shop", { action: "buy", weekId, index, expectedRerolls, timeZone: timeZone() });
export const rerollShop = (weekId: string, expectedRerolls: number) =>
  post<ShopResponse>("/api/shop", { action: "reroll", weekId, expectedRerolls, timeZone: timeZone() });

export const equipItem = (itemId: string) => post<ItemResponse>("/api/items", { action: "equip", itemId });
export const unequipSlot = (slot: Slot) => post<ItemResponse>("/api/items", { action: "unequip", slot });
/** `rarity` and `plus` are what is on screen, so a retry can't upgrade twice. */
export const upgradeItem = (itemId: string, rarity: Rarity, plus: number) =>
  post<ItemResponse>("/api/items", { action: "upgrade", itemId, expectedRarity: rarity, expectedPlus: plus });
export const sellItem = (itemId: string) => post<ItemResponse>("/api/items", { action: "sell", itemId });
export const salvageItem = (itemId: string) => post<ItemResponse>("/api/items", { action: "salvage", itemId });

/** Checks the achievements (the server records newly earned titles) and returns progress on all eight. */
export const checkTitles = () => post<TitlesResponse>("/api/titles", { action: "check", timeZone: timeZone() });
export const equipTitles = (titles: TitleId[]) => post<TitlesResponse>("/api/titles", { action: "equip", titles, timeZone: timeZone() });
/** `expectedSlots` is the slot count on screen, so a retry can't buy two. */
export const buyTitleSlot = (expectedSlots: number) =>
  post<TitlesResponse>("/api/titles", { action: "buy-slot", expectedSlots, timeZone: timeZone() });
