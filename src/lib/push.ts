import { firebase } from "./firebase";

/*
 * This device's side of push notifications (GAME_DESIGN.md 13.26): whether the browser can do it,
 * asking for permission, and getting the device's push token from Firebase Cloud Messaging. The
 * token is remembered on the device so Settings knows whether *this* device is registered.
 * Browser only.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";
const STORE = "dyelb.pushToken";

export type PushSupport =
  /** Can be turned on. */
  | "ok"
  /** The browser has no web push (or, on an iPhone, the app isn't on the Home Screen yet). */
  | "unsupported"
  /** The user said no in the browser; only the browser's own settings can undo that. */
  | "denied"
  /** The deployment has no web push key. */
  | "not-configured";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (!VAPID_KEY && !USE_EMULATORS) return "not-configured";
  return "ok";
}

/** The token this device registered, if it did. */
export function storedPushToken(): string | null {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(STORE, token);
    else localStorage.removeItem(STORE);
  } catch {
    // Private mode: the switch just won't remember this device.
  }
}

export class PushError extends Error {}

/**
 * Asks for permission (must be called from a tap) and returns this device's push token.
 * Against the emulators there is no push service, so the token is a made-up one.
 */
export async function devicePushToken(): Promise<string> {
  const support = pushSupport();
  if (support === "unsupported") throw new PushError("This browser can't show notifications. On an iPhone, add the app to your Home Screen first.");
  if (support === "not-configured") throw new PushError("Notifications aren't set up on this server yet.");
  const permission = support === "denied" ? "denied" : await Notification.requestPermission();
  if (permission !== "granted") throw new PushError("Notifications are blocked for this site. Allow them in your browser's settings, then try again.");

  if (USE_EMULATORS) {
    const token = storedPushToken() ?? `emulator-${crypto.randomUUID()}`;
    remember(token);
    return token;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new PushError("This browser can't show notifications.");
  const token = await getToken(getMessaging(firebase().app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new PushError("Couldn't register this device for notifications. Try again.");
  remember(token);
  return token;
}

/** Forgets this device's token here (the server is told separately). */
export function forgetPushToken() {
  remember(null);
}
