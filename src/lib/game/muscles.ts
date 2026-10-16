import { STAT_MUSCLES, STATS, SUB_MUSCLES, type Stat, type SubMuscle } from "./config";

export function isSubMuscle(value: unknown): value is SubMuscle {
  return typeof value === "string" && (SUB_MUSCLES as string[]).includes(value);
}

export function statOf(muscle: SubMuscle): Stat {
  return STATS.find((s) => muscle in STAT_MUSCLES[s])!;
}

/** The sub-muscles grouped by stat, for the custom-exercise dropdown. */
export const MUSCLE_GROUPS = STATS.map((stat) => ({
  stat,
  muscles: Object.keys(STAT_MUSCLES[stat]) as SubMuscle[],
}));

/** Common free-text names for each sub-muscle, for mapping old custom exercises. */
const ALIASES: Record<string, SubMuscle> = {
  ab: "abdominals",
  abs: "abdominals",
  core: "abdominals",
  oblique: "abdominals",
  obliques: "abdominals",
  stomach: "abdominals",
  "six pack": "abdominals",
  pec: "chest",
  pecs: "chest",
  pectorals: "chest",
  lat: "lats",
  back: "lats",
  latissimus: "lats",
  "upper back": "middle back",
  "mid back": "middle back",
  midback: "middle back",
  rhomboid: "middle back",
  rhomboids: "middle back",
  erector: "lower back",
  erectors: "lower back",
  "spinal erectors": "lower back",
  lumbar: "lower back",
  delt: "shoulders",
  delts: "shoulders",
  deltoid: "shoulders",
  deltoids: "shoulders",
  shoulder: "shoulders",
  trap: "traps",
  trapezius: "traps",
  tri: "triceps",
  tris: "triceps",
  tricep: "triceps",
  bi: "biceps",
  bis: "biceps",
  bicep: "biceps",
  arm: "biceps",
  arms: "biceps",
  forearm: "forearms",
  grip: "forearms",
  wrist: "forearms",
  wrists: "forearms",
  quad: "quadriceps",
  quads: "quadriceps",
  quadricep: "quadriceps",
  thigh: "quadriceps",
  thighs: "quadriceps",
  leg: "quadriceps",
  legs: "quadriceps",
  ham: "hamstrings",
  hams: "hamstrings",
  hamstring: "hamstrings",
  calf: "calves",
  glute: "glutes",
  gluteus: "glutes",
  butt: "glutes",
  booty: "glutes",
  hip: "glutes",
  hips: "glutes",
  adductor: "adductors",
  "inner thigh": "adductors",
  "inner thighs": "adductors",
  groin: "adductors",
  abductor: "abductors",
  "outer thigh": "abductors",
  "outer thighs": "abductors",
};

/** Used when nothing in the text resembles a muscle. */
export const FALLBACK_MUSCLE: SubMuscle = "abdominals";

/** Every recognized name, longest first, so "inner thigh" wins over "thigh". */
const NAMES: [string, SubMuscle][] = [
  ...SUB_MUSCLES.map((m) => [m, m] as [string, SubMuscle]),
  ...Object.entries(ALIASES),
].sort((a, b) => b[0].length - a[0].length);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export type MuscleMatch = "exact" | "alias" | "word" | "fuzzy" | "fallback";

/**
 * Maps a free-text muscle (custom exercises from before the 17-value dropdown) to the closest
 * sub-muscle: an exact name, a known alias, a name or alias inside the text ("upper chest"),
 * a near spelling ("hamstrngs"), or FALLBACK_MUSCLE.
 */
export function closestMuscle(text: string): { muscle: SubMuscle; match: MuscleMatch } {
  if (isSubMuscle(text)) return { muscle: text, match: "exact" };
  const norm = normalize(text);
  if (isSubMuscle(norm)) return { muscle: norm, match: "exact" };
  if (norm in ALIASES) return { muscle: ALIASES[norm], match: "alias" };

  const padded = ` ${norm} `;
  const word = NAMES.find(([name]) => padded.includes(` ${name} `));
  if (word) return { muscle: word[1], match: "word" };

  let best: { muscle: SubMuscle; distance: number } | null = null;
  for (const [name, muscle] of NAMES) {
    // Short names ("ab", "bi") are one typo away from too many words to guess from.
    if (name.length < 4) continue;
    const distance = levenshtein(norm, name);
    if (distance <= Math.max(1, Math.floor(name.length / 4)) && (!best || distance < best.distance)) {
      best = { muscle, distance };
    }
  }
  if (best) return { muscle: best.muscle, match: "fuzzy" };
  return { muscle: FALLBACK_MUSCLE, match: "fallback" };
}
