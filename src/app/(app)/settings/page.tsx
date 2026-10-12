"use client";

import { useState } from "react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { BackHeader } from "@/components/ui";
import { errorDialog } from "@/lib/dialog";
import { changeUsername, nextUsernameChangeAt, updateProfile, USERNAME_PATTERN } from "@/lib/profile";
import type { UserProfile } from "@/lib/types";

function UsernameSetting({ profile }: { profile: UserProfile }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.username);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nextChange = nextUsernameChangeAt(profile);
  // Reading the clock here is fine: this only renders client-side, after auth loads.
  // eslint-disable-next-line react-hooks/purity
  const canChange = Date.now() >= nextChange;
  const valid = USERNAME_PATTERN.test(value) && value !== profile.username;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await changeUsername(profile, value);
      setEditing(false);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "permission-denied"
          ? "Couldn't change it. The name may have just been taken, or it's been under a week."
          : code === "unavailable"
            ? "You're offline. Changing your username needs a connection."
            : (err as Error).message,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 p-4">
        <span>
          Username
          <span className="block text-sm text-muted">@{profile.username}</span>
          {!canChange && (
            <span className="block text-xs text-muted">
              You can change it again on {new Date(nextChange).toLocaleDateString()}
            </span>
          )}
        </span>
        <button
          disabled={!canChange}
          onClick={() => {
            setValue(profile.username);
            setError(null);
            setEditing(true);
          }}
          className="text-sm font-medium text-accent disabled:text-muted/60"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-4">
      <label className="block text-sm text-muted" htmlFor="username">
        New username
      </label>
      <div className="flex items-center rounded-md bg-surface-2 focus-within:ring-2 focus-within:ring-accent">
        <span className="pl-3 text-muted">@</span>
        <input
          id="username"
          autoFocus
          autoCapitalize="none"
          autoComplete="off"
          value={value}
          maxLength={20}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          className="w-full bg-transparent px-1 py-2 outline-none"
        />
      </div>
      <p className="text-xs text-muted">
        3-20 letters, numbers or underscores. After changing, you&apos;ll have to wait 7 days to change it again.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-md bg-surface-2 py-2 text-sm">
          Cancel
        </button>
        <button
          disabled={!valid || saving}
          className="flex-1 rounded-md bg-accent text-on-accent py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const profile = useProfile();
  const { signOut } = useAuth();

  // Not awaited: the profile listener applies the change instantly, even offline.
  const save = (patch: Parameters<typeof updateProfile>[1]) =>
    updateProfile(profile.uid, patch).catch((e) => errorDialog("Couldn't save setting", e));

  return (
    <div className="space-y-6">
      <BackHeader title="Settings" href="/profile" />

      <div className="flex items-center gap-3 rounded-xl bg-surface p-4">
        {profile.photoURL && (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar, no need for next/image config
          <img src={profile.photoURL} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        )}
        <div>
          <div className="font-semibold">{profile.displayName}</div>
          <div className="text-sm text-muted">@{profile.username}</div>
        </div>
      </div>

      <section className="divide-y divide-line rounded-xl bg-surface">
        <UsernameSetting profile={profile} />
        <div className="flex items-center justify-between p-4">
          <span>Weight unit</span>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                onClick={() => save({ unit: u })}
                className={`rounded-md px-3 py-1 text-sm font-medium ${profile.unit === u ? "bg-accent text-on-accent" : ""}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between p-4">
          <span>
            Private account
            <span className="block text-xs text-muted">Only you can see your workouts. Shared links won&apos;t open for others.</span>
          </span>
          <input
            type="checkbox"
            checked={profile.isPrivate}
            onChange={(e) => save({ isPrivate: e.target.checked })}
            className="h-5 w-5 accent-accent"
          />
        </label>
      </section>

      <button onClick={signOut} className="w-full rounded-xl bg-surface py-3 font-medium">
        Sign out
      </button>
    </div>
  );
}
