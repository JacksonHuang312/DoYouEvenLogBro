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

/** The point for axis `i` at `value` (0–100 of the radius). */
export function radarPoint(i: number, value: number): [number, number] {
  const a = (RADAR.angles[i] * Math.PI) / 180;
  const r = (RADAR.radius * value) / 100;
  return [RADAR.cx + Math.cos(a) * r, RADAR.cy + Math.sin(a) * r];
}

/** `points` attribute for a polygon with one value (0–100) per axis, in RADAR_ORDER. */
export function radarPolygon(values: number[]): string {
  return values.map((v, i) => radarPoint(i, Math.min(100, Math.max(0, v))).map(fmt).join(",")).join(" ");
}

/** A ring at `percent` of the radius. */
export const radarRing = (percent: number) => radarPolygon(RADAR_ORDER.map(() => percent));

/** Spoke end and label position for axis `i`. */
export function radarAxis(i: number) {
  const [x, y] = radarPoint(i, 100);
  const [lx, ly] = radarPoint(i, 120);
  const anchor = Math.abs(lx - RADAR.cx) < 5 ? "middle" : lx > RADAR.cx ? "start" : "end";
  return { x: fmt(x), y: fmt(y), lx: fmt(lx), ly: fmt(ly + 5), anchor } as const;
}
