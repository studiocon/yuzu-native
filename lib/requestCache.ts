// lib/useApiGet.ts / InsightScreen の REPORTS 一覧用キャッシュ（SWR: stale-while-revalidate）。
// タブ切替のたびに InsightScreen がアンマウント→再マウントされ、毎回 data=null から始まって
// スケルトンに戻ってしまう問題を、直近のレスポンスをプロセスメモリに保持して初期表示に
// 使うことで解消する。
//
// 加えて AsyncStorage への永続化層を持つ（コールドスタート対策。LOG は lib/logsCache.ts で
// 永続化済みなのに INSIGHT だけ毎回ネットワーク待ちになる非対称を解消する）。
// hydrateRequestCache(userId) で起動時に一括復元し、setCached のたびに裏で書き戻す。
// logsCache と同様、userId を一緒に保存して読み出し時に一致しなければ破棄する
// （別アカウントでログインし直した際の他人データ混入防止。プライバシー上必須）。
//
// フックそのものは renderHook 環境が無くテストしづらいため、キャッシュの読み書きロジックを
// この純関数モジュールに切り出してユニットテストする。

import AsyncStorage from "@react-native-async-storage/async-storage";

export const REQUEST_CACHE_KEY = "yuzu_request_cache_v1";

const cache = new Map<string, unknown>();

// hydrateRequestCache が呼ばれるまで null。null の間は AsyncStorage へ書き込まない
// （userId 抜きで保存すると別アカウント切替時の検証ができなくなるため）。
let persistUserId: string | null = null;
let persistScheduled = false;

// 同一ティック内の連続 setCached を1回の書き込みにまとめる（microtask デバウンス）。
// fire-and-forget: 永続化失敗は無害（次回コールドスタートがネットワーク待ちに戻るだけ）。
function schedulePersist(): void {
  if (persistUserId === null || persistScheduled) return;
  persistScheduled = true;
  Promise.resolve().then(async () => {
    persistScheduled = false;
    // スケジュール後に clearRequestCache（ログアウト）が走った場合は書き込まない。
    if (persistUserId === null) return;
    try {
      await AsyncStorage.setItem(
        REQUEST_CACHE_KEY,
        JSON.stringify({ userId: persistUserId, entries: Object.fromEntries(cache) }),
      );
    } catch {
      // silent
    }
  });
}

export function getCached<T>(key: string): T | undefined {
  return cache.has(key) ? (cache.get(key) as T) : undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
  schedulePersist();
}

// AsyncStorage に永続化したエントリをメモリ Map へ一括復元する。起動時（RecordScreen
// マウント時）に fire-and-forget で呼ぶ。InsightScreen 初回マウント前に完了していれば
// 即表示が効き、間に合わなければ従来挙動（ネットワーク待ち）へ自然フォールバックする。
// メモリ Map に既にあるキーは上書きしない（hydrate がネットワーク応答より後に完了した
// 場合に、新鮮なデータを古い永続キャッシュで潰さないためのレース対策。logsCache と同じ）。
export async function hydrateRequestCache(userId: string): Promise<void> {
  // userId は同期的に確定させ、以降の setCached の永続化を有効にする。
  persistUserId = userId;
  try {
    const raw = await AsyncStorage.getItem(REQUEST_CACHE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return;
    const v = parsed as Record<string, unknown>;
    if (v.userId !== userId) return; // 別ユーザーの永続データは破棄
    if (typeof v.entries !== "object" || v.entries === null || Array.isArray(v.entries)) return;
    for (const [key, value] of Object.entries(v.entries)) {
      if (!cache.has(key)) cache.set(key, value);
    }
  } catch {
    // 壊れた JSON はキャッシュ無し扱い（次の setCached で正常な内容に上書きされる）
  }
}

// メモリ・AsyncStorage の両方を消す（ログアウト時に App.tsx の SIGNED_OUT から呼ばれる）。
// 呼び出し側を変えないよう同期シグネチャのまま、AsyncStorage 側は fire-and-forget で消す。
export function clearRequestCache(): void {
  cache.clear();
  persistUserId = null;
  AsyncStorage.removeItem(REQUEST_CACHE_KEY).catch(() => {});
}
