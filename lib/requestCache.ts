// lib/useApiGet.ts 用のモジュールスコープ・メモリキャッシュ（SWR: stale-while-revalidate）。
// タブ切替のたびに InsightScreen がアンマウント→再マウントされ、useApiGet が毎回 data=null
// から始まってスケルトンに戻ってしまう問題を、直近のレスポンスをプロセスメモリに保持して
// 初期表示に使うことで解消する。永続化はしない（アプリ再起動時は従来通りネットワークから取得）。
//
// フックそのものは renderHook 環境が無くテストしづらいため、キャッシュの読み書きロジックを
// この純関数モジュールに切り出してユニットテストする。

const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.has(key) ? (cache.get(key) as T) : undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearRequestCache(): void {
  cache.clear();
}
