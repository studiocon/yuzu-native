import { useEffect, useRef, useState } from "react";
import { loadSentimentCache, saveSentimentCache } from "./sentimentCache";
import type { Post } from "./types";

// yuzu-app の analyze-sentiment と同じ 30 日ウィンドウ（それより古い投稿はスコア化しない）。
const SENTIMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ScorablePost = Pick<Post, "id" | "text" | "createdAt">;

/**
 * 感情スコア（-1.0〜1.0）を AsyncStorage からhydrateしつつ、未解析の投稿だけ
 * /api/analyze-sentiment に投げて埋める。スコアはDBに永続化されない装飾情報
 * （yuzu-app と同じ設計）なので、失敗しても呼び出し側のフローには影響させない。
 */
export function useSentimentScores(
  posts: ScorablePost[],
  apiBase: string,
  accessToken: string,
): Record<string, number> {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadSentimentCache().then((cached) => {
      if (!mountedRef.current) return;
      setScores(cached);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || posts.length === 0) return;
    const cutoff = Date.now() - SENTIMENT_WINDOW_MS;
    const unresolved = posts.filter((p) => p.createdAt >= cutoff && !(p.id in scores));
    if (unresolved.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/analyze-sentiment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            posts: unresolved.map((p) => ({ id: p.id, text: p.text, createdAt: p.createdAt })),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results: { postId: string; score: number }[] };
        if (cancelled || !mountedRef.current) return;
        setScores((prev) => {
          const next = { ...prev };
          for (const r of data.results) next[r.postId] = r.score;
          saveSentimentCache(next);
          return next;
        });
      } catch {
        // silent: 次回再試行（スコアはあくまで装飾、無くても致命ではない）
      }
    })();
    return () => {
      cancelled = true;
    };
    // posts は毎回新しい配列参照になるが、内容（未解析分のみ）に基づいて早期returnするので問題ない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, posts, apiBase, accessToken]);

  return scores;
}
