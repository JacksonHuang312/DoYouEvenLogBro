import { describe, expect, test } from "vitest";
import { flagInjury, publicInjuries } from "./breaks";
import { newGameState, type GameState } from "./claim";
import { injuryLine, ownInjuryTag } from "./injuryLine";
import { DAY, T0 } from "./test-helpers";

const UTC = "UTC";
const WEEK_MS = 7 * DAY;

function flagged(...flags: [stat: "arms" | "legs" | "core", expectedReturn?: string][]): GameState {
  let state = newGameState(T0 - 90 * DAY, UTC);
  for (const [stat, expectedReturn] of flags) {
    const r = flagInjury(state, stat, { expectedReturn }, T0, UTC);
    if (!r.ok) throw new Error(r.error);
    state = r.value;
  }
  return state;
}

describe("injuryLine (what followers see)", () => {
  test("nothing flagged gives no line", () => {
    expect(injuryLine(undefined, T0, UTC)).toBeNull();
    expect(injuryLine([], T0, UTC)).toBeNull();
  });

  test("names the stat, and when you're back if there is a date", () => {
    expect(injuryLine(publicInjuries(flagged(["arms"]), T0), T0, UTC)).toBe("Injured: Arms");
    expect(injuryLine(publicInjuries(flagged(["arms", "2026-11-20"]), T0), T0, UTC)).toBe(
      "Injured: Arms (back around Nov 20)",
    );
  });

  test("hides a flag whose expiresAt has passed", () => {
    const injuries = publicInjuries(flagged(["arms"]), T0);
    expect(injuryLine(injuries, T0 + 8 * WEEK_MS - 1, UTC)).toBe("Injured: Arms");
    expect(injuryLine(injuries, T0 + 8 * WEEK_MS, UTC)).toBeNull();
  });

  test("a lapsed flag drops out while a live one stays", () => {
    const old = { stat: "legs" as const, expiresAt: T0 - DAY };
    const live = { stat: "arms" as const, expiresAt: T0 + DAY };
    expect(injuryLine([old, live], T0, UTC)).toBe("Injured: Arms");
  });

  test("with two flags, the return date is the later one, and only if both have one", () => {
    const both = publicInjuries(flagged(["arms", "2026-11-10"], ["legs", "2026-11-20"]), T0);
    expect(injuryLine(both, T0, UTC)).toBe("Injured: Arms, Legs (back around Nov 20)");
    const one = publicInjuries(flagged(["arms", "2026-11-10"], ["legs"]), T0);
    expect(injuryLine(one, T0, UTC)).toBe("Injured: Arms, Legs");
  });

  test("a return date already past is left out", () => {
    const injuries = publicInjuries(flagged(["core", "2026-10-20"]), T0);
    expect(injuryLine(injuries, T0 + 10 * DAY, UTC)).toBe("Injured: Core");
  });

  test("ignores a stat it doesn't know", () => {
    const odd = [{ stat: "wings" as never, expiresAt: T0 + DAY }];
    expect(injuryLine(odd, T0, UTC)).toBeNull();
  });
});

describe("ownInjuryTag (your Hero)", () => {
  test("is empty with nothing flagged or no state yet", () => {
    expect(ownInjuryTag(null, T0)).toBeNull();
    expect(ownInjuryTag(newGameState(T0, UTC), T0)).toBeNull();
  });

  test("lists active flags and says when they're hidden from followers", () => {
    const state = flagged(["arms"], ["legs"]);
    expect(ownInjuryTag(state, T0)).toBe("Injured: Arms, Legs");
    expect(ownInjuryTag({ ...state, showInjuries: false }, T0)).toBe("Injured: Arms, Legs · hidden from followers");
  });

  test("drops flags once they lapse", () => {
    expect(ownInjuryTag(flagged(["arms"]), T0 + 9 * WEEK_MS)).toBeNull();
  });

  test("still shows with 'show to followers' off, when publicStats has nothing", () => {
    const hidden = { ...flagged(["arms", "2026-11-20"]), showInjuries: false };
    // What publicStats gets is empty, so a tag read from there would vanish...
    expect(publicInjuries(hidden, T0)).toEqual([]);
    expect(injuryLine(publicInjuries(hidden, T0), T0, UTC)).toBeNull();
    // ...but your own Hero reads game/state, so it stays, and says followers can't see it.
    expect(ownInjuryTag(hidden, T0)).toBe("Injured: Arms · hidden from followers");
  });
});
