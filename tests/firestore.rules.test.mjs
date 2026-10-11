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
