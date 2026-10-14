"use client";

import { useProfile } from "@/components/AuthProvider";
import { UserRow } from "@/components/Follow";
import { Spinner } from "@/components/Spinner";
import { BackHeader } from "@/components/ui";
import { errorDialog } from "@/lib/dialog";
import { acceptRequest, declineRequest, useFollowRequests, useProfiles } from "@/lib/follows";

/** People asking to follow your private account. The list is live, so answered requests drop off. */
export default function FollowRequestsPage() {
  const profile = useProfile();
  const requests = useProfiles(useFollowRequests(profile.uid));

  return (
    <div>
      <BackHeader title="Follow requests" href="/profile" />
      {!requests ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <p className="py-16 text-center text-muted">No pending requests.</p>
      ) : (
        <ul className="divide-y divide-line">
          {requests.map((u) => (
            <UserRow key={u.uid} user={u}>
              <button
                onClick={() =>
                  acceptRequest(profile.uid, u.uid).catch((e) => errorDialog("Couldn't accept request", e))
                }
                className="shrink-0 rounded-lg bg-accent px-4 py-1.5 font-semibold text-on-accent"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  declineRequest(profile.uid, u.uid).catch((e) => errorDialog("Couldn't decline request", e))
                }
                className="shrink-0 rounded-lg bg-surface-2 px-4 py-1.5 font-semibold"
              >
                Decline
              </button>
            </UserRow>
          ))}
        </ul>
      )}
    </div>
  );
}
