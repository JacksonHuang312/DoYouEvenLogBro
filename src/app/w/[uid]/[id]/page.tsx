import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { SharedWorkout } from "./SharedWorkout";

/**
 * A workout's own page, also its share link. Lives outside the (app) group so
 * people who aren't signed in can open it (rules allow reads of public accounts).
 */
export default function WorkoutPage() {
  // The ids are URL data, so they have to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <SharedWorkout />
    </Suspense>
  );
}
