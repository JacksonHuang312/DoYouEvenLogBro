"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ProfileView } from "@/components/ProfileView";
import { Spinner } from "@/components/Spinner";
import { BackHeader } from "@/components/ui";
import { getProfile } from "@/lib/profile";
import type { UserProfile } from "@/lib/types";

/** Someone's profile. Your own lives at /profile, so this sends you there. */
export function UserProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const viewer = useProfile();
  const router = useRouter();
  const isMe = uid === viewer.uid;
  const [loaded, setLoaded] = useState<{ uid: string; profile: UserProfile | null } | null>(null);

  useEffect(() => {
    if (isMe) {
      router.replace("/profile");
      return;
    }
    // Fresh each visit (not cached), so a just-changed privacy setting shows right away.
    getProfile(uid)
      .then((profile) => setLoaded({ uid, profile }))
      .catch(() => setLoaded({ uid, profile: null }));
  }, [isMe, uid, router]);

  if (isMe || loaded?.uid !== uid) return <Spinner />;
  if (!loaded.profile) {
    return (
      <div>
        <BackHeader title="" href="/search" />
        <p className="py-16 text-center text-muted">This account doesn&apos;t exist.</p>
      </div>
    );
  }
  return <ProfileView profile={loaded.profile} />;
}
