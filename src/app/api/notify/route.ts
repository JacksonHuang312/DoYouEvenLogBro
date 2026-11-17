import { z } from "zod";
import { NOTIFY_TYPES } from "@/lib/game/notify";
import { apiRoute, parseBody, requireUser } from "@/lib/server/api";
import { notifyAction, sendTestPush } from "@/lib/server/notify";

/** A push token as the browser's push service hands it out. */
const token = z.string().regex(/^[A-Za-z0-9_:.-]{8,4096}$/, "Invalid device token");

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("enable"), token }),
  /** One device, or every device with null. */
  z.strictObject({ action: z.literal("disable"), token: token.nullable() }),
  z.strictObject({ action: z.literal("prefs"), prefs: z.partialRecord(z.enum(NOTIFY_TYPES), z.boolean()) }),
  /** Sends a test notification to the player's own devices. */
  z.strictObject({ action: z.literal("test") }),
]);

/** Registers or forgets this device for push notifications, or saves the per-message switches. Safe to retry. */
export const POST = apiRoute(async (request) => {
  const uid = await requireUser(request);
  const body = await parseBody(request, Body);
  return body.action === "test" ? sendTestPush(uid) : notifyAction(uid, body);
});
