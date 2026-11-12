import type { GameState } from "./claim";
import { XP } from "./config";
import { xpToReach } from "./economy";
import { fightDay, fightWeek, type BattleDoc } from "./fights";

/*
 * Push notifications (GAME_DESIGN.md 13.12 and 13.26). Pure: what a player has switched on, which
 * devices get it, and which messages are due right now. The daily job (`/api/cron/notify`) reads
 * the stored docs, asks `duePushes`, sends, and records what it sent so nothing repeats.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const NOTIFY_TYPES = ["weeklyFight", "levelUp"] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

export const NOTIFY = {
  /** Devices kept per player; registering another drops the one registered longest ago. */
  maxDevices: 5,
  /** No pushes once the game state hasn't changed for this long: someone who left isn't nagged. */
  quietAfterDays: 14,
};

/** The line each message shows, from 13.12, and where tapping it lands. */
export const NOTIFY_TEXT: Record<NotifyType, { title: string; url: string; label: string }> = {
  weeklyFight: { title: "Your weekly fight is ready", url: "/battle", label: "Weekly fight is ready" },
  levelUp: { title: "1 workout from levelling up", url: "/train", label: "One workout from a level" },
};

export type NotifyPrefs = Record<NotifyType, boolean>;
export const DEFAULT_PREFS: NotifyPrefs = { weeklyFight: true, levelUp: true };

/** notify/{uid}. Written only by the server; the owner can read it. */
export interface NotifyDoc {
  /** True while at least one device is registered: the daily job only reads these. */
  enabled: boolean;
  prefs: NotifyPrefs;
  /** Device key -> its push token and when it was registered. */
  tokens: Record<string, { token: string; at: number }>;
  /** Per message type, the key of the last one sent (see `duePushes`). */
  sent: Partial<Record<NotifyType, string>>;
  updatedAt: number;
}

export const emptyNotify = (now: number): NotifyDoc => ({ enabled: false, prefs: DEFAULT_PREFS, tokens: {}, sent: {}, updatedAt: now });

export const prefsOf = (doc: Pick<NotifyDoc, "prefs"> | null): NotifyPrefs => ({ ...DEFAULT_PREFS, ...(doc?.prefs ?? {}) });

/** A short, stable key for a token (tokens are long and can hold characters a field name can't). */
export function tokenKey(token: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < token.length; i++) {
    a = Math.imul(a ^ token.charCodeAt(i), 0x01000193);
    b = Math.imul(b + token.charCodeAt(i), 0x85ebca6b) ^ (b >>> 13);
  }
  return `d${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

/** Registers a device. The same token again only refreshes its time; past maxDevices the oldest goes. */
export function withToken(doc: NotifyDoc, token: string, now: number): NotifyDoc {
  const tokens = { ...doc.tokens, [tokenKey(token)]: { token, at: now } };
  const kept = Object.entries(tokens)
    .sort(([, x], [, y]) => y.at - x.at)
    .slice(0, NOTIFY.maxDevices);
  return { ...doc, enabled: true, tokens: Object.fromEntries(kept), updatedAt: now };
}

/**
 * Forgets one device, or every device with null. With none left, notifications are off and what
 * was sent is forgotten, so turning them on again later starts fresh.
 */
export function withoutToken(doc: NotifyDoc, token: string | null, now: number): NotifyDoc {
  const tokens = token == null ? {} : Object.fromEntries(Object.entries(doc.tokens).filter(([, t]) => t.token !== token));
  const enabled = Object.keys(tokens).length > 0;
  return { ...doc, enabled, tokens, sent: enabled ? doc.sent : {}, updatedAt: now };
}

export const withPrefs = (doc: NotifyDoc, prefs: Partial<NotifyPrefs>, now: number): NotifyDoc => ({
  ...doc,
  prefs: { ...prefsOf(doc), ...prefs },
  updatedAt: now,
});

export interface Push {
  type: NotifyType;
  /** What makes this message new: the same key is never sent twice. */
  key: string;
  title: string;
  url: string;
}

/**
 * The messages due for one player now. Each is sent once per occasion, never repeated while ignored:
 * - weeklyFight: the weekly boss can be fought (a class is picked, and today's fight isn't used).
 *   Once per fight: it comes back the day after the next weekly fight, or with a new week.
 * - levelUp: the next level is at most one workout's XP away and a workout would pay XP now.
 *   Once per level.
 * Nothing is due for a player whose game hasn't changed in NOTIFY.quietAfterDays.
 */
export function duePushes({
  doc,
  state,
  battle,
  now,
}: {
  doc: NotifyDoc;
  state: GameState | null;
  battle: BattleDoc | null;
  now: number;
}): Push[] {
  if (!doc.enabled || !state) return [];
  if (now - state.updatedAt > NOTIFY.quietAfterDays * DAY_MS) return [];
  const prefs = prefsOf(doc);
  const due: Push[] = [];
  const add = (type: NotifyType, key: string) => {
    if (prefs[type] && doc.sent[type] !== key) due.push({ type, key, title: NOTIFY_TEXT[type].title, url: NOTIFY_TEXT[type].url });
  };

  if (state.classId) {
    const week = fightWeek(now, state.timeZone);
    const weekly = battle?.weekly?.weekId === week ? battle.weekly : null;
    if (weekly?.lastFightDay !== fightDay(now, state.timeZone)) add("weeklyFight", `${week}:${weekly?.fights ?? 0}`);
  }

  if (state.level < XP.maxLevel) {
    const left = xpToReach(state.level + 1) - state.xp;
    const pays = now - (state.workoutXpAt ?? 0) >= XP.workoutCooldownHours * HOUR_MS;
    if (left > 0 && left <= XP.perWorkout && pays) add("levelUp", `level:${state.level}`);
  }
  return due;
}

/** Records what was sent, so the same occasion isn't sent again. */
export function markSent(doc: NotifyDoc, pushes: Pick<Push, "type" | "key">[], now: number): NotifyDoc {
  if (!pushes.length) return doc;
  const sent = { ...doc.sent };
  for (const p of pushes) sent[p.type] = p.key;
  return { ...doc, sent, updatedAt: now };
}
