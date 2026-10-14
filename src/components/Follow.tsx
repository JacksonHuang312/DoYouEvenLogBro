"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { cancelRequest, follow, profilePath, unfollow, useFollowingUids, useRequested } from "@/lib/follows";
import type { UserProfile } from "@/lib/types";
import { useProfile } from "./AuthProvider";
import { Avatar } from "./ui";

/** Who you follow, live, shared by every Follow button and the feed (one listener for the app). */
const FollowingContext = createContext<Set<string> | null>(null);

export function FollowingProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const uids = useFollowingUids(uid);
  const set = useMemo(() => (uids ? new Set(uids) : null), [uids]);
  return <FollowingContext.Provider value={set}>{children}</FollowingContext.Provider>;
}

/** The uids you follow; null while loading. */
export function useFollowing() {
  return useContext(FollowingContext);
}

export type FollowStatus = "self" | "following" | "requested" | "none";

/** Your relationship to `target`; null while loading. */
export function useFollowStatus(target: UserProfile): FollowStatus | null {
  const viewer = useProfile();
  const following = useFollowing();
  const requested = useRequested(viewer.uid, target);
  if (viewer.uid === target.uid) return "self";
  if (!following) return null;
  if (following.has(target.uid)) return "following";
  if (requested == null) return null;
  return requested ? "requested" : "none";
}

/** Follow / Following / Requested, like Hevy. Unfollowing asks first. */
export function FollowButton({ target, block = false }: { target: UserProfile; block?: boolean }) {
  const viewer = useProfile();
  const status = useFollowStatus(target);
  const [busy, setBusy] = useState(false);

  if (status === "self") return null;

  async function onClick() {
    if (busy || !status) return;
    if (status === "following") {
      const ok = await confirmDialog({
        title: `Unfollow ${target.username}?`,
        message: target.isPrivate ? "Their account is private, so you'll have to ask again to see their workouts." : undefined,
        confirmLabel: "Unfollow",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (status === "following") await unfollow(viewer.uid, target.uid);
      else if (status === "requested") await cancelRequest(viewer.uid, target.uid);
      else await follow(viewer.uid, target);
    } catch (e) {
      await errorDialog("Couldn't update follow", e);
    } finally {
      setBusy(false);
    }
  }

  const label = status === "following" ? "Following" : status === "requested" ? "Requested" : "Follow";
  const filled = status === "none";
  return (
    <button
      onClick={onClick}
      disabled={!status || busy}
      className={`shrink-0 rounded-lg px-4 py-1.5 font-semibold disabled:opacity-60 ${block ? "w-full py-2.5" : ""} ${
        filled ? "bg-accent text-on-accent" : "bg-surface-2 text-white"
      } ${status ? "" : "invisible"}`}
    >
      {label}
    </button>
  );
}

/** Avatar, username and name linking to the profile, with something (usually a button) on the right. */
export function UserRow({ user, children }: { user: UserProfile; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={profilePath(user.uid)} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar photoURL={user.photoURL} name={user.username} size={44} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{user.username}</span>
          {user.displayName && user.displayName !== user.username && (
            <span className="block truncate text-sm text-muted">{user.displayName}</span>
          )}
        </span>
      </Link>
      {children}
    </li>
  );
}
