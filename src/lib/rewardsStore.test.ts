import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClaimResult } from "./game/claim";
import type { RewardsSummary } from "./game/rewards";
import {
  clearRewardsPending,
  dismissReward,
  markRewardsPending,
  pendingIds,
  storeClaimResult,
} from "./rewardsStore";
import type { ClaimResponse } from "./server/game";

const memory = new Map<string, string>();
const events: string[] = [];

beforeEach(() => {
  memory.clear();
  events.length = 0;
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: (e: Event) => events.push(e.type) });
});

const summary: RewardsSummary = { name: "Push", startedAt: 1, durationMs: 60_000, workingSets: 5, volumeKg: 100 };
const claimed = (status: "claimed" | "already-claimed"): ClaimResponse => ({
  status,
  result: { workoutId: "w1" } as ClaimResult,
});
const notCounted: ClaimResponse = { status: "not-counted", reason: "too-few-sets", workingSets: 3, required: 4 };

const results = () => JSON.parse(memory.get("dyelb:rewards:u1") ?? "[]") as { workoutId: string; summary: unknown }[];

describe("pending markers", () => {
  test("are written synchronously and announced", () => {
    markRewardsPending("u1", "w1", summary);
    expect(pendingIds("u1")).toEqual(["w1"]);
    expect(events).toHaveLength(1);
  });

  test("can be cleared, and clearing something absent is a no-op", () => {
    markRewardsPending("u1", "w1", summary);
    clearRewardsPending("u1", "w1");
    expect(pendingIds("u1")).toEqual([]);
    const before = events.length;
    clearRewardsPending("u1", "w1");
    expect(events).toHaveLength(before);
  });

  test("never throw when storage is broken", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => markRewardsPending("u1", "w1", summary)).not.toThrow();
  });
});

describe("claim answers", () => {
  test("an expected answer is stored with its summary and clears the marker", () => {
    markRewardsPending("u1", "w1", summary);
    storeClaimResult("u1", "w1", claimed("claimed"));
    expect(pendingIds("u1")).toEqual([]);
    expect(results()).toMatchObject([{ workoutId: "w1", summary }]);
  });

  test("a not-counted answer is shown when the user was waiting for it", () => {
    markRewardsPending("u1", "w1", summary);
    storeClaimResult("u1", "w1", notCounted);
    expect(results()).toHaveLength(1);
  });

  test("an old queued claim that paid something is shown without a summary", () => {
    storeClaimResult("u1", "w1", claimed("claimed"));
    expect(results()).toMatchObject([{ workoutId: "w1", summary: null }]);
  });

  test("a repeat claim nobody is waiting for is not shown again", () => {
    storeClaimResult("u1", "w1", claimed("already-claimed"));
    storeClaimResult("u1", "w2", notCounted);
    expect(results()).toEqual([]);
  });

  test("a lost response that is retried still shows, because the marker is still there", () => {
    markRewardsPending("u1", "w1", summary);
    storeClaimResult("u1", "w1", claimed("already-claimed"));
    expect(results()).toHaveLength(1);
  });

  test("keeps the five newest and one per workout", () => {
    for (let i = 0; i < 7; i++) storeClaimResult("u1", `w${i}`, claimed("claimed"));
    storeClaimResult("u1", "w6", claimed("claimed"));
    expect(results().map((r) => r.workoutId)).toEqual(["w2", "w3", "w4", "w5", "w6"]);
  });

  test("dismissing removes only that answer", () => {
    storeClaimResult("u1", "w1", claimed("claimed"));
    storeClaimResult("u1", "w2", claimed("claimed"));
    dismissReward("u1", "w1");
    expect(results().map((r) => r.workoutId)).toEqual(["w2"]);
  });

  test("users do not see each other's", () => {
    storeClaimResult("u1", "w1", claimed("claimed"));
    expect(memory.get("dyelb:rewards:u2")).toBeUndefined();
  });
});
