import { describe, expect, test } from "vitest";
import {
  cancelRaid,
  canStartRaid,
  finishRaid,
  inviteToRaid,
  joinRaid,
  leaveRaid,
  newRaid,
  raidId,
  setRaidTier,
  type RaidDoc,
  type RaidRecord,
} from "./raidLobby";
import { T0 } from "./test-helpers";

const WEEK = "2026-10-11";
const value = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const raid = (): RaidDoc => value(newRaid({ leader: "lead", name: "har", weekId: WEEK, tier: 2, now: T0 }));
const withAnn = () => value(inviteToRaid(raid(), "lead", "ann", "ann", T0 + 1));

describe("making a party", () => {
  test("a new raid is its leader alone, open, for one week and tier", () => {
    expect(raid()).toEqual({
      leader: "lead",
      weekId: WEEK,
      tier: 2,
      members: ["lead"],
      invited: [],
      participants: ["lead"],
      names: { lead: "har" },
      status: "open",
      createdAt: T0,
      updatedAt: T0,
    });
    expect(raidId("lead", WEEK)).toBe("lead_2026-10-11");
    for (const tier of [0, 6, 1.5]) expect(newRaid({ leader: "lead", name: "har", weekId: WEEK, tier, now: T0 })).toMatchObject({ ok: false });
  });

  test("the leader invites; asking twice changes nothing; the party never passes four", () => {
    const one = withAnn();
    expect(one).toMatchObject({ members: ["lead"], invited: ["ann"], participants: ["lead", "ann"], names: { lead: "har", ann: "ann" }, updatedAt: T0 + 1 });
    expect(value(inviteToRaid(one, "lead", "ann", "ann", T0 + 2))).toBe(one);
    expect(inviteToRaid(one, "ann", "bob", "bob", T0)).toMatchObject({ ok: false, error: "Only the leader can invite" });
    expect(inviteToRaid(one, "lead", "lead", "har", T0)).toMatchObject({ ok: false });
    const full = value(inviteToRaid(value(inviteToRaid(one, "lead", "bob", "bob", T0)), "lead", "cy", "cy", T0));
    expect(full.participants).toHaveLength(4);
    expect(inviteToRaid(full, "lead", "dee", "dee", T0)).toMatchObject({ ok: false, error: "A raid takes at most 4 players" });
  });

  test("the leader can change the tier", () => {
    expect(value(setRaidTier(raid(), "lead", 4, T0 + 5))).toMatchObject({ tier: 4, updatedAt: T0 + 5 });
    expect(setRaidTier(withAnn(), "ann", 4, T0)).toMatchObject({ ok: false });
    expect(setRaidTier(raid(), "lead", 9, T0)).toMatchObject({ ok: false });
    const same = raid();
    expect(value(setRaidTier(same, "lead", 2, T0 + 5))).toBe(same);
  });
});

describe("joining and leaving", () => {
  test("only someone who was asked can join, and they fight in the order they joined", () => {
    const both = value(inviteToRaid(withAnn(), "lead", "bob", "bob", T0));
    const bobIn = value(joinRaid(both, "bob", T0 + 3));
    expect(bobIn).toMatchObject({ members: ["lead", "bob"], invited: ["ann"], participants: ["lead", "bob", "ann"] });
    const annIn = value(joinRaid(bobIn, "ann", T0 + 4));
    expect(annIn.members).toEqual(["lead", "bob", "ann"]);
    expect(annIn.invited).toEqual([]);
    expect(value(joinRaid(annIn, "ann", T0 + 9))).toBe(annIn);
    expect(joinRaid(both, "stranger", T0)).toMatchObject({ ok: false, status: 404 });
  });

  test("declining, leaving and being removed all take you out; the leader can't leave", () => {
    const joined = value(joinRaid(withAnn(), "ann", T0));
    expect(value(leaveRaid(withAnn(), "ann", "ann", T0))).toMatchObject({ invited: [], participants: ["lead"], names: { lead: "har" } });
    expect(value(leaveRaid(joined, "ann", "ann", T0))).toMatchObject({ members: ["lead"], participants: ["lead"] });
    expect(value(leaveRaid(joined, "lead", "ann", T0))).toMatchObject({ members: ["lead"] });
    expect(leaveRaid(joined, "lead", "lead", T0)).toMatchObject({ ok: false, error: "The leader can't leave. Cancel the raid instead" });
    const three = value(joinRaid(value(inviteToRaid(joined, "lead", "bob", "bob", T0)), "bob", T0));
    expect(leaveRaid(three, "bob", "ann", T0)).toMatchObject({ ok: false, error: "Only the leader can remove someone" });
    // Someone who isn't there: nothing to do.
    expect(value(leaveRaid(joined, "lead", "ghost", T0))).toBe(joined);
  });
});

describe("cancelling, starting and finishing", () => {
  test("only the leader cancels, and a cancelled raid takes no more changes", () => {
    const gone = value(cancelRaid(withAnn(), "lead", T0 + 7));
    expect(gone).toMatchObject({ status: "cancelled", updatedAt: T0 + 7 });
    expect(value(cancelRaid(gone, "lead", T0 + 8))).toBe(gone);
    expect(cancelRaid(withAnn(), "ann", T0)).toMatchObject({ ok: false, error: "Only the leader can cancel" });
    for (const r of [joinRaid(gone, "ann", T0), inviteToRaid(gone, "lead", "bob", "bob", T0), leaveRaid(gone, "ann", "ann", T0), setRaidTier(gone, "lead", 3, T0), canStartRaid(gone, "lead", WEEK)]) {
      expect(r).toMatchObject({ ok: false, error: "That raid was cancelled" });
    }
  });

  test("only the leader starts, and only in the week it was made for", () => {
    const joined = value(joinRaid(withAnn(), "ann", T0));
    expect(canStartRaid(joined, "lead", WEEK).ok).toBe(true);
    expect(canStartRaid(joined, "ann", WEEK)).toMatchObject({ ok: false, error: "Only the leader can start the raid" });
    expect(canStartRaid(joined, "lead", "2026-10-18")).toMatchObject({ ok: false, error: "The week has turned. Cancel this raid and make a new one" });
  });

  test("a fought raid keeps its outcome, drops anyone who never answered, and is closed for good", () => {
    const party = value(inviteToRaid(value(joinRaid(withAnn(), "ann", T0)), "lead", "late", "late", T0));
    const outcome = { won: true, members: [] } as unknown as RaidRecord;
    const done = finishRaid(party, outcome, T0 + 50);
    expect(done).toMatchObject({ status: "done", members: ["lead", "ann"], invited: [], participants: ["lead", "ann"], names: { lead: "har", ann: "ann" }, updatedAt: T0 + 50 });
    expect(done.names.late).toBeUndefined();
    expect(done.outcome).toBe(outcome);
    for (const r of [joinRaid(done, "late", T0), cancelRaid(done, "lead", T0), canStartRaid(done, "lead", WEEK), leaveRaid(done, "ann", "ann", T0)]) {
      expect(r).toMatchObject({ ok: false, error: "That raid has already been fought" });
    }
  });
});
