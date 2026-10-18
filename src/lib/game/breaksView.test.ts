import { describe, expect, test } from "vitest";
import { clearInjury, flagInjury, startPause } from "./breaks";
import { injuryView, pausePlan, pauseView } from "./breaksView";
import { newGameState, type GameState } from "./claim";
import { DAY, T0 } from "./test-helpers";

const UTC = "UTC";
const fresh = () => newGameState(T0 - 90 * DAY, UTC);

function unwrap(r: { ok: true; value: GameState } | { ok: false; error: string }): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("pauseView", () => {
  test("nothing running and no cooldown for a fresh account", () => {
    expect(pauseView(fresh(), T0, UTC)).toEqual({ active: null, nextPauseFrom: null });
    expect(pauseView(null, T0, UTC).active).toBeNull();
  });

  test("a running pause shows when you're back and when it can end early", () => {
    const state = unwrap(startPause(fresh(), 14, T0, UTC));
    const v = pauseView(state, T0 + 2 * DAY, UTC);
    expect(v.active).toMatchObject({ backOn: "Oct 28", daysLeft: 12, canEndNow: false, canEndFrom: "Oct 21" });
  });

  test("ending early opens after 7 full days", () => {
    const state = unwrap(startPause(fresh(), 14, T0, UTC));
    expect(pauseView(state, T0 + 7 * DAY - 1, UTC).active?.canEndNow).toBe(false);
    expect(pauseView(state, T0 + 7 * DAY, UTC).active?.canEndNow).toBe(true);
  });

  test("after a pause ends, the next can't start for 14 days", () => {
    const state = unwrap(startPause(fresh(), 7, T0, UTC));
    // The pause ended Oct 21 00:00 UTC; the cooldown runs to Nov 4.
    const v = pauseView(state, T0 + 10 * DAY, UTC);
    expect(v.active).toBeNull();
    expect(v.nextPauseFrom).toBe("Nov 4");
    expect(pauseView(state, T0 + 30 * DAY, UTC).nextPauseFrom).toBeNull();
  });
});

describe("pausePlan", () => {
  test("says when a pause would end", () => {
    expect(pausePlan(fresh(), 14, T0, UTC)).toEqual({ backOn: "Oct 28", error: null });
  });

  test("passes on the server's reason", () => {
    expect(pausePlan(fresh(), 3, T0, UTC).error).toBe("A pause lasts 7 to 28 days");
    expect(pausePlan(fresh(), 29, T0, UTC).error).toBe("A pause lasts 7 to 28 days");
    const state = unwrap(startPause(fresh(), 7, T0, UTC));
    expect(pausePlan(state, 7, T0 + DAY, UTC).error).toBe("You are already paused");
    expect(pausePlan(state, 7, T0 + 10 * DAY, UTC).error).toMatch(/^Wait 14 days/);
  });
});

describe("injuryView", () => {
  test("a fresh account has nothing flagged and every stat to flag", () => {
    const v = injuryView(fresh(), T0, UTC);
    expect(v.rows).toEqual([]);
    expect(v.flaggable.map((f) => f.stat)).toHaveLength(6);
    expect(v.full).toBe(false);
    expect(v.shown).toBe(true);
  });

  test("lists active flags with their expiry and the private note", () => {
    const state = unwrap(flagInjury(fresh(), "arms", { note: "elbow", expectedReturn: "2026-11-20" }, T0, UTC));
    const v = injuryView(state, T0, UTC);
    expect(v.rows).toEqual([
      {
        stat: "arms",
        label: "Arms",
        note: "elbow",
        expectedReturn: "Nov 20",
        expires: "Dec 9",
        daysToExpiry: 56,
        soon: false,
        renewals: 0,
      },
    ]);
    expect(v.flaggable.map((f) => f.stat)).not.toContain("arms");
  });

  test("a flag close to lapsing is marked", () => {
    const state = unwrap(flagInjury(fresh(), "legs", {}, T0, UTC));
    expect(injuryView(state, T0 + 50 * DAY, UTC).rows[0]).toMatchObject({ soon: true, daysToExpiry: 6 });
  });

  test("two flags is the limit", () => {
    let state = unwrap(flagInjury(fresh(), "arms", {}, T0, UTC));
    state = unwrap(flagInjury(state, "legs", {}, T0, UTC));
    const v = injuryView(state, T0, UTC);
    expect(v.full).toBe(true);
    expect(v.flaggable).toEqual([]);
  });

  test("a cleared flag is gone, and its stat can be flagged again", () => {
    let state = unwrap(flagInjury(fresh(), "arms", {}, T0, UTC));
    state = unwrap(clearInjury(state, "arms", T0 + DAY));
    const v = injuryView(state, T0 + 2 * DAY, UTC);
    expect(v.rows).toEqual([]);
    expect(v.flaggable.map((f) => f.stat)).toContain("arms");
  });

  test("an expected return in the past is dropped from the row", () => {
    const state = unwrap(flagInjury(fresh(), "core", { expectedReturn: "2026-10-20" }, T0, UTC));
    expect(injuryView(state, T0 + 10 * DAY, UTC).rows[0].expectedReturn).toBeNull();
  });

  test("shown follows the visibility setting", () => {
    expect(injuryView({ ...fresh(), showInjuries: false }, T0, UTC).shown).toBe(false);
  });
});
