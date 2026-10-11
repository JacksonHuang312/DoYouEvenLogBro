"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { formatDayAndTime } from "@/lib/format";
import { addComment, deleteComment, MAX_COMMENT_LENGTH, type WorkoutComment, workoutPath } from "@/lib/social";
import { useAuth } from "./AuthProvider";
import { promptSignIn } from "./SocialBar";
import { Avatar } from "./ui";

/** How many of the latest comments a feed post shows before "View all". */
const PREVIEW_COUNT = 2;

/**
 * Comment list + "Write a comment" box, like Hevy. The caller loads the comments
 * (useComments) so it can share them with the comment count.
 * - "full": every comment (the workout page).
 * - "preview": the latest few with a "View all" link (feed posts).
 */
export function CommentThread({
  ownerUid,
  workoutId,
  comments,
  variant,
  inputRef,
}: {
  ownerUid: string;
  workoutId: string;
  comments: WorkoutComment[] | null;
  variant: "full" | "preview";
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const { user, profile, signIn } = useAuth();
  const viewerUid = profile ? user!.uid : null;
  const list = comments ?? [];
  const shown = variant === "preview" ? list.slice(-PREVIEW_COUNT) : list;
  const hidden = list.length - shown.length;

  async function onDelete(commentId: string) {
    const ok = await confirmDialog({ title: "Delete comment?", confirmLabel: "Delete", destructive: true });
    if (ok) deleteComment(ownerUid, workoutId, commentId).catch((e) => errorDialog("Couldn't delete comment", e));
  }

  return (
    <div>
      {variant === "full" && comments?.length === 0 && (
        <p className="mb-4 text-sm text-muted">No comments yet. Say something nice.</p>
      )}
      {hidden > 0 && (
        <Link href={`${workoutPath(ownerUid, workoutId)}#comments`} className="mb-3 block text-sm text-muted">
          View all {list.length} comments
        </Link>
      )}

      {shown.length > 0 && (
        <ul className="mb-4 space-y-4">
          {shown.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar photoURL={c.authorPhotoURL} name={c.authorUsername} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-semibold">{c.authorUsername}</span>
                  <span className="text-sm text-muted">· {formatDayAndTime(c.createdAt.toMillis())}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{c.text}</p>
              </div>
              {viewerUid && (viewerUid === c.authorUid || viewerUid === ownerUid) && (
                <button aria-label="Delete comment" onClick={() => onDelete(c.id)} className="self-start p-2 text-muted">
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {profile ? (
        <CommentForm ownerUid={ownerUid} workoutId={workoutId} inputRef={inputRef} />
      ) : (
        <button
          onClick={() => promptSignIn(signIn, "comment")}
          className="w-full rounded-xl bg-surface py-3 font-medium text-accent"
        >
          Sign in to comment
        </button>
      )}
    </div>
  );
}

/** Avatar + pill-shaped box + "Post", matching Hevy's comment row. */
function CommentForm({
  ownerUid,
  workoutId,
  inputRef,
}: {
  ownerUid: string;
  workoutId: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const { profile } = useAuth();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setPosting(true);
    try {
      await addComment(ownerUid, workoutId, profile, text);
      setText("");
    } catch (err) {
      await errorDialog("Couldn't post comment", err);
    } finally {
      setPosting(false);
    }
  }

  if (!profile) return null;
  return (
    <form onSubmit={onPost} className="flex items-center gap-3">
      <Avatar photoURL={profile.photoURL} name={profile.username} size={36} />
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter posts, Shift+Enter adds a line (desktop). Phones use the Post button.
          if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer: fine)").matches) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Write a comment..."
        aria-label="Write a comment"
        maxLength={MAX_COMMENT_LENGTH}
        rows={1}
        className="field-sizing-content max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2 outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
      />
      <button
        disabled={!text.trim() || posting}
        className="px-1 font-medium text-accent disabled:text-muted"
      >
        Post
      </button>
    </form>
  );
}
