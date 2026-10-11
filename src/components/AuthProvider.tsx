"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { firebase } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** null when signed in but the user hasn't picked a username yet. */
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Tagged with the uid it belongs to, so a stale profile never leaks across sign-outs.
  const [loaded, setLoaded] = useState<{ uid: string; profile: UserProfile | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(firebase().auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // If Firestore never answers (blocked by an extension, no network), say so instead of spinning forever.
    const timeout = setTimeout(() => {
      setError(
        "Can't reach the database. Check your connection, and turn off ad blockers or privacy extensions for this site; they often block Firestore. The browser console (F12 → Console) has details.",
      );
    }, 10_000);
    const unsubscribe = onSnapshot(
      doc(firebase().db, "users", user.uid),
      (snap) => {
        // A cache miss while offline isn't proof the profile doesn't exist; keep waiting.
        if (!snap.exists() && snap.metadata.fromCache) return;
        clearTimeout(timeout);
        setError(null);
        setLoaded({
          uid: user.uid,
          profile: snap.exists()
            ? // "estimate" so a pending serverTimestamp() reads as local time instead of null.
              ({ uid: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } as UserProfile)
            : null,
        });
      },
      (err) => {
        clearTimeout(timeout);
        console.error("Couldn't load profile", err);
        setError(
          err.code === "permission-denied"
            ? "Firestore denied access to your profile. Are the security rules deployed? (npx firebase-tools deploy --only firestore)"
            : `Couldn't load your profile: ${err.message}`,
        );
      },
    );
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
        <h1 className="text-xl font-bold">Something&apos;s wrong</h1>
        <p className="text-sm text-muted">{error}</p>
        <button onClick={() => location.reload()} className="rounded-xl bg-accent py-3 font-medium">
          Retry
        </button>
        <button
          onClick={() => firebaseSignOut(firebase().auth).then(() => setError(null))}
          className="rounded-xl bg-surface-2 py-3 font-medium"
        >
          Sign out
        </button>
      </main>
    );
  }

  const profileLoaded = !!user && loaded?.uid === user.uid;
  const value: AuthContextValue = {
    user,
    profile: profileLoaded ? loaded.profile : null,
    loading: !authReady || (!!user && !profileLoaded),
    signIn: async () => {
      await signInWithPopup(firebase().auth, new GoogleAuthProvider());
    },
    signOut: () => firebaseSignOut(firebase().auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages under the (app) route group, where AppShell guarantees a profile. */
export function useProfile(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error("useProfile used outside a signed-in page");
  return profile;
}
