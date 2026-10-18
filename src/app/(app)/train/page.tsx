"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { RoutineMenu } from "@/components/rpg/RoutineMenu";
import { RpgScreen, Skeleton } from "@/components/rpg/RpgScreen";
import { TabHeader } from "@/components/rpg/TabHeader";
import { useWorkout } from "@/components/WorkoutProvider";
import { useCustomExercises } from "@/lib/customExercises";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { buildExerciseLookup } from "@/lib/game/sets";
import { trainSchedule, type PlanDay, type PlanStatus } from "@/lib/game/train";
import { dayLabel, resolveTimeZone, routineStats, STAT_LABELS } from "@/lib/game/view";
import { deleteRoutine, useRoutines } from "@/lib/routines";
import type { Routine } from "@/lib/types";
import { useGameState, useSchedule } from "@/lib/useGame";
import { useWorkouts } from "@/lib/useWorkouts";

const DAY_MS = 24 * 60 * 60 * 1000;
const SECTION = "border-b border-rpg-line px-5";

/** Home screen: what to train today, this week at a glance, your routines, and your last workout. */
export default function TrainPage() {
  const profile = useProfile();
  const router = useRouter();
  const { draft, start, startRoutine } = useWorkout();
  const routines = useRoutines(profile.uid);
  const custom = useCustomExercises();
  const lookup = useMemo(() => buildExerciseLookup(custom), [custom]);
  const gameState = useGameState(profile.uid);
  const schedule = useSchedule(profile.uid);
  const [now] = useState(() => Date.now());
  // A week back plus slack for the time zone: enough to cover this week.
  const [since] = useState(() => Date.now() - 8 * DAY_MS);
  const weekWorkouts = useWorkouts(profile.uid, { since }).workouts;
  const last = useWorkouts(profile.uid, { max: 1 }).workouts?.[0];

  const timeZone = resolveTimeZone(gameState.data, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = new Date(now).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });

  // "Unavailable" (offline, nothing cached) counts as "no schedule yet": Train still has to work.
  const plan = useMemo(
    () =>
      routines && weekWorkouts && gameState.status !== "loading" && schedule.status !== "loading"
        ? trainSchedule({
            schedule: schedule.data,
            state: gameState.data,
            routines,
            workouts: weekWorkouts,
            lookup,
            now,
            timeZone,
          })
        : null,
    [routines, weekWorkouts, gameState.status, gameState.data, schedule.status, schedule.data, lookup, now, timeZone],
  );

  function begin(routine: Routine) {
    startRoutine(routine);
    router.push("/workout");
  }

  /** Same function as the Workout page's routine cards. Replacing an open workout needs a yes first. */
  async function startFrom(routine: Routine) {
    if (
      draft &&
      !(await confirmDialog({
        title: "Replace workout in progress?",
        message: `Starting "${routine.name}" discards the workout you have open.`,
        confirmLabel: "Replace",
        destructive: true,
      }))
    )
      return;
    begin(routine);
  }

  async function remove(routine: Routine) {
    const ok = await confirmDialog({
      title: `Delete "${routine.name}"?`,
      message: "Workouts you've already logged from it are kept.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteRoutine(profile.uid, routine.id).catch((e) => errorDialog("Couldn't delete routine", e));
  }

  // The scheduled routine if there is one, otherwise the most recently edited.
  const card = plan?.card;
  const scheduled = card?.routineId ? routines?.find((r) => r.id === card.routineId) : undefined;
  const offer = scheduled ?? routines?.[0];

  return (
    <RpgScreen>
      <TabHeader
        kicker={today}
        title="Train"
        actions={
          <Link
            href="/exercises"
            aria-label="Search exercise library"
            className="flex h-11 w-11 items-center justify-center border border-rpg-line-strong"
          >
            <Search size={18} strokeWidth={1.8} aria-hidden />
          </Link>
        }
      />

      <section className={`${SECTION} flex flex-col gap-3 py-[18px]`}>
        {draft ? (
          <>
            <Heading title={draft.name || "Workout"} meta={`${draft.exercises.length} exercises`} />
            <p className="text-xs text-rpg-text-2">Workout in progress.</p>
            <PrimaryLink href="/workout">Resume workout</PrimaryLink>
          </>
        ) : !routines || !plan ? (
          <>
            <Skeleton className="h-[30px] w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-[50px] w-full" />
          </>
        ) : offer ? (
          <>
            {card && card.kicker && <div className="text-[11px] text-rpg-accent">{card.kicker}</div>}
            <Heading title={offer.name} meta={`${offer.exercises.length} exercises`} />
            <p className="line-clamp-2 text-xs text-rpg-text-2">{offer.exercises.map((e) => e.name).join(", ")}</p>
            {card?.note && <p className="text-xs text-rpg-text-2">{card.note}</p>}
            <button
              onClick={() => begin(offer)}
              className="min-h-[50px] truncate bg-rpg-text px-4 text-sm font-semibold text-rpg-bg"
            >
              Start {offer.name}
            </button>
            {!plan.hasSchedule && (
              <Link href="/quests" className="flex min-h-11 items-center text-xs text-rpg-accent">
                Set a weekly schedule to earn the scheduled-day bonus
              </Link>
            )}
          </>
        ) : (
          <>
            {card?.kind === "paused" && card.note && <p className="text-xs text-rpg-text-2">{card.note}</p>}
            <Heading title="No routines yet" />
            <p className="text-xs text-rpg-text-2">Save the workouts you repeat as routines to start them in one tap.</p>
            <button
              onClick={() => {
                start();
                router.push("/workout");
              }}
              className="min-h-[50px] bg-rpg-text text-sm font-semibold text-rpg-bg"
            >
              Start empty workout
            </button>
          </>
        )}
      </section>

      <section className={`${SECTION} flex flex-col gap-2 py-3.5`} aria-label="This week">
        <div className="flex justify-between text-[11px] text-rpg-muted">
          <span>This week</span>
          {plan && <span>{plan.summary}</span>}
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
          {plan
            ? plan.days.map((d) => <Day key={d.dayId} day={d} />)
            : Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="mx-auto h-[28px] w-7" />)}
        </div>
        {plan?.anyPredicted && (
          <p className="text-[11px] text-rpg-muted">Dashed marks are predictions until your workouts sync.</p>
        )}
      </section>

      <section className="flex flex-col px-5 pt-4">
        <div className="flex items-baseline justify-between pb-1.5">
          <h2 className="font-rpg-head text-xl font-semibold uppercase">Routines</h2>
          <Link href="/routines/new" className="flex min-h-11 items-center text-xs text-rpg-accent">
            New routine
          </Link>
        </div>
        {!routines && <Skeleton className="my-3 h-10 w-full" />}
        {routines?.length === 0 && <p className="py-3 text-xs text-rpg-muted">No routines yet.</p>}
        {routines?.map((r) => {
          const stats = routineStats(r.exercises.map((e) => e.exerciseId), lookup);
          const next = plan?.nextByRoutine[r.id];
          return (
            <div key={r.id} className="flex items-center gap-1 border-t border-rpg-line-soft py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm">{r.name}</span>
                  {next && <span className="shrink-0 text-xs text-rpg-muted">{next}</span>}
                </div>
                <div className="truncate text-[11px] text-rpg-muted">
                  {[`${r.exercises.length} exercises`, ...stats.map((s) => STAT_LABELS[s])].join(" · ")}
                </div>
              </div>
              <button
                onClick={() => void startFrom(r)}
                aria-label={`Start ${r.name}`}
                className="min-h-11 min-w-[64px] border border-rpg-line-strong px-3 text-xs"
              >
                Start
              </button>
              <RoutineMenu routineId={r.id} name={r.name} onDelete={() => void remove(r)} />
            </div>
          );
        })}
      </section>

      <div className="flex items-center justify-between gap-3 px-5 pt-2 text-xs">
        {last ? (
          <span className="truncate text-rpg-muted">
            Last: {last.name} · {dayLabel(last.startedAt, now, timeZone)}
          </span>
        ) : (
          <span className="text-rpg-muted">{weekWorkouts === null ? "" : "No workouts logged yet"}</span>
        )}
        <Link href="/profile" className="flex min-h-11 shrink-0 items-center text-rpg-accent">
          History
        </Link>
      </div>
    </RpgScreen>
  );
}

function Heading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="truncate font-rpg-head text-[30px] font-bold uppercase leading-none">{title}</h2>
      {meta && <span className="shrink-0 text-xs text-rpg-muted">{meta}</span>}
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-[50px] items-center justify-center bg-rpg-text text-sm font-semibold text-rpg-bg">
      {children}
    </Link>
  );
}

const MARK: Record<PlanStatus, { text: string; cls: string }> = {
  done: { text: "✓", cls: "border-rpg-good text-rpg-good" },
  "on-time": { text: "✓", cls: "border-rpg-good text-rpg-good" },
  late: { text: "~", cls: "border-rpg-warn text-rpg-warn" },
  early: { text: "~", cls: "border-rpg-warn text-rpg-warn" },
  today: { text: "•", cls: "border-rpg-accent bg-rpg-accent text-rpg-bg" },
  planned: { text: "", cls: "border-[#4a4d52] text-rpg-muted" },
  missed: { text: "–", cls: "border-transparent text-rpg-muted" },
  extra: { text: "+", cls: "border-rpg-line-strong text-rpg-text-2" },
  rest: { text: "", cls: "border-transparent" },
};

function Day({ day }: { day: PlanDay }) {
  const mark = MARK[day.status];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={day.isToday ? "text-rpg-text" : "text-rpg-muted"}>{day.letter}</span>
      <span
        role="img"
        aria-label={`${day.name}: ${day.label}`}
        className={`flex h-7 w-7 items-center justify-center border text-[13px] ${mark.cls} ${day.predicted ? "border-dashed" : ""}`}
      >
        {mark.text}
      </span>
    </div>
  );
}
