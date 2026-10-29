import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

/** The Firestore documents the game routes read and write for one user (GAME_DESIGN.md 8.3). */
export function gameRefs(db: Firestore, uid: string) {
  const user = db.collection("users").doc(uid);
  return {
    state: user.collection("game").doc("state"),
    muscles: user.collection("game").doc("muscles"),
    schedule: user.collection("game").doc("schedule"),
    /** Progress in each fight mode (Phase 5). */
    battle: user.collection("game").doc("battle"),
    /** One record per fight request, keyed by the client's request id. */
    fights: user.collection("fights"),
    claims: user.collection("claims"),
    snapshots: user.collection("snapshots"),
    quests: user.collection("quests"),
    inventory: user.collection("inventory"),
    shop: user.collection("shop"),
    workouts: user.collection("workouts"),
    routines: user.collection("routines"),
    customExercises: user.collection("customExercises"),
    /** Injury flags followers may see; the only game data other people can read. */
    publicStats: db.collection("publicStats").doc(uid),
  };
}

export type GameRefs = ReturnType<typeof gameRefs>;

/** A custom exercise doc as the stat code's exercise lookup wants it. */
export const customExercise = (d: DocumentSnapshot) => ({
  id: d.id,
  ...(d.data() as { muscle: string; category: string; equipment: string }),
});
