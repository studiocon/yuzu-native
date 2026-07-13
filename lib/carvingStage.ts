// CARVING 演出（録音後の待機画面 ~10s）の純ロジック。
// 過去ログ抜粋のティッカー・時間ベースのステップ進行・次の刻印番号（NEXT #NNN）を算出する。
// UI（アニメーション・タイマー駆動）とは分離し、ここでは決定的な計算のみを行う。
import type { Post } from "./types";

export type TickerEntry = { index: number; excerpt: string };

export const TICKER_MAX_ENTRIES = 6;
export const TICKER_EXCERPT_MAX_CHARS = 40;

// 改行・連続空白を単一スペースへ正規化して trim する。
// ティッカーは1行表示のため、元テキストの改行がレイアウトを壊さないようにする。
function normalizeExcerptText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// コードポイント単位（Array.from）で切ることで、絵文字などのサロゲートペアを分割しない。
// 切り詰めが発生した場合のみ末尾に … を付与する。
function truncateExcerpt(text: string, maxChars: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join("")}…`;
}

// ティッカーに流すエントリ列を作る。
// marked を新しい順で先頭にまとめ、続けて未 mark を新しい順で並べる（API の返却順には依存しない）。
// 空テキスト（正規化・trim後に空）は除外し、最大 TICKER_MAX_ENTRIES 件に絞る。
export function buildTickerEntries(posts: Post[]): TickerEntry[] {
  const byCreatedAtDesc = (a: Post, b: Post) => b.createdAt - a.createdAt;

  const marked = posts.filter((p) => p.marked).sort(byCreatedAtDesc);
  const unmarked = posts.filter((p) => !p.marked).sort(byCreatedAtDesc);

  const entries: TickerEntry[] = [];
  for (const post of [...marked, ...unmarked]) {
    const normalized = normalizeExcerptText(post.text);
    if (normalized === "") continue;
    entries.push({ index: post.index, excerpt: truncateExcerpt(normalized, TICKER_EXCERPT_MAX_CHARS) });
    if (entries.length >= TICKER_MAX_ENTRIES) break;
  }
  return entries;
}

// 次の刻印番号 = 既存記録の max(index)+1。
// 空配列なら null を返し、匿名/未取得時は NEXT 表示自体を隠せるようにする。
// posts の順序には依存しない（max を取るだけ）。
export function deriveNextIndex(posts: Post[]): number | null {
  if (posts.length === 0) return null;
  return Math.max(...posts.map((p) => p.index)) + 1;
}

// ステップ切り替えの経過時間しきい値（ms）。CARVING 演出は3段階で進行する。
export const CARVING_STEP_AT_MS = [0, 3500, 7000] as const;

// 経過msから現在のステップ（0|1|2）を返す。しきい値ちょうどは次のステップとして扱い、
// 巨大な経過時間（タイマーのズレ等）でも最終ステップに丸め込む。
export function stepForElapsed(elapsedMs: number): 0 | 1 | 2 {
  if (elapsedMs >= CARVING_STEP_AT_MS[2]) return 2;
  if (elapsedMs >= CARVING_STEP_AT_MS[1]) return 1;
  return 0;
}
