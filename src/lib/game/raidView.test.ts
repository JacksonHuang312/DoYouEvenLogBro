import { describe, expect, test } from "vitest";
import { fightWeek } from "./fights";
import type { PartyEvent } from "./party";
import { finishRaid, inviteToRaid, joinRaid, newRaid, type RaidMemberRecord, type RaidRecord } from "./raidLobby";
import { raidBoss } from "./raids";
import { raidCardView, raidLogLines, raidResultView, type StoredRaid } from "./raidView";
import { T0 } from "./test-helpers";

const UTC = "UTC";
const WEEK = fightWeek(T0, UTC);
const value = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const stored = (leader: string, name: string, tier = 2, weekId = WEEK, at = T0): StoredRaid => ({
  ...value(newRaid({ leader, name, weekId, tier, now: at })),
  id: `${leader}_${weekId}`,
});
const card = (over: Partial<Parameters<typeof raidCardView>[0]> = {}) =>
  raidCardView({ uid: "me", level: 60, power: 360, lastRaidWeek: null, raids: [], now: T0, timeZone: UTC, ...over });

const member = (uid: string, patch: Partial<RaidMemberRecord> = {}): RaidMemberRecord => ({
  uid,
  name: uid,
  classId: "striker",
  level: 60,
  power: 360,
  maxHp: 900,
  hpLeft: 320,
  downAt: null,
  stats: { dealt: 1234, taken: 100, absorbed: 56, healed: 7, crits: 2 },
  coins: 300,
  scrap: 90,
  lootEligible: true,
  item: null,
  salvaged: null,
  ...patch,
});
const record = (patch: Partial<RaidRecord> = {}): RaidRecord => ({
  at: T0,
  seed: "s",
  bossId: "raid-x",
  bossName: "The Hollow Colossus",
  tier: 3,
  won: true,
  end: "foe-down",
  seconds: 49,
  foeMaxHp: 5000,
  foeHpLeft: 0,
  members: [member("me"), member("ann", { classId: "vanguard" })],
  log: [],
  ...patch,
});

describe("the Raid card", () => {
  test("this week's boss, what it does, and the tiers the player may pick", () => {
    const v = card();
    const boss = raidBoss(WEEK);
    expect(v.weekId).toBe(WEEK);
    expect(v.boss).toMatchObject({ name: boss.name, epithet: boss.epithet, bestWith: boss.bestWith });
    expect(v.boss.note.length).toBeGreaterThan(0);
    // Level 60 with 360 power: tiers 1 to 3 (tier 4 needs level 70).
    expect(v.topTier).toBe(3);
    expect(v.tiers.map((t) => t.tier)).toEqual([1, 2, 3]);
    expect(v.tiers[2].label).toBe("Tier 3 · level 55 · 280+ power · 300 coins");
    expect(v).toMatchObject({ locked: null, used: false, lobby: null, invitations: [], last: null });
    expect(v.facts[0]).toBe("2 to 4 players who follow each other, within 25 levels");
  });

  test("locked below level 20 or without the power, and says which; nothing is said while power loads", () => {
    expect(card({ level: 12 })).toMatchObject({ topTier: 0, locked: "Raids open at level 20", tiers: [] });
    expect(card({ level: 30, power: 90 })).toMatchObject({ topTier: 0, locked: "Raids need 120 battle power" });
    expect(card({ power: null })).toMatchObject({ topTier: 0, locked: null, tiers: [] });
  });

  test("your open party this week shows as a lobby: who joined, who was asked, and whether you can start", () => {
    const alone = stored("me", "har");
    expect(card({ raids: [alone] }).lobby).toMatchObject({
      isLeader: true,
      tier: 2,
      tierLine: "Tier 2 · level 40 and 220 battle power each",
      rows: [{ uid: "me", name: "har", role: "Leader", you: true }],
      spots: 3,
      canStart: false,
      note: "A raid needs at least 2 players. Wait for someone to join.",
    });
    const asked = { ...value(inviteToRaid(value(inviteToRaid(alone, "me", "ann", "ann", T0)), "me", "bob", "bob", T0)), id: alone.id };
    const joined = { ...value(joinRaid(asked, "ann", T0)), id: alone.id };
    const lobby = card({ raids: [joined] }).lobby!;
    expect(lobby.rows.map((r) => [r.name, r.role])).toEqual([
      ["har", "Leader"],
      ["ann", "Joined"],
      ["bob", "Invited"],
    ]);
    expect(lobby).toMatchObject({ spots: 1, canStart: true, note: "1 player hasn't answered. Starting now leaves them out." });
    // The same party seen by the member who joined: no Start for them.
    expect(card({ uid: "ann", raids: [joined] }).lobby).toMatchObject({ isLeader: false, canStart: false, note: "The leader starts the raid. You'll find the result here afterwards." });
  });

  test("invitations are open parties that asked you; a party from another week, or a cancelled one, isn't shown", () => {
    const asked = { ...value(inviteToRaid(stored("ann", "ann", 3), "ann", "me", "har", T0)), id: "ann_w" };
    const v = card({ raids: [asked] });
    expect(v.lobby).toBeNull();
    expect(v.invitations).toEqual([{ id: "ann_w", leader: "ann", tier: 3, line: "Tier 3 · 1 joined" }]);
    const old = { ...value(inviteToRaid(stored("bob", "bob", 1, "2026-10-04"), "bob", "me", "har", T0)), id: "bob_old" };
    const cancelled = { ...asked, id: "c", status: "cancelled" as const };
    expect(card({ raids: [old, cancelled] }).invitations).toEqual([]);
    // Once you've raided this week, invitations are no use.
    expect(card({ raids: [asked], lastRaidWeek: WEEK })).toMatchObject({ used: true, invitations: [] });
    expect(card({ lastRaidWeek: WEEK }).facts[2]).toMatch(/^You've raided this week/);
  });

  test("your last fought raid can be opened again", () => {
    const fought = { ...finishRaid({ ...value(joinRaid(value(inviteToRaid(stored("me", "har"), "me", "ann", "ann", T0)), "ann", T0)) }, record(), T0 + 5), id: "me_w" };
    const older = { ...finishRaid(stored("me", "har", 1, "2026-10-04"), record({ at: T0 - 9, won: false, tier: 1 }), T0), id: "me_old" };
    expect(card({ raids: [older, fought] }).last).toEqual({ id: "me_w", line: "Victory · The Hollow Colossus · tier 3", won: true });
    expect(card({ raids: [older] }).last).toMatchObject({ id: "me_old", won: false });
    // A fought raid is no longer a lobby.
    expect(card({ raids: [fought] }).lobby).toBeNull();
  });
});

describe("the result", () => {
  test("the outcome, each member's numbers and pay, with your row marked", () => {
    const v = raidResultView(record(), "me");
    expect(v).toMatchObject({ won: true, headline: "Victory", sub: "Raid · tier 3 · 2 players", boss: "The Hollow Colossus", ended: "Defeated it in 24.5s" });
    expect(v.rows[0]).toEqual({
      uid: "me",
      name: "@me (you)",
      you: true,
      detail: "Level 60 Striker · 360 power",
      dealt: "1,234",
      absorbed: "56",
      healed: "7",
      status: "Standing · 320 / 900 HP",
      down: false,
      pay: "+300 coins · +90 scrap",
      loot: null,
    });
    expect(v.rows[1]).toMatchObject({ name: "@ann", you: false, detail: "Level 60 Vanguard · 360 power" });
  });

  test("a loss, a fallen member, an item, a salvaged drop and a member with no loot roll", () => {
    const lost = raidResultView(
      record({ won: false, end: "party-down", seconds: 36, members: [member("me", { downAt: 20, hpLeft: 0, coins: 0, scrap: 0 }), member("ann", { coins: 0, scrap: 0, lootEligible: false })] }),
      "ann",
    );
    expect(lost).toMatchObject({ headline: "Defeat", ended: "The party fell after 18.0s" });
    expect(lost.rows[0]).toMatchObject({ name: "@me", status: "Down at 10.0s", down: true, pay: "", loot: null });
    // No roll only matters on a win.
    expect(lost.rows[1].loot).toBeNull();
    expect(raidResultView(record({ won: false, end: "enrage", seconds: 60 }), "me").ended).toBe("It enraged at 30.0s");

    const won = raidResultView(
      record({
        members: [
          member("me", { item: { id: "i", baseId: "warden-boots", rarity: "epic", itemLevel: 58 } }),
          member("ann", { salvaged: { baseId: "ironbound-boots", rarity: "common", itemLevel: 50, scrap: 5 } }),
          member("alt", { lootEligible: false }),
        ],
      }),
      "me",
    );
    expect(won.rows[0].loot).toEqual({ text: "Warden Striders · Epic · Level 58", rarity: "epic" });
    expect(won.rows[1].loot).toEqual({ text: "Ironbound Boots (Common) auto-salvaged → +5 scrap", rarity: null });
    expect(won.rows[2].loot).toEqual({ text: "No loot roll: under 15% of the party's power", rarity: null });
    expect(won.sub).toBe("Raid · tier 3 · 3 players");
  });

  test("the log reads from the viewer's side: You for them, @names for the rest", () => {
    const e = (patch: Partial<PartyEvent>): PartyEvent => ({ t: 2, actor: 0, action: "attack", fh: 100, ...patch });
    const lines = raidLogLines(
      [
        e({ amount: 45, crit: true }),
        e({ actor: 1, amount: 30 }),
        e({ actor: "foe", target: 0, amount: 20 }),
        e({ actor: "foe", target: 1, action: "heavy", amount: 90 }),
        e({ actor: "foe", action: "telegraph" }),
        e({ actor: "foe", target: 0, action: "bleed", amount: 12 }),
        e({ actor: "foe", target: 1, action: "bleed", amount: 12 }),
        e({ actor: 1, action: "heal", target: 0, amount: 80, name: "Mend" }),
        e({ actor: 1, action: "heal", amount: 40, name: "Radiance" }),
        e({ action: "heal", amount: 15 }),
        e({ actor: 1, action: "skill", name: "Guard" }),
        e({ action: "skill", name: "Power Strike", amount: 120 }),
        e({ actor: 1, action: "skill", name: "Mend", target: 0 }),
        e({ actor: 1, action: "shield", amount: 200 }),
        e({ action: "reflect", amount: 9 }),
        e({ action: "last-stand" }),
        e({ action: "down" }),
        e({ actor: 1, action: "down" }),
        e({ actor: "foe", action: "enrage" }),
        e({ actor: "foe", action: "down", t: 49 }),
      ],
      ["You", "@ann"],
      0,
      "Boss",
    ).map((l) => l.text);
    expect(lines).toEqual([
      "You hit Boss for 45 (critical)",
      "@ann hits Boss for 30",
      "Boss hits you for 20",
      "Boss lands a heavy blow on @ann for 90",
      "Boss winds up a heavy blow",
      "You bleed for 12",
      "@ann bleeds for 12",
      "@ann heals you for 80 (Mend)",
      "@ann heals themself for 40 (Radiance)",
      "You heal yourself for 15",
      "@ann uses Guard",
      "You: Power Strike for 120",
      "@ann uses Mend on you",
      "@ann gains a 200 shield",
      "You reflect 9 back",
      "Last Stand: You survive on 1 HP",
      "You are down",
      "@ann is down",
      "Boss enrages",
      "Boss is down",
    ]);
    expect(raidResultView(record({ log: [e({ t: 49, actor: "foe", action: "down" })] }), "me").log).toEqual([{ t: "24.5s", text: "The Hollow Colossus is down" }]);
  });
});
