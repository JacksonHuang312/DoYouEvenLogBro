import { z } from "zod";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { claimWorkout } from "@/lib/server/game";

const Body = z.strictObject({
  workoutId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid workout id"),
  /** IANA time zone for the daily coin cap and week boundaries, e.g. "America/New_York". */
  timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

/** Claims a saved workout's coins, XP and stats. Safe to retry: a second claim pays nothing. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { workoutId, timeZone } = await parseBody(request, Body);
  return claimWorkout(uid, workoutId, timeZone);
});
