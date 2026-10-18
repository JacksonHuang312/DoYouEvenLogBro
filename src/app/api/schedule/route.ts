import { z } from "zod";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { saveSchedule } from "@/lib/server/schedule";

const Body = z.strictObject({
  /** Weekday ("0" Sunday to "6" Saturday) -> routine id. Days left out are rest days. */
  days: z.partialRecord(
    z.enum(["0", "1", "2", "3", "4", "5", "6"]),
    z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid routine id"),
  ),
  timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

/** Saves the weekly schedule. It starts tomorrow, so today's workout can't be scheduled after the fact. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { days, timeZone } = await parseBody(request, Body);
  return saveSchedule(uid, days, timeZone);
});
