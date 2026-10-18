import { waitForPendingWrites } from "firebase/firestore";
import { firebase } from "./firebase";
import { clearRewardsPending, pendingIds, storeClaimResult } from "./rewardsStore";
import type { ClaimResponse } from "./server/game";

/**
 * Game requests that wait for the network: claiming a finished workout's rewards (POST
 * /api/claim) and rebuilding stats after an edit or delete (POST /api/recompute). Workouts save
 * offline-first, so these sit in a localStorage queue and are sent once the device is online and
 * every pending Firestore write has reached the server. Both endpoints are safe to repeat.
 */
type Task = { kind: "claim"; workoutId: string; queuedAt: number } | { kind: "recompute"; queuedAt: number };

/** Tasks that keep failing (e.g. a claim for a workout that never saved) are dropped after this. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const storageKey = (uid: string) => `dyelb:gameQueue:${uid}`;

function read(uid: string): Task[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid)) ?? "[]") as Task[];
  } catch {
    return [];
  }
}

/** Read-modify-write against fresh storage, so tasks queued meanwhile (or in another tab) survive. */
function update(uid: string, fn: (tasks: Task[]) => Task[]) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(fn(read(uid))));
  } catch {
    // Storage full or blocked: the request is skipped; recompute and the next claim catch up.
  }
}

const sameTask = (a: Task, b: Task) =>
  a.kind === b.kind && (a.kind !== "claim" || a.workoutId === (b as typeof a).workoutId);

/** Queues a workout's reward claim. */
export function queueClaim(uid: string, workoutId: string) {
  const task: Task = { kind: "claim", workoutId, queuedAt: Date.now() };
  update(uid, (tasks) => (tasks.some((t) => sameTask(t, task)) ? tasks : [...tasks, task]));
}

/** Drops a queued claim, e.g. when its workout failed to save or was deleted. */
export function dropClaim(uid: string, workoutId: string) {
  update(uid, (tasks) => tasks.filter((t) => !(t.kind === "claim" && t.workoutId === workoutId)));
  clearRewardsPending(uid, workoutId);
}

/** Queues a stats rebuild. Only one is ever queued; queuing again marks it as newer. */
export function queueRecompute(uid: string) {
  update(uid, (tasks) => [...tasks.filter((t) => t.kind !== "recompute"), { kind: "recompute", queuedAt: Date.now() }]);
}

async function send(task: Task, token: string): Promise<Response> {
  const body =
    task.kind === "claim"
      ? { workoutId: task.workoutId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : {};
  return fetch(task.kind === "claim" ? "/api/claim" : "/api/recompute", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/** Done with a task: it succeeded, or the server says retrying can't help. */
const finished = (res: Response) => res.ok || (res.status >= 400 && res.status < 500 && ![401, 404, 429].includes(res.status));

const flushing = new Map<string, Promise<void>>();

/** Sends the queued tasks in order. Never rejects; whatever fails stays queued for next time. */
export function flushGameQueue(uid: string): Promise<void> {
  let run = flushing.get(uid);
  if (!run) {
    run = flush(uid)
      .catch((err) => console.warn("Game sync will retry later", err))
      .finally(() => flushing.delete(uid));
    flushing.set(uid, run);
  }
  return run;
}

/** A "Rewards pending" marker only makes sense while its claim is queued: clears the ones whose claim is gone. */
function clearOrphanedPending(uid: string) {
  const queued = new Set(read(uid).flatMap((t) => (t.kind === "claim" ? [t.workoutId] : [])));
  for (const id of pendingIds(uid)) if (!queued.has(id)) clearRewardsPending(uid, id);
}

async function flush(uid: string) {
  const now = Date.now();
  update(uid, (tasks) => tasks.filter((t) => now - t.queuedAt < MAX_AGE_MS));
  clearOrphanedPending(uid);
  if (read(uid).length === 0 || !navigator.onLine) return;

  const { auth, db } = firebase();
  // A claim has to see its workout, and a recompute the latest edits, on the server.
  await waitForPendingWrites(db);
  const user = auth.currentUser;
  if (user?.uid !== uid) return;
  const token = await user.getIdToken();

  for (const task of read(uid)) {
    const res = await send(task, token);
    if (task.kind === "claim") await handleClaimAnswer(uid, task.workoutId, res);
    if (finished(res)) {
      // Removed only if unchanged, so a recompute queued during the request still runs.
      update(uid, (tasks) => tasks.filter((t) => !(sameTask(t, task) && t.queuedAt === task.queuedAt)));
    } else if (res.status !== 404) {
      // Signed out, rate limited or server trouble: try again later. (A 404 claim is a workout
      // that hasn't synced; carry on with the rest.)
      return;
    }
  }
}

/**
 * Hands a claim's answer to the Rewards screen. A claim the server refuses for good (a 4xx
 * other than "try again") will never answer, so its "Rewards pending" marker is cleared.
 */
async function handleClaimAnswer(uid: string, workoutId: string, res: Response) {
  if (res.ok) {
    try {
      storeClaimResult(uid, workoutId, (await res.clone().json()) as ClaimResponse);
    } catch {
      clearRewardsPending(uid, workoutId);
    }
  } else if (finished(res)) {
    clearRewardsPending(uid, workoutId);
  }
}
