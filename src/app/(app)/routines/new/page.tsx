"use client";

import { useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { RoutineEditor } from "@/components/RoutineEditor";
import { newRoutineId } from "@/lib/routines";

export default function NewRoutinePage() {
  const profile = useProfile();
  // Id fixed on mount so a double-tapped Save writes the same doc.
  const [id] = useState(() => newRoutineId(profile.uid));
  return (
    <RoutineEditor uid={profile.uid} isNew initial={{ id, name: "", exercises: [], updatedAt: 0 }} />
  );
}
