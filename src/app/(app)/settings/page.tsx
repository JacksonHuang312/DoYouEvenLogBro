"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Avatar, BackHeader } from "@/components/ui";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { AVATAR_SIZE, MAX_AVATAR_CHARS, photoToThumbnail } from "@/lib/image";
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

/** Profile card with the picture: tap it (or "Change photo") to upload a new one, or remove it. */
function ProfilePhotoSetting({
  profile,
  save,
}: {
  profile: UserProfile;
  save: (patch: { photoURL: string | null }) => Promise<unknown>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires onChange
    if (!file) return;
    setBusy(true);
    try {
      const photoURL = await photoToThumbnail(file, { size: AVATAR_SIZE, maxChars: MAX_AVATAR_CHARS });
      // Not awaited, like the other settings: the profile listener shows it instantly, even offline.
      save({ photoURL });
    } catch (err) {
      await errorDialog("Couldn't use that photo", err);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    const ok = await confirmDialog({
      title: "Remove profile photo?",
      message: "Your initial will show instead.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) save({ photoURL: null });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface p-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="relative shrink-0 rounded-full"
      >
        <Avatar photoURL={profile.photoURL} name={profile.username} size={64} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-2">
          <Camera size={13} />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{profile.displayName}</div>
        <div className="truncate text-sm text-muted">@{profile.username}</div>
        <div className="mt-1.5 flex gap-4 text-sm font-medium">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-accent">
            {busy ? "Uploading..." : "Change photo"}
          </button>
          {profile.photoURL && !busy && (
            <button type="button" onClick={onRemove} className="text-red-400">
              Remove
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
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

      <ProfilePhotoSetting profile={profile} save={save} />

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
