import { buildDailyWeeks } from "../dailyHeatmap";
import type { HeatmapCell } from "../insightTypes";

const cell = (date: string, bucket: number, charCount: number): HeatmapCell => ({ date, bucket, charCount });

describe("buildDailyWeeks", () => {
  it("空配列なら weeks は空、hasAny は false", () => {
    const { weeks, maxChars, hasAny } = buildDailyWeeks([]);
    expect(weeks).toEqual([]);
    expect(maxChars).toBe(0);
    expect(hasAny).toBe(false);
  });

  it("同日の複数バケットは合算される", () => {
    // 2026-01-08 は木曜（週内3日目）
    const cells = [cell("2026-01-08", 4, 100), cell("2026-01-08", 10, 50)];
    const { weeks, maxChars, hasAny } = buildDailyWeeks(cells);
    expect(hasAny).toBe(true);
    expect(maxChars).toBe(150);
    const flat = weeks.flat();
    const target = flat.find((c) => c?.date === "2026-01-08");
    expect(target?.charCount).toBe(150);
  });

  it("日付の抜けは charCount 0 の日として埋められる", () => {
    // 1/4(日) と 1/6(火) のみ投稿あり。1/5(月) は0埋めされる
    const cells = [cell("2026-01-04", 0, 10), cell("2026-01-06", 0, 20)];
    const { weeks } = buildDailyWeeks(cells);
    const flat = weeks.flat();
    const jan5 = flat.find((c) => c?.date === "2026-01-05");
    expect(jan5?.charCount).toBe(0);
  });

  it("週の先頭・末尾は日曜〜土曜になるよう null でパディングされる", () => {
    // 2026-01-08(木)〜2026-01-09(金) の2日分だけ
    const cells = [cell("2026-01-08", 0, 10), cell("2026-01-09", 0, 20)];
    const { weeks } = buildDailyWeeks(cells);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(7);
    // 日曜(index0)〜水曜(index3)は範囲外なので null、木(index4)・金(index5)は実データ、土(index6)はnull
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][3]).toBeNull();
    expect(weeks[0][4]?.date).toBe("2026-01-08");
    expect(weeks[0][5]?.date).toBe("2026-01-09");
    expect(weeks[0][6]).toBeNull();
  });

  it("複数週にまたがる場合は列ごとに7日で区切られる", () => {
    // 2026-01-01(木)〜2026-01-15(木) の15日分 → 3週分の列になるはず
    const cells: HeatmapCell[] = [];
    for (let d = 1; d <= 15; d++) {
      cells.push(cell(`2026-01-${String(d).padStart(2, "0")}`, 0, d));
    }
    const { weeks, maxChars } = buildDailyWeeks(cells);
    expect(weeks).toHaveLength(3);
    expect(maxChars).toBe(15);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });
});
