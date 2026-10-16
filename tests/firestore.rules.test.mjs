// Firestore security rules tests (need Java for the emulator).
// Terminal 1: `npm run emulators`. Terminal 2: `npm run test:rules`. Rules are reloaded on every run.
// `npm run test:rules:ci` starts and stops the emulator itself (on Windows the emulator's Java process can outlive it).
import assert from "node:assert/strict";
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

describe("username + password accounts", () => {
  const LOGIN = "3f2a@login.doyouevenlogbro.vercel.app";
  const dbWithEmail = (uid, email) => env.authenticatedContext(uid, { email }).firestore();

  /** The same transaction createProfile() writes, as a batch. */
  function onboard(db, uid, handle, handleData) {
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", handle), handleData);
    batch.set(doc(db, "users", uid), {
      username: handle,
      usernameChangedAt: serverTimestamp(),
      displayName: handle,
      photoURL: null,
      unit: "lb",
      isPrivate: false,
      createdAt: Date.now(),
    });
    return batch.commit();
  }

  test("can claim a handle that points at its own login address", async () => {
    await assertSucceeds(onboard(dbWithEmail("alice", LOGIN), "alice", "alice", { uid: "alice", loginEmail: LOGIN }));
  });

  test("can't point a handle at someone else's login, or at a real email", async () => {
    const other = "9999@login.doyouevenlogbro.vercel.app";
    await assertFails(onboard(dbWithEmail("alice", LOGIN), "alice", "alice", { uid: "alice", loginEmail: other }));
    const gmail = "alice@gmail.com";
    await assertFails(onboard(dbWithEmail("alice", gmail), "alice", "alice", { uid: "alice", loginEmail: gmail }));
  });

  test("signed-out visitors can look up a handle (to sign in) but not list them", async () => {
    await seedUser("alice", "alice", 8);
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "usernames", "alice")));
    await assertFails(getDocs(collection(anon, "usernames")));
  });

  test("the login address moves with a username change", async () => {
    await seedUser("alice", "alice", 8);
    const db = dbWithEmail("alice", LOGIN);
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", "alice_lifts"), { uid: "alice", loginEmail: LOGIN });
    batch.delete(doc(db, "usernames", "alice"));
    batch.update(doc(db, "users", "alice"), { username: "alice_lifts", usernameChangedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });
});

describe("about me", () => {
  test("you can set your own, up to 300 characters", async () => {
    await seedUser("alice", "alice", 8);
    const ref = doc(dbAs("alice"), "users", "alice");
    await assertSucceeds(setDoc(ref, { bio: "Push pull legs.\nhttps://example.com" }, { merge: true }));
    await assertSucceeds(setDoc(ref, { bio: "x".repeat(300) }, { merge: true }));
    await assertFails(setDoc(ref, { bio: "x".repeat(301) }, { merge: true }));
    await assertFails(setDoc(ref, { bio: 42 }, { merge: true }));
  });

  test("nobody else can set it", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 8);
    await assertFails(setDoc(doc(dbAs("bob"), "users", "alice"), { bio: "hacked" }, { merge: true }));
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

describe("custom exercise muscles", () => {
  // The 17 sub-muscles are exactly the library's muscle values (checked in src/lib/game/config.test.ts).
  const library = JSON.parse(readFileSync(new URL("../src/data/exercises.json", import.meta.url), "utf8"));
  const MUSCLES = [...new Set(library.map((e) => e.muscle))];
  const exercise = (muscle) => ({ name: "Hack Squat", muscle, equipment: "machine", category: "strength" });
  const ref = (uid) => doc(dbAs(uid), "users", "alice", "customExercises", "c_abc123");

  test("accepts each of the 17 sub-muscles", async () => {
    await seedUser("alice", "alice", 8);
    assert.equal(MUSCLES.length, 17);
    for (const muscle of MUSCLES) await assertSucceeds(setDoc(ref("alice"), exercise(muscle)));
  });

  test("rejects anything else", async () => {
    await seedUser("alice", "alice", 8);
    for (const muscle of ["Quads", "Chest", "full body", "", 42, null]) {
      await assertFails(setDoc(ref("alice"), exercise(muscle)));
    }
    const noMuscle = exercise("chest");
    delete noMuscle.muscle;
    await assertFails(setDoc(ref("alice"), noMuscle));
  });

  test("an old free-text muscle blocks edits until the backfill maps it", async () => {
    await seedUser("alice", "alice", 8);
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users", "alice", "customExercises", "c_abc123"), exercise("Quads")),
    );
    const jpeg = `data:image/jpeg;base64,${Buffer.alloc(1_000, 7).toString("base64")}`;
    await assertFails(setDoc(ref("alice"), { imageData: jpeg }, { merge: true }));
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users", "alice", "customExercises", "c_abc123"), { muscle: "quadriceps" }, { merge: true }),
    );
    await assertSucceeds(setDoc(ref("alice"), { imageData: jpeg }, { merge: true }));
  });
});

describe("profile photos", () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.alloc(15_000, 7).toString("base64")}`;
  const setPhoto = (uid, photoURL) => setDoc(doc(dbAs(uid), "users", uid), { photoURL }, { merge: true });

  test("can upload a small JPEG, keep a link, or remove it", async () => {
    await seedUser("alice", "alice", 8);
    await assertSucceeds(setPhoto("alice", jpeg));
    await assertSucceeds(setPhoto("alice", "https://lh3.googleusercontent.com/a/photo"));
    await assertSucceeds(setPhoto("alice", null));
  });

  test("rejects photos over the size limit", async () => {
    await seedUser("alice", "alice", 8);
    const huge = `data:image/jpeg;base64,${Buffer.alloc(40_000, 7).toString("base64")}`;
    await assertFails(setPhoto("alice", huge));
  });

  test("rejects data URLs that aren't JPEGs", async () => {
    await seedUser("alice", "alice", 8);
    await assertFails(setPhoto("alice", "data:image/svg+xml;base64,PHN2Zz4="));
    await assertFails(setPhoto("alice", "data:text/html;base64,PHNjcmlwdD4="));
  });

  test("other users can't change your photo", async () => {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 30);
    await assertFails(setDoc(doc(dbAs("bob"), "users", "alice"), { photoURL: jpeg }, { merge: true }));
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

  test("a private account's workout only opens for its owner (and followers)", async () => {
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

  test("the owner can save a workout with notes and a photo", async () => {
    await seedUser("alice", "alice", 30);
    const db = dbAs("alice");
    const photo = `data:image/jpeg;base64,${Buffer.alloc(450_000, 7).toString("base64")}`;
    const batch = writeBatch(db);
    batch.set(workoutRef(db), { ...workout, description: "Felt strong", hasPhoto: true });
    batch.set(doc(db, "users", "alice", "workouts", "w1", "photos", "main"), { data: photo });
    await assertSucceeds(batch.commit());
    // Public account: anyone with the link sees the photo.
    await assertSucceeds(getDoc(doc(anon(), "users", "alice", "workouts", "w1", "photos", "main")));
  });

  test("a workout can carry personal records", async () => {
    await seedUser("alice", "alice", 30);
    const db = dbAs("alice");
    const sets = [{ type: "normal", weightKg: 105, reps: 3, record: "weight" }];
    const withRecord = { ...workout, exercises: [{ ...workout.exercises[0], sets }], recordCount: 1 };
    await assertSucceeds(setDoc(workoutRef(db), withRecord));
    await assertFails(setDoc(workoutRef(db), { ...workout, recordCount: -1 }));
    await assertFails(setDoc(workoutRef(db), { ...workout, recordCount: "lots" }));
  });

  test("workout notes and photos are validated", async () => {
    await seedUser("alice", "alice", 30);
    const db = dbAs("alice");
    const photoRef = (id = "main") => doc(db, "users", "alice", "workouts", "w1", "photos", id);
    await assertFails(setDoc(workoutRef(db), { ...workout, description: "x".repeat(1001) }));
    await assertFails(setDoc(workoutRef(db), { ...workout, hasPhoto: "yes" }));
    const huge = `data:image/jpeg;base64,${Buffer.alloc(650_000, 7).toString("base64")}`;
    await assertFails(setDoc(photoRef(), { data: huge }));
    await assertFails(setDoc(photoRef(), { data: "data:image/svg+xml;base64,PHN2Zz4=" }));
    await assertFails(setDoc(photoRef("second"), { data: "data:image/jpeg;base64,AAAA" }));
  });

  test("only the owner can add or remove a workout photo, and private photos stay private", async () => {
    await seedWorkout("alice", { isPrivate: true });
    await seedUser("bob", "bob", 30);
    const bobPhoto = doc(dbAs("bob"), "users", "alice", "workouts", "w1", "photos", "main");
    await assertFails(setDoc(bobPhoto, { data: "data:image/jpeg;base64,AAAA" }));
    await assertSucceeds(setDoc(doc(dbAs("alice"), "users", "alice", "workouts", "w1", "photos", "main"), { data: "data:image/jpeg;base64,AAAA" }));
    await assertFails(getDoc(bobPhoto));
    await assertFails(deleteDoc(bobPhoto));
  });

  test("a comment can carry an uploaded profile photo, but not an oversized one", async () => {
    await seedWorkout("alice");
    await seedUser("bob", "bob", 30);
    const jpeg = `data:image/jpeg;base64,${Buffer.alloc(15_000, 7).toString("base64")}`;
    const huge = `data:image/jpeg;base64,${Buffer.alloc(40_000, 7).toString("base64")}`;
    await assertSucceeds(setDoc(commentRef(dbAs("bob")), { ...comment("bob", "bob"), authorPhotoURL: jpeg }));
    await assertFails(setDoc(commentRef(dbAs("bob"), "c2"), { ...comment("bob", "bob"), authorPhotoURL: huge }));
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

describe("comment replies", () => {
  const workout = {
    name: "Chest back",
    startedAt: Date.now() - 3_600_000,
    endedAt: Date.now(),
    exercises: [],
    exerciseIds: [],
    volumeKg: 0,
    setCount: 0,
  };
  const path = ["users", "alice", "workouts", "w1", "comments"];
  const ref = (db, id) => doc(db, ...path, id);
  const comment = (uid, extra = {}) => ({
    authorUid: uid,
    authorUsername: uid,
    authorPhotoURL: null,
    text: "hey",
    createdAt: serverTimestamp(),
    ...extra,
  });

  async function seedThread() {
    await seedUser("alice", "alice", 30);
    await seedUser("bob", "bob", 30);
    await seedUser("carol", "carol", 30);
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", "alice", "workouts", "w1"), workout));
    await setDoc(ref(dbAs("bob"), "top"), comment("bob"));
  }

  test("can reply to a top-level comment", async () => {
    await seedThread();
    await assertSucceeds(setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "top", replyToUsername: "bob" })));
  });

  test("can't reply to a reply (one level deep only)", async () => {
    await seedThread();
    await setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "top", replyToUsername: "bob" }));
    await assertFails(setDoc(ref(dbAs("bob"), "r2"), comment("bob", { parentId: "r1", replyToUsername: "carol" })));
  });

  test("can't reply to a comment that doesn't exist", async () => {
    await seedThread();
    await assertFails(setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "nope" })));
  });

  test("replyToUsername must be a valid handle on a reply", async () => {
    await seedThread();
    await assertFails(setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "top", replyToUsername: "Not A Handle!" })));
    await assertFails(setDoc(ref(dbAs("carol"), "r2"), comment("carol", { replyToUsername: "bob" })));
  });

  test("a comment's author can delete it together with its replies", async () => {
    await seedThread();
    await setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "top", replyToUsername: "bob" }));
    const db = dbAs("bob");
    const batch = writeBatch(db);
    batch.delete(ref(db, "r1"));
    batch.delete(ref(db, "top"));
    await assertSucceeds(batch.commit());
  });

  test("other users can't delete someone's reply", async () => {
    await seedThread();
    await seedUser("dave", "dave", 30);
    await setDoc(ref(dbAs("carol"), "r1"), comment("carol", { parentId: "top", replyToUsername: "bob" }));
    await assertFails(deleteDoc(ref(dbAs("dave"), "r1")));
  });
});

describe("following", () => {
  const followDoc = () => ({ createdAt: serverTimestamp() });
  const followingRef = (db, uid, target) => doc(db, "users", uid, "following", target);
  const followerRef = (db, uid, follower) => doc(db, "users", uid, "followers", follower);
  const requestRef = (db, uid, requester) => doc(db, "users", uid, "followRequests", requester);

  async function seedPair({ alicePrivate = false } = {}) {
    await seedUser("alice", "alice", 30);
    await seedUser("bob", "bob", 30);
    if (alicePrivate) {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), "users", "alice"), { isPrivate: true }, { merge: true }),
      );
    }
  }

  /** The same batch the app's follow() sends for a public account: bob follows alice. */
  function followBatch(db, follower = "bob", target = "alice") {
    const batch = writeBatch(db);
    batch.set(followingRef(db, follower, target), followDoc());
    batch.set(followerRef(db, target, follower), followDoc());
    batch.delete(requestRef(db, target, follower));
    return batch.commit();
  }

  /** The same batch the app's acceptRequest() sends: alice accepts bob. */
  function acceptBatch(db) {
    const batch = writeBatch(db);
    batch.set(followerRef(db, "alice", "bob"), followDoc());
    batch.set(followingRef(db, "bob", "alice"), followDoc());
    batch.delete(requestRef(db, "alice", "bob"));
    return batch.commit();
  }

  async function seedPrivateWorkout() {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users", "alice", "workouts", "w1"), {
        name: "Legs",
        startedAt: 0,
        endedAt: 1,
        exercises: [],
        exerciseIds: [],
        volumeKg: 0,
        setCount: 0,
      }),
    );
  }

  test("can follow and unfollow a public account", async () => {
    await seedPair();
    await assertSucceeds(followBatch(dbAs("bob")));
    await assertSucceeds(getDocs(collection(dbAs("carol"), "users", "alice", "followers")));
    const db = dbAs("bob");
    const batch = writeBatch(db);
    batch.delete(followingRef(db, "bob", "alice"));
    batch.delete(followerRef(db, "alice", "bob"));
    await assertSucceeds(batch.commit());
  });

  test("both sides must be written together", async () => {
    await seedPair();
    await assertFails(setDoc(followingRef(dbAs("bob"), "bob", "alice"), followDoc()));
    await assertFails(setDoc(followerRef(dbAs("bob"), "alice", "bob"), followDoc()));
  });

  test("can't make someone else follow, follow yourself, or backdate a follow", async () => {
    await seedPair();
    await seedUser("carol", "carol", 30);
    await assertFails(followBatch(dbAs("carol")));
    await assertFails(followBatch(dbAs("bob"), "bob", "bob"));
    const db = dbAs("bob");
    const batch = writeBatch(db);
    batch.set(followingRef(db, "bob", "alice"), { createdAt: Timestamp.fromMillis(0) });
    batch.set(followerRef(db, "alice", "bob"), { createdAt: Timestamp.fromMillis(0) });
    await assertFails(batch.commit());
  });

  test("follow lists need sign-in", async () => {
    await seedPair();
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), "users", "alice", "followers")));
  });

  test("a private account can't be followed directly, only requested", async () => {
    await seedPair({ alicePrivate: true });
    await assertFails(followBatch(dbAs("bob")));
    await assertSucceeds(setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc()));
    await assertSucceeds(getDoc(requestRef(dbAs("bob"), "alice", "bob")));
  });

  test("requests: only the requester can make one, only the owner can list them", async () => {
    await seedPair({ alicePrivate: true });
    await seedUser("carol", "carol", 30);
    await assertFails(setDoc(requestRef(dbAs("carol"), "alice", "bob"), followDoc()));
    await setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc());
    await assertFails(getDoc(requestRef(dbAs("carol"), "alice", "bob")));
    await assertFails(getDocs(collection(dbAs("bob"), "users", "alice", "followRequests")));
    await assertSucceeds(getDocs(collection(dbAs("alice"), "users", "alice", "followRequests")));
  });

  test("public accounts don't take requests", async () => {
    await seedPair();
    await assertFails(setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc()));
  });

  test("an accepted follower can see a private account's workouts", async () => {
    await seedPair({ alicePrivate: true });
    await seedPrivateWorkout();
    const workoutRef = (db) => doc(db, "users", "alice", "workouts", "w1");
    await assertFails(getDoc(workoutRef(dbAs("bob"))));
    await setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc());
    await assertSucceeds(acceptBatch(dbAs("alice")));
    await assertSucceeds(getDoc(workoutRef(dbAs("bob"))));
    await assertSucceeds(getDocs(collection(dbAs("bob"), "users", "alice", "workouts")));
  });

  test("the owner can't accept a request that was never made", async () => {
    await seedPair({ alicePrivate: true });
    await assertFails(acceptBatch(dbAs("alice")));
  });

  test("the owner can decline a request or remove a follower", async () => {
    await seedPair({ alicePrivate: true });
    await setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc());
    await assertSucceeds(deleteDoc(requestRef(dbAs("alice"), "alice", "bob")));
    await setDoc(requestRef(dbAs("bob"), "alice", "bob"), followDoc());
    await acceptBatch(dbAs("alice"));
    const db = dbAs("alice");
    const batch = writeBatch(db);
    batch.delete(followingRef(db, "bob", "alice"));
    batch.delete(followerRef(db, "alice", "bob"));
    await assertSucceeds(batch.commit());
  });

  test("strangers can't remove someone's follows", async () => {
    await seedPair();
    await seedUser("carol", "carol", 30);
    await followBatch(dbAs("bob"));
    await assertFails(deleteDoc(followingRef(dbAs("carol"), "bob", "alice")));
    await assertFails(deleteDoc(followerRef(dbAs("carol"), "alice", "bob")));
  });
});


describe("game data", () => {
  // Server-written docs (GAME_DESIGN.md 8.3): seeded with rules off, as the Admin SDK would.
  const paths = [
    ["game", "state"],
    ["game", "muscles"],
    ["claims", "w1"],
    ["snapshots", "2026-10-11"],
  ];
  const ref = (db, uid, [col, id]) => doc(db, "users", uid, col, id);

  async function seedGame() {
    await seedUser("alice", "alice", 8);
    await seedUser("bob", "bob", 8);
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const p of paths) await setDoc(ref(ctx.firestore(), "alice", p), { coins: 50 });
    });
  }

  test("the owner can read their own", async () => {
    await seedGame();
    for (const p of paths) await assertSucceeds(getDoc(ref(dbAs("alice"), "alice", p)));
    await assertSucceeds(getDocs(collection(dbAs("alice"), "users", "alice", "claims")));
    await assertSucceeds(getDocs(collection(dbAs("alice"), "users", "alice", "snapshots")));
  });

  test("the owner can't create, change or delete any of it", async () => {
    await seedGame();
    const db = dbAs("alice");
    for (const p of paths) {
      await assertFails(setDoc(ref(db, "alice", p), { coins: 1_000_000 }));
      await assertFails(setDoc(ref(db, "alice", p), { coins: 1_000_000 }, { merge: true }));
      await assertFails(deleteDoc(ref(db, "alice", p)));
    }
    // Nor create new ones.
    await assertFails(setDoc(doc(db, "users", "alice", "claims", "w2"), { coins: 50 }));
    await assertFails(setDoc(doc(db, "users", "alice", "game", "other"), { coins: 50 }));
  });

  test("other users and signed-out visitors can't read or write it", async () => {
    await seedGame();
    const anon = env.unauthenticatedContext().firestore();
    for (const db of [dbAs("bob"), anon]) {
      for (const p of paths) {
        await assertFails(getDoc(ref(db, "alice", p)));
        await assertFails(setDoc(ref(db, "alice", p), { coins: 1 }));
      }
      await assertFails(getDocs(collection(db, "users", "alice", "claims")));
    }
  });
});
