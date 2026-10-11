"use client";

import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebase } from "./firebase";
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
