"use client";

import { Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { formatDayAndTime } from "@/lib/format";
import {
  addComment,
  deleteComment,
  groupThreads,
  MAX_COMMENT_LENGTH,
  type WorkoutComment,
  workoutPath,
} from "@/lib/social";
import { useAuth } from "./AuthProvider";
import { promptSignIn } from "./SocialBar";
import { Avatar } from "./ui";

/** How many of the latest comment threads a feed post shows before "View all". */
const PREVIEW_COUNT = 2;

type ReplyTarget = { parentId: string; username: string };

/**
 * Comment threads + "Write a comment" box, like Hevy. Replies are one level deep and
 * collapsed under their comment. The caller loads the comments (useComments) so it can
 * share them with the comment count.
 * - "full": every thread (the workout page).
 * - "preview": the latest few threads with a "View all" link (feed posts).
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
  /** The comment box; the caller focuses it from its 💬 button, and Reply focuses it too. */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { user, profile, signIn } = useAuth();
  const viewerUid = profile ? user!.uid : null;
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const list = comments ?? [];
  const threads = groupThreads(list);
  const shown = variant === "preview" ? threads.slice(-PREVIEW_COUNT) : threads;

  const expand = (id: string) => setExpanded((s) => new Set(s).add(id));
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function startReply(target: ReplyTarget) {
    if (!viewerUid) return void promptSignIn(signIn, "reply");
    setReplyTo(target);
    inputRef.current?.focus();
  }

  async function onDelete(c: WorkoutComment, replyIds: string[]) {
    const ok = await confirmDialog({
      title: replyIds.length ? "Delete comment and its replies?" : "Delete comment?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    if (replyTo?.parentId === c.id) setReplyTo(null);
    deleteComment(ownerUid, workoutId, c.id, replyIds).catch((e) => errorDialog("Couldn't delete comment", e));
  }

  // Comment authors, the workout owner, and (for replies) the thread starter may delete.
  const canDelete = (c: WorkoutComment, threadAuthor: string) =>
    !!viewerUid && (viewerUid === c.authorUid || viewerUid === ownerUid || (!!c.parentId && viewerUid === threadAuthor));

  return (
    <div>
      {variant === "full" && comments?.length === 0 && (
        <p className="mb-4 text-sm text-muted">No comments yet. Say something nice.</p>
      )}
      {threads.length > shown.length && (
        <Link href={`${workoutPath(ownerUid, workoutId)}#comments`} className="mb-3 block text-sm text-muted">
          View all {list.length} comments
        </Link>
      )}

      {shown.length > 0 && (
        <ul className="mb-4 space-y-4">
          {shown.map(({ comment, replies }) => {
            const open = expanded.has(comment.id);
            return (
              <li key={comment.id}>
                <CommentRow
                  comment={comment}
                  onReply={() => startReply({ parentId: comment.id, username: comment.authorUsername })}
                  onDelete={
                    canDelete(comment, comment.authorUid)
                      ? () => onDelete(comment, replies.map((r) => r.id))
                      : undefined
                  }
                />
                {replies.length > 0 && (
                  <div className="ml-13 mt-2">
                    <button onClick={() => toggle(comment.id)} className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-px w-6 bg-muted/50" />
                      {open ? "Hide replies" : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                    </button>
                    {open && (
                      <ul className="mt-3 space-y-3">
                        {replies.map((r) => (
                          <li key={r.id}>
                            <CommentRow
                              comment={r}
                              small
                              onReply={() => startReply({ parentId: comment.id, username: r.authorUsername })}
                              onDelete={canDelete(r, comment.authorUid) ? () => onDelete(r, []) : undefined}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {profile ? (
        <CommentForm
          ownerUid={ownerUid}
          workoutId={workoutId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPosted={(target) => {
            // Show the reply you just posted.
            if (target) expand(target.parentId);
            setReplyTo(null);
          }}
          inputRef={inputRef}
        />
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

function CommentRow({
  comment: c,
  small = false,
  onReply,
  onDelete,
}: {
  comment: WorkoutComment;
  small?: boolean;
  onReply: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Avatar photoURL={c.authorPhotoURL} name={c.authorUsername} size={small ? 32 : 40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold">{c.authorUsername}</span>
          <span className="text-sm text-muted">· {formatDayAndTime(c.createdAt.toMillis())}</span>
        </div>
        <p className="whitespace-pre-wrap break-words">
          {c.replyToUsername && <span className="text-accent">@{c.replyToUsername} </span>}
          {c.text}
        </p>
        <button onClick={onReply} className="mt-0.5 text-sm font-medium text-muted">
          Reply
        </button>
      </div>
      {onDelete && (
        <button aria-label="Delete comment" onClick={onDelete} className="self-start p-2 text-muted">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

/** Avatar + pill-shaped box + "Post", matching Hevy's comment row. Shows who you're replying to. */
function CommentForm({
  ownerUid,
  workoutId,
  replyTo,
  onCancelReply,
  onPosted,
  inputRef,
}: {
  ownerUid: string;
  workoutId: string;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onPosted: (replyTo: ReplyTarget | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { profile } = useAuth();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setPosting(true);
    try {
      await addComment(ownerUid, workoutId, profile, text, replyTo ?? undefined);
      setText("");
      onPosted(replyTo);
    } catch (err) {
      await errorDialog("Couldn't post comment", err);
    } finally {
      setPosting(false);
    }
  }

  if (!profile) return null;
  return (
    <form onSubmit={onPost}>
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-muted">
          <span>
            Replying to <span className="text-accent">@{replyTo.username}</span>
          </span>
          <button type="button" aria-label="Cancel reply" onClick={onCancelReply} className="p-1">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
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
            if (e.key === "Escape" && replyTo) onCancelReply();
          }}
          placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Write a comment..."}
          aria-label="Write a comment"
          maxLength={MAX_COMMENT_LENGTH}
          rows={1}
          className="field-sizing-content max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2 outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        />
        <button disabled={!text.trim() || posting} className="px-1 font-medium text-accent disabled:text-muted">
          Post
        </button>
      </div>
    </form>
  );
}
