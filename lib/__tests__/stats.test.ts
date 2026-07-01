import { dayNumberSince, formatDuration } from "../stats";

describe("formatDuration", () => {
  it("formats whole seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
  });

  it("clamps negative durations to 0:00", () => {
    expect(formatDuration(-500)).toBe("0:00");
  });

  it("pads seconds under 10 with a leading zero", () => {
    expect(formatDuration(9_000)).toBe("0:09");
  });
});

describe("dayNumberSince", () => {
  const day1 = new Date(2026, 0, 1, 9, 0, 0).getTime();
  const day2 = new Date(2026, 0, 2, 0, 30, 0).getTime();
  const dayBefore = new Date(2025, 11, 31, 23, 59, 0).getTime();

  it("is 1 for a post created the same calendar day as the first post", () => {
    expect(dayNumberSince(day1, day1)).toBe(1);
  });

  it("increments per calendar day, not per 24h window", () => {
    expect(dayNumberSince(day2, day1)).toBe(2);
  });

  it("returns <= 0 when createdAt precedes firstPostAt (呼び出し側で非表示にする)", () => {
    expect(dayNumberSince(dayBefore, day1)).toBeLessThanOrEqual(0);
  });
});
