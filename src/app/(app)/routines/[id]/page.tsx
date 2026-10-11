import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { EditRoutine } from "./EditRoutine";

export default function EditRoutinePage() {
  // The routine id is URL data, so it has to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <EditRoutine />
    </Suspense>
  );
}
