"use client";

import { useState } from "react";
import { createCustomExercise } from "@/lib/customExercises";
import { errorDialog } from "@/lib/dialog";
import { EQUIPMENT, MUSCLES } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";
import { PhotoPicker } from "./PhotoPicker";

/** Create a custom exercise: name, muscle, equipment and an optional photo. */
export function CustomExerciseForm({
  uid,
  initialName = "",
  onCreated,
  onCancel,
}: {
  uid: string;
  initialName?: string;
  onCreated: (exercise: Exercise) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState(MUSCLES[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [imageData, setImageData] = useState<string | null>(null);
  const select = "flex-1 rounded-md bg-surface-2 px-2 py-2 text-sm capitalize";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const { exercise, saved } = createCustomExercise(uid, {
      name: trimmed.slice(0, 80),
      muscle,
      equipment,
      ...(imageData ? { imageData } : {}),
    });
    saved.catch((err) => errorDialog("Couldn't save exercise", err));
    onCreated(exercise);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-surface p-4">
      <h2 className="font-semibold">New exercise</h2>
      <PhotoPicker value={imageData} onChange={setImageData} />
      <input
        autoFocus
        placeholder="Exercise name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md bg-surface-2 px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex gap-2">
        <select aria-label="Muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)} className={select}>
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
          {EQUIPMENT.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-md bg-surface-2 py-2">
          Cancel
        </button>
        <button disabled={!name.trim()} className="flex-1 rounded-md bg-accent py-2 font-medium disabled:opacity-40">
          Create exercise
        </button>
      </div>
    </form>
  );
}
