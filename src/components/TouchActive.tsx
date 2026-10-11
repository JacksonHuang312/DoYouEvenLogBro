"use client";

import { useEffect } from "react";

/**
 * iOS Safari only applies :active (our press effect) when the page has a touch listener.
 * React usually registers one already; this makes it explicit. Renders nothing.
 */
export function TouchActive() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
