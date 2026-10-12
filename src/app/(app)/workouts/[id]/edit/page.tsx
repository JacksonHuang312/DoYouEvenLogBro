import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { EditWorkout } from "./EditWorkout";

export default function EditWorkoutPage() {
  // The workout id is URL data, so it has to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <EditWorkout />
    </Suspense>
  );
}
