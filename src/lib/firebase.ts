import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import {
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
    instance = { app, auth: getAuth(app), db };
  }
  return instance;
}
