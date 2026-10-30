import { z } from "zod";
import { GEAR, ITEM_LEVEL, POSITIONS, RARITIES } from "@/lib/game/config";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { itemAction } from "@/lib/server/items";

const itemId = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "Invalid item id");

const Body = z.discriminatedUnion("action", [
  /** `position` is where to wear it; left out, an item goes where it is or the first free spot of its slot. */
  z.strictObject({ action: z.literal("equip"), itemId, position: z.enum(POSITIONS).optional() }),
  z.strictObject({ action: z.literal("unequip"), position: z.enum(POSITIONS) }),
  z.strictObject({
    action: z.literal("upgrade"),
    itemId,
    /** The rarity and plus the client saw, so a retry can't upgrade twice. */
    expectedRarity: z.enum(RARITIES),
    expectedPlus: z.number().int().min(0).max(GEAR.maxPlus),
  }),
  z.strictObject({
    action: z.literal("reforge"),
    itemId,
    /** The item level the client saw, so a retry can't pay twice. */
    expectedLevel: z.number().int().min(ITEM_LEVEL.min).max(ITEM_LEVEL.max),
  }),
  /** "Best gear": several equips at once, each to its own position. */
  z.strictObject({
    action: z.literal("equipMany"),
    items: z
      .array(z.strictObject({ itemId, position: z.enum(POSITIONS) }))
      .min(1)
      .max(POSITIONS.length),
  }),
  z.strictObject({ action: z.literal("sell"), itemId }),
  z.strictObject({ action: z.literal("salvage"), itemId }),
]);

/** Equips (at a position, or several at once), unequips, upgrades, reforges, sells or salvages an item. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  return itemAction(uid, await parseBody(request, Body));
});
