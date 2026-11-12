"use client";

import { useState } from "react";
import { errorDialog } from "@/lib/dialog";
import { NOTIFY_TEXT, NOTIFY_TYPES, prefsOf, tokenKey, type NotifyType } from "@/lib/game/notify";
import { disableNotifications, enableNotifications, setNotifyPrefs } from "@/lib/gameApi";
import { devicePushToken, forgetPushToken, pushSupport, storedPushToken, type PushSupport } from "@/lib/push";
import { useNotify } from "@/lib/useGame";
import { useOnline } from "@/lib/useOnline";

const WHY_NOT: Record<Exclude<PushSupport, "ok">, string> = {
  unsupported: "This browser can't show notifications. On an iPhone, add the app to your Home Screen first.",
  denied: "Notifications are blocked for this site. Allow them in your browser's settings to turn them on.",
  "not-configured": "Notifications aren't set up on this server yet.",
};

/**
 * Settings · Notifications (GAME_DESIGN.md 13.26): one switch that asks the browser for permission
 * and registers this device, then one switch per message. The device switch is per device; the
 * message switches are for the account.
 */
export function NotificationSettings({ uid }: { uid: string }) {
  const notify = useNotify(uid);
  const online = useOnline();
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [device, setDevice] = useState<string | null>(() => storedPushToken());
  const [busy, setBusy] = useState(false);

  const doc = notify.data;
  const prefs = prefsOf(doc);
  // On for this device only once the server holds this device's token.
  const deviceOn = device != null && doc?.tokens?.[tokenKey(device)] != null;
  const off = busy || !online || notify.status !== "ready";

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      void errorDialog("Couldn't change notifications", err);
    } finally {
      setBusy(false);
      setSupport(pushSupport());
    }
  }

  const toggleDevice = (on: boolean) =>
    run(async () => {
      if (on) {
        const token = await devicePushToken();
        setDevice(token);
        await enableNotifications(token);
      } else if (device) {
        await disableNotifications(device);
        forgetPushToken();
        setDevice(null);
      }
    });

  const note =
    support !== "ok" && !deviceOn
      ? WHY_NOT[support]
      : !online
        ? "You're offline. Notification settings need a connection."
        : "About once a day, around 10 in the morning Eastern time. Each device is switched on separately.";

  return (
    <section>
      <h2 className="mb-2 px-1 text-footnote uppercase text-muted">Notifications</h2>
      <div className="divide-y divide-line rounded-xl bg-surface">
        <label className="flex min-h-11 items-center justify-between gap-3 p-4">
          <span>
            Notifications on this device
            <span className="block text-xs text-muted">{note}</span>
          </span>
          <input
            type="checkbox"
            checked={deviceOn}
            disabled={off || (support !== "ok" && !deviceOn)}
            onChange={(e) => void toggleDevice(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-accent"
          />
        </label>
        {NOTIFY_TYPES.map((type: NotifyType) => (
          <label key={type} className={`flex min-h-11 items-center justify-between gap-3 p-4 ${doc?.enabled ? "" : "opacity-50"}`}>
            <span>
              {NOTIFY_TEXT[type].label}
              <span className="block text-xs text-muted">&ldquo;{NOTIFY_TEXT[type].title}&rdquo;</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[type]}
              disabled={off || !doc?.enabled}
              onChange={(e) => void run(() => setNotifyPrefs({ [type]: e.target.checked }))}
              className="h-5 w-5 shrink-0 accent-accent"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
