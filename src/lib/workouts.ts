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
  type QuerySnapshot,
  where,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "./firebase";
import type { Workout } from "./types";

function workoutsCol(uid: string) {
  return collection(firebase().db, "users", uid, "workouts");
}

/** The workout's photo doc. Kept out of the workout doc so lists and the calendar stay light. */
function photoRef(uid: string, workoutId: string) {
  return doc(workoutsCol(uid), workoutId, "photos", "main");
}

/**
 * Saves (creates or overwrites) a workout. `photo`: a JPEG data URL to store, null to delete
 * the existing one, or undefined to leave it alone. Likes and comments are untouched.
 */
export function saveWorkout(uid: string, workout: Workout, photo?: string | null) {
  const { id, ...data } = workout;
  const batch = writeBatch(firebase().db);
  batch.set(doc(workoutsCol(uid), id), data);
  if (photo) batch.set(photoRef(uid, id), { data: photo });
  else if (photo === null) batch.delete(photoRef(uid, id));
  return batch.commit();
}

/** The workout's photo as a JPEG data URL, or null if it has none. */
export async function getWorkoutPhoto(uid: string, workoutId: string): Promise<string | null> {
  const snap = await getDoc(photoRef(uid, workoutId));
  return snap.exists() ? (snap.data().data as string) : null;
}

/** Deletes a workout along with its photo, likes and comments, so nothing is left orphaned. */
export async function deleteWorkout(uid: string, id: string) {
  const ref = doc(workoutsCol(uid), id);
  // The workout itself goes first, so live lists drop it at once, even before the cleanup
  // below has fetched what to remove (the rules let the owner clear these without it).
  const deleted = deleteDoc(ref);
  const [likes, comments] = await Promise.all([
    getDocs(collection(ref, "likes")),
    getDocs(collection(ref, "comments")),
  ]);
  // A batch holds 500 writes; chunk in case a workout went viral.
  const refs = [...likes.docs, ...comments.docs].map((d) => d.ref);
  refs.push(photoRef(uid, id));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(firebase().db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleted;
}

export async function getWorkout(uid: string, id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(workoutsCol(uid), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Workout) : null;
}

/** Newest first: the latest `max` workouts, or every workout since `since` (ms). */
export function workoutsQuery(uid: string, { max, since }: { max?: number; since?: number }) {
  return query(
    workoutsCol(uid),
    ...(since != null ? [where("startedAt", ">=", since)] : []),
    orderBy("startedAt", "desc"),
    ...(max != null ? [limit(max)] : []),
  );
}

export const toWorkouts = (snap: QuerySnapshot) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workout);

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
