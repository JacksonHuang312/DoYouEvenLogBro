import library from "../../data/exercises.json";
import type { LoggedSet, Workout } from "../types";
import { EXCLUDED_CATEGORIES, MIN_WORKING_SETS, SANITY, type SubMuscle } from "./config";
import { closestMuscle } from "./muscles";

/** What the game needs to know about an exercise. */
export interface ExerciseInfo {
  muscle: SubMuscle;
  category: string;
  equipment: string;
}

export type ExerciseLookup = (exerciseId: string) => ExerciseInfo | undefined;

interface RawExercise {
  id: string;
  muscle: string;
  category: string;
  equipment: string;
}

/**
 * Looks exercises up in the built-in library and the user's custom exercises. Custom exercises
 * from before the 17-value dropdown may have free-text muscles; those map to the closest one.
 */
export function buildExerciseLookup(custom: RawExercise[] = []): ExerciseLookup {
  const map = new Map<string, ExerciseInfo>();
  for (const e of [...(library as RawExercise[]), ...custom]) {
    map.set(e.id, { muscle: closestMuscle(e.muscle).muscle, category: e.category, equipment: e.equipment });
  }
  return (id) => map.get(id);
}

/** A set that counts: not a warm-up, has reps, and isn't an obvious typo. */
export function isWorkingSet(set: LoggedSet): boolean {
  return (
    set.type !== "warmup" &&
    set.reps > 0 &&
    set.reps <= SANITY.maxReps &&
    (set.weightKg == null || (set.weightKg >= 0 && set.weightKg <= SANITY.maxLoadKg))
  );
}

export interface WorkingSet {
  exerciseId: string;
  info: ExerciseInfo;
  set: LoggedSet;
}

/** The workout's working sets on known, non-cardio exercises: the only sets the game looks at. */
export function workingSets(workout: Pick<Workout, "exercises">, lookup: ExerciseLookup): WorkingSet[] {
  return workout.exercises.flatMap((e) => {
    const info = lookup(e.exerciseId);
    if (!info || EXCLUDED_CATEGORIES.includes(info.category)) return [];
    return e.sets.filter(isWorkingSet).map((set) => ({ exerciseId: e.exerciseId, info, set }));
  });
}

export function countsAsWorkout(workout: Pick<Workout, "exercises">, lookup: ExerciseLookup): boolean {
  return workingSets(workout, lookup).length >= MIN_WORKING_SETS;
}
