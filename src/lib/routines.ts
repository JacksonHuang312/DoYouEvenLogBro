"use client";

import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebase } from "./firebase";
import { routineWithRange, type RepRange } from "./game/progression";
import type { Routine } from "./types";

function routinesCol(uid: string) {
  return collection(firebase().db, "users", uid, "routines");
}

export function newRoutineId(uid: string) {
  return doc(routinesCol(uid)).id;
}

/** Live list of the user's routines, most recently edited first. null while loading. */
export function useRoutines(uid: string) {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  useEffect(() => {
    return onSnapshot(
      query(routinesCol(uid), orderBy("updatedAt", "desc")),
      (snap) => setRoutines(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Routine)),
      (err) => {
        // Show an empty list rather than spinning forever.
        console.error("Couldn't load routines", err);
        setRoutines([]);
      },
    );
  }, [uid]);
  return routines;
}

export function saveRoutine(uid: string, routine: Routine) {
  const { id, ...data } = routine;
  return setDoc(doc(routinesCol(uid), id), { ...data, updatedAt: Date.now() });
}

export function deleteRoutine(uid: string, id: string) {
  return deleteDoc(doc(routinesCol(uid), id));
}

/**
 * Saves a rep range changed mid-workout back to the routine, on the first exercise with that id.
 * Does nothing if the routine or the exercise is gone (the change then lasts for the workout only).
 */
export async function saveRoutineRepRange(uid: string, routineId: string, exerciseId: string, range: RepRange | null) {
  const ref = doc(routinesCol(uid), routineId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Omit<Routine, "id">;
  const exercises = routineWithRange(data.exercises, exerciseId, range);
  if (!exercises) return;
  await setDoc(ref, { ...data, exercises, updatedAt: Date.now() });
}
