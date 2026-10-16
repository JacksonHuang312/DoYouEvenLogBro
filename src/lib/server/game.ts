import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { calibrationDone, displayStats } from "../game/calibration";
import {
  applyClaim,
  newGameState,
  profileOf,
  replayMuscles,
  roundStats,
  type ClaimableWorkout,
  type ClaimResult,
  type GameState,
  type MusclesDoc,
  type NotCountedReason,
  type Snapshot,
} from "../game/claim";
import { DEFAULT_TIME_ZONE, MIN_WORKING_SETS } from "../game/config";
import { computeStats, power, type StatLine } from "../game/score";
import { buildExerciseLookup } from "../game/sets";
import type { Workout } from "../types";
import { adminDb } from "./admin";
import { HttpError } from "./api";

/** POST /api/claim response. */
export type ClaimResponse =
  | { status: "claimed" | "already-claimed"; result: ClaimResult }
  | { status: "not-counted"; reason: NotCountedReason; workingSets: number; required: number };

/** POST /api/recompute response. */
export interface RecomputeResponse {
  /** As shown: population averages while calibrating. */
  stats: StatLine;
  power: number;
  calibrating: boolean;
}

function refs(db: Firestore, uid: string) {
  const user = db.collection("users").doc(uid);
  return {
    state: user.collection("game").doc("state"),
    muscles: user.collection("game").doc("muscles"),
    claims: user.collection("claims"),
    snapshots: user.collection("snapshots"),
    workouts: user.collection("workouts"),
    customExercises: user.collection("customExercises"),
  };
}

const customExercise = (d: DocumentSnapshot) => ({
  id: d.id,
  ...(d.data() as { muscle: string; category: string; equipment: string }),
});

/**
 * Claims a saved workout's rewards (GAME_DESIGN.md 8.2) in one transaction. Idempotent per
 * workout: once claimed, later calls return the original result and pay nothing.
 */
export async function claimWorkout(uid: string, workoutId: string, timeZone?: string): Promise<ClaimResponse> {
  const db = adminDb();
  const r = refs(db, uid);
  const claimRef = r.claims.doc(workoutId);

  return db.runTransaction(async (tx) => {
    const [claim, workoutSnap, stateSnap, musclesSnap] = await tx.getAll(
      claimRef,
      r.workouts.doc(workoutId),
      r.state,
      r.muscles,
    );
    if (claim.exists) return { status: "already-claimed", result: claim.data() as ClaimResult };
    // Saved offline-first, so the workout may not have reached the server yet; the client retries.
    if (!workoutSnap.exists) throw new HttpError(404, "Workout not found");

    const workout = { id: workoutSnap.id, ...workoutSnap.data() } as Workout;
    const customIds = [...new Set(workout.exercises.map((e) => e.exerciseId).filter((id) => id.startsWith("c_")))];
    const custom = customIds.length ? await tx.getAll(...customIds.map((id) => r.customExercises.doc(id))) : [];
    const lookup = buildExerciseLookup(custom.filter((d) => d.exists).map(customExercise));

    const now = Date.now();
    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, timeZone ?? DEFAULT_TIME_ZONE);
    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const outcome = applyClaim({ state, muscles, workout, lookup, now, timeZone: timeZone ?? state.timeZone });
    if (!outcome.counted) {
      // No claim record, so the workout can still be claimed if it's edited to count.
      return { status: "not-counted", reason: outcome.reason, workingSets: outcome.workingSets, required: MIN_WORKING_SETS };
    }

    tx.set(r.state, outcome.state);
    tx.set(r.muscles, { muscles: outcome.muscles, updatedAt: now } satisfies MusclesDoc);
    tx.set(claimRef, outcome.result);
    tx.set(r.snapshots.doc(outcome.snapshot.weekId), outcome.snapshot);
    return { status: "claimed", result: outcome.result };
  });
}

/**
 * Rebuilds game/muscles and the weekly snapshots from the user's whole workout history, so an
 * edited typo or a deleted workout stops counting. Coins, XP and claim records are untouched.
 */
export async function recomputeMuscles(uid: string): Promise<RecomputeResponse> {
  const db = adminDb();
  const r = refs(db, uid);

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(r.state);
    const workouts = await tx.get(r.workouts.select("exercises", "startedAt", "endedAt"));
    const custom = await tx.get(r.customExercises.select("muscle", "category", "equipment"));
    const snapshots = await tx.get(r.snapshots.select());

    const now = Date.now();
    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, DEFAULT_TIME_ZONE);
    const profile = profileOf(state);
    const history = workouts.docs.map((d) => ({ id: d.id, ...d.data() }) as ClaimableWorkout);
    const lookup = buildExerciseLookup(custom.docs.map(customExercise));
    const replay = replayMuscles(history, lookup, profile, state.timeZone, now);

    tx.set(r.muscles, { muscles: replay.muscles, updatedAt: now } satisfies MusclesDoc);
    const keep = new Set(replay.snapshots.map((s) => s.weekId));
    for (const d of snapshots.docs) if (!keep.has(d.id)) tx.delete(d.ref);
    for (const s of replay.snapshots) tx.set(r.snapshots.doc(s.weekId), s satisfies Snapshot);

    const shown = roundStats(
      displayStats(computeStats(replay.muscles, profile, now, state.timeZone), state.calibration, now),
    );
    return { stats: shown, power: Math.round(power(shown) * 10) / 10, calibrating: !calibrationDone(state.calibration, now) };
  });
}
