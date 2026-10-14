"use client";

import { Check, MessageCircle, Share, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { shareLink, useLikes, workoutUrl } from "@/lib/social";
import type { UserProfile, Workout } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/** Asks a signed-out visitor to sign in before liking/commenting. */
export async function promptSignIn(signIn: () => Promise<void>, action: string) {
  const ok = await confirmDialog({
    title: `Sign in to ${action}`,
    message: "It's free. You'll stay on this workout.",
    confirmLabel: "Sign in",
  });
  if (ok) await signIn().catch((e) => errorDialog("Couldn't sign in", e));
}

/** Share button: share sheet on phones, copy link elsewhere. Warns when the owner's account is private. */
export function ShareButton({ workout, author }: { workout: Workout; author: UserProfile }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  async function onShare() {
    if (author.isPrivate && user?.uid === author.uid) {
      const ok = await confirmDialog({
        title: "Your account is private",
        message: "Only you and your followers can open this link. Make your account public in Settings to share workouts with anyone.",
        confirmLabel: "Copy anyway",
      });
      if (!ok) return;
    }
    try {
      const result = await shareLink(workout.name, workoutUrl(author.uid, workout.id));
      if (result === "copied") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      await errorDialog("Couldn't share", e);
    }
  }

  return (
    <button onClick={onShare} aria-label="Share workout" className="flex items-center gap-1.5 p-2">
      {copied ? (
        <>
          <Check size={22} className="text-accent" />
          <span className="text-sm text-accent">Link copied</span>
        </>
      ) : (
        <Share size={22} />
      )}
    </button>
  );
}

/** Like / comment / share row under a workout, like Hevy's. */
export function SocialBar({
  workout,
  author,
  commentCount,
  onCommentClick,
}: {
  workout: Workout;
  author: UserProfile;
  /** From the caller's useComments; null while loading. */
  commentCount: number | null;
  /** Focuses the comment box under the workout. */
  onCommentClick: () => void;
}) {
  const { user, profile, signIn } = useAuth();
  const viewerUid = profile ? user!.uid : null;
  const likes = useLikes(author.uid, workout.id, viewerUid);

  async function onLike() {
    if (!viewerUid) return promptSignIn(signIn, "like workouts");
    await likes.toggle().catch((e) => errorDialog("Couldn't update like", e));
  }

  return (
    <div className="-ml-2 flex items-center gap-4">
      <button
        onClick={onLike}
        aria-label={likes.liked ? "Unlike" : "Like"}
        aria-pressed={likes.liked}
        className={`flex items-center gap-1.5 p-2 ${likes.liked ? "text-accent" : ""}`}
      >
        <ThumbsUp size={22} fill={likes.liked ? "currentColor" : "none"} />
        {likes.count != null && <span className="text-sm">{likes.count}</span>}
      </button>
      <button onClick={onCommentClick} aria-label="Comment" className="flex items-center gap-1.5 p-2">
        <MessageCircle size={22} />
        {commentCount != null && <span className="text-sm">{commentCount}</span>}
      </button>
      <ShareButton workout={workout} author={author} />
    </div>
  );
}
