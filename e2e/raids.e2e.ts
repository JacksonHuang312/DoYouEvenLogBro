import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { HERO, RIVAL, seedRival } from "./seed";

/*
 * The raid lobby and the start (GAME_DESIGN.md 13.31) through the server routes, against the
 * emulators, with two players: the hero leads and the rival joins. The screens come in stage 4.
 */

type Json = { error?: string } & Record<string, unknown>;

/** Signs the rival in through the Auth emulator and returns a caller for the game routes as them. */
async function rivalApi(request: APIRequestContext) {
  const res = await request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator", {
    data: { email: RIVAL.email, password: RIVAL.password, returnSecureToken: true },
  });
  const token = ((await res.json()) as { idToken: string }).idToken;
  return async (path: string, body: Record<string, unknown>) => {
    const r = await request.post(path, { data: body, headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status(), json: (await r.json()) as Json };
  };
}

const raidOf = (json: Json) => json.raid as { status: string; tier: number; members: string[]; invited: string[]; participants: string[]; outcome?: Record<string, unknown> };

test.describe("Raids (server)", () => {
  test("a leader makes a party, a mutual follow joins, the leader starts, and both are paid once", async ({ hero, page }) => {
    await hero.start({ level: 60, classId: "striker", statLevel: 60, coins: 100, scrap: 0 });
    await seedRival({}, { mutual: true, seed: { level: 62, classId: "vanguard", statLevel: 60, coins: 100, scrap: 0 } });
    const rival = await rivalApi(page.request);

    const made = await hero.api("/api/raid", { action: "create", tier: 1, invite: [RIVAL.uid] });
    expect(made.status).toBe(200);
    const raidId = made.json.raidId as string;
    expect(raidId).toMatch(new RegExp(`^${HERO.uid}_\\d{4}-\\d{2}-\\d{2}$`));
    expect(raidOf(made.json)).toMatchObject({ status: "open", tier: 1, members: [HERO.uid], invited: [RIVAL.uid] });
    // A second tap finds the same party.
    expect((await hero.api("/api/raid", { action: "create", tier: 1 })).json.raidId).toBe(raidId);

    // Alone, it can't start; and only the leader starts.
    expect((await hero.api("/api/raid", { action: "start", raidId })).json.error).toBe("A raid needs at least 2 players");
    const joined = await rival("/api/raid", { action: "join", raidId });
    expect(raidOf(joined.json)).toMatchObject({ members: [HERO.uid, RIVAL.uid], invited: [] });
    expect((await rival("/api/raid", { action: "start", raidId })).json.error).toBe("Only the leader can start the raid");

    const fought = await hero.api("/api/raid", { action: "start", raidId });
    expect(fought.status).toBe(200);
    const done = raidOf(fought.json);
    expect(done.status).toBe("done");
    const outcome = done.outcome as { won: boolean; tier: number; bossName: string; members: { uid: string; name: string; classId: string; coins: number; scrap: number; stats: { dealt: number } }[]; log: unknown[] };
    expect(outcome.tier).toBe(1);
    expect(outcome.bossName.length).toBeGreaterThan(0);
    expect(outcome.members.map((m) => [m.uid, m.name, m.classId])).toEqual([
      [HERO.uid, "hero", "striker"],
      [RIVAL.uid, "rival", "vanguard"],
    ]);
    expect(outcome.log.length).toBeGreaterThan(5);
    // Far over tier 1's power: they win, and each is paid the tier's coins and scrap.
    expect(outcome.won).toBe(true);
    for (const m of outcome.members) expect(m).toMatchObject({ coins: 150, scrap: 30 });
    expect(outcome.members[0].stats.dealt).toBeGreaterThan(0);

    // Starting again returns the same fight and pays nothing more.
    const again = await hero.api("/api/raid", { action: "start", raidId });
    expect((raidOf(again.json).outcome as { seed: string }).seed).toBe((done.outcome as { seed: string }).seed);
    // Coins went from 100 to 250 for each, once. A cheap way to read a balance: reset costs nothing when refused.
    const balance = async (call: typeof hero.api) => ((await call("/api/items", { action: "autoSalvage", below: null })).json.coins as number);
    expect(await balance(hero.api)).toBe(250);
    expect(await balance(rival)).toBe(250);

    // One raid a week: neither can make or join another.
    expect((await hero.api("/api/raid", { action: "create", tier: 1 })).json.error).toBe("You've already raided this week");
    expect((await rival("/api/raid", { action: "create", tier: 1 })).json.error).toBe("You've already raided this week");
  });

  test("invitations need a mutual follow, strangers see nothing, and the lobby can be left, emptied and cancelled", async ({ hero, page }) => {
    await hero.start({ level: 60, classId: "striker", statLevel: 60 });
    // The hero follows the rival, but not the other way round.
    await seedRival({}, { mutual: false, seed: { level: 62, classId: "vanguard", statLevel: 60 } });
    const rival = await rivalApi(page.request);

    const refused = await hero.api("/api/raid", { action: "create", tier: 1, invite: [RIVAL.uid] });
    expect(refused.status).toBe(409);
    expect(refused.json.error).toBe("You and @rival have to follow each other to raid together");

    const made = await hero.api("/api/raid", { action: "create", tier: 1 });
    const raidId = made.json.raidId as string;
    // Not invited: it doesn't exist as far as the rival can tell.
    expect((await rival("/api/raid", { action: "join", raidId })).status).toBe(404);
    expect((await rival("/api/raid", { action: "cancel", raidId })).status).toBe(404);
    expect((await hero.api("/api/raid", { action: "invite", raidId, uid: RIVAL.uid })).status).toBe(409);

    // Now mutual: invite, decline, invite again, join, get removed.
    await seedRival({}, { mutual: true, seed: { level: 62, classId: "vanguard", statLevel: 60 } });
    const fresh = (await hero.api("/api/raid", { action: "create", tier: 1 })).json.raidId as string;
    expect(raidOf((await hero.api("/api/raid", { action: "invite", raidId: fresh, uid: RIVAL.uid })).json).invited).toEqual([RIVAL.uid]);
    expect(raidOf((await rival("/api/raid", { action: "leave", raidId: fresh })).json).participants).toEqual([HERO.uid]);
    await hero.api("/api/raid", { action: "invite", raidId: fresh, uid: RIVAL.uid });
    expect(raidOf((await rival("/api/raid", { action: "join", raidId: fresh })).json).members).toEqual([HERO.uid, RIVAL.uid]);
    expect((await rival("/api/raid", { action: "tier", raidId: fresh, tier: 2 })).json.error).toBe("Only the leader can change the tier");
    expect(raidOf((await hero.api("/api/raid", { action: "kick", raidId: fresh, uid: RIVAL.uid })).json).members).toEqual([HERO.uid]);

    expect(raidOf((await hero.api("/api/raid", { action: "cancel", raidId: fresh })).json).status).toBe("cancelled");
    expect((await hero.api("/api/raid", { action: "start", raidId: fresh })).json.error).toBe("That raid was cancelled");
    // A tier above the leader's own is refused.
    expect((await hero.api("/api/raid", { action: "create", tier: 5 })).json.error).toMatch(/^Tier 5 needs level 90/);
    // A cancelled party can be made again the same week.
    expect(raidOf((await hero.api("/api/raid", { action: "create", tier: 1 })).json).status).toBe("open");

    // Bad requests.
    expect((await hero.api("/api/raid", { action: "create", tier: 9 })).status).toBe(400);
    expect((await hero.api("/api/raid", { action: "start", raidId: "nope" })).status).toBe(400);
    expect((await page.request.post("/api/raid", { data: { action: "create", tier: 1 } })).status()).toBe(401);
  });

  test("a party outside the level band, or with a member under the tier's power, can't start, and says who and why", async ({ hero, page }) => {
    await hero.start({ level: 30, classId: "striker", statLevel: 60 });
    await seedRival({}, { mutual: true, seed: { level: 80, classId: "vanguard", statLevel: 60 } });
    const rival = await rivalApi(page.request);
    const raidId = (await hero.api("/api/raid", { action: "create", tier: 1, invite: [RIVAL.uid] })).json.raidId as string;
    await rival("/api/raid", { action: "join", raidId });
    expect((await hero.api("/api/raid", { action: "start", raidId })).json.error).toBe("Everyone must be within 25 levels of each other");

    // A weak rival inside the band: under tier 1's 120 battle power.
    await hero.start({ level: 30, classId: "striker", statLevel: 60 });
    await seedRival({}, { mutual: true, seed: { level: 30, classId: "vanguard", statLevel: 5 } });
    const weak = await rivalApi(page.request);
    const second = (await hero.api("/api/raid", { action: "create", tier: 1, invite: [RIVAL.uid] })).json.raidId as string;
    await weak("/api/raid", { action: "join", raidId: second });
    expect((await hero.api("/api/raid", { action: "start", raidId: second })).json.error).toBe("@rival: Needs 120 battle power");
  });
});
