// Firestore security rules tests (need Java for the emulator).
// Terminal 1: `npm run emulators`. Terminal 2: `npm run test:rules`. Rules are reloaded on every run.
// `npm run test:rules:ci` starts and stops the emulator itself (on Windows the emulator's Java process can outlive it).
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

const DAY_MS = 24 * 60 * 60 * 1000;

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dyelb",
    firestore: {
      // Matches firebase.json; emulators:exec sets FIRESTORE_EMULATOR_HOST instead.
      ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { host: "127.0.0.1", port: 8080 }),
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
});

after(() => env.cleanup());

beforeEach(() => env.clearFirestore());

/** Seeds a profile + handle with rules off, as if they onboarded `daysAgo` days ago. */
async function seedUser(uid, username, daysAgo) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usernames", username), { uid });
    await setDoc(doc(db, "users", uid), {
      username,
      usernameChangedAt: Timestamp.fromMillis(Date.now() - daysAgo * DAY_MS),
      displayName: username,
      photoURL: null,
      unit: "kg",
      isPrivate: false,
      createdAt: Date.now() - daysAgo * DAY_MS,
    });
  });
}

const dbAs = (uid) => env.authenticatedContext(uid).firestore();

/** The same batch the app's changeUsername() sends. */
function changeUsernameBatch(db, uid, from, to, changedAt = serverTimestamp()) {
  const batch = writeBatch(db);
  batch.set(doc(db, "usernames", to), { uid });
  batch.delete(doc(db, "usernames", from));
  batch.update(doc(db, "users", uid), { username: to, usernameChangedAt: changedAt });
  return batch.commit();
}

describe("onboarding", () => {
  test("can claim a free handle with usernameChangedAt = server time", async () => {
    const db = dbAs("alice");
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", "alice"), { uid: "alice" });
    batch.set(doc(db, "users", "alice"), {
      username: "alice",
      usernameChangedAt: serverTimestamp(),
      displayName: "Alice",
      photoURL: null,
      unit: "lb",
      isPrivate: false,
      createdAt: Date.now(),
    });
    await assertSucceeds(batch.commit());
  });
});

describe("username change", () => {
  test("allowed once 7 days have passed", async () => {
    await seedUser("alice", "alice", 8);
    await assertSucceeds(changeUsernameBatch(dbAs("alice"), "alice", "alice", "alice_lifts"));
  });

  test("rejected when the last change was under 7 days ago", async () => {
    await seedUser("alice", "alice", 6);
    await assertFails(changeUsernameBatch(dbAs("alice"), "alice", "alice", "alice_lifts"));
  });

  test("rejected when usernameChangedAt isn't the server time", async () => {
    await seedUser("alice", "alice", 8);
    const backdated = Timestamp.fromMillis(Date.now() - 30 * DAY_MS);
    await assertFails(
      changeUsernameBatch(dbAs("alice"), "alice", "alice", "alice_lifts", backdated),
    );
  });

  test("rejected when the old handle isn't released", async () => {
    await seedUser("alice", "alice", 8);
    const db = dbAs("alice");
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", "alice_lifts"), { uid: "alice" });
    batch.update(doc(db, "users", "alice"), {
      username: "alice_lifts",
      usernameChangedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

describe("taking another user's handle", () => {
  test("rejected in a username-change batch", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(changeUsernameBatch(dbAs("alice"), "alice", "alice", "bob"));
  });

  test("rejected as a direct overwrite of usernames/{handle}", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(doc(dbAs("alice"), "usernames", "bob"), { uid: "alice" }));
  });
});

describe("deleting handles", () => {
  test("rejected for someone else's handle", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(deleteDoc(doc(dbAs("alice"), "usernames", "bob")));
  });

  test("rejected for someone else's handle even inside a valid change batch", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    const db = dbAs("alice");
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", "alice_lifts"), { uid: "alice" });
    batch.delete(doc(db, "usernames", "alice"));
    batch.delete(doc(db, "usernames", "bob"));
    batch.update(doc(db, "users", "alice"), {
      username: "alice_lifts",
      usernameChangedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  test("rejected for your own handle while your profile still uses it", async () => {
    await seedUser("alice", "alice", 8);
    await assertFails(deleteDoc(doc(dbAs("alice"), "usernames", "alice")));
  });
});

describe("usernames collection", () => {
  test("can't be listed", async () => {
    await seedUser("alice", "alice", 8);
    await assertFails(getDocs(collection(dbAs("alice"), "usernames")));
  });
});

describe("routines", () => {
  const routine = {
    name: "Anterior",
    exercises: [{ exerciseId: "Barbell_Squat", name: "Barbell Squat", sets: 3, restSec: 90 }],
    updatedAt: Date.now(),
  };

  test("owner can save and read their routine", async () => {
    await seedUser("alice", "alice", 8);
    const ref = doc(dbAs("alice"), "users", "alice", "routines", "r1");
    await assertSucceeds(setDoc(ref, routine));
    await assertSucceeds(getDocs(collection(dbAs("alice"), "users", "alice", "routines")));
  });

  test("other users can't read or write it", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(doc(dbAs("bob"), "users", "alice", "routines", "r1"), routine));
    await assertFails(getDocs(collection(dbAs("bob"), "users", "alice", "routines")));
  });

  test("rejects a routine with no exercises", async () => {
    await seedUser("alice", "alice", 8);
    await assertFails(setDoc(doc(dbAs("alice"), "users", "alice", "routines", "r1"), { ...routine, exercises: [] }));
  });
});

describe("custom exercise photos", () => {
  const exercise = { name: "Hack Squat", muscle: "quadriceps", equipment: "machine", category: "strength" };
  const jpeg = `data:image/jpeg;base64,${Buffer.alloc(15_000, 7).toString("base64")}`;
  const ref = (uid) => doc(dbAs(uid), "users", "alice", "customExercises", "c_abc123");

  test("can be created without a photo", async () => {
    await seedUser("alice", "alice", 8);
    await assertSucceeds(setDoc(ref("alice"), exercise));
  });

  test("can be created with a small JPEG photo", async () => {
    await seedUser("alice", "alice", 8);
    await assertSucceeds(setDoc(ref("alice"), { ...exercise, imageData: jpeg }));
  });

  test("rejects photos over the size limit", async () => {
    await seedUser("alice", "alice", 8);
    const huge = `data:image/jpeg;base64,${Buffer.alloc(120_000, 7).toString("base64")}`;
    await assertFails(setDoc(ref("alice"), { ...exercise, imageData: huge }));
  });

  test("rejects anything that isn't a JPEG data URL", async () => {
    await seedUser("alice", "alice", 8);
    await assertFails(setDoc(ref("alice"), { ...exercise, imageData: "https://evil.example/tracker.png" }));
    await assertFails(setDoc(ref("alice"), { ...exercise, imageData: "data:image/svg+xml;base64,PHN2Zz4=" }));
  });

  test("other users can't set your exercise's photo", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(ref("bob"), { ...exercise, imageData: jpeg }));
  });
});

describe("shared workouts, likes and comments", () => {
  const workout = {
    name: "Chest back",
    startedAt: Date.now() - 3_600_000,
    endedAt: Date.now(),
    exercises: [{ exerciseId: "Pullups", name: "Pull Up", sets: [{ type: "normal", weightKg: null, reps: 4 }] }],
    exerciseIds: ["Pullups"],
    volumeKg: 0,
    setCount: 1,
  };

  async function seedWorkout(ownerUid, { isPrivate = false } = {}) {
    await seedUser(ownerUid, ownerUid, 30);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "users", ownerUid), { isPrivate }, { merge: true });
      await setDoc(doc(db, "users", ownerUid, "workouts", "w1"), workout);
    });
  }

  const workoutRef = (db) => doc(db, "users", "alice", "workouts", "w1");
  const likeRef = (db, liker) => doc(db, "users", "alice", "workouts", "w1", "likes", liker);
  const commentRef = (db, id = "c1") => doc(db, "users", "alice", "workouts", "w1", "comments", id);
  const comment = (uid, username) => ({
    authorUid: uid,
    authorUsername: username,
    authorPhotoURL: null,
    text: "Nice lift!",
    createdAt: serverTimestamp(),
  });
  const anon = () => env.unauthenticatedContext().firestore();

  test("a public workout opens from a link, even signed out", async () => {
    await seedWorkout("alice");
    await assertSucceeds(getDoc(workoutRef(anon())));
    await assertSucceeds(getDoc(workoutRef(dbAs("bob"))));
    await assertSucceeds(getDoc(doc(anon(), "users", "alice")));
  });

  test("a private account's workout only opens for its owner", async () => {
    await seedWorkout("alice", { isPrivate: true });
    await seedUser("bob", "bob", 30);
    await assertFails(getDoc(workoutRef(anon())));
    await assertFails(getDoc(workoutRef(dbAs("bob"))));
    await assertSucceeds(getDoc(workoutRef(dbAs("alice"))));
  });

  test("signed-out visitors can't list profiles", async () => {
    await seedWorkout("alice");
    await assertFails(getDocs(collection(anon(), "users")));
  });

  test("a user can like and unlike a public workout", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertSucceeds(setDoc(likeRef(dbAs("bob"), "bob"), { createdAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(likeRef(dbAs("bob"), "bob")));
  });

  test("can't like as someone else, signed out, or on a private workout", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(likeRef(dbAs("bob"), "carol"), { createdAt: serverTimestamp() }));
    await assertFails(setDoc(likeRef(anon(), "bob"), { createdAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", "alice"), { isPrivate: true }, { merge: true }));
    await assertFails(setDoc(likeRef(dbAs("bob"), "bob"), { createdAt: serverTimestamp() }));
  });

  test("can't remove someone else's like, but the owner can clear it", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await seedUser("carol", "carol", 30);
    await setDoc(likeRef(dbAs("bob"), "bob"), { createdAt: serverTimestamp() });
    await assertFails(deleteDoc(likeRef(dbAs("carol"), "bob")));
    await assertSucceeds(deleteDoc(likeRef(dbAs("alice"), "bob")));
  });

  test("a user can comment under their own name", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertSucceeds(setDoc(commentRef(dbAs("bob")), comment("bob", "bob")));
    await assertSucceeds(getDocs(collection(anon(), "users", "alice", "workouts", "w1", "comments")));
  });

  test("can't comment as someone else or with a fake username", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(commentRef(dbAs("bob")), comment("alice", "alice")));
    await assertFails(setDoc(commentRef(dbAs("bob")), comment("bob", "alice")));
    await assertFails(setDoc(commentRef(anon()), comment("bob", "bob")));
  });

  test("comments can't be empty, too long, or edited", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(commentRef(dbAs("bob")), { ...comment("bob", "bob"), text: "" }));
    await assertFails(setDoc(commentRef(dbAs("bob")), { ...comment("bob", "bob"), text: "x".repeat(501) }));
    await setDoc(commentRef(dbAs("bob")), comment("bob", "bob"));
    await assertFails(setDoc(commentRef(dbAs("bob")), { ...comment("bob", "bob"), text: "edited" }));
  });

  test("only the author or the workout owner can delete a comment", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await seedUser("carol", "carol", 30);
    await setDoc(commentRef(dbAs("bob"), "c1"), comment("bob", "bob"));
    await setDoc(commentRef(dbAs("bob"), "c2"), comment("bob", "bob"));
    await assertFails(deleteDoc(commentRef(dbAs("carol"), "c1")));
    await assertSucceeds(deleteDoc(commentRef(dbAs("bob"), "c1")));
    await assertSucceeds(deleteDoc(commentRef(dbAs("alice"), "c2")));
  });

  test("other users still can't change someone's workout", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(workoutRef(dbAs("bob")), workout));
    await assertFails(deleteDoc(workoutRef(dbAs("bob"))));
  });
});
