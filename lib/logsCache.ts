// LOG 先頭ページ（limit=20）と統計（RECORDS/MINUTES/STREAK）の起動時キャッシュ。
// stale-while-revalidate: 前回起動時に取得した内容をネットワークより先に画面へ出し、
// 裏で最新を取得できたら差し替える。lib/sentimentCache.ts と同じ作り。
//
// userId を一緒に保存し、読み出し時に一致しなければ null を返す。別アカウントでログイン
// し直した端末で前ユーザーの LOG が一瞬でも表示されるのはプライバシー事故なので必須の検証。
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jstDateString } from "./period";
import type { Post } from "./types";

export const LOGS_CACHE_KEY = "yuzu_logs_cache_v1";

export type Stats = {
  streak: number;
  todayCount: number;
  // null = 無制限（admin）。サーバ（yuzu-app /api/records の maxDaily）は admin に null を返す。
  // 0 に潰すと todayCount >= maxDaily が常に成立して録音が全面ブロックされるので number|null で持つ。
  maxDaily: number | null;
  totalCount: number;
  totalMinutes: number;
};

export type LogsCache = {
  userId: string;
  posts: Post[];
  stats: Stats | null;
  firstPostAt: number | null;
  // stats.todayCount を取得した JST 日付（YYYY-MM-DD）。日付を跨いだキャッシュの todayCount は
  // 当日のものではないので、前日の回数で当日の録音をブロックしないために無効化する目印。
  statsDate?: string | null;
};

function isStats(value: unknown): value is Stats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.streak === "number" &&
    typeof v.todayCount === "number" &&
    (v.maxDaily === null || typeof v.maxDaily === "number") &&
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
  // statsDate は後から足したフィールドなので、無い（undefined）旧キャッシュも受け入れる
  // （読み出し側で「日付不明＝当日ではない」として todayCount を無効化する）。
  if (v.statsDate !== undefined && v.statsDate !== null && typeof v.statsDate !== "string") return false;
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
    // JST の日付が変わっていれば todayCount は前日以前の値。そのまま返すと「今日はまだ
    // 録音していないのに 1/1（上限到達）」と表示され録音がブロックされるので 0 に戻し、
    // ネットワーク応答が来たら正しい値へ差し替えさせる。statsDate 未保存の旧キャッシュも同様。
    if (parsed.stats && parsed.statsDate !== jstDateString(Date.now())) {
      return { ...parsed, stats: { ...parsed.stats, todayCount: 0 } };
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLogsCache(
  userId: string,
  data: Omit<LogsCache, "userId" | "statsDate">,
): Promise<void> {
  try {
    // 保存時点の JST 日付を刻む（読み出し時に当日かどうかを判定するため）。
    const payload: LogsCache = { userId, ...data, statsDate: jstDateString(Date.now()) };
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
