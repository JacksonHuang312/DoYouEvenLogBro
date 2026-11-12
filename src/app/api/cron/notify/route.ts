import { apiRoute, HttpError } from "@/lib/server/api";
import { emulatorSender, fcmSender, runDailyPushes, usingEmulators } from "@/lib/server/notify";

/**
 * The daily push job (GAME_DESIGN.md 13.26), called by Vercel Cron (vercel.json), which sends
 * `Authorization: Bearer <CRON_SECRET>`. Anyone else is refused. Against the local emulators no
 * secret is needed and nothing is really sent.
 */
export const GET = apiRoute(async (request) => {
  const emulators = usingEmulators();
  const secret = process.env.CRON_SECRET;
  if (!emulators) {
    if (!secret) throw new HttpError(503, "CRON_SECRET is not set");
    if (request.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Not allowed");
  }
  return runDailyPushes(Date.now(), emulators ? emulatorSender : fcmSender);
});
