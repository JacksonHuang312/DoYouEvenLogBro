import type { Timestamp } from "firebase/firestore";

export type Unit = "kg" | "lb";

export type SetType = "normal" | "warmup" | "drop" | "failure";

export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  muscle: string;
  custom?: boolean;
  /** Custom exercises only: optional 192px JPEG data URL. */
  imageData?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  /** Server time of onboarding or the last username change; changes are limited to once a week. */
  usernameChangedAt: Timestamp;
  displayName: string;
  photoURL: string | null;
  unit: Unit;
  isPrivate: boolean;
  createdAt: number;
}

/** A completed set as stored in Firestore. Weight is always kg. */
export interface LoggedSet {
  type: SetType;
  weightKg: number | null;
  reps: number;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
}

/** users/{uid}/workouts/{id} */
export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  exercises: LoggedExercise[];
  /** Denormalized for "array-contains" queries on exercise history. */
  exerciseIds: string[];
  volumeKg: number;
  setCount: number;
}

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  sets: number;
  restSec: number;
}

/** users/{uid}/routines/{id}: a saved workout template. */
export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  updatedAt: number;
}
