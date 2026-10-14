"use client";

import { useParams } from "next/navigation";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { removeFollower, useFollowerUids, useFollowingUids, useProfiles } from "@/lib/follows";
import type { UserProfile } from "@/lib/types";
import { useProfile } from "./AuthProvider";
import { FollowButton, UserRow } from "./Follow";
import { Spinner } from "./Spinner";
import { BackHeader, OverflowMenu } from "./ui";

/** /u/{uid}/followers and /u/{uid}/following: people with Follow buttons, newest first. */
export function FollowList({ kind }: { kind: "followers" | "following" }) {
  const { uid } = useParams<{ uid: string }>();
  const viewer = useProfile();
  const isMe = uid === viewer.uid;
  const followers = useFollowerUids(kind === "followers" ? uid : null);
  const following = useFollowingUids(kind === "following" ? uid : null);
  const people = useProfiles(kind === "followers" ? followers : following);

  async function onRemove(user: UserProfile) {
    const ok = await confirmDialog({
      title: `Remove ${user.username}?`,
      message: "They won't be told. They can follow you again later.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    removeFollower(viewer.uid, user.uid).catch((e) => errorDialog("Couldn't remove follower", e));
  }

  return (
    <div>
      <BackHeader title={kind === "followers" ? "Followers" : "Following"} href={isMe ? "/profile" : `/u/${uid}`} />
      {!people ? (
        <Spinner />
      ) : people.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {kind === "followers"
            ? "No followers yet."
            : isMe
              ? "You're not following anyone yet."
              : "Not following anyone yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <UserRow key={p.uid} user={p}>
              <FollowButton target={p} />
              {isMe && kind === "followers" && (
                <OverflowMenu label={`Options for ${p.username}`}>
                  {(close) => (
                    <button
                      onClick={() => {
                        close();
                        onRemove(p);
                      }}
                      className="w-full px-4 py-3 text-left text-red-400"
                    >
                      Remove follower
                    </button>
                  )}
                </OverflowMenu>
              )}
            </UserRow>
          ))}
        </ul>
      )}
    </div>
  );
}
