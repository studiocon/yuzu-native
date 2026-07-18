// SIGNAL の「日×時間帯」グリッドを「1日1マス」の週間カレンダーに再集計する。
// date は "YYYY-MM-DD" 文字列のみを扱う（時刻情報は無い）ので、UTC ms 上での
// カレンダー演算に倒す — ローカルタイムゾーンや DST の影響を受けない。
import type { HeatmapCell } from "./insightTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

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

// 週は日曜始まり。範囲外の穴（週の頭・尻）は null で埋め、7で割り切れる列に揃える。
export function buildDailyWeeks(cells: HeatmapCell[]): {
  weeks: (DailyCell | null)[][];
  maxChars: number;
  hasAny: boolean;
} {
  if (cells.length === 0) return { weeks: [], maxChars: 0, hasAny: false };

  const totals = new Map<string, number>();
  for (const c of cells) {
    totals.set(c.date, (totals.get(c.date) ?? 0) + c.charCount);
  }
  const dates = [...totals.keys()].sort();
  const startMs = toUTCms(dates[0]);
  const endMs = toUTCms(dates[dates.length - 1]);

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

  const leadingPad = dayOfWeek(days[0].date);
  const trailingPad = 6 - dayOfWeek(days[days.length - 1].date);
  const padded: (DailyCell | null)[] = [
    ...Array(leadingPad).fill(null),
    ...days,
    ...Array(trailingPad).fill(null),
  ];

  const weeks: (DailyCell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return { weeks, maxChars, hasAny };
}
