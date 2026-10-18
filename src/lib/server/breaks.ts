import {
  clearInjury,
  endPause,
  flagInjury,
  injuriesOf,
  pausesOf,
  publicInjuries,
  renewInjury,
  setShowInjuries,
  startPause,
  type Injury,
  type Pause,
  type Result,
} from "../game/breaks";
import { newGameState, type GameState, type MusclesDoc } from "../game/claim";
import { DEFAULT_TIME_ZONE, type Stat } from "../game/config";
import { questContext, questProgress, swapInjuredQuests, type QuestsDoc } from "../game/quests";
import { emptySchedule, type ScheduleDoc } from "../game/schedule";
import { weekId as weekIdOf } from "../game/time";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { questWeek, readLookup, readWeekWorkouts } from "./quests";
import { gameRefs } from "./refs";

/** Pauses and injury flags as the screen shows them. */
export interface BreaksResponse {
  pauses: Pause[];
  injuries: Injury[];
  showInjuries: boolean;
  /** Quests replaced because their stat was just flagged. */
  swappedQuests?: boolean;
}

const view = (s: GameState): BreaksResponse => ({
  pauses: pausesOf(s),
  injuries: injuriesOf(s),
  showInjuries: s.showInjuries !== false,
});

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new HttpError(409, result.error);
  return result.value;
}

export type PauseAction = { action: "start"; days: number } | { action: "end" };

/** Starts or ends a vacation pause (GAME_DESIGN.md 3.6). Decay and the schedule freeze while it runs. */
export async function pauseAction(uid: string, input: PauseAction, timeZone?: string): Promise<BreaksResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(r.state);
    const now = Date.now();
    const current = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, timeZone ?? DEFAULT_TIME_ZONE);
    const zone = timeZone ?? current.timeZone;
    const next = unwrap(input.action === "start" ? startPause(current, input.days, now, zone) : endPause(current, now, zone));
    tx.set(r.state, next);
    return view(next);
  });
}

export type InjuryAction =
  | { action: "flag"; stat: Stat; note?: string; expectedReturn?: string }
  | { action: "renew"; stat: Stat }
  | { action: "clear"; stat: Stat }
  | { action: "visibility"; show: boolean };

/**
 * Flags, renews or clears an injured stat, or sets whether followers see the flags. Flagging
 * swaps the stat's unclaimed quests for free. publicStats/{uid} always mirrors what followers may see.
 */
export async function injuryAction(uid: string, input: InjuryAction, timeZone?: string): Promise<BreaksResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const [stateSnap, musclesSnap, scheduleSnap] = await tx.getAll(r.state, r.muscles, r.schedule);
    const now = Date.now();
    const current = stateSnap.exists ? (stateSnap.data() as GameState) : newGameState(now, timeZone ?? DEFAULT_TIME_ZONE);
    const zone = timeZone ?? current.timeZone;

    let next: GameState;
    switch (input.action) {
      case "flag":
        next = unwrap(flagInjury(current, input.stat, { note: input.note, expectedReturn: input.expectedReturn }, now, zone));
        break;
      case "renew":
        next = unwrap(renewInjury(current, input.stat, now));
        break;
      case "clear":
        next = unwrap(clearInjury(current, input.stat, now));
        break;
      case "visibility":
        next = setShowInjuries(current, input.show, now);
        break;
    }

    // A new flag takes the stat out of this week's quests: swap any it was in.
    let questsToWrite: QuestsDoc | null = null;
    if (input.action === "flag") {
      const week = weekIdOf(now, zone);
      const questsSnap = await tx.get(r.quests.doc(week));
      if (questsSnap.exists) {
        const doc = questsSnap.data() as QuestsDoc;
        const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
        const schedule = scheduleSnap.exists ? (scheduleSnap.data() as ScheduleDoc) : emptySchedule(now);
        const workouts = await readWeekWorkouts(tx, r, week, zone);
        const weekData = questWeek(week, zone, workouts, await readLookup(tx, r, workouts), schedule);
        const ctx = questContext({ uid, weekId: week, state: next, muscles, schedule, now, timeZone: zone });
        const swapped = swapInjuredQuests(doc, ctx, (q) => questProgress(q, weekData), now);
        if (swapped !== doc) questsToWrite = swapped;
      }
    }

    tx.set(r.state, next);
    tx.set(r.publicStats, { injuries: publicInjuries(next, now), updatedAt: now }, { merge: true });
    if (questsToWrite) tx.set(r.quests.doc(questsToWrite.weekId), questsToWrite);
    return { ...view(next), ...(questsToWrite ? { swappedQuests: true } : {}) };
  });
}
