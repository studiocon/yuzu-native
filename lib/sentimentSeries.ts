// yuzu-app の lib/sentimentSeries.ts を移植。
import type { Post } from "./types";
import { jstDateString } from "./period";

export type SentimentPoint = { date: string; score: number };

// 投稿群を JST 日付で集約し、その日の平均センチメントスコアを返す。
export function computeSentimentSeries(
  posts: Pick<Post, "id" | "createdAt">[],
  scores: Record<string, number>,
): SentimentPoint[] {
  const byDate = new Map<string, number[]>();
  for (const p of posts) {
    const s = scores[p.id];
    if (typeof s !== "number") continue;
    const d = jstDateString(p.createdAt);
    const arr = byDate.get(d) ?? [];
    arr.push(s);
    byDate.set(d, arr);
  }
  return [...byDate.entries()]
    .map(([date, arr]) => ({ date, score: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
