"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { CustomExerciseForm } from "@/components/CustomExerciseForm";
import { ExerciseMeta, LIST_ROW, useExerciseSearch } from "@/components/ExercisePicker";
import { BackHeader, ExerciseThumb } from "@/components/ui";
import type { Exercise } from "@/lib/types";

export default function ExercisesPage() {
  const profile = useProfile();
  const { results, filters } = useExerciseSearch();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <BackHeader
        title="Exercises"
        href="/train"
        right={
          <button onClick={() => setCreating((c) => !c)} className="whitespace-nowrap text-sm font-medium text-accent">
            {creating ? "Cancel" : "+ Custom"}
          </button>
        }
      />
      {creating && (
        <CustomExerciseForm uid={profile.uid} onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
      )}
      {filters}
      <ul className="divide-y divide-line">
        {results.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} />
        ))}
      </ul>
    </div>
  );
}

/** Memoized so searching only renders rows that are new to the results. */
const ExerciseRow = memo(function ExerciseRow({ exercise: ex }: { exercise: Exercise }) {
  return (
    <li className={LIST_ROW}>
      <Link href={`/exercises/${encodeURIComponent(ex.id)}`} className="block px-2 py-3 hover:bg-surface">
        <span className="flex items-center gap-3">
          <ExerciseThumb exerciseId={ex.id} />
          <span>
            <span className="block">{ex.name}</span>
            <ExerciseMeta exercise={ex} />
          </span>
        </span>
      </Link>
    </li>
  );
});
