import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The Admin SDK, for API routes and scripts only (it bypasses security rules). Credentials come
 * from a service account in env vars, see .env.example. Against the local emulators
 * (NEXT_PUBLIC_FIREBASE_EMULATOR=1, or the *_EMULATOR_HOST vars) none are needed.
 */
function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1") {
    // Same ports as firebase.json.
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Env vars often hold the key's newlines as literal "\n".
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing: set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (see .env.example).",
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

let db: Firestore | undefined;

export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(app());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export const adminAuth = () => getAuth(app());
