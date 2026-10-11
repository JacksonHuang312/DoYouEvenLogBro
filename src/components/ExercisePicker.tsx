"use client";

import { useMemo, useState } from "react";
import { EQUIPMENT, MUSCLES, searchExercises, useExercises } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";
import { ExerciseThumb } from "./ui";

/** Search box plus muscle/equipment filters, shared by the picker and the Exercises tab. */
export function useExerciseSearch(uid: string) {
  const all = useExercises(uid);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");

  const results = useMemo(
    () => searchExercises(all, query, muscle, equipment),
    [all, query, muscle, equipment],
  );

  const select = "flex-1 rounded-md bg-surface-2 px-2 py-2 text-sm capitalize";
  const filters = (
    <div className="space-y-2">
      <input
        type="search"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md bg-surface-2 px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex gap-2">
        <select aria-label="Muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)} className={select}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipment"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          className={select}
        >
          <option value="">All equipment</option>
          {EQUIPMENT.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return { results, filters };
}

export function ExerciseMeta({ exercise }: { exercise: Exercise }) {
  return (
    <span className="block text-xs capitalize text-muted">
      {exercise.muscle} · {exercise.equipment}
      {exercise.custom && " · custom"}
    </span>
  );
}

/** Full-screen multi-select picker. Exercises are added in the order they were tapped. */
export function ExercisePicker({
  uid,
  onAdd,
  onClose,
}: {
  uid: string;
  onAdd: (list: Exercise[]) => void;
  onClose: () => void;
}) {
  const { results, filters } = useExerciseSearch(uid);
  const [selected, setSelected] = useState<Exercise[]>([]);

  const toggle = (ex: Exercise) =>
    setSelected((s) =>
      s.some((x) => x.id === ex.id) ? s.filter((x) => x.id !== ex.id) : [...s, ex],
    );

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-muted">
            Cancel
          </button>
          <h2 className="font-semibold">Add exercises</h2>
          <span className="w-12" />
        </div>
        {filters}
        <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto pb-24">
          {results.map((ex) => {
            const order = selected.findIndex((x) => x.id === ex.id);
            return (
              <li key={ex.id}>
                <button
                  onClick={() => toggle(ex)}
                  className={`flex w-full items-center gap-3 px-2 py-3 text-left ${
                    order >= 0 ? "bg-accent/15" : ""
                  }`}
                >
                  <ExerciseThumb exerciseId={ex.id} name={ex.name} />
                  <span className="flex-1">
                    <span className="block">{ex.name}</span>
                    <ExerciseMeta exercise={ex} />
                  </span>
                  {order >= 0 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs">
                      {order + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="py-8 text-center text-muted">No matches</li>}
        </ul>
      </div>
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={() => onAdd(selected)} className="w-full rounded-xl bg-accent py-3 font-semibold">
            Add {selected.length} exercise{selected.length > 1 && "s"}
          </button>
        </div>
      )}
    </div>
  );
}
