import { computeStreak, WEEKDAY_JA } from "../streak";
import type { Post } from "../types";

const day = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();

const post = (ts: number): Pick<Post, "createdAt"> => ({ createdAt: ts });

describe("computeStreak", () => {
  it("空配列なら streak は0、week は7要素", () => {
    const now = new Date(day(2026, 1, 10));
    const { streak, week } = computeStreak([], now);
    expect(streak).toBe(0);
    expect(week).toHaveLength(7);
  });

  it("今日投稿ありで連続N日ならstreakはN", () => {
    const now = new Date(day(2026, 1, 10));
    const posts = [post(day(2026, 1, 10)), post(day(2026, 1, 9)), post(day(2026, 1, 8))];
    const { streak } = computeStreak(posts, now);
    expect(streak).toBe(3);
  });

  it("今日未投稿でも昨日まで連続していればstreakは継続する（cursorを1日戻す分岐）", () => {
    const now = new Date(day(2026, 1, 10));
    const posts = [post(day(2026, 1, 9)), post(day(2026, 1, 8)), post(day(2026, 1, 7))];
    const { streak } = computeStreak(posts, now);
    expect(streak).toBe(3);
  });

  it("中抜けがあるとそこでstreakが途切れる", () => {
    const now = new Date(day(2026, 1, 10));
    // day8 が抜けているので day10, day9 の2日でストップする
    const posts = [post(day(2026, 1, 10)), post(day(2026, 1, 9)), post(day(2026, 1, 7))];
    const { streak } = computeStreak(posts, now);
    expect(streak).toBe(2);
  });

  it("同日複数投稿は1日として扱う", () => {
    const now = new Date(day(2026, 1, 10));
    const posts = [
      post(day(2026, 1, 10, 9)),
      post(day(2026, 1, 10, 21)),
      post(day(2026, 1, 9, 8)),
    ];
    const { streak } = computeStreak(posts, now);
    expect(streak).toBe(2);
  });

  it("weekはlabel（曜日）・done・isToday（末尾のみtrue）を正しく持つ", () => {
    const now = new Date(day(2026, 1, 10)); // 土曜日
    const posts = [post(day(2026, 1, 10)), post(day(2026, 1, 8))];
    const { week } = computeStreak(posts, now);

    // Jan4(日)〜Jan10(土) の7日分。WEEKDAY_JA は日曜始まりなので順序が一致する
    expect(week.map((w) => w.label)).toEqual([...WEEKDAY_JA]);

    // 末尾（今日=Jan10 土）のみ isToday
    expect(week.map((w) => w.isToday)).toEqual([false, false, false, false, false, false, true]);

    // done は投稿がある Jan8(木) と Jan10(土) のみ true
    expect(week.map((w) => w.done)).toEqual([false, false, false, false, true, false, true]);
  });
});
