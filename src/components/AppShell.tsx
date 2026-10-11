"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { BottomNav } from "./BottomNav";
import { Spinner } from "./Spinner";
import { WorkoutProvider } from "./WorkoutProvider";

/** Gate for signed-in pages: redirects to sign-in or onboarding as needed. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (!profile) router.replace("/onboarding");
  }, [loading, user, profile, router]);

  if (loading || !user || !profile) return <Spinner />;

  return (
    <WorkoutProvider uid={user.uid}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </WorkoutProvider>
  );
}
