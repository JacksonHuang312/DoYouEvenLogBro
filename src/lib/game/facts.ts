import type { Workout } from "../types";
import { WEEKS_KEPT, type SubMuscle } from "./config";
import { epley, setLoadKg, workingSets, type ExerciseLookup } from "./sets";
import { weekId } from "./time";

/**
 * The stored facts about one sub-muscle (users/{uid}/game/muscles). Scores are computed from
 * these plus config, never stored.
 */
export interface MuscleFacts {
  /** Best Epley estimate from sets of 2+ reps: the "calculated 1RM". */
  repEst1RMKg: number | null;
  /** Heaviest load actually moved for 1+ reps. Beating repEst1RMKg earns the 1RM bonus. */
  maxLoadKg: number | null;
  /** When the sub-muscle was last trained (workout start, ms). */
  lastTrained: number | null;
  /** Ids of the weeks it was trained (see weekId), newest first, at most WEEKS_KEPT. */
  weeks: string[];
}

export type MusclesFacts = Partial<Record<SubMuscle, MuscleFacts>>;

const maxOrNull = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

/** The facts one workout contributes. */
export function workoutFacts(
  workout: Pick<Workout, "exercises" | "startedAt">,
  lookup: ExerciseLookup,
  bodyweightKg: number,
  timeZone: string,
): MusclesFacts {
  const facts: MusclesFacts = {};
  const week = weekId(workout.startedAt, timeZone);
  for (const { exerciseId, info, set } of workingSets(workout, lookup)) {
    const load = setLoadKg(set, exerciseId, info, bodyweightKg);
    const f = (facts[info.muscle] ??= { repEst1RMKg: null, maxLoadKg: null, lastTrained: workout.startedAt, weeks: [week] });
    f.maxLoadKg = maxOrNull(f.maxLoadKg, load);
    if (set.reps >= 2) f.repEst1RMKg = maxOrNull(f.repEst1RMKg, epley(load, set.reps));
  }
  return facts;
}

/** Combines facts. Order doesn't matter (maxima and a set of weeks), so replays match live claims. */
export function mergeFacts(a: MusclesFacts, b: MusclesFacts): MusclesFacts {
  const result: MusclesFacts = { ...a };
  for (const [muscle, fb] of Object.entries(b) as [SubMuscle, MuscleFacts][]) {
    const fa = a[muscle];
    result[muscle] = fa
      ? {
          repEst1RMKg: maxOrNull(fa.repEst1RMKg, fb.repEst1RMKg),
          maxLoadKg: maxOrNull(fa.maxLoadKg, fb.maxLoadKg),
          lastTrained: maxOrNull(fa.lastTrained, fb.lastTrained),
          weeks: [...new Set([...fa.weeks, ...fb.weeks])].sort().reverse().slice(0, WEEKS_KEPT),
        }
      : { ...fb, weeks: [...fb.weeks] };
  }
  return result;
}
