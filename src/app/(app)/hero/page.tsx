"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { GearPanel } from "@/components/rpg/GearPanel";
import { RadarChart } from "@/components/rpg/RadarChart";
import { ShopPanel } from "@/components/rpg/ShopPanel";
import { TitlesPanel } from "@/components/rpg/TitlesPanel";
import { RpgScreen, Skeleton } from "@/components/rpg/RpgScreen";
import { TabHeader } from "@/components/rpg/TabHeader";
import type { Snapshot } from "@/lib/game/claim";
import { ownInjuryTag } from "@/lib/game/injuryLine";
import { STAT_MUSCLES, type Stat } from "@/lib/game/config";
import type { MusclesFacts } from "@/lib/game/facts";
import { RADAR_ORDER } from "@/lib/game/radar";
import {
  COMPARE_PERIODS,
  combineStatus,
  heroView,
  pickSnapshot,
  resolveTimeZone,
  STAT_LABELS,
  trainedLabel,
  type ComparePeriod,
  type HeroView,
  type LoadStatus,
} from "@/lib/game/view";
import { useGameState, useInventory, useMuscleFacts, useSnapshots } from "@/lib/useGame";
import { useNow } from "@/lib/useNow";
import { useOnline } from "@/lib/useOnline";

const TABS = ["Stats", "Gear", "Shop", "Titles"] as const;
type Tab = (typeof TABS)[number];

const number = (n: number) => n.toLocaleString("en-US");

/** Hero: level and XP up top, then Stats (radar + table), Gear, Shop and Titles. */
export default function HeroPage() {
  const profile = useProfile();
  const state = useGameState(profile.uid);
  const muscles = useMuscleFacts(profile.uid);
  const snapshots = useSnapshots(profile.uid);
  const inventory = useInventory(profile.uid);
  const online = useOnline();
  const timeZone = resolveTimeZone(state.data, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const now = useNow(state.data?.updatedAt);
  const [tab, setTab] = useState<Tab>("Stats");
  // From game/state, so it shows as soon as that answers. Flags that have lapsed aren't listed.
  const injuryTag = ownInjuryTag(state.data, now);

  // "Calibrating…" is only ever shown from a view built after both listeners have answered.
  const status = combineStatus(state.status, muscles.status);
  const view = useMemo(
    () =>
      status === "ready"
        ? heroView(state.data, muscles.data, now, Intl.DateTimeFormat().resolvedOptions().timeZone)
        : null,
    [status, state.data, muscles.data, now],
  );

  return (
    <RpgScreen>
      <TabHeader
        kicker={view ? `${number(view.coins)} coins${view.power != null ? ` · Power ${number(Math.round(view.power))}` : ""}` : <Skeleton className="h-3 w-32" />}
        title={profile.username}
      />
      <LevelStrip view={view} />
      {injuryTag && (
        <p className="border-b border-rpg-line px-5 py-2.5 text-xs text-rpg-warn">{injuryTag}</p>
      )}

      <div role="tablist" aria-label="Hero sections" className="grid grid-cols-4 border-b border-rpg-line px-3">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`hero-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="hero-panel"
            onClick={() => setTab(t)}
            className={`min-h-11 border-b-2 text-xs ${tab === t ? "border-rpg-text text-rpg-text" : "border-transparent text-rpg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="hero-panel" aria-labelledby={`hero-tab-${tab}`}>
        {tab === "Stats" ? (
          <StatsPanel
            status={status}
            view={view}
            muscles={muscles.data}
            snapshots={snapshots.data}
            snapshotsStatus={snapshots.status}
            now={now}
          />
        ) : tab === "Gear" ? (
          <GearPanel
            state={state.data}
            items={inventory.data}
            itemsStatus={combineStatus(inventory.status, status)}
            bodyPower={view?.power ?? null}
            now={now}
            online={online}
          />
        ) : tab === "Shop" ? (
          <ShopPanel uid={profile.uid} state={state.data} now={now} timeZone={timeZone} online={online} />
        ) : (
          <TitlesPanel state={state.data} online={online} />
        )}
      </div>
    </RpgScreen>
  );
}

function LevelStrip({ view }: { view: HeroView | null }) {
  if (!view) {
    return (
      <div className="flex items-end justify-between gap-4 border-b border-rpg-line px-5 py-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-1 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-12" />
      </div>
    );
  }
  const { level, into, needed } = view.level;
  return (
    <div className="flex items-end justify-between gap-4 border-b border-rpg-line px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={`Level ${level} progress`}
          aria-valuenow={into}
          aria-valuemin={0}
          aria-valuemax={needed}
          className="h-1 bg-rpg-line"
        >
          <div className="h-full bg-rpg-accent" style={{ width: `${Math.min(100, (100 * into) / needed)}%` }} />
        </div>
        <div className="text-[11px] text-rpg-muted">
          {number(into)} / {number(needed)} XP to level {level + 1}
        </div>
      </div>
      <div aria-label={`Level ${level}`} className="font-rpg-head text-[44px] font-bold leading-[0.85] text-rpg-accent">
        {level}
      </div>
    </div>
  );
}

const dateLabel = (ms: number, timeZone: string) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });

function StatsPanel({
  status,
  view,
  muscles,
  snapshots,
  snapshotsStatus,
  now,
}: {
  status: LoadStatus;
  view: HeroView | null;
  muscles: MusclesFacts;
  snapshots: Snapshot[];
  snapshotsStatus: LoadStatus;
  now: number;
}) {
  const [period, setPeriod] = useState<ComparePeriod>("1M");
  const [open, setOpen] = useState<Stat | null>(null);

  if (status === "unavailable") {
    return (
      <p className="px-5 py-8 text-sm text-rpg-text-2">
        Can&apos;t load your stats right now. They&apos;ll show here once you&apos;re back online.
      </p>
    );
  }
  if (!view) {
    return (
      <div aria-busy="true" aria-label="Loading stats" className="flex flex-col gap-4 px-5 pt-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-[262px] w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  const compared = view.calibrating ? null : pickSnapshot(snapshots, now, period);
  const values = Object.fromEntries(RADAR_ORDER.map((s) => [s, view.stats[s].value])) as Record<Stat, number>;
  const previous = compared
    ? (Object.fromEntries(RADAR_ORDER.map((s) => [s, compared.stats[s].value])) as Record<Stat, number>)
    : null;
  const previousLabel = compared ? `your snapshot from ${dateLabel(compared.takenAt, view.timeZone)}` : undefined;

  let note: string | null = null;
  if (view.calibrating) note = "Comparing to the past starts after calibration.";
  else if (!compared && snapshotsStatus === "loading") note = "Loading your history…";
  else if (!compared && snapshotsStatus === "unavailable") note = "History isn't available offline.";
  else if (!compared) {
    const oldest = snapshots.reduce<Snapshot | null>((o, s) => (!o || s.takenAt < o.takenAt ? s : o), null);
    note = oldest
      ? `No snapshot that old yet. Your history starts ${dateLabel(oldest.takenAt, view.timeZone)}.`
      : "No snapshot that old yet. Snapshots are saved as you log workouts.";
  }

  return (
    <>
      <div className="flex flex-col gap-1 px-5 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="font-rpg-head text-xl font-semibold uppercase tracking-[0.02em]">Body stats</h2>
          <div role="group" aria-label="Compare to" className="flex">
            {COMPARE_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                disabled={view.calibrating}
                className={`min-h-11 min-w-11 text-xs disabled:opacity-40 ${
                  period === p ? "text-rpg-text underline underline-offset-[5px]" : "text-rpg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {view.calibrating && (
          <p className="text-xs text-rpg-text-2">
            Calibrating… {view.calibration.workouts} of {view.calibration.needed} workouts
            {view.calibration.daysLeft != null && ` · ${view.calibration.daysLeft} ${view.calibration.daysLeft === 1 ? "day" : "days"} left`}.
            These are average starting stats; your real ones replace them after that.
          </p>
        )}

        <RadarChart values={values} previous={previous} previousLabel={previousLabel} injured={view.injured} />

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-rpg-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t-2 border-rpg-accent" />
            {view.calibrating ? "Average" : "Now"}
          </span>
          {compared && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 border-t-2 border-dashed border-[#6f6c66]" />
              Snapshot, {dateLabel(compared.takenAt, view.timeZone)}
            </span>
          )}
        </div>
        {note && <p className="pt-1 text-[11px] text-rpg-muted">{note}</p>}
      </div>

      <div className="mx-5 mt-3.5 border-t border-rpg-line">
        {RADAR_ORDER.map((stat) => (
          <StatRow
            key={stat}
            stat={stat}
            view={view}
            muscles={muscles}
            previous={compared ? compared.stats[stat].value : null}
            injured={view.injured.includes(stat)}
            open={open === stat}
            onToggle={() => setOpen(open === stat ? null : stat)}
            now={now}
          />
        ))}
      </div>
    </>
  );
}

function StatRow({
  stat,
  view,
  muscles,
  previous,
  injured,
  open,
  onToggle,
  now,
}: {
  stat: Stat;
  view: HeroView;
  muscles: MusclesFacts;
  previous: number | null;
  injured: boolean;
  open: boolean;
  onToggle: () => void;
  now: number;
}) {
  const { value, bonus } = view.stats[stat];
  const shown = Math.round(value);
  const bonusShown = Math.round(bonus);
  const delta = previous == null ? null : shown - Math.round(previous);
  const panelId = `breakdown-${stat}`;

  return (
    <div className="border-b border-rpg-line-soft">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="grid min-h-11 w-full grid-cols-[1fr_64px_64px] items-baseline py-2 text-left text-[13px]"
      >
        <span className={`flex items-center gap-1.5 self-center ${injured ? "text-rpg-warn" : "text-rpg-text-2"}`}>
          {STAT_LABELS[stat]}
          {injured && <span className="text-[11px]">injured</span>}
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        </span>
        <span className="text-right font-semibold">
          {shown}
          {bonusShown >= 1 && <span className="font-normal text-rpg-accent"> +{bonusShown}</span>}
        </span>
        <span
          className={`text-right ${delta == null || delta === 0 ? "text-rpg-muted" : delta > 0 ? "text-rpg-good" : "text-rpg-bad"}`}
        >
          {delta == null ? "" : delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0"}
        </span>
      </button>
      {open && (
        <div id={panelId} className="pb-3 text-xs">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pb-1 text-[11px] text-rpg-muted">
            <span>Muscle</span>
            <span className="text-right">Weight</span>
            <span className="w-8 text-right">Score</span>
            <span className="w-16 text-right">Trained</span>
          </div>
          {(Object.entries(STAT_MUSCLES[stat]) as [keyof typeof view.scores, number][]).map(([muscle, weight]) => (
            <div key={muscle} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-1">
              <span className="capitalize text-rpg-text-2">{muscle}</span>
              <span className="text-right text-rpg-muted">{Math.round(weight * 100)}%</span>
              <span className="w-8 text-right">{view.calibrating ? "–" : Math.round(view.scores[muscle])}</span>
              <span className="w-16 text-right text-rpg-muted">
                {trainedLabel(muscles[muscle]?.lastTrained ?? null, now, view.timeZone)}
              </span>
            </div>
          ))}
          {view.calibrating && <p className="pt-1 text-[11px] text-rpg-muted">Muscle scores show after calibration.</p>}
        </div>
      )}
    </div>
  );
}
