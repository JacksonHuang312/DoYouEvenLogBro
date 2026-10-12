import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "./firebase";
import type { Unit, UserProfile } from "./types";

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Must match the duration in firestore.rules. */
export const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is taken");
  }
}

function checkHandle(username: string) {
  const handle = username.toLowerCase();
  if (!USERNAME_PATTERN.test(handle)) {
    throw new Error("Use 3-20 lowercase letters, numbers or underscores");
  }
  return handle;
}

/**
 * Creates the user's profile and reserves usernames/{handle} in one transaction,
 * so two people can never end up with the same handle.
 */
export async function createProfile(user: User, username: string, unit: Unit) {
  const { db } = firebase();
  const handle = checkHandle(username);

  await runTransaction(db, async (tx) => {
    const handleRef = doc(db, "usernames", handle);
    if ((await tx.get(handleRef)).exists()) throw new UsernameTakenError();

    tx.set(handleRef, { uid: user.uid });
    tx.set(doc(db, "users", user.uid), {
      username: handle,
      usernameChangedAt: serverTimestamp(),
      displayName: user.displayName?.slice(0, 50) ?? handle,
      photoURL: user.photoURL,
      unit,
      isPrivate: false,
      createdAt: Date.now(),
    });
  });
}

/** When the user may next change their username (rules enforce this server-side too). */
export function nextUsernameChangeAt(profile: UserProfile): number {
  return profile.usernameChangedAt.toMillis() + USERNAME_CHANGE_COOLDOWN_MS;
}

/**
 * Claims the new handle, releases the old one and updates the profile in a single batch.
 * Rules reject the whole batch if the handle is taken or the last change was under a week ago.
 */
export async function changeUsername(profile: UserProfile, username: string) {
  const { db } = firebase();
  const handle = checkHandle(username);
  if (handle === profile.username) return;

  const newRef = doc(db, "usernames", handle);
  // Friendly pre-check only; the rules are what actually guarantee uniqueness.
  if ((await getDoc(newRef)).exists()) throw new UsernameTakenError();

  const batch = writeBatch(db);
  batch.set(newRef, { uid: profile.uid });
  batch.delete(doc(db, "usernames", profile.username));
  batch.update(doc(db, "users", profile.uid), {
    username: handle,
    usernameChangedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Any user's public profile (needed to show a shared workout's author). */
export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(firebase().db, "users", uid));
  return snap.exists()
    ? ({ uid: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } as UserProfile)
    : null;
}

export function updateProfile(
  uid: string,
  patch: Partial<Pick<UserProfile, "unit" | "isPrivate" | "displayName" | "photoURL">>,
) {
  const { db } = firebase();
  return updateDoc(doc(db, "users", uid), patch);
}
