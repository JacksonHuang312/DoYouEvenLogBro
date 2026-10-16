import { z } from "zod";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { recomputeMuscles } from "@/lib/server/game";

const Body = z.strictObject({});

/**
 * Rebuilds the signed-in user's muscle facts and snapshots from their workouts, after an edit
 * or delete. Coins, XP and claim records are untouched.
 */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  await parseBody(request, Body);
  return recomputeMuscles(uid);
});
