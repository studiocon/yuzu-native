// yuzu-app の lib/highlightWords.ts を移植。AI は使わず、INSIGHT の WORDS（頻出語トップ20）に
// 入っている語のうち、その RECORD の本文に実際に出現する語だけを強調するための純ロジック。
// native は topWords が常に配線される前提なので、web にある「未配線時の記録単体フォールバック」は持たない。

const CONTENT_CHAR = /[\p{Script=Han}\p{Script=Katakana}]/u;

// 単漢字1文字はノイズが過ぎるので、2文字以上かつ漢字/カタカナを含む語だけをハイライト対象にする。
const isHighlightable = (w: string): boolean => w.length >= 2 && CONTENT_CHAR.test(w);

export function recordWords(text: string, globalWords: Set<string>): Set<string> {
  if (!text || globalWords.size === 0) return new Set();
  const hits = new Set<string>();
  for (const w of globalWords) {
    if (isHighlightable(w) && text.includes(w)) hits.add(w);
  }
  return hits;
}

export type HighlightSegment = { text: string; mark: boolean };

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 段落文字列を、ハイライト対象語にマッチする区間（mark=true）としない区間（mark=false）の
// セグメント配列に分解する。長い語を優先してマッチさせ、重なりは飲み込む。
export function splitHighlights(text: string, words: Set<string>): HighlightSegment[] {
  if (!text) return [];
  if (words.size === 0) return [{ text, mark: false }];

  const sorted = [...words].filter((w) => w.length > 0).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [{ text, mark: false }];

  const re = new RegExp(sorted.map(escapeRegExp).join("|"), "g");

  const segments: HighlightSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index === re.lastIndex) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) segments.push({ text: text.slice(last, m.index), mark: false });
    segments.push({ text: m[0], mark: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), mark: false });
  return segments.length > 0 ? segments : [{ text, mark: false }];
}
