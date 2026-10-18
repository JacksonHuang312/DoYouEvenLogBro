import { freezeFor } from "../game/breaks";
import { calibrationDone, displayStats } from "../game/calibration";
import {
  applyClaim,
  newGameState,
  profileOf,
  recomputedPeak,
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
import { claimDeadline, generateQuests, questContext, questsAfterWorkout, withQuestRewards, type QuestsDoc, type QuestUpdate } from "../game/quests";
import { emptySchedule, matchWorkout, withMatch, type ScheduleDoc } from "../game/schedule";
import { computeStats, power, type StatLine } from "../game/score";
import { buildExerciseLookup } from "../game/sets";
import { dayId, weekId as weekIdOf } from "../game/time";
import type { Workout } from "../types";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { questWeek, readLookup, readWeekWorkouts } from "./quests";
import { customExercise, gameRefs } from "./refs";

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

/**
 * Claims a saved workout's rewards (GAME_DESIGN.md 8.2) in one transaction. Idempotent per
 * workout: once claimed, later calls return the original result and pay nothing.
 */
export async function claimWorkout(uid: string, workoutId: string, timeZone?: string): Promise<ClaimResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);
  const claimRef = r.claims.doc(workoutId);

  return db.runTransaction(async (tx) => {
    const [claim, workoutSnap, stateSnap, musclesSnap, scheduleSnap] = await tx.getAll(
      claimRef,
      r.workouts.doc(workoutId),
      r.state,
      r.muscles,
      r.schedule,
    );
    if (claim.exists) return { status: "already-claimed", result: claim.data() as ClaimResult };
    // Saved offline-first, so the workout may not have reached the server yet; the client retries.
    if (!workoutSnap.exists) throw new HttpError(404, "Workout not found");

    const workout = { id: workoutSnap.id, ...workoutSnap.data() } as Workout;

    const now = Date.now();
    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, timeZone ?? DEFAULT_TIME_ZONE);
    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const zone = timeZone ?? state.timeZone;

    // The quests of the week the workout was done in: this week's (made now if missing), or an
    // older week's while it can still be claimed. All reads happen before any write.
    const week = weekIdOf(workout.startedAt, zone);
    const questsSnap = await tx.get(r.quests.doc(week));
    const savedQuests = questsSnap.exists ? (questsSnap.data() as QuestsDoc) : null;
    const questsOpen = week === weekIdOf(now, zone) || (savedQuests != null && now < claimDeadline(week, savedQuests.timeZone));
    const weekWorkouts = questsOpen ? await readWeekWorkouts(tx, r, week, zone) : [];
    const lookup = await readLookup(tx, r, [workout, ...weekWorkouts]);

    // Which scheduled day (if any) this workout fills; the bonus follows the off-day curve.
    const schedule = scheduleSnap.exists ? (scheduleSnap.data() as ScheduleDoc) : emptySchedule(now);
    const workoutDay = dayId(workout.startedAt, zone);
    const claimDay = dayId(now, zone);
    const match = matchWorkout({ doc: schedule, state, workoutDay, claimDay });

    const outcome = applyClaim({
      state,
      muscles,
      workout,
      lookup,
      now,
      timeZone: zone,
      freeze: freezeFor(state),
      daysOff: match?.daysOff ?? null,
    });
    if (!outcome.counted) {
      // No claim record, so the workout can still be claimed if it's edited to count.
      return { status: "not-counted", reason: outcome.reason, workingSets: outcome.workingSets, required: MIN_WORKING_SETS };
    }

    const scheduleAfter = match ? withMatch(schedule, match, { id: workoutId, day: workoutDay }, claimDay, now) : schedule;

    // Quest progress is counted from the week's workouts, with and without this one. Finished
    // quests are paid here; their coins and XP don't count toward the daily cap.
    let nextState = outcome.state;
    let quests: QuestUpdate[] = [];
    let questsToWrite: QuestsDoc | null = null;
    if (questsOpen) {
      const doc =
        savedQuests ??
        generateQuests(questContext({ uid, weekId: week, state, muscles, schedule, now, timeZone: zone }), zone, now);
      const others = weekWorkouts.filter((w) => w.id !== workoutId);
      const quest = questsAfterWorkout(
        doc,
        questWeek(week, zone, others, lookup, schedule),
        questWeek(week, zone, [...others, workout], lookup, scheduleAfter),
        now,
      );
      nextState = withQuestRewards(outcome.state, quest.paid, now);
      quests = quest.updates;
      if (!savedQuests || quest.paid.length > 0) questsToWrite = quest.doc;
    }

    const result: ClaimResult = {
      ...outcome.result,
      coins: { ...outcome.result.coins, balance: nextState.coins },
      xp: { ...outcome.result.xp, balance: nextState.xp },
      level: { ...outcome.result.level, after: nextState.level },
      schedule: match ? { day: match.day, daysOff: match.daysOff } : null,
      quests,
    };

    tx.set(r.state, nextState);
    tx.set(r.muscles, { muscles: outcome.muscles, updatedAt: now } satisfies MusclesDoc);
    tx.set(claimRef, result);
    tx.set(r.snapshots.doc(outcome.snapshot.weekId), outcome.snapshot);
    if (match) tx.set(r.schedule, scheduleAfter);
    if (questsToWrite) tx.set(r.quests.doc(week), questsToWrite);
    return { status: "claimed", result };
  });
}

/**
 * Rebuilds game/muscles and the weekly snapshots from the user's whole workout history, so an
 * edited typo or a deleted workout stops counting, and lowers the XP peak to match. Coins, XP
 * and claim records are untouched.
 */
export async function recomputeMuscles(uid: string): Promise<RecomputeResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

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
    const freeze = freezeFor(state);
    const replay = replayMuscles(history, lookup, profile, state.timeZone, now, freeze);

    tx.set(r.muscles, { muscles: replay.muscles, updatedAt: now } satisfies MusclesDoc);
    const keep = new Set(replay.snapshots.map((s) => s.weekId));
    for (const d of snapshots.docs) if (!keep.has(d.id)) tx.delete(d.ref);
    for (const s of replay.snapshots) tx.set(r.snapshots.doc(s.weekId), s satisfies Snapshot);
    const peakPower = recomputedPeak(state, replay.peakPower);
    if (stateSnap.exists && peakPower !== state.peakPower) tx.update(r.state, { peakPower, updatedAt: now });

    const shown = roundStats(
      displayStats(computeStats(replay.muscles, profile, now, state.timeZone, freeze), state.calibration, now),
    );
    return { stats: shown, power: Math.round(power(shown) * 10) / 10, calibrating: !calibrationDone(state.calibration, now) };
  });
}
