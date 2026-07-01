// yuzu-app の lib/period.ts から必要な分だけ移植（JST 固定で週/月の境界を扱う）。

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodKind = "week" | "month";

function jstParts(ts: number): { y: number; m: number; d: number } {
  const d = new Date(ts + JST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

// 投稿の createdAt を YYYY-MM-DD（JST）に整形
export function jstDateString(ts: number): string {
  const { y, m, d } = jstParts(ts);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// レポートカードの期間スパン表示（JST）。end は排他境界なので最終日は end - DAY_MS。
// week → "M/D–M/D"（例 6/8–6/14）、month → "M月"（例 6月）。
export function formatPeriodRange(start: number, end: number, kind: PeriodKind): string {
  if (kind === "month") {
    const { m } = jstParts(start);
    return `${m}月`;
  }
  const s = jstParts(start);
  const e = jstParts(end - DAY_MS);
  return `${s.m}/${s.d}–${e.m}/${e.d}`;
}

// レポート詳細画面の見出し（例 "6月2週 週次レポート" / "5月 月次レポート"）。
export function periodLabel(key: string): string {
  const w = key.match(/^w-(\d{4})-(\d{2})-(\d{2})$/);
  if (w) {
    const month = +w[2];
    const day = +w[3];
    const wn = Math.floor((day - 1) / 7) + 1;
    return `${month}月${wn}週 週次レポート`;
  }
  const m = key.match(/^m-(\d{4})-(\d{2})$/);
  if (m) return `${+m[2]}月 月次レポート`;
  return key;
}
