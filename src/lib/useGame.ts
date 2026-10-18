"use client";

import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { GameState, MusclesDoc, Snapshot } from "./game/claim";
import type { MusclesFacts } from "./game/facts";
import type { QuestsDoc } from "./game/quests";
import type { ScheduleDoc } from "./game/schedule";
import { weekId as weekIdOf } from "./game/time";
import type { LoadStatus } from "./game/view";
import { firebase } from "./firebase";
import { ApiError, loadQuests } from "./gameApi";

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

/** Logs a failed listener. Permission errors (rules not deployed yet) are a warning: the screen already says it can't load. */
function report(what: string, err: { code?: string }) {
  (err.code === "permission-denied" ? console.warn : console.error)(`Couldn't load ${what}`, err);
}

const NO_MUSCLES: MusclesFacts = {};
const NO_SNAPSHOTS: Snapshot[] = [];

function useGameDoc<T>(uid: string, name: "state" | "muscles" | "schedule", empty: T, pick: (data: unknown) => T): Live<T> {
  return useLive(`${uid}/game/${name}`, empty, (settle, fail) =>
    onSnapshot(
      doc(firebase().db, "users", uid, "game", name),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) settle(pick(snap.data()));
        else if (!snap.metadata.fromCache) settle(empty);
      },
      (err) => {
        report(`game/${name}`, err);
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
        report("snapshots", err);
        fail();
      },
    ),
  );
}

/** game/schedule: the weekly schedule and which days were filled. data is null once the server confirms none was saved yet. */
export function useSchedule(uid: string): Live<ScheduleDoc | null> {
  return useGameDoc<ScheduleDoc | null>(uid, "schedule", null, (d) => d as ScheduleDoc);
}

export interface QuestsLive extends Live<QuestsDoc | null> {
  /** The id of the week the quests are for (this week, in the game's time zone). */
  weekId: string;
  /** Why the server couldn't make or load this week's quests, if it couldn't. Offline is not an error. */
  error: string | null;
  /** Asks the server again (the Retry button). */
  retry: () => void;
}

/**
 * This week's quests. Opening the screen calls POST /api/quests, which generates them the first
 * time the week is opened; a live listener on quests/{weekId} then keeps them current through
 * claims, rerolls and injury swaps. Offline, whatever is cached shows and nothing is requested.
 */
export function useQuests(uid: string, timeZone: string): QuestsLive {
  const [week] = useState(() => weekIdOf(Date.now(), timeZone));
  const [made, setMade] = useState<{ week: string; doc: QuestsDoc } | null>(null);
  const [failure, setFailure] = useState<{ week: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const live = useLive<QuestsDoc | null>(`${uid}/quests/${week}`, null, (settle, fail) =>
    onSnapshot(
      doc(firebase().db, "users", uid, "quests", week),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) settle(snap.data() as QuestsDoc);
        else if (!snap.metadata.fromCache) settle(null);
      },
      (err) => {
        report("quests", err);
        fail();
      },
    ),
  );

  useEffect(() => {
    let cancelled = false;
    const ask = () => {
      if (!navigator.onLine) return;
      loadQuests()
        .then(({ quests }) => !cancelled && quests.weekId === week && (setMade({ week, doc: quests }), setFailure(null)))
        .catch((err) => {
          // A request that never left the device is just "offline", not something to report.
          if (!cancelled && !(err instanceof ApiError && err.status === 0)) {
            setFailure({ week, message: err instanceof Error ? err.message : "Couldn't load quests." });
          }
        });
    };
    ask();
    window.addEventListener("online", ask);
    return () => {
      cancelled = true;
      window.removeEventListener("online", ask);
    };
  }, [uid, week, attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  // The listener is the source of truth; what the route returned covers the moment before it answers.
  const fallback = made?.week === week ? made.doc : null;
  const data = live.data ?? fallback;
  const status: LoadStatus = data ? "ready" : live.status;
  return { status, data, weekId: week, error: failure?.week === week ? failure.message : null, retry };
}
