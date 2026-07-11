import { computeSentimentSeries } from "../sentimentSeries";
import type { Post } from "../types";

const post = (id: string, ts: number): Pick<Post, "id" | "createdAt"> => ({ id, createdAt: ts });

describe("computeSentimentSeries", () => {
  it("スコアが無い投稿はスキップする", () => {
    const posts = [post("a", Date.UTC(2026, 0, 10, 3, 0, 0))];
    expect(computeSentimentSeries(posts, {})).toEqual([]);
  });

  it("同一JST日の投稿はスコアを平均する", () => {
    const posts = [
      post("a", Date.UTC(2026, 0, 10, 1, 0, 0)),
      post("b", Date.UTC(2026, 0, 10, 10, 0, 0)),
    ];
    const scores = { a: 0.2, b: 0.8 };
    expect(computeSentimentSeries(posts, scores)).toEqual([{ date: "2026-01-10", score: 0.5 }]);
  });

  it("結果は日付昇順で返る", () => {
    const posts = [
      post("late", Date.UTC(2026, 0, 12, 1, 0, 0)),
      post("early", Date.UTC(2026, 0, 10, 1, 0, 0)),
    ];
    const scores = { late: 1, early: -1 };
    const result = computeSentimentSeries(posts, scores);
    expect(result.map((p) => p.date)).toEqual(["2026-01-10", "2026-01-12"]);
  });

  it("UTCでは前日になるtsもJSTの日付に跨いで集計される", () => {
    // UTC 2026-01-10 20:00 は JST では 2026-01-11 05:00
    const posts = [post("a", Date.UTC(2026, 0, 10, 20, 0, 0))];
    const scores = { a: 0.4 };
    expect(computeSentimentSeries(posts, scores)).toEqual([{ date: "2026-01-11", score: 0.4 }]);
  });
});
