"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { useCustomExercises } from "@/lib/customExercises";
import { LIBRARY } from "@/lib/exercises";
import { pausedOn } from "@/lib/game/breaks";
import { rewardsView } from "@/lib/game/rewards";
import { dayId } from "@/lib/game/time";
import { resolveTimeZone } from "@/lib/game/view";
import { dismissReward, useRewards, type StoredReward } from "@/lib/rewardsStore";
import { useGameState } from "@/lib/useGame";
import { useOnline } from "@/lib/useOnline";
import { RewardsScreen } from "./rpg/RewardsScreen";

/** The active workout screen: rewards never open over it. */
const onWorkoutScreen = (pathname: string) => pathname === "/workout" || pathname.startsWith("/workout/");

/**
 * Mounted once in SignedInChrome. Shows a "Rewards pending" bar above the nav while a claim is
 * queued, then opens the Rewards screen when the claim answers (waiting until you leave /workout).
 */
export function RewardsHost({ uid }: { uid: string }) {
  const { pending, results } = useRewards(uid);
  const pathname = usePathname();
  const online = useOnline();
  const blocked = onWorkoutScreen(pathname);

  const next = results[0];
  return (
    <>
      {pending.length > 0 && !blocked && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex h-8 items-center justify-center border-t border-rpg-line bg-rpg-surface px-4 font-rpg-body text-[11px] text-rpg-text-2 lg:bottom-0 lg:left-64"
        >
          {online ? "Rewards pending" : "Syncing — rewards when you're back online"}
        </div>
      )}
      {next && !blocked && <Overlay key={next.workoutId} uid={uid} reward={next} />}
    </>
  );
}

function Overlay({ uid, reward }: { uid: string; reward: StoredReward }) {
  const profile = useProfile();
  const state = useGameState(uid);
  const custom = useCustomExercises();
  const [now] = useState(() => Date.now());

  const names = useMemo(() => new Map([...LIBRARY, ...custom].map((e) => [e.id, e.name])), [custom]);
  const timeZone = resolveTimeZone(state.data, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const paused =
    reward.summary != null && state.data != null && pausedOn(state.data, dayId(reward.summary.startedAt, timeZone));
  const workoutXpAt = state.data?.workoutXpAt;

  const view = useMemo(
    () =>
      rewardsView({
        response: reward.response,
        summary: reward.summary,
        unit: profile.unit,
        timeZone,
        paused,
        workoutXpAt,
        now,
        exerciseName: (id) => names.get(id),
      }),
    [reward, profile.unit, timeZone, paused, workoutXpAt, now, names],
  );

  const done = useCallback(() => dismissReward(uid, reward.workoutId), [uid, reward.workoutId]);
  return <RewardsScreen view={view} onDone={done} />;
}
