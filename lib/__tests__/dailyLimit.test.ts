import {
  FALLBACK_MAX_DAILY,
  isDailyLimitReached,
  mergeStats,
  parseMaxDaily,
  remainingToday,
  statsPatchFromResponse,
} from "../dailyLimit";
import type { Stats } from "../logsCache";

const base: Stats = {
  streak: 3,
  todayCount: 0,
  maxDaily: 1,
  totalCount: 10,
  totalMinutes: 20,
};

describe("parseMaxDaily", () => {
  // null = 無制限（admin）。0 等に潰すと admin が録音できなくなる。
  it("null は無制限としてそのまま保つ", () => {
    expect(parseMaxDaily(null)).toBeNull();
  });

  it("数値はそのまま通す（0 も有効値）", () => {
    expect(parseMaxDaily(1)).toBe(1);
    expect(parseMaxDaily(3)).toBe(3);
    expect(parseMaxDaily(0)).toBe(0);
  });

  it("欠損・不正型はサーバ既定値へフォールバックする", () => {
    expect(parseMaxDaily(undefined)).toBe(FALLBACK_MAX_DAILY);
    expect(parseMaxDaily("3")).toBe(FALLBACK_MAX_DAILY);
    expect(parseMaxDaily({})).toBe(FALLBACK_MAX_DAILY);
  });
});

describe("isDailyLimitReached", () => {
  // 回帰防止: admin（maxDaily=null）は todayCount がいくつでも上限に達しない。
  it("maxDaily が null（admin）なら常に false", () => {
    expect(isDailyLimitReached({ ...base, maxDaily: null, todayCount: 0 })).toBe(false);
    expect(isDailyLimitReached({ ...base, maxDaily: null, todayCount: 99 })).toBe(false);
  });

  it("todayCount が maxDaily 未満なら false", () => {
    expect(isDailyLimitReached({ ...base, maxDaily: 1, todayCount: 0 })).toBe(false);
  });

  it("todayCount が maxDaily 以上なら true", () => {
    expect(isDailyLimitReached({ ...base, maxDaily: 1, todayCount: 1 })).toBe(true);
    expect(isDailyLimitReached({ ...base, maxDaily: 1, todayCount: 2 })).toBe(true);
  });

  it("stats 未取得（null）なら false", () => {
    expect(isDailyLimitReached(null)).toBe(false);
  });
});

describe("statsPatchFromResponse", () => {
  it("maxDaily: null（無制限）を patch に含める", () => {
    expect(statsPatchFromResponse({ maxDaily: null })).toEqual({ maxDaily: null });
  });

  it("maxDaily が無い応答では maxDaily を含めない（前の値を保つため）", () => {
    const patch = statsPatchFromResponse({ streak: 2, todayCount: 1 });
    expect("maxDaily" in patch).toBe(false);
    expect(patch).toEqual({ streak: 2, todayCount: 1 });
  });

  it("不正型のフィールドは無視する", () => {
    expect(statsPatchFromResponse({ streak: "5", todayCount: null, maxDaily: "1" })).toEqual({});
  });

  it("オブジェクトでない応答は空 patch", () => {
    expect(statsPatchFromResponse(null)).toEqual({});
    expect(statsPatchFromResponse("broken")).toEqual({});
  });
});

describe("mergeStats", () => {
  // 回帰防止: `??` で merge すると null（無制限）が前値や既定値に置き換わってしまう。
  it("maxDaily: null で上書きできる（admin 昇格を反映）", () => {
    const merged = mergeStats({ ...base, maxDaily: 1 }, { maxDaily: null });
    expect(merged.maxDaily).toBeNull();
  });

  it("patch に maxDaily が無ければ前の値を保つ", () => {
    const merged = mergeStats({ ...base, maxDaily: null }, { todayCount: 2 });
    expect(merged.maxDaily).toBeNull();
    expect(merged.todayCount).toBe(2);
  });

  it("prev も patch も無ければ既定値", () => {
    expect(mergeStats(null, {}).maxDaily).toBe(FALLBACK_MAX_DAILY);
  });
});

describe("remainingToday", () => {
  it("無制限（null）は残数なし＝null", () => {
    expect(remainingToday(null, 5)).toBeNull();
  });

  it("残数は 0 未満にならない", () => {
    expect(remainingToday(1, 0)).toBe(1);
    expect(remainingToday(1, 1)).toBe(0);
    expect(remainingToday(1, 3)).toBe(0);
  });
});
