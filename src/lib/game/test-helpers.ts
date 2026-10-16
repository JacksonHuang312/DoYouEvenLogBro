import type { LoggedSet, SetType } from "../types";
import type { ClaimableWorkout } from "./claim";
import { buildExerciseLookup } from "./sets";

export const DAY = 24 * 60 * 60 * 1000;
/** Wednesday 2026-10-14, 12:00 UTC. Its week (UTC) starts Sunday 2026-10-11. */
export const T0 = Date.UTC(2026, 9, 14, 12);

export const BENCH = "Barbell_Bench_Press_-_Medium_Grip";
export const SQUAT = "Barbell_Squat";
export const CURL = "Barbell_Curl";
export const ROW = "Seated_Cable_Rows";
export const PULLUP = "Pullups";
export const CRUNCH = "Crunches";
export const BIKE = "Bicycling_Stationary";

export const set = (weightKg: number | null, reps: number, type: SetType = "normal"): LoggedSet => ({
  type,
  weightKg,
  reps,
});

let n = 0;
export function workout(
  startedAt: number,
  exercises: [exerciseId: string, sets: LoggedSet[]][],
  id = `w${++n}`,
): ClaimableWorkout {
  return {
    id,
    startedAt,
    endedAt: startedAt + 60 * 60 * 1000,
    exercises: exercises.map(([exerciseId, sets]) => ({ exerciseId, name: exerciseId, sets })),
  };
}

/** Four working sets of bench at `kg` × 5. */
export const benchDay = (startedAt: number, kg = 80, id?: string) =>
  workout(startedAt, [[BENCH, [set(kg, 5), set(kg, 5), set(kg, 5), set(kg, 5)]]], id);

export const lookup = buildExerciseLookup([
  { id: "c_hack", muscle: "Quads", category: "strength", equipment: "machine" },
  { id: "c_ok", muscle: "chest", category: "strength", equipment: "dumbbell" },
]);
