import { z } from "zod";
import { CLASS_IDS } from "@/lib/game/config";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { classAction } from "@/lib/server/fights";

const timeZone = z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional();

const Body = z.strictObject({ action: z.enum(["pick", "switch"]), classId: z.enum(CLASS_IDS), timeZone });

/** Picks the hero's class (free, once) or switches it (300 coins, once per 7 days since the last switch). Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { timeZone: zone, ...input } = await parseBody(request, Body);
  return classAction(uid, input, zone);
});
