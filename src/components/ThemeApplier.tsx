"use client";

import { useLayoutEffect } from "react";
import { applyTheme, storedTheme } from "@/lib/themes";

/**
 * The inline script in the layout applies the saved theme before first paint; this re-applies
 * it after hydration, since in development React's Strict Mode remount clears attributes on
 * <html>. Also catches the theme-color meta if it came after the script. Renders nothing.
 */
export function ThemeApplier() {
  useLayoutEffect(() => applyTheme(storedTheme()), []);
  return null;
}
