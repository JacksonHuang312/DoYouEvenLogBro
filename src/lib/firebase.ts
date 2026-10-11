import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Local development/testing against the Firebase emulators (`npm run emulators`).
 * Off unless NEXT_PUBLIC_FIREBASE_EMULATOR=1, so normal builds always talk to the real project.
 */
const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

let instance: { app: FirebaseApp; auth: Auth; db: Firestore } | undefined;

/**
 * Lazily initializes the Firebase client. Browser-only: call it from effects
 * and event handlers, never during render, since pages are prerendered on the server.
 */
export function firebase() {
  if (typeof window === "undefined") {
    throw new Error("firebase() must only be called in the browser");
  }
  if (!instance) {
    if (!config.apiKey || !config.projectId) {
      throw new Error(
        "Firebase config missing: copy .env.example to .env.local, fill it in, then restart `npm run dev`.",
      );
    }
    const app = getApps().length ? getApp() : initializeApp(config);
    let db: Firestore;
    try {
      // Offline cache in IndexedDB: gyms have bad signal, writes queue until back online.
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Already initialized (e.g. after a hot reload).
      db = getFirestore(app);
    }
    const auth = getAuth(app);
    if (USE_EMULATORS) {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      // Lets automated browser tests sign in as seeded emulator users (no Google popup).
      Object.assign(window, {
        __emulatorSignIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
      });
    }
    instance = { app, auth, db };
  }
  return instance;
}
