import { describe, expect, test } from "vitest";
import { newGameState, type GameState } from "./claim";
import { XP } from "./config";
import { xpToReach } from "./economy";
import { fightDay, fightWeek, newBattleDoc, type BattleDoc } from "./fights";
import {
  DEFAULT_PREFS,
  duePushes,
  emptyNotify,
  markSent,
  NOTIFY,
  prefsOf,
  tokenKey,
  withoutToken,
  withPrefs,
  withToken,
  type NotifyDoc,
} from "./notify";
import { DAY, T0 } from "./test-helpers";

const UTC = "UTC";
const HOUR = 60 * 60 * 1000;

const on = (patch: Partial<NotifyDoc> = {}): NotifyDoc => ({ ...withToken(emptyNotify(T0), "token-a", T0), ...patch });
const state = (patch: Partial<GameState> = {}): GameState => ({
  ...newGameState(T0, UTC),
  classId: "striker",
  level: 10,
  xp: xpToReach(10),
  updatedAt: T0,
  ...patch,
});
const battle = (weekly: BattleDoc["weekly"]): BattleDoc => ({ ...newBattleDoc(T0), weekly });
const types = (doc: NotifyDoc, s: GameState | null, b: BattleDoc | null, now = T0) => duePushes({ doc, state: s, battle: b, now }).map((p) => p.type);

describe("devices and settings", () => {
  test("off until a device registers; the same token twice is one device", () => {
    expect(emptyNotify(T0)).toMatchObject({ enabled: false, tokens: {}, prefs: DEFAULT_PREFS });
    const one = withToken(emptyNotify(T0), "token-a", T0 + 1);
    expect(one.enabled).toBe(true);
    expect(Object.values(one.tokens)).toEqual([{ token: "token-a", at: T0 + 1 }]);
    const again = withToken(one, "token-a", T0 + 5);
    expect(Object.values(again.tokens)).toEqual([{ token: "token-a", at: T0 + 5 }]);
    expect(tokenKey("token-a")).toBe(tokenKey("token-a"));
    expect(tokenKey("token-a")).not.toBe(tokenKey("token-b"));
    expect(tokenKey("a/b.c:d")).toMatch(/^d[0-9a-z]+$/);
  });

  test("at most 5 devices: the one registered longest ago is dropped", () => {
    let doc = emptyNotify(T0);
    for (let i = 0; i <= NOTIFY.maxDevices; i++) doc = withToken(doc, `t${i}`, T0 + i);
    const kept = Object.values(doc.tokens).map((t) => t.token).sort();
    expect(kept).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  test("removing the last device turns notifications off; null removes them all", () => {
    const two = withToken(on(), "token-b", T0);
    expect(withoutToken(two, "token-a", T0)).toMatchObject({ enabled: true });
    expect(withoutToken(withoutToken(two, "token-a", T0), "token-b", T0)).toMatchObject({ enabled: false, tokens: {} });
    expect(withoutToken(two, null, T0)).toMatchObject({ enabled: false, tokens: {} });
    expect(withoutToken(two, "unknown", T0).enabled).toBe(true);
    // What was sent is kept while a device remains, and forgotten once they are all gone.
    const told = { ...two, sent: { weeklyFight: "w:0" } };
    expect(withoutToken(told, "token-a", T0).sent).toEqual({ weeklyFight: "w:0" });
    expect(withoutToken(told, null, T0).sent).toEqual({});
  });

  test("each message has its own switch, on by default", () => {
    expect(prefsOf(null)).toEqual({ weeklyFight: true, levelUp: true });
    expect(withPrefs(on(), { levelUp: false }, T0 + 1)).toMatchObject({ prefs: { weeklyFight: true, levelUp: false }, updatedAt: T0 + 1 });
    // A doc written before a message type existed still has it on.
    expect(prefsOf({ prefs: { weeklyFight: false } as never })).toEqual({ weeklyFight: false, levelUp: true });
  });
});

describe("what is due", () => {
  const week = fightWeek(T0, UTC);
  const today = fightDay(T0, UTC);

  test("nothing for a player who hasn't turned it on, has no game, or has gone quiet for 14 days", () => {
    expect(types(emptyNotify(T0), state(), null)).toEqual([]);
    expect(types(on(), null, null)).toEqual([]);
    expect(types(on(), state({ updatedAt: T0 - 15 * DAY }), null)).toEqual([]);
    expect(types(on(), state({ updatedAt: T0 - 13 * DAY }), null)).toEqual(["weeklyFight"]);
  });

  test("the weekly fight: due while today's fight is unused, and only with a class", () => {
    expect(types(on(), state(), null)).toEqual(["weeklyFight"]);
    expect(types(on(), state({ classId: undefined }), null)).toEqual([]);
    const fought = battle({ weekId: week, tier: 1, wins: 1, fights: 1, lastFightDay: today });
    expect(types(on(), state(), fought)).toEqual([]);
    // The next fight day it is ready again.
    expect(types(on(), state({ updatedAt: T0 + DAY }), fought, T0 + DAY)).toEqual(["weeklyFight"]);
    // The fight day turns at 04:00, not midnight.
    const lateNight = Date.UTC(2026, 9, 15, 2);
    expect(types(on(), state(), fought, lateNight)).toEqual([]);
  });

  test("the weekly fight is sent once per fight: ignored, it stays quiet until the next fight or a new week", () => {
    const first = duePushes({ doc: on(), state: state(), battle: null, now: T0 });
    expect(first).toEqual([{ type: "weeklyFight", key: `${week}:0`, title: "Your weekly fight is ready", url: "/battle" }]);
    const told = markSent(on(), first, T0);
    expect(types(told, state({ updatedAt: T0 + 2 * DAY }), null, T0 + 2 * DAY)).toEqual([]);
    // They fought yesterday: a new occasion.
    const yesterday = battle({ weekId: week, tier: 1, wins: 0, fights: 1, lastFightDay: fightDay(T0 - DAY, UTC) });
    expect(duePushes({ doc: told, state: state(), battle: yesterday, now: T0 })[0]).toMatchObject({ key: `${week}:1` });
    // A new week: last week's progress no longer counts.
    const next = T0 + 7 * DAY;
    expect(duePushes({ doc: told, state: state({ updatedAt: next }), battle: yesterday, now: next })[0]).toMatchObject({
      key: `${fightWeek(next, UTC)}:0`,
    });
  });

  test("levelling up: due when one workout's XP reaches the next level and a workout would pay XP", () => {
    const fought = battle({ weekId: week, tier: 1, wins: 1, fights: 1, lastFightDay: today });
    const near = (left: number, patch: Partial<GameState> = {}) => state({ xp: xpToReach(11) - left, ...patch });
    expect(types(on(), near(XP.perWorkout), fought)).toEqual(["levelUp"]);
    expect(types(on(), near(1), fought)).toEqual(["levelUp"]);
    expect(types(on(), near(XP.perWorkout + 1), fought)).toEqual([]);
    // Workout XP was paid 2 hours ago: the next workout wouldn't pay any, so no nudge yet.
    expect(types(on(), near(5, { workoutXpAt: T0 - 2 * HOUR }), fought)).toEqual([]);
    expect(types(on(), near(5, { workoutXpAt: T0 - 12 * HOUR }), fought)).toEqual(["levelUp"]);
    // Not at the top level.
    expect(types(on(), state({ level: XP.maxLevel, xp: xpToReach(XP.maxLevel) + 5 }), fought)).toEqual([]);
    const push = duePushes({ doc: on(), state: near(5), battle: fought, now: T0 })[0];
    expect(push).toEqual({ type: "levelUp", key: "level:10", title: "1 workout from levelling up", url: "/train" });
    // Once per level.
    expect(types(markSent(on(), [push], T0), near(5), fought)).toEqual([]);
    expect(types(markSent(on(), [push], T0), state({ level: 11, xp: xpToReach(12) - 5 }), fought)).toEqual(["levelUp"]);
  });

  test("a switched-off message is never due; both can be due together", () => {
    const near = state({ xp: xpToReach(11) - 5 });
    expect(types(on(), near, null)).toEqual(["weeklyFight", "levelUp"]);
    expect(types(withPrefs(on(), { weeklyFight: false }, T0), near, null)).toEqual(["levelUp"]);
    expect(types(withPrefs(on(), { weeklyFight: false, levelUp: false }, T0), near, null)).toEqual([]);
  });

  test("markSent with nothing sent changes nothing", () => {
    const doc = on();
    expect(markSent(doc, [], T0 + 9)).toBe(doc);
  });
});
