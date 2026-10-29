import type { LoggedSet, Workout } from "../types";
import { STAT_POINTS, WEEKS_KEPT, type Stat, type SubMuscle } from "./config";
import { statOf } from "./muscles";
import { didProgress } from "./progression";
import { workingSets, type ExerciseLookup } from "./sets";
import { weekId } from "./time";

/**
 * The stored facts about one sub-muscle (users/{uid}/game/muscles). Points and stats are
 * computed from these plus config, never stored.
 */
export interface MuscleFacts {
  /** Working sets that earned points (after the per-stat cap), progressed ones included. */
  sets: number;
  /** Of those, sets of an exercise that beat its last session. */
  progressed: number;
  /** When the sub-muscle was last trained (workout start, ms). */
  lastTrained: number | null;
  /** Ids of the weeks it was trained (see weekId), newest first, at most WEEKS_KEPT. */
  weeks: string[];
}

export type MusclesFacts = Partial<Record<SubMuscle, MuscleFacts>>;

/** An exercise's working sets in its latest session before the workout being scored, if any. */
export type PreviousSession = (exerciseId: string) => LoggedSet[] | undefined;

/** The working sets of each exercise in a workout, by exercise id (an exercise logged twice is merged). */
export function exerciseSessions(workout: Pick<Workout, "exercises">, lookup: ExerciseLookup): Map<string, LoggedSet[]> {
  const sessions = new Map<string, LoggedSet[]>();
  for (const { exerciseId, set } of workingSets(workout, lookup)) {
    sessions.set(exerciseId, [...(sessions.get(exerciseId) ?? []), set]);
  }
  return sessions;
}

/** Whether an exercise's sets beat its previous session (section 9.2, with the stats' fixed step). */
export function beatLastSession(previous: LoggedSet[] | undefined, current: LoggedSet[]): boolean {
  if (!previous) return false;
  return didProgress({ previous, current, stepKg: STAT_POINTS.stepKg, repMin: 1 }).progressed;
}

export interface WorkoutFacts {
  muscles: MusclesFacts;
  /** Exercises that beat their last session, in workout order. */
  progressed: string[];
  /** The stats those exercises train. */
  progressedStats: Stat[];
}

/**
 * The facts one workout contributes. Every working set of an exercise that beat its last session
 * is a progressed set. At most STAT_POINTS.maxSetsPerStat sets per stat count, progressed ones
 * first; a set over the cap still marks its sub-muscle as trained (for rust and the weeks).
 */
export function workoutFacts(
  workout: Pick<Workout, "exercises" | "startedAt">,
  lookup: ExerciseLookup,
  previous: PreviousSession,
  timeZone: string,
): WorkoutFacts {
  const week = weekId(workout.startedAt, timeZone);
  const sessions = exerciseSessions(workout, lookup);
  const progressed = [...sessions].filter(([id, sets]) => beatLastSession(previous(id), sets)).map(([id]) => id);
  const sets = workingSets(workout, lookup).map((w) => ({ ...w, progressed: progressed.includes(w.exerciseId) }));
  // Stable sort: progressed sets first, otherwise in logged order.
  sets.sort((a, b) => Number(b.progressed) - Number(a.progressed));

  const muscles: MusclesFacts = {};
  const perStat = new Map<Stat, number>();
  for (const { info, progressed: p } of sets) {
    const f = (muscles[info.muscle] ??= { sets: 0, progressed: 0, lastTrained: workout.startedAt, weeks: [week] });
    const stat = statOf(info.muscle);
    const counted = perStat.get(stat) ?? 0;
    if (counted >= STAT_POINTS.maxSetsPerStat) continue;
    perStat.set(stat, counted + 1);
    f.sets++;
    if (p) f.progressed++;
  }
  const progressedStats = [...new Set(progressed.map((id) => statOf(lookup(id)!.muscle)))];
  return { muscles, progressed, progressedStats };
}

const maxOrNull = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

/** Combines facts. Order doesn't matter (sums, a maximum and a set of weeks), so replays match live claims. */
export function mergeFacts(a: MusclesFacts, b: MusclesFacts): MusclesFacts {
  const result: MusclesFacts = { ...a };
  for (const [muscle, fb] of Object.entries(b) as [SubMuscle, MuscleFacts][]) {
    const fa = a[muscle];
    result[muscle] = fa
      ? {
          sets: (fa.sets ?? 0) + fb.sets,
          progressed: (fa.progressed ?? 0) + fb.progressed,
          lastTrained: maxOrNull(fa.lastTrained, fb.lastTrained),
          weeks: [...new Set([...fa.weeks, ...fb.weeks])].sort().reverse().slice(0, WEEKS_KEPT),
        }
      : { ...fb, weeks: [...fb.weeks] };
  }
  return result;
}
