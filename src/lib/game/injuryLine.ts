import { activeInjuries, type PublicInjury } from "./breaks";
import type { GameState } from "./claim";
import { STATS } from "./config";
import { dayId } from "./time";
import { STAT_LABELS } from "./view";

/*
 * The injury line on a profile (GAME_DESIGN.md 3.6). publicStats/{uid} is written when a flag
 * changes and is never cleaned up on its own, so a flag that has lapsed (expiresAt passed) is
 * still in the document: the readers here drop those.
 */

const dayLabel = (id: string) =>
  new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What followers see on a profile: "Injured: Arms, Legs (back around Nov 20)". Null when nothing is live. */
export function injuryLine(injuries: PublicInjury[] | undefined, now: number, timeZone: string): string | null {
  const live = (injuries ?? []).filter((i) => i.expiresAt > now && STATS.includes(i.stat));
  if (live.length === 0) return null;
  const today = dayId(now, timeZone);
  const stats = live.map((i) => STAT_LABELS[i.stat]).join(", ");
  const returns = live.flatMap((i) => (i.expectedReturn && i.expectedReturn >= today ? [i.expectedReturn] : [])).sort();
  // With several flags, "back around" is only true once the last one is: say it only when every flag has a date.
  const back = returns.length === live.length ? returns.at(-1) : undefined;
  return `Injured: ${stats}${back ? ` (back around ${dayLabel(back)})` : ""}`;
}

/** The same tag on your own Hero, which also says when followers can't see it. Null when nothing is flagged. */
export function ownInjuryTag(state: GameState | null, now: number): string | null {
  if (!state) return null;
  const active = activeInjuries(state, now);
  if (active.length === 0) return null;
  const stats = active.map((i) => STAT_LABELS[i.stat]).join(", ");
  return `Injured: ${stats}${state.showInjuries === false ? " · hidden from followers" : ""}`;
}
