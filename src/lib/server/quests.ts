import type { Transaction } from "firebase-admin/firestore";
import { newGameState, type GameState, type MusclesDoc } from "../game/claim";
import { DEFAULT_TIME_ZONE } from "../game/config";
import {
  generateQuests,
  payQuest,
  questContext,
  questProgress,
  rerollQuest,
  withQuestRewards,
  type Quest,
  type QuestsDoc,
  type QuestWeek,
} from "../game/quests";
import { emptySchedule, type ScheduleDoc } from "../game/schedule";
import { buildExerciseLookup, type ExerciseLookup } from "../game/sets";
import { addDays, dayStartMs, weekId as weekIdOf } from "../game/time";
import type { Workout } from "../types";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { customExercise, gameRefs, type GameRefs } from "./refs";

/** The user's workouts that started in the week (Sunday to Saturday in the time zone). */
export async function readWeekWorkouts(tx: Transaction, r: GameRefs, weekId: string, timeZone: string): Promise<Workout[]> {
  const snap = await tx.get(
    r.workouts
      .where("startedAt", ">=", dayStartMs(weekId, timeZone))
      .where("startedAt", "<", dayStartMs(addDays(weekId, 7), timeZone)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);
}

/** An exercise lookup that also knows the custom exercises these workouts use. */
export async function readLookup(tx: Transaction, r: GameRefs, workouts: Pick<Workout, "exercises">[]): Promise<ExerciseLookup> {
  const ids = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)).filter((id) => id.startsWith("c_")))];
  const custom = ids.length ? await tx.getAll(...ids.map((id) => r.customExercises.doc(id))) : [];
  return buildExerciseLookup(custom.filter((d) => d.exists).map(customExercise));
}

export const questWeek = (
  weekId: string,
  timeZone: string,
  workouts: Workout[],
  lookup: ExerciseLookup,
  schedule: ScheduleDoc,
): QuestWeek => ({ weekId, timeZone, workouts, lookup, matched: schedule.matched });

/** Everything quest routes read about a user, in one batch. */
async function readGame(tx: Transaction, r: GameRefs) {
  const [stateSnap, musclesSnap, scheduleSnap] = await tx.getAll(r.state, r.muscles, r.schedule);
  return { stateSnap, musclesSnap, scheduleSnap, now: Date.now() };
}

const loadSchedule = (snap: { exists: boolean; data(): unknown }, now: number) =>
  snap.exists ? (snap.data() as ScheduleDoc) : emptySchedule(now);

/** Makes sure this week's quests exist (generating them the first time) and returns them. Safe to repeat. */
export async function ensureQuests(uid: string, timeZone?: string): Promise<QuestsDoc> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const { stateSnap, musclesSnap, scheduleSnap, now } = await readGame(tx, r);
    const zone = timeZone ?? (stateSnap.exists ? (stateSnap.data() as GameState).timeZone : DEFAULT_TIME_ZONE);
    const week = weekIdOf(now, zone);
    const existing = await tx.get(r.quests.doc(week));
    if (existing.exists) return existing.data() as QuestsDoc;

    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, zone);
    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const schedule = loadSchedule(scheduleSnap, now);
    const doc = generateQuests(questContext({ uid, weekId: week, state, muscles, schedule, now, timeZone: zone }), zone, now);
    tx.set(r.quests.doc(week), doc);
    return doc;
  });
}

export interface RerollResponse {
  quests: QuestsDoc;
  coins: number;
  cost: number;
}

/** Rerolls one quest of this week for coins. `expectedRerolls` keeps a retried request from charging twice. */
export async function rerollQuestFor(
  uid: string,
  weekId: string,
  questId: string,
  expectedRerolls: number,
  timeZone?: string,
): Promise<RerollResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const { stateSnap, musclesSnap, scheduleSnap, now } = await readGame(tx, r);
    const questsSnap = await tx.get(r.quests.doc(weekId));
    if (!questsSnap.exists) throw new HttpError(404, "No quests for that week");
    const doc = questsSnap.data() as QuestsDoc;

    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, doc.timeZone);
    const zone = timeZone ?? state.timeZone;
    if (weekIdOf(now, zone) !== weekId) throw new HttpError(400, "Only this week's quests can be rerolled");

    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const schedule = loadSchedule(scheduleSnap, now);
    const workouts = await readWeekWorkouts(tx, r, weekId, zone);
    const week = questWeek(weekId, zone, workouts, await readLookup(tx, r, workouts), schedule);

    const result = rerollQuest(
      doc,
      questId,
      expectedRerolls,
      questContext({ uid, weekId, state, muscles, schedule, now, timeZone: zone }),
      (q) => questProgress(q, week),
      now,
    );
    if (!result.ok) throw new HttpError(409, result.error);
    if (state.coins < result.value.cost) throw new HttpError(402, "Not enough coins");

    const next: GameState = { ...state, coins: state.coins - result.value.cost, updatedAt: now };
    tx.set(r.state, next);
    tx.set(r.quests.doc(weekId), result.value.doc);
    return { quests: result.value.doc, coins: next.coins, cost: result.value.cost };
  });
}

export interface ClaimQuestResponse {
  status: "claimed" | "already-claimed";
  quests: QuestsDoc;
  quest: Quest;
  balance: { coins: number; xp: number; level: number };
}

/** Pays a finished quest (the Claim button, for quests finished by an edit). Idempotent. */
export async function claimQuestFor(uid: string, weekId: string, questId: string): Promise<ClaimQuestResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const { stateSnap, scheduleSnap, now } = await readGame(tx, r);
    const questsSnap = await tx.get(r.quests.doc(weekId));
    if (!questsSnap.exists) throw new HttpError(404, "No quests for that week");
    const doc = questsSnap.data() as QuestsDoc;
    const state = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, doc.timeZone);
    const balance = (s: GameState) => ({ coins: s.coins, xp: s.xp, level: s.level });

    const existing = doc.quests.find((q) => q.id === questId);
    if (existing?.claimedAt != null) return { status: "already-claimed", quests: doc, quest: existing, balance: balance(state) };

    const zone = doc.timeZone;
    const workouts = await readWeekWorkouts(tx, r, weekId, zone);
    const week = questWeek(weekId, zone, workouts, await readLookup(tx, r, workouts), loadSchedule(scheduleSnap, now));

    const paid = payQuest(doc, questId, (q) => questProgress(q, week), now);
    if (!paid.ok) throw new HttpError(409, paid.error);

    const next = withQuestRewards(state, [paid.value.quest], now);
    tx.set(r.state, next);
    tx.set(r.quests.doc(weekId), paid.value.doc);
    return { status: "claimed", quests: paid.value.doc, quest: paid.value.quest, balance: balance(next) };
  });
}
