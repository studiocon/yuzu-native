// INSIGHT セクション共通の認証付き GET フェッチ。silent fail させない（失敗は error 文字列で返す）。
import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";

export function useApiGet<T>(
  url: string,
  parse: (payload: Record<string, unknown>) => T,
  errorMessage = "失敗、話せ",
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(url);
        if (!res.ok) {
          if (!cancelled) setError(errorMessage);
          return;
        }
        const payload = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        setData(parse(payload));
      } catch {
        if (!cancelled) setError(errorMessage);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, error };
}
