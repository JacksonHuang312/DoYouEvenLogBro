// Gives every account that existed before the RPG its game state, from its workout history
// (GAME_DESIGN.md 2.6). Run once, BEFORE deploying the new firestore.rules (they reject the
// free-text custom-exercise muscles this script maps):
//
//   npm run backfill -- --dry-run            # print what would change
//   npm run backfill                         # write it
//   npm run backfill -- --uid <uid>          # one user
//   npm run backfill -- --time-zone Europe/London
//   npm run backfill -- --rework --dry-run   # also move existing games onto the stat rework
//
// Writing to a real (non-emulator) project needs --confirm <projectId>, naming the project.
//
// Credentials: the FIREBASE_ADMIN_* vars from .env.local (or the environment). Against the
// emulators: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and FIREBASE_ADMIN_PROJECT_ID=demo-dyelb.
//
// Per user:
// 1. Custom exercises whose muscle isn't one of the 17 get the closest one.
// 2. If the user has no game/state yet, every workout is replayed through the claim logic for
//    stats and XP (no coins), and the welcome bonus is paid. Claim records are written for the
//    replayed workouts so they can never be claimed again. Users who already have a game/state
//    are left alone, unless --rework is given:
// 3. --rework (once, after deploying the stat rework): a user's existing game/state gets stats,
//    peak power, workout XP and level replayed from the whole history under the new rules, plus
//    the XP its claimed quests paid (see reworkGame). Coins, items, titles, breaks and claim
//    records are kept. Snapshots are rebuilt. Running it twice gives the same result.
import { parseArgs } from "node:util";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import {
  backfillHistory,
  reworkGame,
  type ClaimableWorkout,
  type GameState,
  type MusclesDoc,
} from "../src/lib/game/claim";
import { DEFAULT_TIME_ZONE } from "../src/lib/game/config";
import { closestMuscle, isSubMuscle } from "../src/lib/game/muscles";
import { questXpEarned, type QuestsDoc } from "../src/lib/game/quests";
import { buildExerciseLookup, type ExerciseLookup } from "../src/lib/game/sets";
import { isValidTimeZone } from "../src/lib/game/time";
import { adminDb } from "../src/lib/server/admin";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: credentials come from the environment.
}

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    rework: { type: "boolean", default: false },
    confirm: { type: "string" },
    uid: { type: "string" },
    // Week boundaries for snapshots of new games. Each user's next claim switches to their own zone.
    "time-zone": { type: "string", default: DEFAULT_TIME_ZONE },
  },
});
const dryRun = args["dry-run"];
const rework = args.rework;
const timeZone = args["time-zone"];
if (!isValidTimeZone(timeZone)) throw new Error(`Unknown time zone: ${timeZone}`);

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "(unknown)";
if (!emulator && !dryRun && args.confirm !== projectId) {
  console.error(`This writes to the real project "${projectId}". Re-run with --confirm ${projectId} if that's intended.`);
  process.exit(1);
}

// adminDb() reads the credentials on first use, after .env.local is loaded above.
const db = adminDb();

interface CustomExercise {
  id: string;
  name: string;
  muscle: string;
  category: string;
  equipment: string;
}

const totals = { users: 0, backfilled: 0, reworked: 0, skipped: 0, failed: 0, exercisesMapped: 0, toCheck: 0 };

async function fixCustomMuscles(uid: string, user: DocumentReference): Promise<CustomExercise[]> {
  const snap = await user.collection("customExercises").get();
  const exercises = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomExercise);
  const batch = db.batch();
  for (const e of exercises) {
    if (isSubMuscle(e.muscle)) continue;
    const { muscle, match } = closestMuscle(String(e.muscle ?? ""));
    const check = match === "fallback" ? "  <-- no close match, CHECK" : "";
    console.log(`  ${uid} custom "${e.name}": "${e.muscle}" -> "${muscle}" (${match})${check}`);
    totals.exercisesMapped++;
    if (check) totals.toCheck++;
    e.muscle = muscle;
    batch.update(user.collection("customExercises").doc(e.id), { muscle });
  }
  if (!dryRun) await batch.commit();
  return exercises;
}

async function backfillUser(uid: string) {
  const user = db.collection("users").doc(uid);
  const custom = await fixCustomMuscles(uid, user);
  const lookup = buildExerciseLookup(custom);
  const stateRef = user.collection("game").doc("state");

  const outcome = await db.runTransaction(async (tx) => {
    // Checked inside the transaction, so a claim made meanwhile is never overwritten.
    const stateSnap = await tx.get(stateRef);
    const workouts = await tx.get(user.collection("workouts").select("exercises", "startedAt", "endedAt"));
    const history = workouts.docs.map((d) => ({ id: d.id, ...d.data() }) as ClaimableWorkout);
    const now = Date.now();
    if (stateSnap.exists) return rework ? reworkUser(tx, user, stateSnap.data() as GameState, history, lookup, now) : null;
    const result = backfillHistory(history, lookup, timeZone, now);
    if (!dryRun) {
      for (const claim of result.claims) tx.set(user.collection("claims").doc(claim.workoutId), claim);
      for (const s of result.snapshots) tx.set(user.collection("snapshots").doc(s.weekId), s);
      tx.set(user.collection("game").doc("muscles"), { muscles: result.muscles, updatedAt: now } satisfies MusclesDoc);
      tx.set(stateRef, result.state);
    }
    return { kind: "backfilled" as const, workouts: history.length, ...result };
  });

  if (!outcome) {
    totals.skipped++;
    console.log(`  ${uid}: already has game state, skipped (use --rework to move it onto the stat rework)`);
    return;
  }
  if (outcome.kind === "reworked") {
    totals.reworked++;
    const { before, state } = outcome;
    console.log(
      `  ${uid}: reworked, XP ${before.xp} -> ${state.xp}, level ${before.level} -> ${state.level}, ` +
        `peak power ${Math.round(before.peakPower)} -> ${Math.round(state.peakPower)}`,
    );
    return;
  }
  totals.backfilled++;
  const { state, claims, workouts } = outcome;
  console.log(
    `  ${uid}: ${claims.length}/${workouts} workouts counted, ${state.xp} XP, level ${state.level}, ${state.coins} coins`,
  );
}

/** --rework for a user who already has a game: replay stats and XP under the current rules. */
async function reworkUser(
  tx: Transaction,
  user: DocumentReference,
  before: GameState,
  history: ClaimableWorkout[],
  lookup: ExerciseLookup,
  now: number,
) {
  const quests = await tx.get(user.collection("quests").select("quests"));
  const snapshots = await tx.get(user.collection("snapshots").select());
  const questXp = questXpEarned(quests.docs.map((d) => d.data() as Pick<QuestsDoc, "quests">));
  const result = reworkGame({ state: before, workouts: history, lookup, now, questXp });
  if (!dryRun) {
    const keep = new Set(result.snapshots.map((s) => s.weekId));
    for (const d of snapshots.docs) if (!keep.has(d.id)) tx.delete(d.ref);
    for (const s of result.snapshots) tx.set(user.collection("snapshots").doc(s.weekId), s);
    tx.set(user.collection("game").doc("muscles"), { muscles: result.muscles, updatedAt: now } satisfies MusclesDoc);
    tx.set(user.collection("game").doc("state"), result.state);
  }
  return { kind: "reworked" as const, before, state: result.state };
}

async function main() {
  const uids = args.uid ? [args.uid] : (await db.collection("users").listDocuments()).map((d) => d.id);
  const target = emulator ? "the emulator" : projectId;
  console.log(`${dryRun ? "DRY RUN: " : ""}backfilling ${uids.length} user(s) in ${target}, weeks in ${timeZone}${rework ? ", with --rework" : ""}`);
  for (const uid of uids) {
    totals.users++;
    try {
      await backfillUser(uid);
    } catch (err) {
      totals.failed++;
      console.error(`  ${uid}: FAILED`, err);
    }
  }
  console.log(dryRun ? "DRY RUN, nothing written:" : "Done:", totals);
  if (totals.failed) process.exitCode = 1;
}

void main();
