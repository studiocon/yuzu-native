// SIGNAL の「日×時間帯」グリッドを「1日1マス」の週間カレンダーに再集計する。
// date は "YYYY-MM-DD" 文字列のみを扱う（時刻情報は無い）ので、UTC ms 上での
// カレンダー演算に倒す — ローカルタイムゾーンや DST の影響を受けない。
import type { HeatmapCell } from "./insightTypes";
import { jstDateString } from "./period";

const DAY_MS = 24 * 60 * 60 * 1000;

// 表示範囲は「今日を含む週から遡って16週」で固定する。
// データ範囲（初ログ〜最終ログ）に列数を委ねると、履歴が浅いユーザーで
// 列が数本しかなくなり、セルが画面幅いっぱいに巨大化するため。
export const WINDOW_WEEKS = 16;

export type DailyCell = { date: string; charCount: number };

function toUTCms(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTCms(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayOfWeek(date: string): number {
  return new Date(toUTCms(date)).getUTCDay();
}

// 週は日曜始まり。「今日を含む週から遡って WINDOW_WEEKS 週」の固定範囲を描画する。
// 初ログ以前・ログの無い日は charCount 0、今日より未来（今週の残り）は null で埋める。
// 範囲より古いデータは切り捨てる。today は JST の "YYYY-MM-DD"（テスト用に注入可能）。
export function buildDailyWeeks(
  cells: HeatmapCell[],
  today: string = jstDateString(Date.now())
): {
  weeks: (DailyCell | null)[][];
  maxChars: number;
  hasAny: boolean;
} {
  if (cells.length === 0) return { weeks: [], maxChars: 0, hasAny: false };

  const totals = new Map<string, number>();
  for (const c of cells) {
    totals.set(c.date, (totals.get(c.date) ?? 0) + c.charCount);
  }

  const endMs = toUTCms(today);
  const startMs = endMs - dayOfWeek(today) * DAY_MS - (WINDOW_WEEKS - 1) * 7 * DAY_MS;

  const days: DailyCell[] = [];
  let maxChars = 0;
  let hasAny = false;
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const date = fromUTCms(ms);
    const charCount = totals.get(date) ?? 0;
    days.push({ date, charCount });
    if (charCount > maxChars) maxChars = charCount;
    if (charCount > 0) hasAny = true;
  }

  const trailingPad = 6 - dayOfWeek(days[days.length - 1].date);
  const padded: (DailyCell | null)[] = [...days, ...Array(trailingPad).fill(null)];

  const weeks: (DailyCell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return { weeks, maxChars, hasAny };
}
