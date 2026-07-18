import { DAY_MS, JST_OFFSET_MS, formatPeriodRange, jstDateString, jstHour, periodLabel, recentClosedPeriods } from "../period";

// JST 深夜0時ちょうどにあたる UTC ts を作るヘルパー
const jstMidnight = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d, 0, 0, 0) - JST_OFFSET_MS;

describe("jstDateString", () => {
  it("UTC 15:00 は JST 翌日0時なので日付が繰り上がる", () => {
    const ts = Date.UTC(2026, 0, 10, 15, 0, 0);
    expect(jstDateString(ts)).toBe("2026-01-11");
  });

  it("UTC 14:59:59 はまだ JST 同日中", () => {
    const ts = Date.UTC(2026, 0, 10, 14, 59, 59);
    expect(jstDateString(ts)).toBe("2026-01-10");
  });
});

describe("formatPeriodRange", () => {
  it("weekはendを排他境界として扱い、最終日は end - 1日で表示する", () => {
    const start = jstMidnight(2026, 6, 8);
    const end = start + 7 * DAY_MS; // 6/15 0時（排他）
    expect(formatPeriodRange(start, end, "week")).toBe("6/8–6/14");
  });

  it("monthはstartの月のみを表示する", () => {
    const start = jstMidnight(2026, 5, 1);
    const end = jstMidnight(2026, 6, 1);
    expect(formatPeriodRange(start, end, "month")).toBe("5月");
  });
});

describe("periodLabel", () => {
  it("週次キー: 月内の週番号は (day-1)/7 + 1（day1は1週）", () => {
    expect(periodLabel("w-2026-06-01")).toBe("6月1週 週次レポート");
  });

  it("週次キー: day8は2週目の境界", () => {
    expect(periodLabel("w-2026-06-08")).toBe("6月2週 週次レポート");
  });

  it("月次キー", () => {
    expect(periodLabel("m-2026-06")).toBe("6月 月次レポート");
  });

  it("不明なキーはそのまま返す", () => {
    expect(periodLabel("unknown-key")).toBe("unknown-key");
  });
});

describe("jstHour", () => {
  it("UTC 15:00 は JST 翌日0時なので0時になる", () => {
    const ts = Date.UTC(2026, 0, 10, 15, 0, 0);
    expect(jstHour(ts)).toBe(0);
  });

  it("UTC 14:59 はまだ JST 23時台", () => {
    const ts = Date.UTC(2026, 0, 10, 14, 59, 0);
    expect(jstHour(ts)).toBe(23);
  });
});

describe("recentClosedPeriods", () => {
  it("進行中の週・月は含めず、確定済みの直近4週+前月のみ返す", () => {
    // 2026-06-10(水) JST 12:00 を「今」とする
    const now = jstMidnight(2026, 6, 10) + 12 * 60 * 60 * 1000;
    const periods = recentClosedPeriods(now, 4);

    // 週は4件、月は1件（前月）= 5件
    expect(periods.filter((p) => p.kind === "week")).toHaveLength(4);
    expect(periods.filter((p) => p.kind === "month")).toHaveLength(1);
    // end 降順
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i - 1].end).toBeGreaterThanOrEqual(periods[i].end);
    }
    // 進行中の今週(6/7開始の日曜週)は含まれない
    expect(periods.some((p) => p.key === "w-2026-06-07")).toBe(false);
    // 前月は5月
    expect(periods.find((p) => p.kind === "month")?.key).toBe("m-2026-05");
  });
});
