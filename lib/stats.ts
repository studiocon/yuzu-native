// yuzu-app の lib/stats.ts から必要な分だけ移植。

// 録音時間を m:ss 形式に整形する（例 84000ms → "1:24"）。
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// その記録が登録（最初の投稿）から何日目かを返す（1-based、ローカル日付基準）。
// createdAt が firstPostAt より前など算出不能なケースは 0 以下を返し、呼び出し側で非表示判定する。
export function dayNumberSince(createdAt: number, firstPostAt: number): number {
  const startOfDay = (ts: number) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diffDays = Math.round((startOfDay(createdAt) - startOfDay(firstPostAt)) / 86400000);
  return diffDays + 1;
}
