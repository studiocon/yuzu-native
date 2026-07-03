// yuzu-app の lib/streak.ts を移植（CompleteView の7日帯 + STREAK 算出）。
// dayKey は意図的にローカルタイム（端末のタイムゾーン）で日付を割る。web と同じ設計判断で、
// 「ユーザーの体感する1日」に streak を合わせるため（lib/period.ts の JST 固定とは別軸）。
// サーバ側 get_streak は JST 固定なので、非 JST 端末や JST 深夜帯ではズレ得るが、
// RecordScreen 側で Math.max(サーバ streak, このクライアント streak) を取るため実害は出ない
// （このクライアント値は「投稿直後の即時反映」用の補助であり、正の値の低め見積りにしかならない）。
import type { Post } from "./types";

export const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type WeekDay = { label: string; done: boolean; isToday: boolean };

export function computeStreak(posts: Pick<Post, "createdAt">[], now: Date = new Date()): { streak: number; week: WeekDay[] } {
  const days = new Set(posts.map((p) => dayKey(new Date(p.createdAt))));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let streak = 0;
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const week: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    week.push({
      label: WEEKDAY_JA[d.getDay()],
      done: days.has(dayKey(d)),
      isToday: i === 0,
    });
  }

  return { streak, week };
}
