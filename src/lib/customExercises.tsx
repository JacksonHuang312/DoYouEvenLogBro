"use client";

import { collection, deleteDoc, deleteField, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { firebase } from "./firebase";
import type { Exercise } from "./types";

function customCol(uid: string) {
  return collection(firebase().db, "users", uid, "customExercises");
}

const CustomExercisesContext = createContext<Exercise[]>([]);

/** One live listener for the user's custom exercises, shared by every picker and thumbnail. */
export function CustomExercisesProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const [custom, setCustom] = useState<Exercise[]>([]);

  useEffect(() => {
    return onSnapshot(
      customCol(uid),
      (snap) => setCustom(snap.docs.map((d) => ({ id: d.id, ...d.data(), custom: true }) as Exercise)),
      // The built-in library still works without custom exercises.
      (err) => console.error("Couldn't load custom exercises", err),
    );
  }, [uid]);

  return <CustomExercisesContext.Provider value={custom}>{children}</CustomExercisesContext.Provider>;
}

export function useCustomExercises() {
  return useContext(CustomExercisesContext);
}

export type CustomExerciseInput = Pick<Exercise, "name" | "muscle" | "equipment"> & { imageData?: string };

/**
 * Creates a custom exercise and returns it right away; the write isn't awaited so it
 * works offline. `saved` rejects if the server refuses it.
 */
export function createCustomExercise(uid: string, input: CustomExerciseInput) {
  // "c_" prefix keeps custom ids from ever colliding with library ids.
  const ref = doc(customCol(uid), `c_${doc(customCol(uid)).id}`);
  const data = { ...input, category: "strength" };
  if (!data.imageData) delete data.imageData;
  const exercise: Exercise = { id: ref.id, ...data, custom: true };
  return { exercise, saved: setDoc(ref, data) };
}

/** Sets or (with null) removes a custom exercise's photo. */
export function setCustomExerciseImage(uid: string, id: string, imageData: string | null) {
  return updateDoc(doc(customCol(uid), id), { imageData: imageData ?? deleteField() });
}

export function deleteCustomExercise(uid: string, id: string) {
  return deleteDoc(doc(customCol(uid), id));
}
