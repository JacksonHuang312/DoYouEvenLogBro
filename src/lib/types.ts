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
  /** "About me" shown on the profile. Missing on accounts that never set one. */
  bio?: string;
  /** Whether set effort shows as RPE or reps in reserve. Missing means RPE. */
  effortScale?: "rpe" | "rir";
}

/**
 * A personal record set: the heaviest weight ever for the exercise, or the most reps ever
 * at a weight done before. See src/lib/records.ts.
 */
export type RecordType = "weight" | "reps";

/** A completed set as stored in Firestore. Weight is always kg. */
export interface LoggedSet {
  type: SetType;
  weightKg: number | null;
  reps: number;
  /** How hard it was, as RPE in half steps (5 to 10). Optional; see src/lib/effort.ts. Never affects stats. */
  rpe?: number;
  /** Set when this set was a personal record at the time it was saved. */
  record?: RecordType;
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
  /** Optional notes shown under the title. Omitted when empty. */
  description?: string;
  /** The photo lives in users/{uid}/workouts/{id}/photos/main, so lists don't download it. */
  hasPhoto?: boolean;
  /** How many sets were personal records. Omitted when none (and on workouts saved before records). */
  recordCount?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  sets: number;
  restSec: number;
  /** Target rep range (GAME_DESIGN.md 9.2): hit the top and it is time to add weight. Both or neither; most exercises have none. */
  repMin?: number;
  repMax?: number;
  /** Weight to add when progressing, in kg. Missing means the default step for the user's unit. */
  stepKg?: number;
}

/** users/{uid}/routines/{id}: a saved workout template. */
export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  updatedAt: number;
}
