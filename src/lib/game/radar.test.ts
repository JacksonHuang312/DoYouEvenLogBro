import { describe, expect, test } from "vitest";
import { STATS } from "./config";
import { RADAR, RADAR_ORDER, radarAxis, radarPoint, radarPolygon, radarRing } from "./radar";

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

  test("polygons have one point per axis and clamp out-of-range values", () => {
    expect(radarPolygon([10, 20, 30, 40, 50, 60]).split(" ")).toHaveLength(6);
    expect(radarPolygon([150, -5, 0, 0, 0, 0])).toBe(radarPolygon([100, 0, 0, 0, 0, 0]));
    expect(radarRing(50).split(" ")).toHaveLength(6);
  });

  test("labels sit outside the ring and anchor away from the centre", () => {
    expect(radarAxis(0).anchor).toBe("end");
    expect(radarAxis(1).anchor).toBe("start");
    expect(radarAxis(2).anchor).toBe("start");
    expect(radarAxis(5).anchor).toBe("end");
    expect(Number(radarAxis(2).lx)).toBeGreaterThan(RADAR.cx + RADAR.radius);
  });
});
