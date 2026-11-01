import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCREENS = path.join(__dirname, ".output", "screens");

/** A 390px screenshot saved to e2e/.output/screens/<name>.png. */
export async function shot(page: Page, name: string, { full = true }: { full?: boolean } = {}) {
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: full });
}

/**
 * Soft-fails (and annotates) if anything sticks out past the right edge of the 390px screen.
 * Elements inside a horizontally scrolling container are ignored, since that scroll is deliberate.
 */
export async function expectNoOverflow(page: Page, label: string, info: TestInfo) {
  const problems = await page.evaluate(() => {
    const width = window.innerWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > width) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px wide`);
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      if (r.right <= width + 1 && r.left >= -1) continue;
      let scrolls = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth) scrolls = true;
      }
      if (scrolls) continue;
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40);
      out.push(`<${el.tagName.toLowerCase()}> "${text}" spans ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (out.length >= 8) break;
    }
    return out;
  });
  if (problems.length > 0) info.annotations.push({ type: "overflow", description: `${label}: ${problems.join("; ")}` });
  expect.soft(problems, `${label} overflows the 390px screen`).toEqual([]);
}

/** Soft-fails (and annotates) for visible buttons shorter than the 44px tap target (section 7.1). */
export async function expectTapTargets(scope: Locator, label: string, info: TestInfo) {
  const small = await scope.evaluate((root) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("button, [role=tab], a")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.hasAttribute("disabled")) continue;
      if (r.height < 43.5) out.push(`"${(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)}" is ${Math.round(r.height)}px tall`);
    }
    return out;
  });
  if (small.length > 0) info.annotations.push({ type: "tap-target", description: `${label}: ${small.join("; ")}` });
  expect.soft(small, `${label} has tap targets under 44px`).toEqual([]);
}

/**
 * Soft-fails (and annotates) unless `scope` shows at least `min` item tiles (13.19), each inside the
 * screen with its icon inside the tile, and every non-empty tile drawn with gear art (not the plain
 * slot-icon fallback).
 */
export async function expectItemTiles(scope: Locator, label: string, info: TestInfo, min = 1) {
  const problems = await scope.evaluate((root, min) => {
    const width = window.innerWidth;
    const out: string[] = [];
    const tiles = [...root.querySelectorAll<HTMLElement>("[data-item-tile]")].filter((t) => t.getBoundingClientRect().width > 0);
    if (tiles.length < min) out.push(`${tiles.length} tiles, expected at least ${min}`);
    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      const svg = tile.querySelector("svg");
      const name = tile.getAttribute("data-item-tile");
      if (r.left < -1 || r.right > width + 1) out.push(`a ${name} tile spans ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (!svg) { out.push(`a ${name} tile has no icon`); continue; }
      const s = svg.getBoundingClientRect();
      if (s.left < r.left - 1 || s.right > r.right + 1 || s.top < r.top - 1 || s.bottom > r.bottom + 1) out.push(`a ${name} tile's icon sticks out`);
      if (name !== "empty" && !svg.hasAttribute("data-gear-icon")) out.push(`a ${name} tile shows the plain slot icon`);
      if (out.length >= 8) break;
    }
    return out;
  }, min);
  if (problems.length > 0) info.annotations.push({ type: "item-tile", description: `${label}: ${problems.join("; ")}` });
  expect.soft(problems, `${label} item tiles`).toEqual([]);
}

/** The number in text like "5,112 coins" or "Level 30 · 5,112 coins · 335 scrap". */
export function numberBefore(text: string, word: string): number {
  const m = text.match(new RegExp(`([\\d,]+)\\s*${word}`));
  if (!m) throw new Error(`No "<number> ${word}" in: ${text}`);
  return Number(m[1].replaceAll(",", ""));
}
