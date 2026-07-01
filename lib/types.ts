// RecordScreen と IndexDetailModal の両方が同じ形の投稿データを扱うので、
// 型を一元化して重複定義を防ぐ（yuzu-app の lib/types.ts の Post に相当）。
export type Post = {
  id: string;
  text: string;
  index: number;
  createdAt: number;
  marked: boolean;
  durationMs: number;
  charCount: number;
};
