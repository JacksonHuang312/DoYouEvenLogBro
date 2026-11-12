import type { GameState } from "../game/claim";
import type { BattleDoc } from "../game/fights";
import {
  duePushes,
  emptyNotify,
  markSent,
  prefsOf,
  withoutToken,
  withPrefs,
  withToken,
  type NotifyDoc,
  type NotifyPrefs,
  type Push,
} from "../game/notify";
import { adminDb, adminMessaging } from "./admin";
import { gameRefs } from "./refs";

/*
 * Push notifications on the server (GAME_DESIGN.md 13.26): the routes that register a device and
 * save the switches, and the daily job that sends what is due. notify/{uid} is written only here.
 */

const notifyRef = (uid: string) => adminDb().collection("notify").doc(uid);
const docOf = (data: unknown, now: number): NotifyDoc => {
  const doc = (data as NotifyDoc | undefined) ?? emptyNotify(now);
  return { ...emptyNotify(now), ...doc, prefs: prefsOf(doc), tokens: doc.tokens ?? {}, sent: doc.sent ?? {} };
};

export type NotifyAction =
  /** Registers this device's push token and turns notifications on. */
  | { action: "enable"; token: string }
  /** Forgets one device, or every device with null. */
  | { action: "disable"; token: string | null }
  | { action: "prefs"; prefs: Partial<NotifyPrefs> };

export interface NotifyResponse {
  enabled: boolean;
  prefs: NotifyPrefs;
  devices: number;
}

/** Registers or forgets a device, or saves the per-message switches. Every action is safe to retry. */
export async function notifyAction(uid: string, input: NotifyAction): Promise<NotifyResponse> {
  const ref = notifyRef(uid);
  return adminDb().runTransaction(async (tx) => {
    const now = Date.now();
    const doc = docOf((await tx.get(ref)).data(), now);
    const next =
      input.action === "enable"
        ? withToken(doc, input.token, now)
        : input.action === "disable"
          ? withoutToken(doc, input.token, now)
          : withPrefs(doc, input.prefs, now);
    tx.set(ref, next);
    return { enabled: next.enabled, prefs: next.prefs, devices: Object.keys(next.tokens).length };
  });
}

/** Sends one push to some devices and says which tokens are dead (unregistered or malformed). */
export type PushSender = (tokens: string[], push: Push) => Promise<{ delivered: number; dead: string[] }>;

const DEAD = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"];

/**
 * Firebase Cloud Messaging. Data only: the service worker (public/sw.js) draws the notification and
 * opens `url` on a tap, so it looks the same on every browser.
 */
export const fcmSender: PushSender = async (tokens, push) => {
  const res = await adminMessaging().sendEachForMulticast({
    tokens,
    data: { type: push.type, title: push.title, url: push.url },
    webpush: { headers: { Urgency: "normal", TTL: "86400" } },
  });
  const dead = res.responses.flatMap((r, i) => (!r.success && DEAD.includes(r.error?.code ?? "") ? [tokens[i]] : []));
  return { delivered: res.successCount, dead };
};

/** Against the emulators nothing leaves the machine: every token "delivers", except ones starting "dead-". */
export const emulatorSender: PushSender = async (tokens) => {
  const dead = tokens.filter((t) => t.startsWith("dead-"));
  return { delivered: tokens.length - dead.length, dead };
};

export const usingEmulators = () => process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" || Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export interface DailyPushReport {
  /** Players with notifications on. */
  checked: number;
  /** Messages delivered to at least one device, by type. */
  sent: Record<string, number>;
  /** Dead device tokens removed. */
  removed: number;
  failed: number;
}

/**
 * The daily job: for every player with notifications on, sends what `duePushes` says and records it,
 * so the same occasion is never sent twice. A message that reached no device isn't recorded, and
 * is tried again the next day. Dead tokens are dropped.
 */
export async function runDailyPushes(now: number, send: PushSender): Promise<DailyPushReport> {
  const db = adminDb();
  const report: DailyPushReport = { checked: 0, sent: {}, removed: 0, failed: 0 };
  const players = await db.collection("notify").where("enabled", "==", true).get();

  for (const snap of players.docs) {
    report.checked++;
    try {
      const uid = snap.id;
      const doc = docOf(snap.data(), now);
      const r = gameRefs(db, uid);
      const [state, battle] = await Promise.all([r.state.get(), r.battle.get()]);
      const due = duePushes({
        doc,
        state: state.exists ? (state.data() as GameState) : null,
        battle: battle.exists ? (battle.data() as BattleDoc) : null,
        now,
      });
      if (!due.length) continue;

      const tokens = Object.values(doc.tokens).map((t) => t.token);
      const delivered: Push[] = [];
      const dead = new Set<string>();
      for (const push of due) {
        const result = await send(tokens.filter((t) => !dead.has(t)), push);
        result.dead.forEach((t) => dead.add(t));
        if (result.delivered > 0) {
          delivered.push(push);
          report.sent[push.type] = (report.sent[push.type] ?? 0) + 1;
        }
      }
      if (!delivered.length && !dead.size) continue;

      // Applied to the doc as it is now, so a switch flipped while the job ran isn't undone.
      await db.runTransaction(async (tx) => {
        let fresh = docOf((await tx.get(snap.ref)).data(), now);
        for (const token of dead) fresh = withoutToken(fresh, token, now);
        tx.set(snap.ref, markSent(fresh, delivered, now));
      });
      report.removed += dead.size;
    } catch (err) {
      report.failed++;
      console.error(`Daily pushes failed for ${snap.id}`, err);
    }
  }
  return report;
}
