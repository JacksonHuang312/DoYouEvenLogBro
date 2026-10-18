import { z } from "zod";
import { PAUSE } from "@/lib/game/config";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { pauseAction } from "@/lib/server/breaks";

const timeZone = z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional();

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start"), days: z.number().int().min(PAUSE.minDays).max(PAUSE.maxDays), timeZone }),
  z.strictObject({ action: z.literal("end"), timeZone }),
]);

/** Starts a vacation pause (7 to 28 days) or ends the running one early (after its first 7 days). */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const body = await parseBody(request, Body);
  return pauseAction(uid, body.action === "start" ? { action: "start", days: body.days } : { action: "end" }, body.timeZone);
});
