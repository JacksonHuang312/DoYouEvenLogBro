"use client";

import { ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignedInChrome } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { CommentThread } from "@/components/Comments";
import { SocialBar } from "@/components/SocialBar";
import { Spinner } from "@/components/Spinner";
import { Avatar, ExerciseThumb } from "@/components/ui";
import { SetList, WorkoutStats } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { formatDayAndTime } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { useComments } from "@/lib/social";
import type { UserProfile, Workout } from "@/lib/types";
import { deleteWorkout, getWorkout } from "@/lib/workouts";

type Loaded =
  | { status: "ok"; author: UserProfile; workout: Workout }
  | { status: "private" }
  | { status: "missing" };

export function SharedWorkout() {
  const { uid: ownerUid, id } = useParams<{ uid: string; id: string }>();
  const { user, profile: viewer, loading, signIn } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Wait for auth so the owner of a private account is recognized; reload after signing in.
  const viewerUid = loading ? undefined : (user?.uid ?? null);
  useEffect(() => {
    if (viewerUid === undefined) return;
    Promise.all([getProfile(ownerUid), getWorkout(ownerUid, id)])
      .then(([author, workout]) =>
        setLoaded(author && workout ? { status: "ok", author, workout } : { status: "missing" }),
      )
      .catch((err: { code?: string }) =>
        setLoaded(err.code === "permission-denied" ? { status: "private" } : { status: "missing" }),
      );
  }, [ownerUid, id, viewerUid]);

  if (loading) return <Spinner />;

  const content = !loaded ? (
    <Spinner />
  ) : loaded.status === "ok" ? (
    <WorkoutView author={loaded.author} workout={loaded.workout} />
  ) : (
    <div className="space-y-3 py-16 text-center">
      {loaded.status === "private" && <Lock className="mx-auto text-muted" size={32} />}
      <h1 className="text-xl font-semibold">
        {loaded.status === "private" ? "This workout is private" : "Workout not found"}
      </h1>
      <p className="text-muted">
        {loaded.status === "private"
          ? "The owner's account is private."
          : "It may have been deleted, or the link is wrong."}
      </p>
    </div>
  );

  // Signed-in users get the normal app frame (tab bar); everyone else a simple public header.
  if (user && viewer) return <SignedInChrome uid={user.uid}>{content}</SignedInChrome>;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-black/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/" className="font-bold">
            Do You Even Log, Bro?
          </Link>
          {user ? (
            <Link href="/onboarding" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium">
              Finish setup
            </Link>
          ) : (
            <button
              onClick={() => signIn().catch((e) => errorDialog("Couldn't sign in", e))}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
        {content}
      </main>
    </>
  );
}

function WorkoutView({ author, workout }: { author: UserProfile; workout: Workout }) {
  const { user, profile: viewer } = useAuth();
  const router = useRouter();
  const commentBox = useRef<HTMLTextAreaElement>(null);
  const comments = useComments(author.uid, workout.id);
  const isOwner = user?.uid === author.uid;
  // Show weights in the viewer's unit; visitors who aren't signed in see the author's.
  const unit = viewer?.unit ?? author.unit;

  async function onDelete() {
    const ok = await confirmDialog({
      title: "Delete workout?",
      message: "Its likes and comments will be deleted too. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteWorkout(author.uid, workout.id).catch((e) => errorDialog("Couldn't delete workout", e));
    router.replace("/home");
  }

  return (
    <div>
      {viewer && (
        <div className="-mx-4 mb-2 flex items-center px-2">
          <button onClick={() => router.back()} aria-label="Back" className="p-1 text-accent">
            <ChevronLeft size={28} />
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <Avatar photoURL={author.photoURL} name={author.username} size={44} />
        <div>
          <div className="font-medium">{author.username}</div>
          <div className="text-sm text-muted">{formatDayAndTime(workout.startedAt)}</div>
        </div>
      </div>
      <h1 className="mb-3 text-2xl font-semibold">{workout.name}</h1>
      <div className="border-b border-line pb-3">
        <WorkoutStats workout={workout} unit={unit} />
      </div>
      <div className="border-b border-line py-1">
        <SocialBar
          workout={workout}
          author={author}
          commentCount={comments?.length ?? null}
          onCommentClick={() => {
            document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" });
            commentBox.current?.focus({ preventScroll: true });
          }}
        />
      </div>

      <div className="divide-y divide-line">
        {workout.exercises.map((ex, i) => {
          const header = (
            <>
              <ExerciseThumb exerciseId={ex.exerciseId} size={40} />
              <span className="text-lg font-semibold text-accent">{ex.name}</span>
            </>
          );
          return (
            <section key={i} className="py-5">
              {/* Exercise history pages are personal, so only the owner gets the link. */}
              {isOwner ? (
                <Link href={`/exercises/${encodeURIComponent(ex.exerciseId)}`} className="mb-3 flex items-center gap-3">
                  {header}
                </Link>
              ) : (
                <div className="mb-3 flex items-center gap-3">{header}</div>
              )}
              <div className="mb-1 flex gap-4 px-2 text-xs uppercase text-muted">
                <span className="w-5 text-center">Set</span>
                <span>Weight & Reps</span>
              </div>
              <SetList sets={ex.sets} unit={unit} />
            </section>
          );
        })}
      </div>

      <section id="comments" className="scroll-mt-4 border-t border-line pt-5">
        <h2 className="mb-3 font-semibold">
          Comments{comments && comments.length > 0 && <span className="text-muted"> · {comments.length}</span>}
        </h2>
        <CommentThread
          ownerUid={author.uid}
          workoutId={workout.id}
          comments={comments}
          variant="full"
          inputRef={commentBox}
        />
      </section>

      {isOwner && (
        <button onClick={onDelete} className="mt-8 w-full rounded-xl bg-surface py-3 font-medium text-red-400">
          Delete Workout
        </button>
      )}
    </div>
  );
}
