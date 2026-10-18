import { z } from "zod";
import { INJURY, STATS } from "@/lib/game/config";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { injuryAction } from "@/lib/server/breaks";

const timeZone = z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional();
const stat = z.enum(STATS);

const Body = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("flag"),
    stat,
    /** Private: never shown to followers. */
    note: z.string().max(INJURY.maxNoteLength).optional(),
    /** Day id ("2026-11-20"), shown to followers. */
    expectedReturn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    timeZone,
  }),
  z.strictObject({ action: z.literal("renew"), stat, timeZone }),
  z.strictObject({ action: z.literal("clear"), stat, timeZone }),
  z.strictObject({ action: z.literal("visibility"), show: z.boolean(), timeZone }),
]);

/** Flags, renews or clears an injured stat, or shows or hides the flags from followers. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { timeZone: zone, ...input } = await parseBody(request, Body);
  return injuryAction(uid, input, zone);
});
