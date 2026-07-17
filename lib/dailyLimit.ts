// 1 日あたり録音回数の上限まわりの純ロジック。
//
// サーバ（yuzu-app /api/records）は maxDaily に **null = 無制限（admin）** を返す。
// これを 0 などの数値へ潰すと `todayCount >= maxDaily` が 0 >= 0 で常に成立し、
// admin が録音を全面ブロックされる（実際に発生した回帰）。null を値として保つこと。
import type { Stats } from "./logsCache";

// stats 未取得・maxDaily 欠損時のフォールバック。サーバ側の実際の上限
// （yuzu-app lib/constants.ts の MAX_DAILY_SESSIONS）と揃える。
export const FALLBACK_MAX_DAILY = 1;

// null（無制限）は有効値として保つ。数値でも null でもない（フィールド欠損など）ときだけ
// フォールバックする。
export function parseMaxDaily(value: unknown): number | null {
  if (value === null) return null;
  return typeof value === "number" ? value : FALLBACK_MAX_DAILY;
}

// サーバ応答から stats の部分更新を作る。「フィールドが無い」と「null（無制限）」を区別し、
// 無いものは触らない（＝前の値を引き継がせる）。
export function statsPatchFromResponse(data: unknown): Partial<Stats> {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const patch: Partial<Stats> = {};
  if (typeof d.streak === "number") patch.streak = d.streak;
  if (typeof d.todayCount === "number") patch.todayCount = d.todayCount;
  if (d.maxDaily === null || typeof d.maxDaily === "number") patch.maxDaily = d.maxDaily;
  return patch;
}

export function mergeStats(prev: Stats | null, patch: Partial<Stats>): Stats {
  return {
    streak: patch.streak ?? prev?.streak ?? 0,
    todayCount: patch.todayCount ?? prev?.todayCount ?? 0,
    // null（無制限）は有効値なので ?? で潰さない。patch に無ければ prev の値を
    // null ごとそのまま引き継ぎ、prev 自体が無いときだけ既定値にする
    // （`prev?.maxDaily ?? FALLBACK` と書くと prev の null が既定値 1 に化けて admin が降格する）。
    maxDaily: patch.maxDaily !== undefined ? patch.maxDaily : prev ? prev.maxDaily : FALLBACK_MAX_DAILY,
    totalCount: patch.totalCount ?? prev?.totalCount ?? 0,
    totalMinutes: patch.totalMinutes ?? prev?.totalMinutes ?? 0,
  };
}

// maxDaily === null（無制限）なら決して上限に達しない。
export function isDailyLimitReached(stats: Stats | null): boolean {
  return stats !== null && stats.maxDaily !== null && stats.todayCount >= stats.maxDaily;
}

// 無制限（admin）は残数の概念が無いので null を返す（UI は "N LEFT" を出さない）。
export function remainingToday(maxDaily: number | null, todayCount: number): number | null {
  return maxDaily === null ? null : Math.max(0, maxDaily - todayCount);
}
