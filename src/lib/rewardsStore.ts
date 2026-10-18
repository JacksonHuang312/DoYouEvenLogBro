import { useSyncExternalStore } from "react";
import type { ClaimResponse } from "./server/game";
import type { RewardsSummary } from "./game/rewards";

/*
 * Where the Rewards screen's data waits (GAME_DESIGN.md 7.3, 8.2). finish() writes a "pending"
 * marker synchronously, so the app can say "Rewards pending" while the claim is queued. When
 * gameSync gets the claim's answer it stores it here and emits an event; <RewardsHost> opens the
 * screen from it. Everything is in localStorage so a closed tab or an offline workout still gets
 * its Rewards screen the next time the claim goes through.
 */

const EVENT = "dyelb:rewards";
/** Answers nobody looked at for this long are dropped: the screen is for right after a workout. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;

interface PendingEntry {
  summary: RewardsSummary;
  markedAt: number;
}

/** A claim answer that hasn't been shown yet. */
export interface StoredReward {
  workoutId: string;
  response: ClaimResponse;
  /** Missing for claims queued before this screen existed. */
  summary: RewardsSummary | null;
  receivedAt: number;
}

export interface RewardsState {
  /** Workouts whose claim hasn't answered yet, oldest first. */
  pending: { workoutId: string; summary: RewardsSummary }[];
  /** Answers waiting to be shown, oldest first. */
  results: StoredReward[];
}

const pendingKey = (uid: string) => `dyelb:rewardsPending:${uid}`;
const resultsKey = (uid: string) => `dyelb:rewards:${uid}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the screen is a courtesy, the claim itself doesn't depend on it.
  }
}

const emit = () => {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // No window (server render): nothing is listening.
  }
};

const readPending = (uid: string) => readJson<Record<string, PendingEntry>>(pendingKey(uid), {});
const readResults = (uid: string) => readJson<StoredReward[]>(resultsKey(uid), []);

/**
 * Notes that a finished workout's rewards are on their way. Synchronous and never throws, so
 * finish() stays offline-first and instant.
 */
export function markRewardsPending(uid: string, workoutId: string, summary: RewardsSummary) {
  try {
    writeJson(pendingKey(uid), { ...readPending(uid), [workoutId]: { summary, markedAt: Date.now() } });
    emit();
  } catch {
    // Never let the rewards screen get in the way of saving a workout.
  }
}

/** The workout ids with a "Rewards pending" marker. */
export const pendingIds = (uid: string): string[] => Object.keys(readPending(uid));

/** Forgets a pending marker, e.g. when the queue gave up on the claim. */
export function clearRewardsPending(uid: string, workoutId: string) {
  const all = readPending(uid);
  if (!(workoutId in all)) return;
  delete all[workoutId];
  writeJson(pendingKey(uid), all);
  emit();
}

/**
 * Stores a claim's answer for the screen and clears the workout's pending marker. Only answers
 * the user is waiting for are kept: one that was expected (a marker existed) or that paid
 * something new. A repeated claim for a workout seen before is not shown again.
 */
export function storeClaimResult(uid: string, workoutId: string, response: ClaimResponse) {
  const marker = readPending(uid)[workoutId];
  const worthShowing = marker != null || response.status === "claimed";
  if (marker) {
    const all = readPending(uid);
    delete all[workoutId];
    writeJson(pendingKey(uid), all);
  }
  if (worthShowing) {
    const now = Date.now();
    const kept = readResults(uid).filter((r) => r.workoutId !== workoutId && now - r.receivedAt < MAX_AGE_MS);
    const entry: StoredReward = { workoutId, response, summary: marker?.summary ?? null, receivedAt: now };
    writeJson(resultsKey(uid), [...kept, entry].slice(-MAX_RESULTS));
  }
  emit();
}

/** The user has seen (or dismissed) this answer. */
export function dismissReward(uid: string, workoutId: string) {
  writeJson(resultsKey(uid), readResults(uid).filter((r) => r.workoutId !== workoutId));
  emit();
}

// ---- Reading it in React ----

const NOTHING: RewardsState = { pending: [], results: [] };
let cache: { uid: string; rawPending: string | null; rawResults: string | null; state: RewardsState } | null = null;

/** The current state, the same object until storage changes (what useSyncExternalStore needs). */
function snapshot(uid: string): RewardsState {
  let rawPending: string | null = null;
  let rawResults: string | null = null;
  try {
    rawPending = localStorage.getItem(pendingKey(uid));
    rawResults = localStorage.getItem(resultsKey(uid));
  } catch {
    return NOTHING;
  }
  if (cache && cache.uid === uid && cache.rawPending === rawPending && cache.rawResults === rawResults) return cache.state;
  const pending = Object.entries(readPending(uid))
    .sort(([, a], [, b]) => a.markedAt - b.markedAt)
    .map(([workoutId, p]) => ({ workoutId, summary: p.summary }));
  const now = Date.now();
  const results = readResults(uid).filter((r) => now - r.receivedAt < MAX_AGE_MS);
  const state = pending.length === 0 && results.length === 0 ? NOTHING : { pending, results };
  cache = { uid, rawPending, rawResults, state };
  return state;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Pending claims and unseen answers for this user, live. */
export function useRewards(uid: string): RewardsState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(uid),
    () => NOTHING,
  );
}
