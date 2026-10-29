import { z } from "zod";
import { BOSS_TOWER } from "@/lib/game/config";
import { FIGHT_MODES } from "@/lib/game/fights";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { fightAction } from "@/lib/server/fights";

/** Made by the client once per tap, so a retried request returns the fight it already fought. */
const requestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const Body = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal(FIGHT_MODES[0]), requestId }),
  z.strictObject({ mode: z.literal(FIGHT_MODES[1]), requestId, climb: z.boolean().optional() }),
  z.strictObject({ mode: z.literal(FIGHT_MODES[2]), requestId, floor: z.number().int().min(1).max(BOSS_TOWER.floors).optional() }),
  z.strictObject({ mode: z.literal(FIGHT_MODES[3]), requestId }),
]);

/** Fights the weekly boss, the endless tower (optionally climbing), a Boss Tower floor or the next Campaign stage. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  return fightAction(uid, await parseBody(request, Body));
});
