"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CustomExercisesProvider } from "@/lib/customExercises";
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
      <CustomExercisesProvider uid={user.uid}>
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+2rem)] pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
        <BottomNav />
      </CustomExercisesProvider>
    </WorkoutProvider>
  );
}
