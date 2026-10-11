"use client";

import { useMemo } from "react";
import library from "@/data/exercises.json";
import { useCustomExercises } from "./customExercises";
import type { Exercise } from "./types";

export const LIBRARY = library as Exercise[];

export const MUSCLES = [...new Set(LIBRARY.map((e) => e.muscle))].sort();
export const EQUIPMENT = [...new Set(LIBRARY.map((e) => e.equipment))].sort();

/** Built-in library merged with the user's custom exercises, sorted by name. */
export function useExercises() {
  const custom = useCustomExercises();
  return useMemo(
    () => [...custom, ...LIBRARY].sort((a, b) => a.name.localeCompare(b.name)),
    [custom],
  );
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
