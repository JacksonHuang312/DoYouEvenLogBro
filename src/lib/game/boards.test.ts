import { describe, expect, test } from "vitest";
import { boardAfterClaim, boardAfterFight, boardRows, BOARDS, boardValue, type BoardEntry, type BoardStats } from "./boards";
import { T0 } from "./test-helpers";

const WEEK = "2026-10-11";
const round = (dealt: number, absorbed = 0, healed = 0) => ({ dealt, absorbed, healed });

describe("what the server stores", () => {
  test("a counted workout writes power and level, and nothing about the week", () => {
    expect(boardAfterClaim(236.44, 40, T0)).toEqual({ power: 236.4, level: 40, updatedAt: T0 });
  });

  test("a fight adds every round to the week's totals; a new fight week starts from zero", () => {
    const first = boardAfterFight(null, { week: WEEK, level: 40, classId: "striker", rounds: [round(100.4, 20, 5), round(50.4, 10, 0)] }, T0);
    expect(first).toEqual({
      level: 40,
      classId: "striker",
      week: { id: WEEK, dealt: 151, absorbed: 30, healed: 5, fights: 1 },
      updatedAt: T0,
    });
    const second = boardAfterFight(first, { week: WEEK, level: 41, classId: "cleric", rounds: [round(9, 1, 40)] }, T0 + 1);
    expect(second).toMatchObject({ level: 41, classId: "cleric", week: { id: WEEK, dealt: 160, absorbed: 31, healed: 45, fights: 2 } });
    const next = boardAfterFight(second, { week: "2026-10-18", level: 41, classId: "cleric", rounds: [round(7)] }, T0 + 2);
    expect(next.week).toEqual({ id: "2026-10-18", dealt: 7, absorbed: 0, healed: 0, fights: 1 });
    // It never touches power: only a workout does.
    expect(next.power).toBeUndefined();
  });
});

describe("the board", () => {
  const entry = (uid: string, board: BoardStats | null, name = uid): BoardEntry => ({ uid, name, photoURL: null, board });
  const week = (dealt: number, absorbed = 0, healed = 0, id = WEEK) => ({ id, dealt, absorbed, healed, fights: 1 });
  const friends = [
    entry("me", { power: 200, level: 40, classId: "striker", week: week(500, 50, 0) }, "har"),
    entry("ann", { power: 320.6, level: 61, classId: "vanguard", week: week(300, 900, 10) }),
    entry("bob", { power: 200, level: 38, week: week(900, 5, 0, "2026-10-04") }),
    entry("cy", null),
    entry("dee", { level: 12, classId: "cleric", week: week(40, 0, 700) }),
  ];

  test("four boards: power, and this week's damage, absorbed and healing", () => {
    expect([...BOARDS]).toEqual(["power", "dealt", "absorbed", "healed"]);
  });

  test("power: best first, level on the number shares a rank, no number goes last by name", () => {
    const rows = boardRows(friends, "power", "me", WEEK);
    expect(rows.map((r) => [r.uid, r.rank, r.text])).toEqual([
      ["ann", 1, "321"],
      ["bob", 2, "200"],
      ["me", 2, "200"],
      ["cy", null, "–"],
      ["dee", null, "–"],
    ]);
    expect(rows.find((r) => r.uid === "me")).toMatchObject({ isYou: true, name: "har", detail: "Level 40 · Striker" });
    expect(rows.find((r) => r.uid === "bob")!.detail).toBe("Level 38");
    expect(rows.find((r) => r.uid === "cy")).toMatchObject({ detail: "", value: null, isYou: false });
  });

  test("weekly boards count only this fight week: last week's totals are gone", () => {
    expect(boardRows(friends, "dealt", "me", WEEK).map((r) => [r.uid, r.rank, r.text])).toEqual([
      ["me", 1, "500"],
      ["ann", 2, "300"],
      ["dee", 3, "40"],
      // bob's 900 was last week's.
      ["bob", null, "–"],
      ["cy", null, "–"],
    ]);
    expect(boardRows(friends, "absorbed", "me", WEEK)[0]).toMatchObject({ uid: "ann", text: "900" });
    expect(boardRows(friends, "healed", "me", WEEK).slice(0, 2).map((r) => r.uid)).toEqual(["dee", "ann"]);
    expect(boardValue(friends[2].board, "dealt", "2026-10-04")).toBe(900);
    // A zero this week is a number, and ranks.
    expect(boardRows(friends, "healed", "me", WEEK).find((r) => r.uid === "me")).toMatchObject({ rank: 3, text: "0" });
  });

  test("alone on the board, and an empty board", () => {
    expect(boardRows([friends[0]], "power", "me", WEEK)).toHaveLength(1);
    expect(boardRows([], "power", "me", WEEK)).toEqual([]);
  });
});
