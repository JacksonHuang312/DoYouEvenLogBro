"use client";

import type { User } from "firebase/auth";
import { Camera, Check, KeyRound } from "lucide-react";
import { useReducer, useRef, useState } from "react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Avatar, BackHeader } from "@/components/ui";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { AVATAR_SIZE, MAX_AVATAR_CHARS, photoToThumbnail } from "@/lib/image";
import { authErrorMessage, changePassword, googleEmailOf, linkGoogle, MIN_PASSWORD_LENGTH } from "@/lib/accounts";
import {
  changeUsername,
  loginEmailOf,
  MAX_BIO_LENGTH,
  nextUsernameChangeAt,
  updateProfile,
  USERNAME_PATTERN,
} from "@/lib/profile";
import { saveTheme, storedTheme, THEMES } from "@/lib/themes";
import type { UserProfile } from "@/lib/types";

function UsernameSetting({ profile }: { profile: UserProfile }) {
  const { user } = useAuth();
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
      await changeUsername(profile, value, user ? loginEmailOf(user) : null);
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

/** The "About me" shown on your profile. Saved with a button, not per keystroke. */
function BioSetting({ profile, save }: { profile: UserProfile; save: (patch: { bio: string }) => Promise<unknown> }) {
  const [value, setValue] = useState(profile.bio ?? "");
  const changed = value.trim() !== (profile.bio ?? "");

  return (
    <section>
      <h2 className="mb-2 px-1 text-footnote uppercase text-muted">About me</h2>
      <div className="rounded-xl bg-surface p-4">
        <textarea
          id="bio"
          aria-label="About me"
          placeholder="Tell people about your training, goals, or anything else."
          value={value}
          maxLength={MAX_BIO_LENGTH}
          rows={4}
          onChange={(e) => setValue(e.target.value)}
          className="w-full resize-none rounded-md bg-surface-2 px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {value.length}/{MAX_BIO_LENGTH}
          </span>
          {changed && (
            <div className="flex gap-2">
              <button onClick={() => setValue(profile.bio ?? "")} className="rounded-md bg-surface-2 px-4 py-1.5 text-sm">
                Cancel
              </button>
              {/* Not awaited, like the other settings: the profile listener shows it instantly. */}
              <button
                onClick={() => {
                  const bio = value.trim();
                  setValue(bio);
                  save({ bio });
                }}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-on-accent"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * App color theme, saved on this device. Each option shows the colors it actually uses
 * (background, cards, secondary text, accent), so you can see it before picking it.
 */
function ThemeSetting() {
  const [current, setCurrent] = useState(storedTheme);

  return (
    <section>
      <h2 className="mb-2 px-1 text-footnote uppercase text-muted">Theme</h2>
      <div role="radiogroup" aria-label="Theme" className="divide-y divide-line rounded-xl bg-surface">
        {THEMES.map(({ id, name, colors }) => (
          <button
            key={id}
            role="radio"
            aria-checked={current === id}
            onClick={() => {
              saveTheme(id);
              setCurrent(id);
            }}
            className="flex w-full items-center gap-4 p-4 text-left"
          >
            <span className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-white/15" aria-hidden>
              {[colors.canvas, colors.surface2, colors.muted, colors.accent].map((c, i) => (
                <span key={i} className="h-8 w-7" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="flex-1">{name}</span>
            {current === id && <Check size={20} className="text-accent" />}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * How this account signs in: username + password and/or Google. A password account can link
 * Google later, which also becomes the way back in if the password is forgotten.
 */
function SignInMethods({ user, username }: { user: User; username: string }) {
  // Linking changes user.providerData in place, so re-render by hand afterwards.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [linking, setLinking] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const hasPassword = loginEmailOf(user) != null;
  const google = googleEmailOf(user);

  async function onLinkGoogle() {
    setLinking(true);
    try {
      await linkGoogle(user);
      rerender();
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) await errorDialog("Couldn't link Google", new Error(message));
    } finally {
      setLinking(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 px-1 text-footnote uppercase text-muted">Sign-in methods</h2>
      <div className="divide-y divide-line rounded-xl bg-surface">
        {hasPassword && (
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <KeyRound size={20} className="text-muted" />
                <span>
                  Username &amp; password
                  <span className="block text-sm text-muted">Sign in as @{username}</span>
                </span>
              </span>
              {!changingPassword && (
                <button onClick={() => setChangingPassword(true)} className="text-sm font-medium text-accent">
                  Change password
                </button>
              )}
            </div>
            {changingPassword && <PasswordForm user={user} onDone={() => setChangingPassword(false)} />}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex min-w-0 items-center gap-3">
            <GoogleMark />
            <span className="min-w-0">
              Google
              <span className="block truncate text-sm text-muted">{google ?? "Not linked"}</span>
            </span>
          </span>
          {google ? (
            <span className="text-sm text-muted">Linked</span>
          ) : (
            <button onClick={onLinkGoogle} disabled={linking} className="shrink-0 text-sm font-medium text-accent">
              {linking ? "Linking..." : "Link Google"}
            </button>
          )}
        </div>
      </div>
      {hasPassword && !google && (
        <p className="mt-2 px-1 text-footnote text-muted">
          There&apos;s no email on this account, so a forgotten password can&apos;t be reset. Link Google to always
          have a way back in.
        </p>
      )}
    </section>
  );
}

function PasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set on a save with a short new password, so the hint shows even if it's empty.
  const [triedShort, setTriedShort] = useState(false);
  const tooShort = next.length < MIN_PASSWORD_LENGTH;
  const showHint = tooShort && (next.length > 0 || triedShort);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Say what's wrong instead of silently refusing.
    setError(current ? null : "Enter your current password.");
    setTriedShort(tooShort);
    if (!current || tooShort) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword(user, current, next);
      onDone();
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Here "wrong credentials" can only mean the current password.
      setError(code === "auth/invalid-credential" || code === "auth/wrong-password" ? "Current password is wrong." : authErrorMessage(err));
      setSaving(false);
    }
  }

  const field = "w-full rounded-md bg-surface-2 px-3 py-2 outline-none focus:ring-2 focus:ring-accent";
  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <input
        type="password"
        autoComplete="current-password"
        aria-label="Current password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className={field}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label="New password"
        placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        aria-invalid={showHint}
        aria-describedby={showHint ? "new-password-hint" : undefined}
        className={field}
      />
      {showHint && (
        <p id="new-password-hint" className="text-sm text-red-400">
          New password must be at least {MIN_PASSWORD_LENGTH} characters ({next.length}/{MIN_PASSWORD_LENGTH}).
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-md bg-surface-2 py-2 text-sm">
          Cancel
        </button>
        <button
          disabled={saving}
          className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-on-accent disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

/** Google's "G", in its colors, so the row is recognizable at a glance. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default function SettingsPage() {
  const profile = useProfile();
  const { user, signOut } = useAuth();

  // Not awaited: the profile listener applies the change instantly, even offline.
  const save = (patch: Parameters<typeof updateProfile>[1]) =>
    updateProfile(profile.uid, patch).catch((e) => errorDialog("Couldn't save setting", e));

  return (
    <div className="space-y-6">
      <BackHeader title="Settings" href="/profile" />

      <ProfilePhotoSetting profile={profile} save={save} />

      <BioSetting profile={profile} save={save} />

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
            <span className="block text-xs text-muted">Only you and your followers can see your workouts. New followers need your approval.</span>
          </span>
          <input
            type="checkbox"
            checked={profile.isPrivate}
            onChange={(e) => save({ isPrivate: e.target.checked })}
            className="h-5 w-5 accent-accent"
          />
        </label>
      </section>

      <ThemeSetting />

      {user && <SignInMethods user={user} username={profile.username} />}

      <button onClick={signOut} className="w-full rounded-xl bg-surface py-3 font-medium">
        Sign out
      </button>
    </div>
  );
}
