// Replays real training history from Hevy CSV exports through the game's own rules (backfillHistory:
// stats, progressed sets, workout and stat XP, levels) and prints it month by month beside the
// pacing model's steady player (GAME_DESIGN.md 13.11). Reads only the files given; writes nothing.
// Keep exports outside the repo.
//
//   npx tsx scripts/hevy-pacing.ts <export.csv> [more.csv ...]
import { readFileSync } from "node:fs";
import { backfillHistory, type ClaimableWorkout } from "../src/lib/game/claim";
import { PACING, STATS, type Stat, type SubMuscle } from "../src/lib/game/config";
import { statOf } from "../src/lib/game/muscles";
import { simulatePacing } from "../src/lib/game/pacing";
import { power } from "../src/lib/game/score";
import { buildExerciseLookup, workingSets } from "../src/lib/game/sets";
import type { LoggedSet, SetType } from "../src/lib/types";

const LB = 0.45359237;
const DAY = 86_400_000;
const MONTH = (365.25 / 12) * DAY;

/** Hevy exercise title → sub-muscle, first match wins (specific before general). Null skips it (cardio). */
const MUSCLE_RULES: [RegExp, SubMuscle | null][] = [
  [/air bike|treadmill|cycling|rowing machine/i, null],
  [/crunch|ab pulldown|torso rotation|plank|leg raise/i, "abdominals"],
  [/reverse curl|wrist/i, "forearms"],
  [/calf/i, "calves"],
  [/adduction/i, "adductors"],
  [/abduction/i, "abductors"],
  [/romanian|leg curl|stiff/i, "hamstrings"],
  [/leg extension|squat|leg press|lunge/i, "quadriceps"],
  [/hip thrust|glute/i, "glutes"],
  [/tri|jm press|dip|pushdown/i, "triceps"],
  [/curl|preacher/i, "biceps"],
  [/lat pulldown|pull ?up|chin ?up/i, "lats"],
  [/row|pullaparts|pull-apart/i, "middle back"],
  [/deadlift|back extension/i, "lower back"],
  [/shrug/i, "traps"],
  [/lateral raise|shoulder press|rear delt|overhead press|face pull/i, "shoulders"],
  [/bench|chest|fly|butterfly|pec|push ?up/i, "chest"],
];

const muscleOf = (title: string): SubMuscle | null | undefined => MUSCLE_RULES.find(([re]) => re.test(title))?.[1];

const SET_TYPES: Record<string, SetType> = { normal: "normal", warmup: "warmup", dropset: "drop", failure: "failure" };

/** A small CSV parser: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((f) => f !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const files = process.argv.slice(2);
if (!files.length) throw new Error("Usage: npx tsx scripts/hevy-pacing.ts <export.csv> [more.csv ...]");

const unmapped = new Map<string, number>();
const custom = new Map<string, { id: string; muscle: string; category: string; equipment: string }>();
const byWorkout = new Map<string, { start: number; end: number; exercises: Map<string, LoggedSet[]> }>();

for (const file of files) {
  for (const r of parseCsv(readFileSync(file, "utf8"))) {
    const muscle = muscleOf(r.exercise_title);
    if (muscle === undefined) unmapped.set(r.exercise_title, (unmapped.get(r.exercise_title) ?? 0) + 1);
    if (!muscle) continue;
    const id = `hevy:${r.exercise_title}`;
    custom.set(id, { id, muscle, category: "strength", equipment: "machine" });
    const key = `${file}|${r.start_time}`;
    const w = byWorkout.get(key) ?? { start: Date.parse(r.start_time), end: Date.parse(r.end_time), exercises: new Map() };
    byWorkout.set(key, w);
    const sets = w.exercises.get(id) ?? [];
    w.exercises.set(id, sets);
    const lbs = r.weight_lbs === "" ? null : Number(r.weight_lbs);
    sets.push({ type: SET_TYPES[r.set_type] ?? "normal", weightKg: lbs == null ? null : lbs * LB, reps: Number(r.reps) || 0 });
  }
}

const lookup = buildExerciseLookup([...custom.values()]);
const workouts: ClaimableWorkout[] = [...byWorkout.entries()].map(([key, w], i) => ({
  id: `hevy-${i}`,
  startedAt: w.start,
  endedAt: Number.isNaN(w.end) ? w.start + 3_600_000 : w.end,
  exercises: [...w.exercises.entries()].map(([exerciseId, sets]) => ({ exerciseId, name: key, sets })),
}));
workouts.sort((a, b) => a.startedAt - b.startedAt);
if (workouts.some((w) => Number.isNaN(w.startedAt))) throw new Error("Some start_time values didn't parse");

const now = workouts[workouts.length - 1].startedAt + DAY;
const { claims, state } = backfillHistory(workouts, lookup, "America/Toronto", now);
const first = workouts[0].startedAt;
const months = (now - first) / MONTH;

// Training habits, from the working sets as the game counts them.
const counted = new Set(claims.map((c) => c.workoutId));
const setsPerStat = Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>;
let totalSets = 0;
for (const w of workouts.filter((x) => counted.has(x.id))) {
  for (const s of workingSets(w, lookup)) {
    setsPerStat[statOf(lookup(s.exerciseId)!.muscle)]++;
    totalSets++;
  }
}
const progressedExercises = claims.reduce((n, c) => n + (c.progressed?.length ?? 0), 0);
const exerciseSessions = workouts.filter((x) => counted.has(x.id)).reduce((n, w) => n + w.exercises.length, 0);
const perWeek = claims.length / (months * (52 / 12));

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (x: number) => x.toFixed(1);
console.log(`${files.length} file(s): ${workouts.length} workouts, ${claims.length} counted, over ${n1(months)} months`);
console.log(`Workouts a week: ${n1(perWeek)} (model ${PACING.workoutsPerWeek})`);
console.log(`Working sets a workout: ${n1(totalSets / claims.length)} (model ${STATS.reduce((n, s) => n + PACING.setsPerStat[s], 0)})`);
console.log(
  "Sets a workout by stat (real / model): " +
    STATS.map((s) => `${s} ${n1(setsPerStat[s] / claims.length)}/${PACING.setsPerStat[s]}`).join(", "),
);
console.log(`Exercises that beat last session: ${pct(progressedExercises / exerciseSessions)} (model ${pct(PACING.progressedShare)} of sets)`);
if (unmapped.size) console.log(`Unmapped (skipped): ${[...unmapped.entries()].map(([t, c]) => `${t} (${c})`).join(", ")}`);

// Month by month against the model.
const model = simulatePacing(Math.ceil(months * (52 / 12)) + 1);
console.log("\nmonth  real: avg stat  power  level  |  model: avg stat  power  level");
for (let m = 1; m <= Math.floor(months); m++) {
  const at = first + m * MONTH;
  const c = [...claims].reverse().find((x) => x.claimedAt <= at);
  const avg = c ? STATS.reduce((n, s) => n + c.stats.after[s], 0) / STATS.length : 0;
  const w = model[Math.min(model.length - 1, Math.round((m * 52) / 12) - 1)];
  const mAvg = STATS.reduce((n, s) => n + w.stats[s], 0) / STATS.length;
  const pad = (x: number | string, k = 6) => String(x).padStart(k);
  console.log(`${pad(m, 5)}  ${pad(n1(avg), 14)} ${pad(Math.round(c ? power(c.stats.after) : 0))} ${pad(c?.level.after ?? 1)}  |  ${pad(n1(mAvg), 15)} ${pad(Math.round(w.body))} ${pad(w.level)}`);
}
const end = model[model.length - 1];
console.log(`\nNow: level ${state.level}, ${state.xp} XP, body power ${Math.round(state.peakPower)}; model at ${n1(months)} months: level ${end.level}, ${end.xp} XP, body power ${Math.round(end.body)}`);
console.log(`Real XP pace is ${pct(state.xp / end.xp)} of the model's.`);
