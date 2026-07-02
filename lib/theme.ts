// Design tokens — mirrors studiocon/yuzu-app (DESIGN.md / app/globals.css :root).
// yuzu-app が Source of Truth。値を変えるときは向こうの DESIGN.md と揃えること。

export const colors = {
  // YUZU Primary
  yuzuYellow: "#F5D84A", // ゆず黄：信号色・アクセント（デフォルト状態）
  yuzuZest: "#E8A020", // 完熟オレンジ：録音中・強調
  yuzuWhite: "#FAFAF5", // オフホワイト：背景単色

  // Text
  ink: "#1A1A2E",
  inkSecondary: "#4A4A6A",
  inkMuted: "#9A9ABA",

  // Surface
  surfaceCard: "#FFFFFF",
  surfaceBorder: "#E8E0C8",
  surfaceHover: "#FFF5CC",
  divider: "#EDEAE0",
  iconBg: "rgba(26, 26, 46, 0.06)",
  moodLow: "#2E3A66",

  danger: "#C0392B",
} as const;

// 角丸は最小限。0 / 2px(card) / 9999px(pill) のみ。ボタン類の 4px だけ個別。
export const radius = {
  none: 0,
  card: 2,
  button: 4,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// タイポ段階: xs(11) / sm(13) / base(15) / lg(18) / xl(24) / 2xl(32) / 3xl(48)
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// letter-spacing は em 指定が無いので fontSize に掛けて px 換算する側で使う比率
export const letterSpacing = {
  tight: -0.02,
  normal: 0,
  wide: 0.06,
  wider: 0.08,
  widest: 0.12,
  label: 0.16,
} as const;

// Unbounded＝英字・ロゴ・タブラベル・スタッツ数値・状態ラベル。
// LINE Seed JP はネイティブ未バンドル（フォントファイル未取得）のため、
// 日本語本文は当面システムフォント（San Francisco / Roboto）にフォールバックする。
export const fonts = {
  displayBlack: "Unbounded_900Black", // ロゴ
  displayBold: "Unbounded_700Bold", // タグライン・ラベル・ボタン・スタッツ数値
  displayRegular: "Unbounded_400Regular", // タイムスタンプ等
  body: undefined, // 未指定 = OS 標準（System / Roboto）
} as const;

// CSS の cubic-bezier と同じ4値。react-native の Easing.bezier(...) にそのまま渡せる。
export const easingCurves = {
  organic: [0.34, 1.56, 0.64, 1] as const, // 少しバウンス
  soft: [0.25, 0.46, 0.45, 0.94] as const, // なめらか
  snap: [0.68, -0.55, 0.27, 1.55] as const, // パッと反応
};

// box-shadow は使わない（DESIGN.md §5）。階層は罫線と余白だけで作る。
// 例外：録音アフォーダンス（TabBar / RecordFab）のみ Liquid Glass 質感を許容。
// yuzu-app の box-shadow（0 10px 30px rgba(...,0.10), 0 2px 8px rgba(...,0.06)）を
// RN の単一 shadow プロパティで近似した薄めの版。TabBar/RecordFab で共有する。
export const recordingGlowShadow = {
  shadowColor: "#1A1A30",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 4,
} as const;
