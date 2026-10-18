import type { ClaimResponse } from "../server/game";
import { formatNumber, kgTo } from "../units";
import type { Unit, Workout } from "../types";
import { COINS, STATS, XP } from "./config";
import { levelProgress } from "./economy";
import { isWorkingSet } from "./sets";
import { dayId, daysBetween } from "./time";
import { STAT_LABELS } from "./view";

/*
 * What the Rewards screen shows after a workout (GAME_DESIGN.md 7.3). Pure: the claim response
 * and the little the client knows about the workout go in, plain strings and percentages come
 * out, so the screen only lays them out. Fields the server added in Phase 3 (usedToday,
 * dailyCap, oneRm, schedule, quests) are optional because claims from before it lack them.
 */

const HOUR_MS = 60 * 60 * 1000;

/** What the device knows about a finished workout, saved when it ends (before any claim). */
export interface RewardsSummary {
  name: string;
  startedAt: number;
  durationMs: number;
  workingSets: number;
  volumeKg: number;
}

/** The summary of a workout as it was saved. Warm-ups are left out of the set count and volume. */
export function summaryOf(workout: Pick<Workout, "name" | "startedAt" | "endedAt" | "exercises">): RewardsSummary {
  const sets = workout.exercises.flatMap((e) => e.sets.filter(isWorkingSet));
  return {
    name: workout.name,
    startedAt: workout.startedAt,
    durationMs: Math.max(0, workout.endedAt - workout.startedAt),
    workingSets: sets.length,
    volumeKg: sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0),
  };
}

export type Tone = "good" | "warn" | "muted";

export interface QuestBar {
  id: string;
  title: string;
  /** Share of the bar that was already done, and the share this workout added (both 0 to 100). */
  basePct: number;
  addedPct: number;
  /** "7 / 12" */
  label: string;
  done: boolean;
  /** "+30 coins · +25 XP" when this workout finished the quest. */
  reward: string | null;
}

export interface RewardsView {
  counted: boolean;
  header: { label: string; tone: Tone };
  /** "Push day complete", or the plain workout name when it didn't count. */
  title: string;
  /** "58 min · 18 working sets · 14,320 lb". Empty when the workout's summary is missing. */
  meta: string;
  /** Only when the workout didn't count. */
  notCounted: { headline: string; message: string } | null;
  coins: {
    rows: { label: string; value: string }[];
    total: string;
    /** "180 of 300 daily cap used", or null on claims from before the server reported it. */
    cap: string | null;
  } | null;
  xp: {
    gained: number;
    /** "Level 27 · 6,760 / 10,000" */
    label: string;
    basePct: number;
    addedPct: number;
    /** "Level 26 → 27" when this claim crossed a level. */
    levelUp: string | null;
    /** Why no workout XP was paid, and when it can be again. */
    note: string | null;
  } | null;
  /** While calibrating the stats shown are averages, so no changes are listed. */
  calibrating: boolean;
  stats: { name: string; from: string; to: string; delta: string }[];
  oneRm: string[];
  quests: QuestBar[];
}

export interface RewardsInput {
  response: ClaimResponse;
  summary: RewardsSummary | null;
  unit: Unit;
  timeZone: string;
  /** Whether the workout day fell inside a pause (for the "paused" header). */
  paused: boolean;
  /** game/state.workoutXpAt: when workout XP last paid. Used to say when the next one can. */
  workoutXpAt?: number | null;
  now: number;
  exerciseName: (exerciseId: string) => string | undefined;
}

const number = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (part: number, whole: number) => (whole <= 0 ? 0 : Math.max(0, Math.min(100, (100 * part) / whole)));
const round1 = (x: number) => Math.round(x * 10) / 10;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** 1 decimal, no trailing ".0". */
const one = (x: number) => String(round1(x));

export function durationLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function metaOf(summary: RewardsSummary | null, unit: Unit): string {
  if (!summary) return "";
  return [
    durationLabel(summary.durationMs),
    plural(summary.workingSets, "working set"),
    `${number(kgTo(unit, summary.volumeKg))} ${unit}`,
  ].join(" · ");
}

/** The line above the title: how the workout sat against the schedule. */
function headerOf(
  schedule: { day: string; daysOff: number } | null | undefined,
  summary: RewardsSummary | null,
  paused: boolean,
  timeZone: string,
): RewardsView["header"] {
  if (!schedule) return paused ? { label: "Done while paused", tone: "muted" } : { label: "Extra workout", tone: "muted" };
  if (schedule.daysOff === 0) return { label: "Done on schedule", tone: "good" };
  const days = plural(schedule.daysOff, "day");
  if (!summary) return { label: `Done ${days} off schedule`, tone: "warn" };
  // The slot is before the workout's day when the workout was late; claiming late alone also counts as late.
  const early = daysBetween(dayId(summary.startedAt, timeZone), schedule.day) > 0;
  return { label: `Done ${schedule.daysOff === 1 ? "a day" : days} ${early ? "early" : "late"}`, tone: "warn" };
}

/** "6:40 PM", with the weekday when it isn't today. */
function timeLabel(ms: number, now: number, timeZone: string): string {
  const time = new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  if (dayId(ms, timeZone) === dayId(now, timeZone)) return time;
  return `${new Date(ms).toLocaleDateString("en-US", { weekday: "short", timeZone })} ${time}`;
}

function xpNote(input: RewardsInput): string {
  const every = `Workout XP is paid once every ${XP.workoutCooldownHours} hours.`;
  const at = input.workoutXpAt;
  if (at == null) return every;
  const next = at + XP.workoutCooldownHours * HOUR_MS;
  return next > input.now ? `${every} Next at ${timeLabel(next, input.now, input.timeZone)}.` : every;
}

export function rewardsView(input: RewardsInput): RewardsView {
  const { response, summary, unit, timeZone } = input;
  const meta = metaOf(summary, unit);
  const name = summary?.name.trim() || "Workout";

  if (response.status === "not-counted") {
    const { workingSets, required, reason } = response;
    return {
      counted: false,
      header: { label: "Not counted", tone: "muted" },
      title: name,
      meta,
      notCounted:
        reason === "future"
          ? { headline: "Starts too far ahead", message: "This workout is dated too far in the future to count." }
          : {
              headline: `${workingSets} of ${required} working sets`,
              message: `A workout counts from ${required} working sets. Warm-ups don't count. It's saved either way.`,
            },
      coins: null,
      xp: null,
      calibrating: false,
      stats: [],
      oneRm: [],
      quests: [],
    };
  }

  const r = response.result;
  const quests = r.quests ?? [];

  // Quest XP is inside xp.balance but not xp.total, so the bar's start is balance minus both.
  const questXp = quests.reduce((n, q) => n + (q.paid?.xp ?? 0), 0);
  const gained = r.xp.total + questXp;
  const before = levelProgress(r.xp.balance - gained);
  const after = levelProgress(r.xp.balance);
  const sameLevel = before.level === after.level;
  const baseXp = sameLevel ? before.into : 0;

  const coinRows: { label: string; value: string }[] = [{ label: "Workout", value: String(r.coins.base) }];
  if (r.coins.scheduledBonus > 0) coinRows.push({ label: "Scheduled-day bonus", value: `+${r.coins.scheduledBonus}` });
  if (r.coins.capped > 0) coinRows.push({ label: "Held back by daily cap", value: `−${r.coins.capped}` });
  const cap = r.coins.dailyCap ?? COINS.dailyCap;

  const statsChanged = STATS.flatMap((s) => {
    const from = r.stats.before[s].value;
    const to = r.stats.after[s].value;
    const delta = round1(to - from);
    return Math.abs(delta) >= 0.1 ? [{ stat: s, name: STAT_LABELS[s], from: one(from), to: one(to), d: delta }] : [];
  })
    .sort((a, b) => b.d - a.d)
    .map(({ name, from, to, d }) => ({ name, from, to, delta: d > 0 ? `+${one(d)}` : `−${one(-d)}` }));

  const unitLabel = unit === "lb" ? "lb" : "kg";
  const oneRm = (r.oneRm ?? []).map((l) => {
    const lift = input.exerciseName(l.exerciseId) ?? "Lift";
    return `${lift} ${formatNumber(kgTo(unit, l.weightKg))} ${unitLabel} × ${l.reps} beat your estimate · ${STAT_LABELS[l.stat]} bonus +${one(l.bonusDelta)}`;
  });

  return {
    counted: true,
    header: headerOf(r.schedule, summary, input.paused, timeZone),
    title: summary ? `${name} complete` : "Workout complete",
    meta,
    notCounted: null,
    coins: {
      rows: coinRows,
      total: `+${r.coins.total}`,
      cap: r.coins.usedToday != null ? `${number(r.coins.usedToday)} of ${number(cap)} daily cap used` : null,
    },
    xp: {
      gained,
      label: `Level ${after.level} · ${number(after.into)} / ${number(after.needed)}`,
      basePct: pct(baseXp, after.needed),
      addedPct: pct(after.into - baseXp, after.needed),
      levelUp: sameLevel ? null : `Level ${before.level} → ${after.level}`,
      note: r.xp.workout === 0 ? xpNote(input) : null,
    },
    calibrating: r.calibrating,
    stats: r.calibrating ? [] : statsChanged,
    oneRm: r.calibrating ? [] : oneRm,
    quests: quests.map((q) => ({
      id: q.id,
      title: q.title,
      basePct: pct(Math.min(q.before, q.target), q.target),
      addedPct: pct(Math.min(q.after, q.target) - Math.min(q.before, q.target), q.target),
      label: `${Math.min(q.after, q.target)} / ${q.target}`,
      done: q.after >= q.target,
      reward: q.paid ? `+${q.paid.coins} coins · +${q.paid.xp} XP` : null,
    })),
  };
}
