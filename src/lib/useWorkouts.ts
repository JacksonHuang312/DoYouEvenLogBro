"use client";

import { onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Workout } from "./types";
import { toWorkouts, workoutsQuery } from "./workouts";

/**
 * Live list of your workouts, newest first: the latest `max`, or all since `since` (ms).
 * Cache first: anything already on the device shows at once, then the server's answer
 * replaces it, and later changes (an edit, a delete) arrive on their own. So a page never
 * waits on the network just to show what it already has. null while nothing is known yet.
 */
export function useWorkouts(uid: string, { max, since }: { max?: number; since?: number }) {
  const [state, setState] = useState<{ key: string; workouts: Workout[] | null; error: string | null }>({
    key: "",
    workouts: null,
    error: null,
  });
  const key = `${uid}|${max}|${since}`;

  useEffect(() => {
    return onSnapshot(
      workoutsQuery(uid, { max, since }),
      (snap) => setState({ key, workouts: toWorkouts(snap), error: null }),
      (err) => {
        console.error("Couldn't load workouts", err);
        setState({ key, workouts: [], error: err.message });
      },
    );
  }, [key, uid, max, since]);

  // Ignore results from a previous uid/max/since until the new listener answers.
  return state.key === key ? state : { workouts: null, error: null };
}
