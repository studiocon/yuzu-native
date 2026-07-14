// LOG 先頭ページ（limit=20）と統計（RECORDS/MINUTES/STREAK）の起動時キャッシュ。
// stale-while-revalidate: 前回起動時に取得した内容をネットワークより先に画面へ出し、
// 裏で最新を取得できたら差し替える。lib/sentimentCache.ts と同じ作り。
//
// userId を一緒に保存し、読み出し時に一致しなければ null を返す。別アカウントでログイン
// し直した端末で前ユーザーの LOG が一瞬でも表示されるのはプライバシー事故なので必須の検証。
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Post } from "./types";

export const LOGS_CACHE_KEY = "yuzu_logs_cache_v1";

export type Stats = {
  streak: number;
  todayCount: number;
  maxDaily: number;
  totalCount: number;
  totalMinutes: number;
};

export type LogsCache = {
  userId: string;
  posts: Post[];
  stats: Stats | null;
  firstPostAt: number | null;
};

function isStats(value: unknown): value is Stats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.streak === "number" &&
    typeof v.todayCount === "number" &&
    typeof v.maxDaily === "number" &&
    typeof v.totalCount === "number" &&
    typeof v.totalMinutes === "number"
  );
}

function isPost(value: unknown): value is Post {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.text === "string" &&
    typeof v.index === "number" &&
    typeof v.createdAt === "number" &&
    typeof v.marked === "boolean" &&
    typeof v.durationMs === "number" &&
    typeof v.charCount === "number"
  );
}

function isLogsCache(value: unknown): value is LogsCache {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.userId !== "string") return false;
  if (!Array.isArray(v.posts) || !v.posts.every(isPost)) return false;
  if (v.stats !== null && !isStats(v.stats)) return false;
  if (v.firstPostAt !== null && typeof v.firstPostAt !== "number") return false;
  return true;
}

// userId 不一致・JSON 破損・形式不一致はすべて null（＝キャッシュ無し扱い。呼び出し側は
// 従来通りネットワーク応答を待つ）。
export async function loadLogsCache(userId: string): Promise<LogsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(LOGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isLogsCache(parsed)) return null;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLogsCache(userId: string, data: Omit<LogsCache, "userId">): Promise<void> {
  try {
    const payload: LogsCache = { userId, ...data };
    await AsyncStorage.setItem(LOGS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // キャッシュ書き込み失敗は装飾機能のため無視してよい
  }
}

export async function clearLogsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOGS_CACHE_KEY);
  } catch {
    // 削除失敗は致命的ではない
  }
}
