import { WINDOW_WEEKS, buildDailyWeeks } from "../dailyHeatmap";
import type { HeatmapCell } from "../insightTypes";

const cell = (date: string, bucket: number, charCount: number): HeatmapCell => ({ date, bucket, charCount });

// today は注入可能。2026-01-10 は土曜（週の末尾）なので、その週は
// 日曜 2026-01-04 始まりで trailing パディングが発生しない。
const TODAY_SAT = "2026-01-10";
// 2026-01-08 は木曜。週の残り（金・土）が null パディングになる。
const TODAY_THU = "2026-01-08";

describe("buildDailyWeeks", () => {
  it("空配列なら weeks は空、hasAny は false", () => {
    const { weeks, maxChars, hasAny } = buildDailyWeeks([], TODAY_SAT);
    expect(weeks).toEqual([]);
    expect(maxChars).toBe(0);
    expect(hasAny).toBe(false);
  });

  it("今日を含む週から遡って常に WINDOW_WEEKS 列になる", () => {
    const cells = [cell("2026-01-08", 0, 10)];
    const { weeks } = buildDailyWeeks(cells, TODAY_SAT);
    expect(weeks).toHaveLength(WINDOW_WEEKS);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    // 先頭列は WINDOW_WEEKS 週前の日曜から始まる（leading パディングなし）
    expect(weeks[0][0]?.date).toBe("2025-09-21");
    // 最終列の末尾は今日（土曜）
    expect(weeks[WINDOW_WEEKS - 1][6]?.date).toBe(TODAY_SAT);
  });

  it("同日の複数バケットは合算される", () => {
    const cells = [cell("2026-01-08", 4, 100), cell("2026-01-08", 10, 50)];
    const { weeks, maxChars, hasAny } = buildDailyWeeks(cells, TODAY_SAT);
    expect(hasAny).toBe(true);
    expect(maxChars).toBe(150);
    const flat = weeks.flat();
    const target = flat.find((c) => c?.date === "2026-01-08");
    expect(target?.charCount).toBe(150);
  });

  it("ウィンドウ内でログの無い日（初ログ以前を含む）は charCount 0 で埋められる", () => {
    const cells = [cell("2026-01-04", 0, 10), cell("2026-01-06", 0, 20)];
    const { weeks } = buildDailyWeeks(cells, TODAY_SAT);
    const flat = weeks.flat();
    // ログとログの間の抜け
    expect(flat.find((c) => c?.date === "2026-01-05")?.charCount).toBe(0);
    // 初ログ（1/4）より前の日もウィンドウ内なら 0 埋め
    expect(flat.find((c) => c?.date === "2025-12-25")?.charCount).toBe(0);
  });

  it("今日が週の途中なら残りの曜日は null でパディングされる", () => {
    const cells = [cell("2026-01-08", 0, 10)];
    const { weeks } = buildDailyWeeks(cells, TODAY_THU);
    expect(weeks).toHaveLength(WINDOW_WEEKS);
    const lastWeek = weeks[WINDOW_WEEKS - 1];
    // 日(4)〜木(8)は実データ、金(index5)・土(index6)は未来なので null
    expect(lastWeek[4]?.date).toBe(TODAY_THU);
    expect(lastWeek[5]).toBeNull();
    expect(lastWeek[6]).toBeNull();
  });

  it("ウィンドウより古いデータは切り捨てられ、maxChars にも影響しない", () => {
    const cells = [
      cell("2024-01-01", 0, 9999), // 2年前 → 範囲外
      cell("2026-01-08", 0, 10),
    ];
    const { weeks, maxChars } = buildDailyWeeks(cells, TODAY_SAT);
    const flat = weeks.flat();
    expect(flat.find((c) => c?.date === "2024-01-01")).toBeUndefined();
    expect(maxChars).toBe(10);
  });

  it("ウィンドウ内に1件もログが無ければ hasAny は false", () => {
    const cells = [cell("2024-01-01", 0, 100)]; // 範囲外のみ
    const { hasAny, maxChars } = buildDailyWeeks(cells, TODAY_SAT);
    expect(hasAny).toBe(false);
    expect(maxChars).toBe(0);
  });
});
