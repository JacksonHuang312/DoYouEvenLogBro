"use client";

import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import library from "@/data/exercises.json";
import { firebase } from "./firebase";
import type { Exercise } from "./types";

export const LIBRARY = library as Exercise[];

export const MUSCLES = [...new Set(LIBRARY.map((e) => e.muscle))].sort();
export const EQUIPMENT = [...new Set(LIBRARY.map((e) => e.equipment))].sort();

function customCol(uid: string) {
  return collection(firebase().db, "users", uid, "customExercises");
}

/** Built-in library merged with the user's custom exercises, sorted by name. */
export function useExercises(uid: string) {
  const [custom, setCustom] = useState<Exercise[]>([]);

  useEffect(() => {
    return onSnapshot(customCol(uid), (snap) => {
      setCustom(snap.docs.map((d) => ({ id: d.id, ...d.data(), custom: true }) as Exercise));
    });
  }, [uid]);

  return useMemo(
    () => [...custom, ...LIBRARY].sort((a, b) => a.name.localeCompare(b.name)),
    [custom],
  );
}

export function createCustomExercise(
  uid: string,
  data: Pick<Exercise, "name" | "muscle" | "equipment">,
) {
  // "c_" prefix keeps custom ids from ever colliding with library ids.
  const ref = doc(customCol(uid), `c_${doc(customCol(uid)).id}`);
  return setDoc(ref, { ...data, category: "strength" }).then(() => ref.id);
}

export function deleteCustomExercise(uid: string, id: string) {
  return deleteDoc(doc(customCol(uid), id));
}

export function searchExercises(
  list: Exercise[],
  text: string,
  muscle: string,
  equipment: string,
) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(
    (e) =>
      (!muscle || e.muscle === muscle) &&
      (!equipment || e.equipment === equipment) &&
      words.every((w) => e.name.toLowerCase().includes(w)),
  );
}
