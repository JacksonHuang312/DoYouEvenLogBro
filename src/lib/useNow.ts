"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `tickMs`. `floor` is a time that must already have passed,
 * normally the `updatedAt` of the game state on screen: a pause or flag the server just wrote is
 * stamped with the server's clock, so a `now` captured at mount (or a device clock a little
 * behind) would call it "not started yet" and keep showing the old controls.
 */
export function useNow(floor = 0, tickMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return Math.max(now, floor);
}
