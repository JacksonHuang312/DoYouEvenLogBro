// Seeds the local Firebase emulators with two users and a shared workout.
// Usage: `npm run emulators` in one terminal, then `node scripts/seed-emulator.mjs`.
// Sign in as alice@test.dev or bob@test.dev, password "password123".
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";

const PROJECT = "demo-dyelb";
const AUTH = "http://127.0.0.1:9099";
const PASSWORD = "password123";

/** Creates (or recreates) an Auth emulator user and returns its uid. */
async function createUser(email) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${email}: ${body.error?.message}`);
  return body.localId;
}

// Start from a clean Auth emulator so reruns don't fail with EMAIL_EXISTS.
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
const alice = await createUser("alice@test.dev");
const bob = await createUser("bob@test.dev");

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});
await env.clearFirestore();

const now = Date.now();
const profile = (username) => ({
  username,
  usernameChangedAt: Timestamp.fromMillis(now - 30 * 86_400_000),
  displayName: username,
  photoURL: null,
  unit: "lb",
  isPrivate: false,
  createdAt: now - 30 * 86_400_000,
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [uid, name] of [[alice, "alice"], [bob, "bob"]]) {
    await setDoc(doc(db, "users", uid), profile(name));
    await setDoc(doc(db, "usernames", name), { uid });
  }
  await setDoc(doc(db, "users", alice, "workouts", "w1"), {
    name: "Chest back",
    startedAt: now - 26 * 3_600_000,
    endedAt: now - 25 * 3_600_000,
    exercises: [
      { exerciseId: "Pullups", name: "Pull Up", sets: [{ type: "normal", weightKg: null, reps: 4 }, { type: "normal", weightKg: null, reps: 4 }] },
      { exerciseId: "Wide-Grip_Lat_Pulldown", name: "Lat Pulldown (Cable)", sets: [{ type: "normal", weightKg: 77.1, reps: 10 }, { type: "normal", weightKg: 77.1, reps: 12 }] },
    ],
    exerciseIds: ["Pullups", "Wide-Grip_Lat_Pulldown"],
    volumeKg: 77.1 * 22,
    setCount: 4,
  });
  await setDoc(doc(db, "users", alice, "workouts", "w1", "comments", "seed"), {
    authorUid: bob,
    authorUsername: "bob",
    authorPhotoURL: null,
    text: "Nice lift!",
    createdAt: Timestamp.fromMillis(now - 3_600_000),
  });
});
await env.cleanup();

console.log(JSON.stringify({ alice, bob, workoutUrl: `/w/${alice}/w1` }));
