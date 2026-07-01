// yuzu-app の lib/reportTypes.ts + lib/themes.ts の型を移植。
import type { PeriodKind } from "./period";

export type ReportPayload = {
  headline: string;
  topics: string[];
  manifest: string;
  latent: string;
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

export type Theme = {
  theme: string;
  description: string;
  count: number;
};

export const MIN_POSTS_FOR_THEMES = 10;

export type WordFreq = { word: string; count: number };

export type HeatmapCell = { date: string; bucket: number; charCount: number };
