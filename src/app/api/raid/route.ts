import { z } from "zod";
import { RAID } from "@/lib/game/config";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { raidAction } from "@/lib/server/raids";

const uid = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid player id");
/** A raid's id: its leader's uid, an underscore, and the week (see raidId). */
const raidId = z.string().regex(/^[A-Za-z0-9_-]{1,128}_\d{4}-\d{2}-\d{2}$/, "Invalid raid id");
const tier = z.number().int().min(1).max(RAID.tierLevels.length);

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), tier, invite: z.array(uid).max(RAID.maxParty - 1).optional() }),
  z.strictObject({ action: z.literal("invite"), raidId, uid }),
  z.strictObject({ action: z.literal("join"), raidId }),
  z.strictObject({ action: z.literal("leave"), raidId }),
  z.strictObject({ action: z.literal("kick"), raidId, uid }),
  z.strictObject({ action: z.literal("tier"), raidId, tier }),
  z.strictObject({ action: z.literal("cancel"), raidId }),
  z.strictObject({ action: z.literal("start"), raidId }),
]);

/** Raid lobby actions and the start (GAME_DESIGN.md 13.31). Safe to retry. */
export const POST = apiRoute(async (request) => {
  const user = await requireUser(request);
  return raidAction(user, await parseBody(request, Body));
});
