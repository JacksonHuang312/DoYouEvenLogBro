import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  updatePassword,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebase } from "./firebase";
import { createProfile, LOGIN_DOMAIN, USERNAME_PATTERN } from "./profile";
import type { Unit } from "./types";

/*
 * Username + password accounts. Firebase Auth only knows email/password, so each account gets
 * a hidden login address (see LOGIN_DOMAIN in profile.ts), stored as usernames/{handle}.loginEmail.
 * Signing in looks the handle up, then signs in with that address and the password.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** The linked Google account's email, or null if none is linked. */
export function googleEmailOf(user: User): string | null {
  const google = user.providerData.find((p) => p.providerId === "google.com");
  return google ? (google.email ?? "Google account") : null;
}

/** Turns Firebase Auth errors into something to show the user; null for "they cancelled". */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Wrong username or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/weak-password":
      return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
    case "auth/account-exists-with-different-credential":
      return "That Google account already has its own account here. Sign in with it instead.";
    case "auth/provider-already-linked":
      return "A Google account is already linked.";
    case "auth/operation-not-allowed":
      return "Username sign-in isn't turned on yet: enable Email/Password in Firebase Authentication.";
    case "auth/requires-recent-login":
      return "For your security, sign out and back in, then try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    default:
      return (err as Error).message ?? "Something went wrong.";
  }
}

export class UsernameNotAvailableError extends Error {
  constructor() {
    super("That username is taken.");
  }
}

function checkCredentials(username: string, password: string) {
  const handle = username.toLowerCase();
  if (!USERNAME_PATTERN.test(handle)) throw new Error("Use 3-20 lowercase letters, numbers or underscores.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  }
  return handle;
}

/**
 * Creates a username + password account and its profile. The handle is checked first so a
 * taken name doesn't leave an empty account behind; if someone claims it in between, the
 * account still exists and onboarding asks for another name.
 */
export async function signUpWithUsername(username: string, password: string, unit: Unit) {
  const handle = checkCredentials(username, password);
  const { auth, db } = firebase();
  if ((await getDoc(doc(db, "usernames", handle))).exists()) throw new UsernameNotAvailableError();

  const loginEmail = `${crypto.randomUUID()}@${LOGIN_DOMAIN}`;
  const { user } = await createUserWithEmailAndPassword(auth, loginEmail, password);
  await createProfile(user, handle, unit);
}

/** Signs in with a username and password. Unknown names get the same message as wrong passwords. */
export async function signInWithUsername(username: string, password: string) {
  const { auth, db } = firebase();
  const handle = username.toLowerCase().replace(/^@/, "");
  const snap = USERNAME_PATTERN.test(handle) ? await getDoc(doc(db, "usernames", handle)) : null;
  const loginEmail = snap?.data()?.loginEmail as string | undefined;
  if (!loginEmail) throw Object.assign(new Error("Wrong username or password."), { code: "auth/invalid-credential" });
  await signInWithEmailAndPassword(auth, loginEmail, password);
}

/** Links a Google account, so either way signs in (and Google works if the password is forgotten). */
export async function linkGoogle(user: User) {
  await linkWithPopup(user, new GoogleAuthProvider());
}

/** Changes the password; Firebase requires proving the current one first. */
export async function changePassword(user: User, current: string, next: string) {
  if (next.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  if (!user.email) throw new Error("This account has no password.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}
