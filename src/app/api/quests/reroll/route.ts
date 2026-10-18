import { z } from "zod";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { rerollQuestFor } from "@/lib/server/quests";

const Body = z.strictObject({
  weekId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  questId: z.string().regex(/^s[0-2]r\d{1,3}$/),
  /** The week's reroll count the client saw. A retry after success no longer matches, so it can't charge twice. */
  expectedRerolls: z.number().int().min(0).max(10),
  timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

/** Rerolls one of this week's quests for coins (25, then 50; two a week). */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { weekId, questId, expectedRerolls, timeZone } = await parseBody(request, Body);
  return rerollQuestFor(uid, weekId, questId, expectedRerolls, timeZone);
});
