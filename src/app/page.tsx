"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  signInWithUsername,
  signUpWithUsername,
} from "@/lib/accounts";
import { USERNAME_PATTERN } from "@/lib/profile";
import type { Unit } from "@/lib/types";

type Mode = "signin" | "signup";

export default function Home() {
  const { user, profile, loading, signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unit, setUnit] = useState<Unit>("lb");
  const [error, setError] = useState<string | null>(null);
  // While an account is being created the user exists before its profile does; hold the
  // redirect so it doesn't flash onboarding on the way to /home.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || (busy && !profile)) return;
    router.replace(profile ? "/home" : "/onboarding");
  }, [loading, user, profile, busy, router]);

  if (loading || (user && !busy)) return <Spinner />;

  const signingUp = mode === "signup";
  const valid = USERNAME_PATTERN.test(username) && password.length >= (signingUp ? MIN_PASSWORD_LENGTH : 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (signingUp) {
        await signUpWithUsername(username, password, unit);
        // Stay busy until the new profile arrives, then the effect goes to /home. If it somehow
        // doesn't, fall through to the normal redirect (onboarding) instead of waiting forever.
        setTimeout(() => setBusy(false), 8000);
      } else {
        await signInWithUsername(username, password);
        setBusy(false);
      }
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  const field = "w-full bg-transparent px-3 py-3 outline-none";
  const box = "flex items-center rounded-xl bg-surface-2 focus-within:ring-2 focus-within:ring-accent";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Do You Even Log Bro?</h1>
        <p className="mt-2 text-muted">Track sets, reps and weight. Free, no subscription.</p>
      </div>

      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={mode === id}
            onClick={() => switchMode(id)}
            className={`rounded-lg py-2 text-subhead font-semibold ${mode === id ? "bg-surface-2 text-white" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="sr-only">Username</span>
          <div className={box}>
            <span className="pl-3 text-muted">@</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username"
              value={username}
              maxLength={20}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              className={`${field} pl-1`}
            />
          </div>
        </label>

        <label className="block">
          <span className="sr-only">Password</span>
          <div className={box}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder={signingUp ? `Password (${MIN_PASSWORD_LENGTH}+ characters)` : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="px-3 text-muted"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>

        {signingUp && (
          <>
            <p className="px-1 text-footnote text-muted">
              3-20 letters, numbers or underscores. No email needed; you can link Google later in Settings.
            </p>
            <fieldset>
              <legend className="mb-1 px-1 text-footnote text-muted">Weight unit</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["lb", "kg"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={`rounded-xl py-2 font-medium ${unit === u ? "bg-accent text-on-accent" : "bg-surface-2"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && <p className="px-1 text-sm text-red-400">{error}</p>}

        <button
          disabled={!valid || busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-40"
        >
          {busy ? (signingUp ? "Creating account..." : "Signing in...") : signingUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-footnote text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        onClick={() =>
          signIn().catch((e) => {
            const message = authErrorMessage(e);
            if (message) setError(message);
          })
        }
        className="rounded-xl bg-white py-3 font-semibold text-zinc-900"
      >
        Continue with Google
      </button>
    </main>
  );
}
