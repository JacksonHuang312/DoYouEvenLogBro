import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { ExerciseDetail } from "./ExerciseDetail";

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ExerciseDetail />
    </Suspense>
  );
}
