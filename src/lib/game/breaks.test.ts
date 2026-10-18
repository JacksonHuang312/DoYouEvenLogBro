import { describe, expect, test } from "vitest";
import {
  activeInjuries,
  activePause,
  clearInjury,
  endPause,
  flagInjury,
  freezeFor,
  injuredStats,
  pausedOn,
  publicInjuries,
  renewInjury,
  setShowInjuries,
  startPause,
  type Result,
} from "./breaks";
import { newGameState, type GameState } from "./claim";
import { INJURY, PAUSE } from "./config";
import { DAY, T0 } from "./test-helpers";

const UTC = "UTC";
const fresh = () => newGameState(T0, UTC);

/** Unwraps a result that must have succeeded. */
function good<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("startPause", () => {
  test("covers the planned calendar days, today included, and ends on its own", () => {
    const state = good(startPause(fresh(), PAUSE.minDays, T0, UTC));
    const [pause] = state.pauses!;
    expect(pause).toMatchObject({ startAt: T0, startDay: "2026-10-14", endDay: "2026-10-21" });
    expect(pause.endAt).toBe(Date.UTC(2026, 9, 21));
    expect(activePause(state, T0 + 6 * DAY)).toBe(pause);
    expect(activePause(state, pause.endAt)).toBeNull();
    expect(pausedOn(state, "2026-10-14")).toBe(true);
    expect(pausedOn(state, "2026-10-20")).toBe(true);
    expect(pausedOn(state, "2026-10-21")).toBe(false);
    expect(pausedOn(state, "2026-10-13")).toBe(false);
  });

  test("lasts 7 to 28 whole days", () => {
    for (const days of [6, 29, 7.5, 0, -3]) expect(startPause(fresh(), days, T0, UTC).ok).toBe(false);
    expect(startPause(fresh(), PAUSE.maxDays, T0, UTC).ok).toBe(true);
  });

  test("can't start while paused", () => {
    const state = good(startPause(fresh(), 7, T0, UTC));
    expect(startPause(state, 7, T0 + DAY, UTC).ok).toBe(false);
  });

  test("needs a 14-day gap after the last pause ended", () => {
    const state = good(startPause(fresh(), 7, T0, UTC));
    const end = state.pauses![0].endAt;
    expect(startPause(state, 7, end + (PAUSE.cooldownDays - 1) * DAY, UTC).ok).toBe(false);
    expect(startPause(state, 7, end + PAUSE.cooldownDays * DAY, UTC).ok).toBe(true);
  });

  test("keeps the time zone's days: Los Angeles starts at local midnight", () => {
    const la = "America/Los_Angeles";
    const state = good(startPause(newGameState(T0, la), 7, T0, la));
    expect(state.pauses![0].startDay).toBe("2026-10-14");
    expect(state.pauses![0].endAt).toBe(Date.UTC(2026, 9, 21, 7));
  });
});

describe("endPause", () => {
  test("only after the 7-day minimum, and the cooldown counts from then", () => {
    const state = good(startPause(fresh(), 14, T0, UTC));
    expect(endPause(state, T0 + 6 * DAY, UTC).ok).toBe(false);
    const at = T0 + 8 * DAY;
    const ended = good(endPause(state, at, UTC));
    expect(ended.pauses![0]).toMatchObject({ endedEarlyAt: at, endDay: "2026-10-22" });
    expect(activePause(ended, at + 1)).toBeNull();
    expect(pausedOn(ended, "2026-10-22")).toBe(false);
    expect(pausedOn(ended, "2026-10-21")).toBe(true);
    expect(startPause(ended, 7, at + 13 * DAY, UTC).ok).toBe(false);
    expect(startPause(ended, 7, at + 14 * DAY, UTC).ok).toBe(true);
  });

  test("needs a running pause", () => {
    expect(endPause(fresh(), T0, UTC).ok).toBe(false);
  });
});

describe("injury flags", () => {
  test("flag a stat for 8 weeks; at most 2 at once", () => {
    let state = good(flagInjury(fresh(), "arms", { note: "elbow" }, T0, UTC));
    expect(state.injuries![0]).toMatchObject({ stat: "arms", since: T0, expiresAt: T0 + INJURY.expiryWeeks * 7 * DAY, renewals: 0 });
    expect(injuredStats(state, T0)).toEqual(["arms"]);
    expect(flagInjury(state, "arms", {}, T0, UTC).ok).toBe(false);
    state = good(flagInjury(state, "legs", {}, T0, UTC));
    expect(flagInjury(state, "chest", {}, T0, UTC).ok).toBe(false);
  });

  test("auto-expires", () => {
    const state = good(flagInjury(fresh(), "arms", {}, T0, UTC));
    expect(activeInjuries(state, T0 + INJURY.expiryWeeks * 7 * DAY - 1)).toHaveLength(1);
    expect(activeInjuries(state, T0 + INJURY.expiryWeeks * 7 * DAY)).toHaveLength(0);
  });

  test("renewing restarts the 8 weeks; clearing ends it now and frees the slot", () => {
    let state = good(flagInjury(fresh(), "arms", {}, T0, UTC));
    const later = T0 + 40 * DAY;
    state = good(renewInjury(state, "arms", later));
    expect(state.injuries![0]).toMatchObject({ expiresAt: later + INJURY.expiryWeeks * 7 * DAY, renewals: 1 });
    state = good(clearInjury(state, "arms", later + DAY));
    expect(activeInjuries(state, later + DAY)).toHaveLength(0);
    expect(renewInjury(state, "arms", later + DAY).ok).toBe(false);
    expect(clearInjury(state, "arms", later + DAY).ok).toBe(false);
    expect(flagInjury(state, "arms", {}, later + 2 * DAY, UTC).ok).toBe(true);
  });

  test("validates the note and the expected return", () => {
    expect(flagInjury(fresh(), "arms", { note: "x".repeat(INJURY.maxNoteLength + 1) }, T0, UTC).ok).toBe(false);
    expect(flagInjury(fresh(), "arms", { expectedReturn: "soon" }, T0, UTC).ok).toBe(false);
    expect(flagInjury(fresh(), "arms", { expectedReturn: "2026-10-13" }, T0, UTC).ok).toBe(false);
    expect(flagInjury(fresh(), "arms", { expectedReturn: "2026-10-14" }, T0, UTC).ok).toBe(true);
    expect(flagInjury(fresh(), "knee" as never, {}, T0, UTC).ok).toBe(false);
  });

  test("followers see the stat and expected return, never the note, and nothing when hidden", () => {
    let state = good(flagInjury(fresh(), "arms", { note: "private", expectedReturn: "2026-11-20" }, T0, UTC));
    const shown = publicInjuries(state, T0);
    expect(shown).toEqual([{ stat: "arms", expiresAt: T0 + INJURY.expiryWeeks * 7 * DAY, expectedReturn: "2026-11-20" }]);
    expect(JSON.stringify(shown)).not.toContain("private");
    state = setShowInjuries(state, false, T0);
    expect(publicInjuries(state, T0)).toEqual([]);
    expect(activeInjuries(state, T0)).toHaveLength(1);
  });
});

describe("freezeFor", () => {
  test("pauses freeze every stat, injuries only theirs, until they end", () => {
    let state: GameState = good(startPause(fresh(), 7, T0, UTC));
    state = good(flagInjury(state, "arms", {}, T0, UTC));
    state = good(clearInjury(state, "arms", T0 + 2 * DAY));
    const freeze = freezeFor(state);
    expect(freeze.all).toEqual([[T0, Date.UTC(2026, 9, 21)]]);
    expect(freeze.byStat.arms).toEqual([[T0, T0 + 2 * DAY]]);
    expect(freeze.byStat.legs).toBeUndefined();
  });

  test("an early end shortens the frozen time", () => {
    const state = good(endPause(good(startPause(fresh(), 14, T0, UTC)), T0 + 8 * DAY, UTC));
    expect(freezeFor(state).all).toEqual([[T0, T0 + 8 * DAY]]);
  });

  test("a state from before Phase 3 freezes nothing", () => {
    const old: GameState = fresh();
    delete old.pauses;
    delete old.injuries;
    expect(freezeFor(old)).toEqual({ all: [], byStat: {} });
  });
});
