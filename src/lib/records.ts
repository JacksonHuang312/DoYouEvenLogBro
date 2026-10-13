import type { LoggedSet, RecordType, SetType, Workout } from "./types";
import { listWorkoutsWithExercise } from "./workouts";

/**
 * Your best performances on one exercise before a given workout. A plain object so it can be
 * stored in the localStorage draft.
 */
export interface ExerciseBests {
  /** Heaviest weight lifted, in kg; null if the exercise was only ever done at bodyweight. */
  maxWeightKg: number | null;
  /** Most reps done at each weight, keyed by weightKey(). */
  repsAtWeight: Record<string, number>;
}

interface SetLike {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
}

/** How far back history is read per exercise when looking for records. */
const HISTORY_LIMIT = 500;

/** Weights come from lb→kg conversions, so they're compared rounded to 0.01 kg. */
const hundredths = (kg: number) => Math.round(kg * 100);
export const weightKey = (kg: number | null) => (kg == null ? "bw" : String(hundredths(kg)));

/** Warm-ups never count, and neither do sets without reps. */
const counts = (s: SetLike) => s.type !== "warmup" && s.reps != null && s.reps > 0;

export function bestsFromWorkouts(workouts: Workout[], exerciseId: string): ExerciseBests {
  const bests: ExerciseBests = { maxWeightKg: null, repsAtWeight: {} };
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (!counts(s)) continue;
        if (s.weightKg != null && (bests.maxWeightKg == null || s.weightKg > bests.maxWeightKg)) {
          bests.maxWeightKg = s.weightKg;
        }
        const key = weightKey(s.weightKg);
        bests.repsAtWeight[key] = Math.max(bests.repsAtWeight[key] ?? 0, s.reps);
      }
    }
  }
  return bests;
}

/**
 * Which of `sets` (one exercise's sets in one workout, in order) are personal records.
 * - "weight": heavier than anything lifted before. Only the first set at the new top weight.
 * - "reps": more reps than ever at a weight done before. Only the best such set per weight.
 * With no history (`bests` missing, or the first time doing the exercise) nothing is a record.
 */
export function findRecords(sets: SetLike[], bests: ExerciseBests | undefined): (RecordType | null)[] {
  const result: (RecordType | null)[] = sets.map(() => null);
  if (!bests) return result;

  let heaviest = -1;
  if (bests.maxWeightKg != null) {
    const top = hundredths(bests.maxWeightKg);
    sets.forEach((s, i) => {
      if (!counts(s) || s.weightKg == null || hundredths(s.weightKg) <= top) return;
      if (heaviest < 0 || hundredths(s.weightKg) > hundredths(sets[heaviest].weightKg!)) heaviest = i;
    });
    if (heaviest >= 0) result[heaviest] = "weight";
  }

  const bestAtWeight = new Map<string, number>(); // weight key -> index of its best set
  sets.forEach((s, i) => {
    if (!counts(s) || i === heaviest) return;
    const key = weightKey(s.weightKg);
    const before = bests.repsAtWeight[key];
    if (before == null || s.reps! <= before) return;
    const current = bestAtWeight.get(key);
    if (current == null || s.reps! > sets[current].reps!) bestAtWeight.set(key, i);
  });
  for (const i of bestAtWeight.values()) result[i] = "reps";
  return result;
}

/**
 * Marks the workout's record sets and sets recordCount, replacing any earlier marks (so an
 * edited workout is re-judged). `bests` maps exerciseId to history from before this workout.
 * An exercise listed twice in one workout is judged as one.
 */
export function withRecords(workout: Workout, bests: Record<string, ExerciseBests | undefined>): Workout {
  const exercises = workout.exercises.map((e) => ({
    ...e,
    sets: e.sets.map<LoggedSet>((s) => ({ type: s.type, weightKg: s.weightKg, reps: s.reps })),
  }));

  // The set objects are shared between these lists and `exercises`, so marking one marks both.
  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const e of exercises) setsByExercise.set(e.exerciseId, [...(setsByExercise.get(e.exerciseId) ?? []), ...e.sets]);

  let count = 0;
  for (const [exerciseId, sets] of setsByExercise) {
    findRecords(sets, bests[exerciseId]).forEach((record, i) => {
      if (!record) return;
      sets[i].record = record;
      count++;
    });
  }

  const result: Workout = { ...workout, exercises };
  delete result.recordCount;
  if (count > 0) result.recordCount = count;
  return result;
}

/**
 * An exercise's history: your bests before `before` (default: all time) and the sets from
 * the most recent time you did it, for the "Previous" column. `excludeId` skips the workout
 * being edited, so it isn't compared against itself.
 */
export async function loadExerciseHistory(
  uid: string,
  exerciseId: string,
  { before, excludeId }: { before?: number; excludeId?: string } = {},
): Promise<{ bests: ExerciseBests; previous: LoggedSet[] | null }> {
  const workouts = (await listWorkoutsWithExercise(uid, exerciseId, HISTORY_LIMIT)).filter(
    (w) => w.id !== excludeId && (before == null || w.startedAt < before),
  );
  // Newest first, so [0] is the last time you did it.
  const previous = workouts[0]?.exercises.find((e) => e.exerciseId === exerciseId)?.sets ?? null;
  return { bests: bestsFromWorkouts(workouts, exerciseId), previous };
}
