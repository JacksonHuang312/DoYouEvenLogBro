import { describe, expect, test } from "vitest";
import { STATS } from "./config";
import { RADAR, RADAR_ORDER, radarAxis, radarPoint, radarPolygon, radarRing, radarScale } from "./radar";

describe("radar", () => {
  test("axis order is Chest, Shoulders, Core, Legs, Arms, Back and covers every stat once", () => {
    expect(RADAR_ORDER).toEqual(["chest", "shoulders", "core", "legs", "arms", "back"]);
    expect([...RADAR_ORDER].sort()).toEqual([...STATS].sort());
    expect(RADAR.angles).toHaveLength(RADAR_ORDER.length);
  });

  test("a value of 0 is the centre and 100 is the outer ring", () => {
    const [cx, cy] = radarPoint(2, 0);
    expect([cx, cy]).toEqual([RADAR.cx, RADAR.cy]);
    const [x, y] = radarPoint(2, 100); // Core points right
    expect(x).toBeCloseTo(RADAR.cx + RADAR.radius);
    expect(y).toBeCloseTo(RADAR.cy);
  });

  test("Chest is upper left and Back is directly left", () => {
    const [chestX, chestY] = radarPoint(0, 100);
    expect(chestX).toBeLessThan(RADAR.cx);
    expect(chestY).toBeLessThan(RADAR.cy);
    const [backX, backY] = radarPoint(5, 100);
    expect(backX).toBeCloseTo(RADAR.cx - RADAR.radius);
    expect(backY).toBeCloseTo(RADAR.cy);
  });

  test("polygons have one point per axis; negative values sit at the centre", () => {
    expect(radarPolygon([10, 20, 30, 40, 50, 60]).split(" ")).toHaveLength(6);
    expect(radarPolygon([0, -5, 0, 0, 0, 0])).toBe(radarPolygon([0, 0, 0, 0, 0, 0]));
    expect(radarRing(50).split(" ")).toHaveLength(6);
  });

  test("values past 100 aren't clipped: the scale grows to the highest one", () => {
    expect(radarScale([40, 80, 60, 0, 0, 0])).toBe(100);
    expect(radarScale([150, 80, 60, 0, 0, 0])).toBe(150);
    // 150 on a 150 scale is the edge; 100 on it sits two thirds of the way out.
    expect(radarPolygon([150, 0, 0, 0, 0, 0], 150)).toBe(radarPolygon([100, 0, 0, 0, 0, 0]));
    const [x] = radarPoint(2, 100, 150);
    expect(x).toBeCloseTo(RADAR.cx + (RADAR.radius * 2) / 3);
  });

  test("labels sit outside the ring and anchor away from the centre", () => {
    expect(radarAxis(0).anchor).toBe("end");
    expect(radarAxis(1).anchor).toBe("start");
    expect(radarAxis(2).anchor).toBe("start");
    expect(radarAxis(5).anchor).toBe("end");
    expect(Number(radarAxis(2).lx)).toBeGreaterThan(RADAR.cx + RADAR.radius);
  });
});
