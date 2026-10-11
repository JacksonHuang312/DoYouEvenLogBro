import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { WorkoutDetail } from "./WorkoutDetail";

export default function WorkoutDetailPage() {
  // The workout id is URL data, so it has to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <WorkoutDetail />
    </Suspense>
  );
}
