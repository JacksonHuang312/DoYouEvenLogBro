"use client";

import { disableNetwork, enableNetwork } from "firebase/firestore";
import { useEffect } from "react";
import { firebase } from "@/lib/firebase";

/** Backgrounded longer than this and the old connection is presumed dead. */
const STALE_AFTER_MS = 10_000;

/**
 * Phones suspend a backgrounded PWA and silently kill its network connection. Firestore
 * still believes it's online, so every request waits on the dead connection and pages spin
 * forever. When the app comes back (or the device reconnects), cycle Firestore's network:
 * stuck reads settle from the offline cache, and a fresh connection takes over.
 * Queued writes aren't lost; they're sent once the network is enabled again. Renders nothing.
 */
export function FirestoreReconnect() {
  useEffect(() => {
    let hiddenAt: number | null = null;
    let cycling = false;

    async function reconnect() {
      if (cycling) return;
      cycling = true;
      const { db } = firebase();
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch (err) {
        console.warn("Couldn't reconnect Firestore", err);
      } finally {
        cycling = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt != null) {
        if (Date.now() - hiddenAt > STALE_AFTER_MS) void reconnect();
        hiddenAt = null;
      }
    }
    // Restored from the back/forward cache: the page's connections didn't survive.
    const onPageShow = (e: PageTransitionEvent) => e.persisted && void reconnect();
    const onOnline = () => void reconnect();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
