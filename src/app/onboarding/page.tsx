"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { createProfile, USERNAME_PATTERN } from "@/lib/profile";
import type { Unit } from "@/lib/types";

export default function Onboarding() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [unit, setUnit] = useState<Unit>("lb");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (profile) router.replace("/home");
  }, [loading, user, profile, router]);

  if (loading || !user || profile) return <Spinner />;

  const valid = USERNAME_PATTERN.test(username);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !valid) return;
    setSaving(true);
    setError(null);
    try {
      // The profile snapshot listener picks up the new doc and redirects.
      await createProfile(user, username, unit);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4">
      <form onSubmit={submit} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set up your profile</h1>
          <p className="mt-1 text-sm text-muted">Your username is how friends will find you.</p>
        </div>

        <label className="block">
          <span className="text-sm text-muted">Username</span>
          <div className="mt-1 flex items-center rounded-md bg-surface-2 focus-within:ring-2 focus-within:ring-accent">
            <span className="pl-3 text-muted">@</span>
            <input
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              maxLength={20}
              className="w-full bg-transparent px-1 py-2 outline-none"
            />
          </div>
          <span className="mt-1 block text-xs text-muted">
            3-20 characters: letters, numbers, underscores. You can change it in Settings once a week.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm text-muted">Weight unit</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-md py-2 font-medium ${unit === u ? "bg-accent text-on-accent" : "bg-surface-2"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          disabled={!valid || saving}
          className="w-full rounded-xl bg-accent text-on-accent py-3 font-semibold disabled:opacity-40"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
        <button type="button" onClick={signOut} className="w-full text-sm text-muted">
          Sign out
        </button>
      </form>
    </main>
  );
}
