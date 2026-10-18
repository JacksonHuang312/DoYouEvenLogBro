import { describe, expect, test } from "vitest";
import { addDays, dayId, dayStartMs, daysBetween, isValidTimeZone, recentWeekIds, weekId, weekdayOf } from "./time";
import { DAY, T0 } from "./test-helpers";

describe("isValidTimeZone", () => {
  test("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Not/A_Zone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("dayId", () => {
  test("is the local calendar date", () => {
    expect(dayId(T0, "UTC")).toBe("2026-10-14");
    // 12:00 UTC is 01:00 the next day in Auckland (UTC+13 in October).
    expect(dayId(T0, "Pacific/Auckland")).toBe("2026-10-15");
    // 03:00 UTC is still the previous evening in Los Angeles.
    expect(dayId(Date.UTC(2026, 9, 14, 3), "America/Los_Angeles")).toBe("2026-10-13");
  });
});

describe("daysBetween", () => {
  test("counts calendar days, across months and DST changes", () => {
    expect(daysBetween("2026-10-14", "2026-10-14")).toBe(0);
    expect(daysBetween("2026-10-14", "2026-10-17")).toBe(3);
    expect(daysBetween("2026-10-17", "2026-10-14")).toBe(-3);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("weekId", () => {
  test("is the Sunday the week starts on", () => {
    expect(weekId(T0, "UTC")).toBe("2026-10-11"); // Wednesday
    expect(weekId(Date.UTC(2026, 9, 11, 0, 0), "UTC")).toBe("2026-10-11"); // Sunday 00:00
    expect(weekId(Date.UTC(2026, 9, 17, 23, 59), "UTC")).toBe("2026-10-11"); // Saturday night
    expect(weekId(Date.UTC(2026, 9, 18), "UTC")).toBe("2026-10-18"); // next Sunday
  });

  test("uses the user's time zone", () => {
    // Sunday 03:00 UTC is still Saturday in Los Angeles.
    expect(weekId(Date.UTC(2026, 9, 18, 3), "America/Los_Angeles")).toBe("2026-10-11");
  });

  test("handles weeks spanning a new year", () => {
    expect(weekId(Date.UTC(2027, 0, 1), "UTC")).toBe("2026-12-27");
  });
});

describe("recentWeekIds", () => {
  test("lists this week and the ones before it, newest first", () => {
    expect(recentWeekIds(T0, "UTC", 3)).toEqual(["2026-10-11", "2026-10-04", "2026-09-27"]);
    expect(recentWeekIds(T0 + 7 * DAY, "UTC", 1)).toEqual(["2026-10-18"]);
  });
});

describe("addDays and weekdayOf", () => {
  test("move across months and name the weekday", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOf("2026-10-11")).toBe(0);
    expect(weekdayOf("2026-10-14")).toBe(3);
    expect(weekdayOf("2026-10-17")).toBe(6);
  });
});

describe("dayStartMs", () => {
  test("is local midnight in the time zone", () => {
    expect(dayStartMs("2026-10-14", "UTC")).toBe(Date.UTC(2026, 9, 14));
    expect(dayStartMs("2026-10-14", "America/Los_Angeles")).toBe(Date.UTC(2026, 9, 14, 7));
    // Auckland is UTC+13 in October.
    expect(dayStartMs("2026-10-15", "Pacific/Auckland")).toBe(Date.UTC(2026, 9, 14, 11));
  });

  test("handles days either side of a DST change", () => {
    // Los Angeles falls back on 2026-11-01: that day is 25 hours long.
    expect(dayStartMs("2026-11-01", "America/Los_Angeles")).toBe(Date.UTC(2026, 10, 1, 7));
    expect(dayStartMs("2026-11-02", "America/Los_Angeles")).toBe(Date.UTC(2026, 10, 2, 8));
  });

  test("round-trips with dayId", () => {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland"]) {
      const start = dayStartMs("2026-10-14", tz);
      expect(dayId(start, tz)).toBe("2026-10-14");
      expect(dayId(start - 1, tz)).toBe("2026-10-13");
    }
  });
});
