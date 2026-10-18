import type { Stat } from "./config";

/** Axis order of the radar chart, clockwise from the upper left (GAME_DESIGN.md 7.3). */
export const RADAR_ORDER: Stat[] = ["chest", "shoulders", "core", "legs", "arms", "back"];

/** Angle of each axis in degrees (0 = right, clockwise), centre and radius in SVG units. */
export const RADAR = {
  angles: [-120, -60, 0, 60, 120, 180],
  cx: 160,
  cy: 150,
  radius: 120,
  viewBox: "-60 -26 440 330",
};

const fmt = (n: number) => n.toFixed(1);

/**
 * The value at the outer edge: 100, or the highest value shown when a stat is past 100 (stats
 * have no cap, so the axis grows instead of clipping).
 */
export function radarScale(values: number[]): number {
  return Math.max(100, ...values.filter(Number.isFinite));
}

/** The point for axis `i` at `value`, where `scale` is at the outer edge. */
export function radarPoint(i: number, value: number, scale = 100): [number, number] {
  const a = (RADAR.angles[i] * Math.PI) / 180;
  const r = (RADAR.radius * value) / scale;
  return [RADAR.cx + Math.cos(a) * r, RADAR.cy + Math.sin(a) * r];
}

/** `points` attribute for a polygon with one value per axis, in RADAR_ORDER. Negative values sit at the centre. */
export function radarPolygon(values: number[], scale = 100): string {
  return values.map((v, i) => radarPoint(i, Math.max(0, v), scale).map(fmt).join(",")).join(" ");
}

/** A ring at `value` on an axis whose edge is `scale`. */
export const radarRing = (value: number, scale = 100) => radarPolygon(RADAR_ORDER.map(() => value), scale);

/** Spoke end and label position for axis `i` (always at the outer edge). */
export function radarAxis(i: number) {
  const [x, y] = radarPoint(i, 100);
  const [lx, ly] = radarPoint(i, 120);
  const anchor = Math.abs(lx - RADAR.cx) < 5 ? "middle" : lx > RADAR.cx ? "start" : "end";
  return { x: fmt(x), y: fmt(y), lx: fmt(lx), ly: fmt(ly + 5), anchor } as const;
}
