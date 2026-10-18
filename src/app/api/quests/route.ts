import { z } from "zod";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { ensureQuests } from "@/lib/server/quests";

const Body = z.strictObject({
  timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

/** Makes sure this week's quests exist, generating them the first time the week is opened. Safe to repeat. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { timeZone } = await parseBody(request, Body);
  return { quests: await ensureQuests(uid, timeZone) };
});
