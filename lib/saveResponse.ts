// POST /api/records の成功レスポンス（{ post: { index, durationMs, char_count, ... }, streak, ... }）を
// 安全にパースする。lib/dailyLimit.ts の statsPatchFromResponse と同じ流儀：
// 「サーバは ok を返した＝保存は成功している」を前提に、body の形状が壊れていても
// 例外を投げず、取れるフィールドだけ拾う。
//
// components/RecordScreen.tsx の handleTranscribed / pending record 復元パスは、どちらも
// `saveData.post.index` に形状ガードが無く、saveRes.ok が true でも body に post が無い
// （またはネットワーク越しに壊れた JSON が返る）と TypeError で catch に落ち、実際は
// 保存済みなのに「送れなかった。もう一度。」の失敗表示になっていた（#14）。ok の応答は
// 常に保存成功として扱い、index が取れなければ 0 にフォールバックする
// （呼び出し側の fetchLogs() が直後に走り、正しい index へ補正される）。
export type ParsedSavedPost = {
  index: number;
  durationMs: number | null;
  charCount: number | null;
};

export function parseSaveResponse(data: unknown): ParsedSavedPost {
  const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const post =
    typeof root.post === "object" && root.post !== null ? (root.post as Record<string, unknown>) : {};
  return {
    index: typeof post.index === "number" ? post.index : 0,
    durationMs: typeof post.durationMs === "number" ? post.durationMs : null,
    charCount: typeof post.char_count === "number" ? post.char_count : null,
  };
}
