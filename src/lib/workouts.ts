import {
  collection,
  getCountFromServer,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { firebase } from "./firebase";
import type { Workout } from "./types";

function workoutsCol(uid: string) {
  return collection(firebase().db, "users", uid, "workouts");
}

export function saveWorkout(uid: string, workout: Workout) {
  const { id, ...data } = workout;
  return setDoc(doc(workoutsCol(uid), id), data);
}

export function deleteWorkout(uid: string, id: string) {
  return deleteDoc(doc(workoutsCol(uid), id));
}

export async function getWorkout(uid: string, id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(workoutsCol(uid), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Workout) : null;
}

export async function listWorkouts(uid: string, max = 50): Promise<Workout[]> {
  const snap = await getDocs(query(workoutsCol(uid), orderBy("startedAt", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);
}

export async function listWorkoutsSince(uid: string, since: number): Promise<Workout[]> {
  const snap = await getDocs(
    query(workoutsCol(uid), where("startedAt", ">=", since), orderBy("startedAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);
}

/** Server-side count, so the profile doesn't download every workout just to count them. */
export async function countWorkouts(uid: string): Promise<number> {
  const snap = await getCountFromServer(workoutsCol(uid));
  return snap.data().count;
}

/** Most recent workouts containing an exercise. Needs the composite index in firestore.indexes.json. */
export async function listWorkoutsWithExercise(
  uid: string,
  exerciseId: string,
  max = 30,
): Promise<Workout[]> {
  const snap = await getDocs(
    query(
      workoutsCol(uid),
      where("exerciseIds", "array-contains", exerciseId),
      orderBy("startedAt", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);
}
