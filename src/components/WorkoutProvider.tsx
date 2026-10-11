"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Draft from "@/lib/draft";
import type { DraftWorkout } from "@/lib/draft";
import type { Exercise, Routine } from "@/lib/types";
import { listWorkoutsWithExercise, saveWorkout } from "@/lib/workouts";

interface WorkoutContextValue {
  draft: DraftWorkout | null;
  update: (fn: (w: DraftWorkout) => DraftWorkout) => void;
  start: () => void;
  /** Replaces any current draft with one built from the routine. */
  startRoutine: (routine: Routine) => void;
  discard: () => void;
  addExercises: (list: Exercise[]) => void;
  /** Saves the workout and returns its id, or null if no sets were completed. */
  finish: () => string | null;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

function load(key: string): DraftWorkout | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DraftWorkout) : null;
  } catch {
    return null;
  }
}

function persist(key: string, draft: DraftWorkout | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the workout still lives in memory.
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

  const update = useCallback((fn: (w: DraftWorkout) => DraftWorkout) => {
    setDraft((w) => (w ? fn(w) : w));
  }, []);

  /** Fills the "Previous" column from the last time each exercise was logged. */
  const loadPrevious = useCallback(
    (exerciseIds: string[], keys: string[]) => {
      exerciseIds.forEach((exerciseId, i) => {
        listWorkoutsWithExercise(uid, exerciseId, 1)
          .then(([last]) => {
            const sets = last?.exercises.find((e) => e.exerciseId === exerciseId)?.sets;
            if (sets) update((w) => Draft.setPrevious(w, keys[i], sets));
          })
          .catch((err) => console.warn("Couldn't load previous sets", err));
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

  const finish = useCallback(() => {
    if (!draft) return null;
    const workout = Draft.toWorkout(draft);
    if (workout.exercises.length === 0) return null;

    // Not awaited: with the offline cache the write is queued locally and the
    // promise only settles once the server acks, which never happens offline.
    setDraft(null);
    saveWorkout(uid, workout).catch((err) => {
      console.error(err);
      setDraft(draft);
      alert(`Couldn't save your workout, it's been restored. (${err.message})`);
    });
    return workout.id;
  }, [draft, uid]);

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
