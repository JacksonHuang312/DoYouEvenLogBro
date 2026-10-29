import { describe, expect, test } from "vitest";
import { newGameState, type GameState } from "./claim";
import { CLASS_SWITCH, CLASSES } from "./config";
import { classBonusPct, nextSwitchAt, pickClass, switchClass } from "./heroClass";
import { DAY, T0 } from "./test-helpers";

const fresh = (patch: Partial<GameState> = {}): GameState => ({ ...newGameState(T0, "UTC"), ...patch });

describe("class pick and switch", () => {
  test("the first pick is free and only once", () => {
    const r = pickClass(fresh({ coins: 0 }), "cleric", T0);
    expect(r).toMatchObject({ ok: true, value: { classId: "cleric", coins: 0 } });
    expect(pickClass(r.ok ? r.value : fresh(), "striker", T0).ok).toBe(false);
    expect(pickClass(fresh(), "rogue" as never, T0)).toMatchObject({ ok: false, status: 404 });
  });

  test("a switch costs coins and waits 7 days after the last switch", () => {
    const picked = fresh({ classId: "vanguard", coins: 1000 });
    expect(nextSwitchAt(picked, T0)).toBeNull();
    const first = switchClass(picked, "striker", T0);
    expect(first).toMatchObject({ ok: true, value: { cost: CLASS_SWITCH.cost, state: { classId: "striker", coins: 1000 - CLASS_SWITCH.cost, classSwitchedAt: T0 } } });
    const after = first.ok ? first.value.state : picked;
    expect(switchClass(after, "cleric", T0 + 6 * DAY).ok).toBe(false);
    expect(nextSwitchAt(after, T0 + 6 * DAY)).toBe(T0 + CLASS_SWITCH.everyDays * DAY);
    expect(switchClass(after, "cleric", T0 + CLASS_SWITCH.everyDays * DAY).ok).toBe(true);
  });

  test("a switch needs a picked class, a different class and the coins", () => {
    expect(switchClass(fresh({ coins: 1000 }), "striker", T0).ok).toBe(false);
    expect(switchClass(fresh({ classId: "striker", coins: 1000 }), "striker", T0).ok).toBe(false);
    expect(switchClass(fresh({ classId: "striker", coins: CLASS_SWITCH.cost - 1 }), "cleric", T0)).toMatchObject({ ok: false, status: 402 });
  });

  test("the class adds its share to the bonus pool once picked", () => {
    expect(classBonusPct(fresh())).toBe(0);
    expect(classBonusPct(fresh({ classId: "cleric" }))).toBe(CLASSES.cleric.bucketPct);
  });
});
