import type { Exercise, LoggedSet, Routine, SetType, Workout } from "./types";

/** The in-progress workout. Lives in localStorage until finished, then becomes a Workout. */
export interface DraftWorkout {
  id: string;
  name: string;
  startedAt: number;
  exercises: DraftExercise[];
  /** Rest timer end time. Stored as a timestamp so it stays accurate in background tabs. */
  restEndsAt: number | null;
  restTotalSec: number;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  restSec: number;
  sets: DraftSet[];
  /** Sets from the last time this exercise was logged, shown in the "Previous" column. */
  previous: LoggedSet[] | null;
}

export interface DraftSet {
  key: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

export const DEFAULT_REST_SEC = 90;
export const SET_TYPES: SetType[] = ["normal", "warmup", "drop", "failure"];

const newKey = () => crypto.randomUUID();

function defaultName(now: Date) {
  const h = now.getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `${part} Workout`;
}

export function newDraft(): DraftWorkout {
  return {
    id: crypto.randomUUID(),
    name: defaultName(new Date()),
    startedAt: Date.now(),
    exercises: [],
    restEndsAt: null,
    restTotalSec: 0,
  };
}

/** A new draft pre-filled with a routine's exercises and empty sets. */
export function draftFromRoutine(routine: Routine, keys: string[]): DraftWorkout {
  return {
    ...newDraft(),
    name: routine.name,
    exercises: routine.exercises.map((e, i) => ({
      key: keys[i],
      exerciseId: e.exerciseId,
      name: e.name,
      restSec: e.restSec,
      sets: Array.from({ length: Math.max(1, e.sets) }, () => newSet()),
      previous: null,
    })),
  };
}

function newSet(prev?: DraftSet): DraftSet {
  return {
    key: newKey(),
    type: "normal",
    weightKg: prev?.weightKg ?? null,
    reps: prev?.reps ?? null,
    done: false,
  };
}

function mapExercise(
  w: DraftWorkout,
  exKey: string,
  fn: (e: DraftExercise) => DraftExercise,
): DraftWorkout {
  return { ...w, exercises: w.exercises.map((e) => (e.key === exKey ? fn(e) : e)) };
}

function mapSet(
  w: DraftWorkout,
  exKey: string,
  setKey: string,
  fn: (s: DraftSet) => DraftSet,
): DraftWorkout {
  return mapExercise(w, exKey, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.key === setKey ? fn(s) : s)),
  }));
}

export function addExercises(
  w: DraftWorkout,
  list: Exercise[],
  keys = list.map(newKey),
): DraftWorkout {
  const added = list.map<DraftExercise>((ex, i) => ({
    key: keys[i],
    exerciseId: ex.id,
    name: ex.name,
    restSec: DEFAULT_REST_SEC,
    sets: [newSet()],
    previous: null,
  }));
  return { ...w, exercises: [...w.exercises, ...added] };
}

export function removeExercise(w: DraftWorkout, exKey: string): DraftWorkout {
  return { ...w, exercises: w.exercises.filter((e) => e.key !== exKey) };
}

export function moveExercise(w: DraftWorkout, exKey: string, dir: -1 | 1): DraftWorkout {
  const i = w.exercises.findIndex((e) => e.key === exKey);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= w.exercises.length) return w;
  const exercises = [...w.exercises];
  [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
  return { ...w, exercises };
}

export function setPrevious(w: DraftWorkout, exKey: string, previous: LoggedSet[]): DraftWorkout {
  return mapExercise(w, exKey, (e) => ({ ...e, previous }));
}

export function setRest(w: DraftWorkout, exKey: string, restSec: number): DraftWorkout {
  return mapExercise(w, exKey, (e) => ({ ...e, restSec }));
}

export function addSet(w: DraftWorkout, exKey: string): DraftWorkout {
  return mapExercise(w, exKey, (e) => ({ ...e, sets: [...e.sets, newSet(e.sets.at(-1))] }));
}

export function removeSet(w: DraftWorkout, exKey: string, setKey: string): DraftWorkout {
  return mapExercise(w, exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));
}

export function updateSet(
  w: DraftWorkout,
  exKey: string,
  setKey: string,
  patch: Partial<Omit<DraftSet, "key">>,
): DraftWorkout {
  return mapSet(w, exKey, setKey, (s) => ({ ...s, ...patch }));
}

export function cycleSetType(w: DraftWorkout, exKey: string, setKey: string): DraftWorkout {
  return mapSet(w, exKey, setKey, (s) => ({
    ...s,
    type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length],
  }));
}

/** Toggles a set's done state. Completing a set starts that exercise's rest timer. */
export function toggleDone(w: DraftWorkout, exKey: string, setKey: string): DraftWorkout {
  const ex = w.exercises.find((e) => e.key === exKey);
  const set = ex?.sets.find((s) => s.key === setKey);
  if (!ex || !set) return w;

  const done = !set.done;
  // Ticking an empty set fills it from the "Previous" placeholder values, like Hevy.
  const prev = done ? ex.previous?.[ex.sets.indexOf(set)] : undefined;
  const next = mapSet(w, exKey, setKey, (s) => ({
    ...s,
    done,
    reps: s.reps ?? prev?.reps ?? null,
    weightKg: s.weightKg ?? prev?.weightKg ?? null,
  }));
  if (done && ex.restSec > 0) {
    return startRest(next, ex.restSec);
  }
  return next;
}

export function startRest(w: DraftWorkout, seconds: number): DraftWorkout {
  return { ...w, restEndsAt: Date.now() + seconds * 1000, restTotalSec: seconds };
}

export function adjustRest(w: DraftWorkout, deltaSec: number): DraftWorkout {
  if (w.restEndsAt == null) return w;
  const restEndsAt = Math.max(Date.now(), w.restEndsAt + deltaSec * 1000);
  return { ...w, restEndsAt, restTotalSec: Math.max(0, w.restTotalSec + deltaSec) };
}

export function stopRest(w: DraftWorkout): DraftWorkout {
  return { ...w, restEndsAt: null, restTotalSec: 0 };
}

/** Labels like Hevy: normal sets are numbered, other types get a letter. */
export function setLabels(sets: { type: SetType }[]): string[] {
  let n = 0;
  return sets.map((s) => {
    if (s.type === "warmup") return "W";
    if (s.type === "drop") return "D";
    n += 1;
    return s.type === "failure" ? "F" : String(n);
  });
}

/** Converts the draft into a stored Workout, keeping only completed sets with reps. */
export function toWorkout(w: DraftWorkout, endedAt = Date.now()): Workout {
  const exercises = w.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets
        .filter((s) => s.done && s.reps != null && s.reps > 0)
        .map<LoggedSet>((s) => ({ type: s.type, weightKg: s.weightKg, reps: s.reps! })),
    }))
    .filter((e) => e.sets.length > 0);

  const allSets = exercises.flatMap((e) => e.sets);
  return {
    id: w.id,
    name: w.name.trim().slice(0, 100) || defaultName(new Date(w.startedAt)),
    startedAt: w.startedAt,
    endedAt,
    exercises,
    exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
    volumeKg: allSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0),
    setCount: allSets.length,
  };
}
