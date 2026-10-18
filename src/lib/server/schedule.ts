import type { GameState } from "../game/claim";
import { DEFAULT_TIME_ZONE } from "../game/config";
import { emptySchedule, withSchedule, type ScheduleDoc, type WeekdayRoutines } from "../game/schedule";
import { dayId } from "../game/time";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { gameRefs } from "./refs";

/**
 * Saves the weekly schedule as a new version that starts tomorrow (GAME_DESIGN.md 3.2). Every
 * routine named has to exist. An empty `days` clears the schedule.
 */
export async function saveSchedule(uid: string, days: WeekdayRoutines, timeZone?: string): Promise<ScheduleDoc> {
  const db = adminDb();
  const r = gameRefs(db, uid);
  const routineIds = [...new Set(Object.values(days))];

  return db.runTransaction(async (tx) => {
    const [stateSnap, scheduleSnap, ...routines] = await tx.getAll(
      r.state,
      r.schedule,
      ...routineIds.map((id) => r.routines.doc(id)),
    );
    const missing = routines.find((d) => !d.exists);
    if (missing) throw new HttpError(400, "That routine doesn't exist");

    const now = Date.now();
    const zone = timeZone ?? (stateSnap.exists ? (stateSnap.data() as GameState).timeZone : DEFAULT_TIME_ZONE);
    const current = scheduleSnap.exists ? (scheduleSnap.data() as ScheduleDoc) : emptySchedule(now);
    const next = withSchedule(current, days, dayId(now, zone), now);
    tx.set(r.schedule, next);
    return next;
  });
}
