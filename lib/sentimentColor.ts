// yuzu-app の lib/sentimentColor.ts を移植。
// 感情スコア（-1.0〜1.0）→ 色 の共有スケール。SDK 非依存。
// 端点の色は yuzu-app の app/globals.css :root トークンと一致させること
// （ただし POS はネイティブ側の意図的差分。DESIGN.md 冒頭の差分リスト参照）。

/**
 * +1.0（最ポジ）側の端点色。--yuzu-yellow と一致。
 * yuzu-app 正典は --yuzu-zest (#E8A020) だが、ネイティブは SIGNAL ウィジェット・
 * ヒートマップと色言語を揃えるため YUZU イエローに意図的に乖離している。
 */
export const SENTIMENT_POS = "#F5D84A";
/** -1.0（最ネガ）側の端点色。--mood-low と一致（紺）。 */
export const SENTIMENT_NEG = "#2E3A66";
/** 0（凪）の中立色。強い感情が無い状態。 */
export const SENTIMENT_MID = "#B6B6C6";

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const NEG_RGB = hexToRgb(SENTIMENT_NEG);
const MID_RGB = hexToRgb(SENTIMENT_MID);
const POS_RGB = hexToRgb(SENTIMENT_POS);

/**
 * 感情スコアを色に写像する。
 * -1.0 = 紺 / 0 = 中立グレー / +1.0 = ゆず黄 を RGB 線形補間。
 * score が未定義・非数（解析前のカード）は null を返す → 呼び出し側でバーを出さない。
 */
export function sentimentColor(score: number | undefined | null): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const s = Math.max(-1, Math.min(1, score));
  const rgb = s >= 0 ? lerp(MID_RGB, POS_RGB, s) : lerp(MID_RGB, NEG_RGB, -s);
  return rgbToHex(rgb);
}
