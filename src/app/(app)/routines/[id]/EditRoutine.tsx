"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useProfile } from "@/components/AuthProvider";
import { RoutineEditor } from "@/components/RoutineEditor";
import { Spinner } from "@/components/Spinner";
import { useRoutines } from "@/lib/routines";

export function EditRoutine() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile();
  const routines = useRoutines(profile.uid);

  if (!routines) return <Spinner />;
  const routine = routines.find((r) => r.id === id);
  if (!routine) {
    return (
      <div className="py-10 text-center text-muted">
        Routine not found.{" "}
        <Link href="/workout" className="text-accent">
          Back to workouts
        </Link>
      </div>
    );
  }
  return <RoutineEditor key={routine.id} uid={profile.uid} isNew={false} initial={routine} />;
}
