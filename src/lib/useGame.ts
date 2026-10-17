"use client";

import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { GameState, MusclesDoc, Snapshot } from "./game/claim";
import type { MusclesFacts } from "./game/facts";
import type { LoadStatus } from "./game/view";
import { firebase } from "./firebase";

/*
 * Live, read-only views of the game docs the server writes (GAME_DESIGN.md 8.3). The owner can
 * read them under firestore.rules; nothing here writes.
 *
 * "Missing" has to mean the server said so. A listener on a cold cache answers at once with
 * "doesn't exist, from cache", which is not an answer, so a missing doc stays "loading" until the
 * server confirms it. If that never comes (offline, nothing cached) the status becomes
 * "unavailable" after UNAVAILABLE_AFTER_MS, so the screen can say so instead of spinning forever.
 */

const UNAVAILABLE_AFTER_MS = 8000;

/** Snapshots kept for the radar overlay: a year of weekly ones, plus a margin. */
const SNAPSHOTS_KEPT = 60;

interface Live<T> {
  status: LoadStatus;
  data: T;
}

/** Subscribes with `listen`, which calls `settle` for each answer worth showing and `fail` on an error. */
function useLive<T>(key: string, empty: T, listen: (settle: (data: T) => void, fail: () => void) => () => void): Live<T> {
  const [answer, setAnswer] = useState<{ key: string; status: LoadStatus; data: T } | null>(null);
  const [timedOut, setTimedOut] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(key), UNAVAILABLE_AFTER_MS);
    const unsubscribe = listen(
      (data) => {
        clearTimeout(timer);
        setAnswer({ key, status: "ready", data });
      },
      () => {
        clearTimeout(timer);
        setAnswer((a) => (a?.key === key ? a : { key, status: "unavailable", data: empty }));
      },
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
    // `listen` and `empty` are rebuilt every render; `key` identifies what they listen to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (answer?.key === key) return { status: answer.status, data: answer.data };
  return { status: timedOut === key ? "unavailable" : "loading", data: empty };
}

const NO_MUSCLES: MusclesFacts = {};
const NO_SNAPSHOTS: Snapshot[] = [];

function useGameDoc<T>(uid: string, name: "state" | "muscles", empty: T, pick: (data: unknown) => T): Live<T> {
  return useLive(`${uid}/game/${name}`, empty, (settle, fail) =>
    onSnapshot(
      doc(firebase().db, "users", uid, "game", name),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) settle(pick(snap.data()));
        else if (!snap.metadata.fromCache) settle(empty);
      },
      (err) => {
        console.error(`Couldn't load game/${name}`, err);
        fail();
      },
    ),
  );
}

/** game/state: coins, XP, calibration, body inputs, time zone. data is null once the server confirms there is none yet. */
export function useGameState(uid: string): Live<GameState | null> {
  return useGameDoc<GameState | null>(uid, "state", null, (d) => d as GameState);
}

/** game/muscles: the stored per-sub-muscle facts. Empty once the server confirms there are none yet. */
export function useMuscleFacts(uid: string): Live<MusclesFacts> {
  return useGameDoc<MusclesFacts>(uid, "muscles", NO_MUSCLES, (d) => (d as MusclesDoc).muscles ?? NO_MUSCLES);
}

/** The newest weekly stat snapshots, for the radar's comparison overlay. */
export function useSnapshots(uid: string): Live<Snapshot[]> {
  return useLive(`${uid}/snapshots`, NO_SNAPSHOTS, (settle, fail) =>
    onSnapshot(
      query(collection(firebase().db, "users", uid, "snapshots"), orderBy("takenAt", "desc"), limit(SNAPSHOTS_KEPT)),
      { includeMetadataChanges: true },
      (snap) => {
        // An empty answer from the cache says nothing about the server.
        if (snap.empty && snap.metadata.fromCache) return;
        settle(snap.docs.map((d) => d.data() as Snapshot));
      },
      (err) => {
        console.error("Couldn't load snapshots", err);
        fail();
      },
    ),
  );
}
