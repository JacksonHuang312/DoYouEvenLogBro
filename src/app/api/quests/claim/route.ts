import { z } from "zod";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { claimQuestFor } from "@/lib/server/quests";

const Body = z.strictObject({
  weekId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  questId: z.string().regex(/^s[0-2]r\d{1,3}$/),
});

/** Pays a finished quest. Safe to retry: a second call pays nothing. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { weekId, questId } = await parseBody(request, Body);
  return claimQuestFor(uid, weekId, questId);
});
