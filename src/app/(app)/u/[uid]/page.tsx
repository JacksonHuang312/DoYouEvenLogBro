import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { UserProfilePage } from "./UserProfilePage";

export default function UserPage() {
  // The uid is URL data, so it has to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfilePage />
    </Suspense>
  );
}
