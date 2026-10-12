"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ExerciseCard } from "@/components/ExerciseCard";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Spinner } from "@/components/Spinner";
import { WorkoutDetailsForm } from "@/components/WorkoutDetailsForm";
import { alertDialog, errorDialog } from "@/lib/dialog";
import * as Draft from "@/lib/draft";
import type { DraftWorkout } from "@/lib/draft";
import { workoutPath } from "@/lib/social";
import { getWorkout, getWorkoutPhoto, saveWorkout } from "@/lib/workouts";

type Loaded =
  | { status: "ok"; original: { photo: string | null } }
  | { status: "missing" };

/** Edit a saved workout: details, photo, and every exercise and set. Only your own workouts. */
export function EditWorkout() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<DraftWorkout | null>(null);
  const [durationMin, setDurationMin] = useState(0);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    getWorkout(profile.uid, id)
      .then(async (workout) => {
        if (!workout) return setLoaded({ status: "missing" });
        const photo = workout.hasPhoto ? await getWorkoutPhoto(profile.uid, id) : null;
        setDraft(Draft.draftFromWorkout(workout, photo));
        setDurationMin(Math.max(1, Math.round((workout.endedAt - workout.startedAt) / 60_000)));
        setLoaded({ status: "ok", original: { photo } });
      })
      .catch(() => setLoaded({ status: "missing" }));
  }, [profile.uid, id]);

  const update = useCallback((fn: (w: DraftWorkout) => DraftWorkout) => setDraft((w) => (w ? fn(w) : w)), []);

  if (!loaded) return <Spinner />;
  if (loaded.status === "missing" || !draft) {
    return (
      <div className="py-10 text-center text-muted">
        Workout not found.{" "}
        <Link href="/profile" className="text-accent">
          Back to your profile
        </Link>
      </div>
    );
  }

  const back = workoutPath(profile.uid, id);
  const originalPhoto = loaded.original.photo;

  async function onSave() {
    const workout = Draft.toWorkout(draft!, draft!.startedAt + durationMin * 60_000, { requireDone: false });
    if (workout.exercises.length === 0) {
      await alertDialog({ title: "Nothing to save", message: "Add at least one set with reps." });
      return;
    }
    if (durationMin < 1) {
      await alertDialog({ title: "Check the duration", message: "A workout has to last at least a minute." });
      return;
    }
    // Only touch the photo if it changed: undefined leaves it, a new one replaces it, null deletes it.
    const current = draft!.photo ?? null;
    const photo = current === originalPhoto ? undefined : current;
    // Not awaited: offline, the write is queued and only settles once the server acks.
    saveWorkout(profile.uid, workout, photo).catch((e) => errorDialog("Couldn't save workout", e));
    router.replace(back);
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-black px-2 py-2">
        <Link href={back} aria-label="Cancel editing" className="p-1.5 text-muted">
          <X size={24} />
        </Link>
        <h1 className="flex-1 text-headline">Edit Workout</h1>
        <button onClick={onSave} className="rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent">
          Save
        </button>
      </div>

      <WorkoutDetailsForm
        draft={draft}
        update={update}
        durationMin={durationMin}
        setDurationMin={setDurationMin}
        preview={Draft.toWorkout(draft, undefined, { requireDone: false })}
        unit={profile.unit}
      />

      <h2 className="pt-4 text-title-3">Exercises</h2>
      {draft.exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.key}
          exercise={ex}
          unit={profile.unit}
          isFirst={i === 0}
          isLast={i === draft.exercises.length - 1}
          update={update}
          editing
        />
      ))}

      <button
        onClick={() => setPicking(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-semibold"
      >
        <Plus size={20} /> Add Exercise
      </button>

      {picking && (
        <ExercisePicker
          uid={profile.uid}
          onClose={() => setPicking(false)}
          onAdd={(list) => {
            update((w) => Draft.addExercises(w, list));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
