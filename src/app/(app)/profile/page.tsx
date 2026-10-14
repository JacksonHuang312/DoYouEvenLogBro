"use client";

import { useProfile } from "@/components/AuthProvider";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return <ProfileView profile={useProfile()} />;
}
