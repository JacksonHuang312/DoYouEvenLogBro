"use client";

import Link from "next/link";
import { useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ExerciseMeta, useExerciseSearch } from "@/components/ExercisePicker";
import { BackHeader, ExerciseThumb } from "@/components/ui";
import { createCustomExercise, EQUIPMENT, MUSCLES } from "@/lib/exercises";

export default function ExercisesPage() {
  const profile = useProfile();
  const { results, filters } = useExerciseSearch(profile.uid);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <BackHeader
        title="Exercises"
        href="/profile"
        right={
          <button onClick={() => setCreating((c) => !c)} className="whitespace-nowrap text-sm font-medium text-accent">
            {creating ? "Cancel" : "+ Custom"}
          </button>
        }
      />
      {creating && <CustomExerciseForm uid={profile.uid} onDone={() => setCreating(false)} />}
      {filters}
      <ul className="divide-y divide-line">
        {results.map((ex) => (
          <li key={ex.id}>
            <Link href={`/exercises/${encodeURIComponent(ex.id)}`} className="block px-2 py-3 hover:bg-surface">
              <span className="flex items-center gap-3">
                <ExerciseThumb exerciseId={ex.id} name={ex.name} />
                <span>
                  <span className="block">{ex.name}</span>
                  <ExerciseMeta exercise={ex} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomExerciseForm({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState(MUSCLES[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const select = "flex-1 rounded-md bg-surface-2 px-2 py-2 text-sm capitalize";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Not awaited: the snapshot listener shows it immediately, even offline.
    createCustomExercise(uid, { name: trimmed, muscle, equipment }).catch((err: Error) =>
      alert(`Couldn't save exercise: ${err.message}`),
    );
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-surface p-3">
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
      <button disabled={!name.trim()} className="w-full rounded-md bg-accent py-2 font-medium disabled:opacity-40">
        Create exercise
      </button>
    </form>
  );
}
