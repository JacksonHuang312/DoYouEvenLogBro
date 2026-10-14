import { Suspense } from "react";
import { FollowList } from "@/components/FollowList";
import { Spinner } from "@/components/Spinner";

export default function FollowersPage() {
  // The uid is URL data, so it has to be read inside Suspense (see Next's Cache Components docs).
  return (
    <Suspense fallback={<Spinner />}>
      <FollowList kind="followers" />
    </Suspense>
  );
}
