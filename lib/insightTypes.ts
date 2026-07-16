// yuzu-app の lib/reportTypes.ts + lib/themes.ts の型を移植。
import type { PeriodKind } from "./period";

export type ReportPayload = {
  headline: string;
  topics: string[];
  fact: string;
  proof: string;
  shadow: string;
  advice: string;
  adviceDetail: string;
  sentimentSeries: { date: string; score: number }[];
};

export type ReportMeta = {
  periodKey: string;
  kind: PeriodKind;
  rangeStart: number;
  rangeEnd: number;
  label: string;
  generated: boolean;
  headline?: string;
  topics?: string[];
  postCount: number;
  payload?: ReportPayload;
  generatedAt?: number;
  model?: string;
};

function isSentimentPoint(value: unknown): value is { date: string; score: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.date === "string" && typeof v.score === "number";
}

// レポート本体（Anthropic 生成）は部分生成・キャッシュ/スキーマ drift で欠損・型不一致が
// 起こりうる（コンパイル時アサーションだけでは実行時に守れない）。ReportDetailModal /
// EmotionChart が実際に触るフィールドをここで検証し、フィールド単位でフェイルセーフする
// （lib/currentUser.ts の parseCurrentUser と同じ方針: 欠損は空文字/空配列、壊れた要素は除外）。
// payload 自体がオブジェクトでない場合のみ null（＝呼び出し側でエラー扱い）。
export function parseReportPayload(value: unknown): ReportPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  return {
    headline: typeof v.headline === "string" ? v.headline : "",
    topics: Array.isArray(v.topics) ? v.topics.filter((t): t is string => typeof t === "string") : [],
    fact: typeof v.fact === "string" ? v.fact : "",
    proof: typeof v.proof === "string" ? v.proof : "",
    shadow: typeof v.shadow === "string" ? v.shadow : "",
    advice: typeof v.advice === "string" ? v.advice : "",
    adviceDetail: typeof v.adviceDetail === "string" ? v.adviceDetail : "",
    sentimentSeries: Array.isArray(v.sentimentSeries) ? v.sentimentSeries.filter(isSentimentPoint) : [],
  };
}

// GET/POST /api/reports/[periodKey] の応答形 `{ report?: { payload } }` を検証する。
// report が無い、または payload がオブジェクトですらない場合は null（エラー扱い）。
export function parseReportResponse(data: unknown): ReportPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const report = (data as Record<string, unknown>).report;
  if (typeof report !== "object" || report === null) return null;
  return parseReportPayload((report as Record<string, unknown>).payload);
}

export type Theme = {
  theme: string;
  description: string;
  count: number;
};

export const MIN_POSTS_FOR_THEMES = 10;

export type WordFreq = { word: string; count: number };

export type HeatmapCell = { date: string; bucket: number; charCount: number };
