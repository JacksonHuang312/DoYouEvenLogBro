"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CustomExercisesProvider } from "@/lib/customExercises";
import { useAuth } from "./AuthProvider";
import { BottomNav } from "./BottomNav";
import { FollowingProvider } from "./Follow";
import { RewardsHost } from "./RewardsHost";
import { Sidebar } from "./Sidebar";
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

  return <SignedInChrome uid={user.uid}>{children}</SignedInChrome>;
}

/**
 * Page frame for a signed-in user: workout, custom-exercise and following state, content column, navigation.
 * Phones get a single column and the bottom tab bar. From lg up there's a sidebar instead, and the
 * column widens to fit a right rail on pages that use <WithRail> (detected via [data-rail]).
 */
export function SignedInChrome({ uid, children }: { uid: string; children: React.ReactNode }) {
  return (
    <WorkoutProvider uid={uid}>
      <CustomExercisesProvider uid={uid}>
        <FollowingProvider uid={uid}>
          <div className="flex w-full flex-1 flex-col lg:pl-64">
            <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+2rem)] pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-2xl lg:pb-12 lg:pt-8 lg:has-data-rail:max-w-[68rem]">
              {children}
            </main>
          </div>
          <Sidebar />
          <BottomNav />
          <RewardsHost uid={uid} />
        </FollowingProvider>
      </CustomExercisesProvider>
    </WorkoutProvider>
  );
}
