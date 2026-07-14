// INSIGHT セクション共通の認証付き GET フェッチ。silent fail させない（失敗は error 文字列で返す）。
// モジュールレベルの requestCache（SWR）でヒットがあれば初期表示に使い、裏で再取得して差し替える。
// 再取得が失敗しても、既にデータを見せている場合は error に落とさずキャッシュ表示を維持する。
// url に null を渡すとフェッチをスキップする（起動直後の非クリティカルな通信を遅らせる用途）。
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "./apiFetch";
import { getCached, setCached } from "./requestCache";

export function useApiGet<T>(
  url: string | null,
  parse: (payload: Record<string, unknown>) => T,
  errorMessage = "失敗、話せ",
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(() => (url ? getCached<T>(url) ?? null : null));
  const [error, setError] = useState<string | null>(null);
  // 現在表示中のデータがキャッシュ由来 or 取得済みかどうか。true の間は再取得失敗を error に
  // 落とさない（既に見せているものを消さない）。
  const hasDataRef = useRef(url ? getCached<T>(url) !== undefined : false);

  useEffect(() => {
    if (url === null) {
      hasDataRef.current = false;
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const cached = getCached<T>(url);
    hasDataRef.current = cached !== undefined;
    setData(cached ?? null);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(url);
        if (!res.ok) {
          if (!cancelled && !hasDataRef.current) setError(errorMessage);
          return;
        }
        const payload = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        const parsed = parse(payload);
        setCached(url, parsed);
        hasDataRef.current = true;
        setData(parsed);
      } catch {
        if (!cancelled && !hasDataRef.current) setError(errorMessage);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, error };
}
