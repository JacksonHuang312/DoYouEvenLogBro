import { z } from "zod";
import { SHOP } from "@/lib/game/config";
import { isValidTimeZone } from "@/lib/game/time";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { shopAction } from "@/lib/server/items";

const timeZone = z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional();
const weekId = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** The stock's reroll count the client saw. A retry after success no longer matches, so it can't charge twice. */
const expectedRerolls = z.number().int().min(0).max(SHOP.rerollCosts.length);

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("buy"), weekId, index: z.number().int().min(0).max(SHOP.offers - 1), expectedRerolls, timeZone }),
  z.strictObject({ action: z.literal("reroll"), weekId, expectedRerolls, timeZone }),
]);

/** Buys an offer from this week's shop, or rerolls the stock for coins. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const { timeZone: zone, ...input } = await parseBody(request, Body);
  return shopAction(uid, input, zone);
});
