/**
 * Color themes, picked in Settings and saved per device. Every theme stays dark (the app's
 * overlays, status bar and white text assume it); each tints the background, cards and
 * secondary text and brings its own accent. Accents are all light, so on-accent is dark text.
 */
export interface ThemeColors {
  canvas: string;
  surface: string;
  surface2: string;
  line: string;
  muted: string;
  accent: string;
  onAccent: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const DEFAULT_THEME = "default";
export const THEME_STORAGE_KEY = "theme";

export const THEMES: Theme[] = [
  {
    id: DEFAULT_THEME,
    name: "Default",
    // Must match the @theme block in globals.css, which is what renders before any theme applies.
    colors: { canvas: "#000000", surface: "#1c1c1e", surface2: "#2c2c2e", line: "#38383a", muted: "#8e8e93", accent: "#30d5a0", onAccent: "#00261a" },
  },
  {
    id: "wisteria",
    name: "Wisteria bloom",
    colors: { canvas: "#0d0614", surface: "#1a0f26", surface2: "#2a1a3d", line: "#3a2752", muted: "#a99bb8", accent: "#ed80e9", onAccent: "#2a0629" },
  },
  {
    id: "iris",
    name: "Iris garden",
    colors: { canvas: "#0e0811", surface: "#1d1222", surface2: "#2c1c33", line: "#3d2846", muted: "#a47dab", accent: "#82ab7d", onAccent: "#0f1f0d" },
  },
  {
    id: "peach",
    name: "Fresh peach",
    colors: { canvas: "#120c09", surface: "#221813", surface2: "#33251d", line: "#44322a", muted: "#b39a8a", accent: "#ffb5ab", onAccent: "#3a1510" },
  },
  {
    id: "cherry",
    name: "Cherry blossom",
    colors: { canvas: "#0f0a0b", surface: "#1f1517", surface2: "#2e2023", line: "#3e2c30", muted: "#a8949a", accent: "#ffb7c5", onAccent: "#3d0f19" },
  },
  {
    id: "ink",
    name: "Ink wash",
    colors: { canvas: "#121212", surface: "#222222", surface2: "#333333", line: "#4a4a4a", muted: "#8d9cad", accent: "#ffffe3", onAccent: "#2b2b20" },
  },
  {
    id: "eclipse",
    name: "Blue eclipse",
    colors: { canvas: "#0f0e47", surface: "#1d1c55", surface2: "#2c2b66", line: "#3d3c75", muted: "#8686ac", accent: "#b4b4f0", onAccent: "#0f0e47" },
  },
  {
    id: "tuscan",
    name: "Tuscan sunset",
    colors: { canvas: "#120806", surface: "#221310", surface2: "#33201b", line: "#4a2c24", muted: "#9988a1", accent: "#e35336", onAccent: "#1f0802" },
  },
  {
    id: "lemon",
    name: "Zesty lemon",
    colors: { canvas: "#0e0e06", surface: "#1c1c10", surface2: "#2b2b1a", line: "#3b3b25", muted: "#a6a580", accent: "#ffff66", onAccent: "#2b2b00" },
  },
  {
    id: "california",
    name: "California beaches",
    colors: { canvas: "#071016", surface: "#12202a", surface2: "#1d2f3b", line: "#2a3f4d", muted: "#7d99aa", accent: "#66c4ff", onAccent: "#00233a" },
  },
  {
    id: "mango",
    name: "Mango popsicle",
    colors: { canvas: "#110b05", surface: "#21170c", surface2: "#312314", line: "#43301c", muted: "#a8906c", accent: "#f2b949", onAccent: "#2e1e00" },
  },
  {
    id: "kiwi",
    name: "Electric kiwi",
    colors: { canvas: "#000000", surface: "#141612", surface2: "#22251c", line: "#30342a", muted: "#8f9682", accent: "#ccff00", onAccent: "#1a2000" },
  },
  {
    id: "salt-pepper",
    name: "Salt and pepper",
    colors: { canvas: "#000000", surface: "#1f1f1f", surface2: "#2b2b2b", line: "#3d3d3d", muted: "#9a9a9a", accent: "#ffffff", onAccent: "#000000" },
  },
  {
    id: "night-sands",
    name: "Night sands",
    colors: { canvas: "#0f0d07", surface: "#1e1a10", surface2: "#2e2818", line: "#403822", muted: "#a39a7c", accent: "#fae8b4", onAccent: "#2c2410" },
  },
];

const byId = new Map(THEMES.map((t) => [t.id, t]));

export const themeOf = (id: string | null | undefined) => byId.get(id ?? "") ?? byId.get(DEFAULT_THEME)!;

/**
 * One rule per theme, keyed on <html data-theme>. Unlayered, so it beats Tailwind's
 * @theme variables (which live in a cascade layer) without any specificity games.
 */
export function themeCss() {
  return THEMES.filter((t) => t.id !== DEFAULT_THEME)
    .map(({ id, colors: c }) =>
      `[data-theme="${id}"]{--color-canvas:${c.canvas};--color-surface:${c.surface};--color-surface-2:${c.surface2};` +
      `--color-line:${c.line};--color-muted:${c.muted};--color-accent:${c.accent};--color-on-accent:${c.onAccent}}`,
    )
    .join("\n");
}

/** Points <html> and the browser chrome (theme-color) at the theme. */
export function applyTheme(id: string) {
  const theme = themeOf(id);
  document.documentElement.setAttribute("data-theme", theme.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.canvas);
}

export function storedTheme(): string {
  try {
    return themeOf(localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(id: string) {
  applyTheme(id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage blocked (private mode): the theme still applies for this visit.
  }
}

/**
 * Runs in <head> while the HTML is parsed, so a saved theme is on before the first paint.
 * Same logic as storedTheme() + applyTheme(), inlined since nothing is loaded yet.
 */
export function themeScript() {
  const canvases = Object.fromEntries(THEMES.map((t) => [t.id, t.colors.canvas]));
  return `(function(){try{var c=${JSON.stringify(canvases)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!t||!c[t])return;document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c[t])}catch(e){}})()`;
}
