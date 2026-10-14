"use client";

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { EQUIPMENT, MUSCLES, searchExercises, useExercises } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";
import { CustomExerciseForm } from "./CustomExerciseForm";
import { ExerciseThumb } from "./ui";

/** Search box plus muscle/equipment filters, shared by the picker and the Exercises tab. */
export function useExerciseSearch() {
  const all = useExercises();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");

  // The list (750+ rows) re-renders from a deferred copy, so typing in the box never waits for it.
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchExercises(all, deferredQuery, muscle, equipment),
    [all, deferredQuery, muscle, equipment],
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

  return { results, filters, query };
}

/**
 * For each row of a long exercise list: off-screen rows skip layout and paint until scrolled
 * near (the intrinsic size is a row's height, so the scrollbar stays right).
 */
export const LIST_ROW = "[content-visibility:auto] [contain-intrinsic-size:auto_4.25rem]";

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
  const { results, filters, query } = useExerciseSearch();
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);

  // Stable, so memoized rows only re-render when their own selection changes.
  const toggle = useCallback(
    (ex: Exercise) =>
      setSelected((s) => (s.some((x) => x.id === ex.id) ? s.filter((x) => x.id !== ex.id) : [...s, ex])),
    [],
  );

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-muted">
            Cancel
          </button>
          <h2 className="font-semibold">Add exercises</h2>
          <button onClick={() => setCreating((c) => !c)} className="font-medium text-accent">
            {creating ? "Close" : "Create"}
          </button>
        </div>
        {creating ? (
          <div className="mb-3">
            <CustomExerciseForm
              uid={uid}
              initialName={query}
              onCancel={() => setCreating(false)}
              onCreated={(ex) => {
                // Pre-select the new exercise so it's one tap to add.
                setSelected((s) => [...s, ex]);
                setCreating(false);
              }}
            />
          </div>
        ) : (
          filters
        )}
        <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto pb-24">
          {results.map((ex) => (
            <PickerRow key={ex.id} exercise={ex} order={selected.findIndex((x) => x.id === ex.id)} onToggle={toggle} />
          ))}
          {results.length === 0 && (
            <li className="space-y-3 py-8 text-center text-muted">
              <p>No matches</p>
              {!creating && (
                <button onClick={() => setCreating(true)} className="rounded-lg bg-surface px-4 py-2 text-accent">
                  Create &quot;{query.trim() || "custom exercise"}&quot;
                </button>
              )}
            </li>
          )}
        </ul>
      </div>
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={() => onAdd(selected)} className="w-full rounded-xl bg-accent text-on-accent py-3 font-semibold">
            Add {selected.length} exercise{selected.length > 1 && "s"}
          </button>
        </div>
      )}
    </div>
  );
}

/** One selectable exercise; `order` is its position in the selection, or -1. */
const PickerRow = memo(function PickerRow({
  exercise: ex,
  order,
  onToggle,
}: {
  exercise: Exercise;
  order: number;
  onToggle: (ex: Exercise) => void;
}) {
  return (
    <li className={LIST_ROW}>
      <button
        onClick={() => onToggle(ex)}
        className={`flex w-full items-center gap-3 px-2 py-3 text-left ${order >= 0 ? "bg-accent/15" : ""}`}
      >
        <ExerciseThumb exerciseId={ex.id} />
        <span className="flex-1">
          <span className="block">{ex.name}</span>
          <ExerciseMeta exercise={ex} />
        </span>
        {order >= 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-on-accent">
            {order + 1}
          </span>
        )}
      </button>
    </li>
  );
});
