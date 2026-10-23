import { z } from "zod";
import { TITLES } from "@/lib/game/config";
import { isValidTimeZone } from "@/lib/game/time";
import { TITLE_IDS } from "@/lib/game/titles";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { titleAction } from "@/lib/server/titles";

const timeZone = z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional();

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("check"), timeZone }),
  z.strictObject({ action: z.literal("equip"), titles: z.array(z.enum(TITLE_IDS)).max(TITLES.maxSlots), timeZone }),
  /** The slot count the client saw, so a retry can't buy two. */
  z.strictObject({ action: z.literal("buy-slot"), expectedSlots: z.number().int().min(1).max(TITLES.maxSlots), timeZone }),
]);

/** Checks achievements (earning their titles), equips titles, or buys a title slot. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { timeZone: zone, ...input } = await parseBody(request, Body);
  return titleAction(uid, input, zone);
});
