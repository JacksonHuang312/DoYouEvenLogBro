import { DEFAULT_TIME_ZONE } from "../game/config";
import { assignPoints, pointsFree, pointsOf, pointsSpent, respecPoints, type StatPoints } from "../game/levels";
import { adminDb } from "./admin";
import { stateOf, unwrap } from "./items";
import { gameRefs } from "./refs";

export type PointsAction = { action: "assign"; add: StatPoints; expectedSpent: number } | { action: "respec"; expectedSpent: number };

export interface PointsResponse {
  /** "already-done": a retry of an action that already happened; nothing changed. */
  status: "done" | "already-done";
  statPoints: StatPoints;
  free: number;
  coins: number;
  cost: number;
}

/**
 * Puts free stat points into stats, or resets them all for a flat fee (GAME_DESIGN.md 13.3). One
 * transaction, safe to retry: the request names the spent total it saw, and a retry finds the
 * points already moved.
 */
export async function pointsAction(uid: string, input: PointsAction): Promise<PointsResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const state = stateOf(await tx.get(r.state), now, DEFAULT_TIME_ZONE);
    const answer = (status: PointsResponse["status"], s: typeof state, cost = 0): PointsResponse => ({
      status,
      statPoints: pointsOf(s),
      free: pointsFree(s),
      coins: s.coins,
      cost,
    });
    const spent = pointsSpent(state);

    if (input.action === "assign") {
      const adding = Object.values(input.add).reduce((n, x) => n + (x ?? 0), 0);
      if (adding > 0 && spent === input.expectedSpent + adding) return answer("already-done", state);
      const next = unwrap(assignPoints(state, input.add, input.expectedSpent, now));
      tx.set(r.state, next);
      return answer("done", next);
    }
    if (spent === 0 && input.expectedSpent > 0) return answer("already-done", state);
    const next = unwrap(respecPoints(state, input.expectedSpent, now));
    tx.set(r.state, next.state);
    return answer("done", next.state, next.cost);
  });
}
