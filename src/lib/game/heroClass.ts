import type { GameState } from "./claim";
import { CLASS_IDS, CLASS_SWITCH, CLASSES, type ClassId } from "./config";
import { fail, ok, type GameResult } from "./items";

/*
 * The hero's class (GAME_DESIGN.md 10, Phase 5 round 3): picked free once (new accounts at sign-up,
 * existing ones on their next visit), then switched for CLASS_SWITCH.cost coins at most once every
 * CLASS_SWITCH.everyDays days since the last switch. Stored on game/state.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClassCard {
  id: ClassId;
  name: string;
  /** One line on what it does. */
  blurb: string;
  skill: string;
  ultimate: string;
}

const BLURB: Record<ClassId, string> = {
  vanguard: "Tough and steady. Lots of health and defense, hits softer. Strong against heavy hitters.",
  striker: "Hits hard and fast. Less health and defense. Best against short fights.",
  cleric: "Heals through damage from your Core. Hits softer. Best against bleeding.",
};

/** The classes as the pick screens show them (Battle and sign-up). */
export const classCards = (): ClassCard[] =>
  CLASS_IDS.map((id) => ({ id, name: CLASSES[id].name, blurb: BLURB[id], skill: CLASSES[id].skill.name, ultimate: CLASSES[id].ultimate.name }));

export const isClassId = (id: unknown): id is ClassId => (CLASS_IDS as readonly unknown[]).includes(id);

/** The class's share of the bonus pool (titles + class), 0 before a class is picked. */
export const classBonusPct = (state: Pick<GameState, "classId">): number => (state.classId ? CLASSES[state.classId].bucketPct : 0);

/** When the next switch is allowed, or null when it is allowed now (or no class is picked yet). */
export function nextSwitchAt(state: Pick<GameState, "classId" | "classSwitchedAt">, now: number): number | null {
  if (!state.classId || state.classSwitchedAt == null) return null;
  const at = state.classSwitchedAt + CLASS_SWITCH.everyDays * DAY_MS;
  return at > now ? at : null;
}

/** The free first pick. */
export function pickClass(state: GameState, classId: ClassId, now: number): GameResult<GameState> {
  if (!isClassId(classId)) return fail("Unknown class", 404);
  if (state.classId) return fail("You already picked a class. Switch it instead");
  return ok({ ...state, classId, updatedAt: now });
}

/** A paid switch to another class. */
export function switchClass(state: GameState, classId: ClassId, now: number): GameResult<{ state: GameState; cost: number }> {
  if (!isClassId(classId)) return fail("Unknown class", 404);
  if (!state.classId) return fail("Pick a class first");
  if (state.classId === classId) return fail(`You are already a ${CLASSES[classId].name}`);
  if (nextSwitchAt(state, now) != null) return fail(`You can switch class once every ${CLASS_SWITCH.everyDays} days`);
  if (state.coins < CLASS_SWITCH.cost) return fail("Not enough coins", 402);
  return ok({
    state: { ...state, classId, classSwitchedAt: now, coins: state.coins - CLASS_SWITCH.cost, updatedAt: now },
    cost: CLASS_SWITCH.cost,
  });
}
