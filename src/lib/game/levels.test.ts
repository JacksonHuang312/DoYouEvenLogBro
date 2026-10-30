import { describe, expect, test } from "vitest";
import { newGameState, type GameState } from "./claim";
import { LEVEL_POINTS, LEVEL_REWARDS } from "./config";
import { assignPoints, boosted, payLevelRewards, pointBoost, pointsFree, respecPoints } from "./levels";
import { withQuestRewards } from "./quests";
import { T0 } from "./test-helpers";

const state = (patch: Partial<GameState> = {}): GameState => ({ ...newGameState(T0, "UTC"), ...patch });

describe("level rewards", () => {
  test("each new level pays once; every 10th pays the bigger reward", () => {
    const r = payLevelRewards(state({ level: 11, coins: 0, materials: { scrap: 1 } }), T0);
    expect(r.reward!.levels).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(r.reward!.coins).toBe(9 * LEVEL_REWARDS.coins + LEVEL_REWARDS.tenth.coins);
    expect(r.state).toMatchObject({ coins: r.reward!.coins, materials: { scrap: 1 + 9 * LEVEL_REWARDS.scrap + LEVEL_REWARDS.tenth.scrap }, levelRewardsTo: 11 });
    // Paid levels never pay again.
    expect(payLevelRewards(r.state, T0).reward).toBeNull();
  });

  test("the backfill records levels as paid without paying", () => {
    const r = payLevelRewards(state({ level: 30, coins: 7 }), T0, false);
    expect(r).toMatchObject({ reward: null, state: { coins: 7, levelRewardsTo: 30 } });
  });

  test("a quest that levels you up pays the level's reward too", () => {
    const next = withQuestRewards(state({ xp: 0, coins: 0 }), [{ reward: { coins: 10, xp: 30 } }], T0);
    expect(next.level).toBe(2);
    expect(next.coins).toBe(10 + LEVEL_REWARDS.coins);
    expect(next.levelRewardsTo).toBe(2);
  });
});

describe("stat points", () => {
  test("one per level past 1; assigning spends them, capped per stat", () => {
    const s = state({ level: 11 });
    expect(pointsFree(s)).toBe(10 * LEVEL_POINTS.perLevel);
    const r = assignPoints(s, { legs: 4, core: 2 }, 0, T0);
    expect(r).toMatchObject({ ok: true, value: { statPoints: { legs: 4, core: 2 } } });
    if (!r.ok) return;
    expect(pointsFree(r.value)).toBe(4);
    expect(assignPoints(r.value, { arms: 5 }, 6, T0).ok).toBe(false);
    expect(assignPoints(state({ level: 100 }), { legs: LEVEL_POINTS.maxPerStat + 1 }, 0, T0).ok).toBe(false);
    expect(assignPoints(s, { legs: 1.5 }, 0, T0).ok).toBe(false);
    expect(assignPoints(s, {}, 0, T0).ok).toBe(false);
  });

  test("the spent total the player saw guards against a double spend", () => {
    const once = assignPoints(state({ level: 11 }), { legs: 2 }, 0, T0);
    if (!once.ok) throw new Error(once.error);
    expect(assignPoints(once.value, { legs: 2 }, 0, T0)).toMatchObject({ ok: false });
  });

  test("points make a stat stronger in fights by a percent, so they compound with training", () => {
    const s = state({ statPoints: { legs: 10 } });
    expect(pointBoost(s).legs).toBeCloseTo(1 + 10 * LEVEL_POINTS.pctPerPoint);
    expect(pointBoost(s).chest).toBe(1);
    const stats = { chest: 50, back: 50, shoulders: 50, arms: 50, legs: 100, core: 10 };
    expect(boosted(stats, s).legs).toBeCloseTo(100 * (1 + 10 * LEVEL_POINTS.pctPerPoint));
    expect(boosted({ ...stats, legs: 0 }, s).legs).toBe(0);
  });

  test("a full level-100 spread is worth only a few percent", () => {
    const per = Math.floor(99 / 6);
    const s = state({ statPoints: { chest: per, back: per, shoulders: per, arms: per, legs: per, core: per } });
    for (const v of Object.values(pointBoost(s))) expect(v).toBeLessThanOrEqual(1.1);
  });

  test("a respec takes every point back for a flat fee", () => {
    const s = state({ level: 11, coins: 1000, statPoints: { legs: 4 } });
    expect(respecPoints(s, 4, T0)).toMatchObject({ ok: true, value: { cost: LEVEL_POINTS.respecCost, state: { statPoints: {}, coins: 1000 - LEVEL_POINTS.respecCost } } });
    expect(respecPoints(state({ coins: 1000 }), 0, T0).ok).toBe(false);
    expect(respecPoints({ ...s, coins: 0 }, 4, T0)).toMatchObject({ ok: false, status: 402 });
  });
});
