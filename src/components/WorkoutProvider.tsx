"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { alertDialog } from "@/lib/dialog";
import * as Draft from "@/lib/draft";
import type { DraftWorkout } from "@/lib/draft";
import { loadExerciseHistory, withRecords } from "@/lib/records";
import type { Exercise, Routine } from "@/lib/types";
import { saveWorkout } from "@/lib/workouts";

interface WorkoutContextValue {
  draft: DraftWorkout | null;
  update: (fn: (w: DraftWorkout) => DraftWorkout) => void;
  start: () => void;
  /** Replaces any current draft with one built from the routine. */
  startRoutine: (routine: Routine) => void;
  discard: () => void;
  addExercises: (list: Exercise[]) => void;
  /**
   * Saves the workout (with its photo, if any) as ending at `endedAt` and returns its id,
   * or null if no sets were completed.
   */
  finish: (endedAt: number) => string | null;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

/** The workout photo (up to ~600 KB) is stored under its own key, see persist below. */
const photoKey = (key: string) => `${key}:photo`;

function load(key: string): DraftWorkout | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftWorkout;
    return { ...draft, photo: localStorage.getItem(photoKey(key)) ?? draft.photo ?? null };
  } catch {
    return null;
  }
}

/** Saves the draft without its photo, so a keystroke never re-serializes a big image. */
function persist(key: string, draft: DraftWorkout | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify({ ...draft, photo: undefined }));
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the workout still lives in memory.
  }
}

function persistPhoto(key: string, photo: string | null) {
  try {
    if (photo) localStorage.setItem(photoKey(key), photo);
    else localStorage.removeItem(photoKey(key));
  } catch {
    // Storage full: the photo still lives in memory and is saved with the workout.
  }
}

/**
 * Holds the in-progress workout. Every change is written to localStorage so a
 * refresh or closed tab never loses it. Only mounted client-side, after auth.
 */
export function WorkoutProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const storageKey = `dyelb:draft:${uid}`;
  const [draft, setDraft] = useState<DraftWorkout | null>(() => load(storageKey));

  useEffect(() => persist(storageKey, draft), [storageKey, draft]);
  // Only runs when the photo itself changes (it's a string, compared by value).
  const photo = draft?.photo ?? null;
  useEffect(() => persistPhoto(storageKey, photo), [storageKey, photo]);

  const update = useCallback((fn: (w: DraftWorkout) => DraftWorkout) => {
    setDraft((w) => (w ? fn(w) : w));
  }, []);

  /**
   * Loads each exercise's history: the "Previous" column (last time it was logged) and your
   * bests, so record sets get a trophy as they're checked off and are saved as records.
   */
  const loadPrevious = useCallback(
    (exerciseIds: string[], keys: string[]) => {
      exerciseIds.forEach((exerciseId, i) => {
        loadExerciseHistory(uid, exerciseId)
          .then(({ previous, bests }) => update((w) => Draft.setHistory(w, keys[i], previous, bests)))
          .catch((err) => console.warn("Couldn't load exercise history", err));
      });
    },
    [uid, update],
  );

  const addExercises = useCallback(
    (list: Exercise[]) => {
      const keys = list.map(() => crypto.randomUUID());
      update((w) => Draft.addExercises(w, list, keys));
      loadPrevious(list.map((ex) => ex.id), keys);
    },
    [update, loadPrevious],
  );

  const startRoutine = useCallback(
    (routine: Routine) => {
      const keys = routine.exercises.map(() => crypto.randomUUID());
      setDraft(Draft.draftFromRoutine(routine, keys));
      loadPrevious(routine.exercises.map((e) => e.exerciseId), keys);
    },
    [loadPrevious],
  );

  const finish = useCallback(
    (endedAt: number) => {
      if (!draft) return null;
      const workout = withRecords(Draft.toWorkout(draft, endedAt), Draft.draftBests(draft));
      if (workout.exercises.length === 0) return null;

      // Not awaited: with the offline cache the write is queued locally and the
      // promise only settles once the server acks, which never happens offline.
      setDraft(null);
      saveWorkout(uid, workout, draft.photo || undefined).catch((err) => {
        console.error(err);
        setDraft(draft);
        void alertDialog({
          title: "Couldn't save workout",
          message: `Your workout has been restored so nothing is lost. (${err.message})`,
        });
      });
      return workout.id;
    },
    [draft, uid],
  );

  const value = useMemo<WorkoutContextValue>(
    () => ({
      draft,
      update,
      start: () => setDraft((w) => w ?? Draft.newDraft()),
      startRoutine,
      discard: () => setDraft(null),
      addExercises,
      finish,
    }),
    [draft, update, startRoutine, addExercises, finish],
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used inside <WorkoutProvider>");
  return ctx;
}
