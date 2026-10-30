import { z } from "zod";
import { LEVEL_POINTS, STATS, XP } from "@/lib/game/config";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { pointsAction } from "@/lib/server/points";

/** The spent total the client saw, so a retry or another device can't spend twice. */
const expectedSpent = z.number().int().min(0).max(XP.maxLevel * LEVEL_POINTS.perLevel);
const add = z.partialRecord(z.enum(STATS), z.number().int().min(0).max(LEVEL_POINTS.maxPerStat));

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("assign"), add, expectedSpent }),
  z.strictObject({ action: z.literal("respec"), expectedSpent }),
]);

/** Puts free stat points into stats, or resets them all for a flat fee. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  return pointsAction(uid, await parseBody(request, Body));
});
