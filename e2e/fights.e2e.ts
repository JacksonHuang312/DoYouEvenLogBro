import { CLASS_SWITCH, ENDLESS_TOWER } from "../src/lib/game/config";
import { expect, test } from "./fixtures";

/*
 * The fight and class routes (Phase 5 piece 2), through the real server against the emulators.
 * There are no Battle screens yet (piece 3), so these call the routes directly.
 */

let n = 0;
const rid = () => `e2e-${Date.now()}-${++n}`;

test.describe("Fight and class routes", () => {
  test("a class is picked free once, then switched for coins once a week", async ({ hero }) => {
    await hero.start({ coins: 1000 });
    // No class yet: fights are refused.
    const early = await hero.api("/api/fight", { mode: "campaign", requestId: rid() });
    expect(early.status).toBe(409);
    expect(early.json.error).toMatch(/Pick a class/);

    const pick = await hero.api("/api/class", { action: "pick", classId: "cleric" });
    expect(pick).toMatchObject({ status: 200, json: { status: "done", classId: "cleric", coins: 1000, cost: 0 } });
    // A retried pick changes nothing; a second pick of another class is refused.
    expect((await hero.api("/api/class", { action: "pick", classId: "cleric" })).json.status).toBe("already-done");
    expect((await hero.api("/api/class", { action: "pick", classId: "striker" })).status).toBe(409);

    const sw = await hero.api("/api/class", { action: "switch", classId: "striker" });
    expect(sw.json).toMatchObject({ status: "done", classId: "striker", coins: 1000 - CLASS_SWITCH.cost, cost: CLASS_SWITCH.cost });
    expect((await hero.api("/api/class", { action: "switch", classId: "striker" })).json.status).toBe("already-done");
    expect((await hero.api("/api/class", { action: "switch", classId: "vanguard" })).status).toBe(409);
  });

  test("the weekly boss: one fight a day, and a retry returns the same fight", async ({ hero }) => {
    await hero.start({ classId: "striker" });
    const requestId = rid();
    const first = await hero.api("/api/fight", { mode: "weekly", requestId });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ status: "fought", fight: { mode: "weekly" }, battle: { weekly: { fights: 1 } } });
    const again = await hero.api("/api/fight", { mode: "weekly", requestId });
    expect(again.json.status).toBe("already-fought");
    expect((again.json.fight as { seed: string }).seed).toBe((first.json.fight as { seed: string }).seed);
    const second = await hero.api("/api/fight", { mode: "weekly", requestId: rid() });
    expect(second.status).toBe(409);
    expect(second.json.error).toMatch(/today/);
  });

  test("the endless tower climbs, the Campaign fights the next stage, the Boss Tower closes after a fight", async ({ hero }) => {
    await hero.start({ classId: "vanguard", level: 30 });
    const climb = await hero.api("/api/fight", { mode: "endless", requestId: rid(), climb: true });
    expect(climb.status).toBe(200);
    const rounds = (climb.json.fight as { rounds: { key: number }[] }).rounds;
    expect(rounds.length).toBeGreaterThanOrEqual(1);
    expect(rounds.length).toBeLessThanOrEqual(ENDLESS_TOWER.autoClimbMax);
    expect(rounds.map((r) => r.key)).toEqual(rounds.map((_, i) => i + 1));

    const stage = await hero.api("/api/fight", { mode: "campaign", requestId: rid() });
    expect((stage.json.fight as { rounds: { key: number }[] }).rounds[0].key).toBe(1);

    expect((await hero.api("/api/fight", { mode: "bossTower", requestId: rid(), floor: 2 })).status).toBe(409);
    expect((await hero.api("/api/fight", { mode: "bossTower", requestId: rid() })).status).toBe(200);
    const closed = await hero.api("/api/fight", { mode: "bossTower", requestId: rid() });
    expect(closed.status).toBe(409);
    expect(closed.json.error).toMatch(/opens again/);
  });

  test("bad requests are refused", async ({ hero }) => {
    await hero.start({ classId: "striker" });
    expect((await hero.api("/api/fight", { mode: "weekly", requestId: "x" })).status).toBe(400);
    expect((await hero.api("/api/fight", { mode: "arena", requestId: rid() })).status).toBe(400);
    expect((await hero.api("/api/fight", { mode: "weekly", requestId: rid(), floor: 3 })).status).toBe(400);
    expect((await hero.api("/api/class", { action: "pick", classId: "rogue" })).status).toBe(400);
  });
});
