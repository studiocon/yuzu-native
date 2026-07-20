import { useEffect, useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { SENTIMENT_NEG, SENTIMENT_POS } from "../lib/sentimentColor";
import { WEEKDAY_JA } from "../lib/streak";
import * as haptics from "../lib/haptics";
import type { SentimentPoint } from "../lib/sentimentSeries";

const CHART_H = 160;
const PAD_X = 8;
const TOOLTIP_AUTO_HIDE_MS = 2500;
const TOOLTIP_W = 118;

// Mirror 原則: 感情を judging せず、状態を描写する短い言葉だけ返す（yuzu-app の SentimentChart.tsx と同じ基準）。
function scoreLabel(score: number): string {
  if (score >= 0.5) return "高い";
  if (score >= 0.15) return "上向き";
  if (score > -0.15) return "凪";
  if (score > -0.5) return "下向き";
  return "低い";
}

function formatPointDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = WEEKDAY_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${dow})`;
}

function buildPaths(data: SentimentPoint[], width: number) {
  const w = Math.max(1, width - PAD_X * 2);
  const n = data.length;
  const zero = CHART_H / 2;
  const amp = CHART_H / 2 - 8;
  const xs = data.map((_, i) => PAD_X + (n === 1 ? w / 2 : (i / (n - 1)) * w));
  const clamp = (s: number) => Math.max(-1, Math.min(1, s));
  const ys = data.map((d) => zero - clamp(d.score) * amp);
  const posYs = data.map((d) => zero - Math.max(0, clamp(d.score)) * amp);
  const negYs = data.map((d) => zero - Math.min(0, clamp(d.score)) * amp);

  const toArea = (vals: number[]) => {
    const body = vals.map((v, i) => `L${xs[i].toFixed(2)},${v.toFixed(2)}`).join("");
    return `M${xs[0].toFixed(2)},${zero}${body}L${xs[xs.length - 1].toFixed(2)},${zero}Z`;
  };
  const points = data.map((d, i) => ({ x: xs[i], y: ys[i], date: d.date, score: d.score }));
  return { posArea: toArea(posYs), negArea: toArea(negYs), points };
}

function clampTooltipLeft(x: number, width: number): number {
  return Math.min(Math.max(x - TOOLTIP_W / 2, 4), Math.max(4, width - TOOLTIP_W - 4));
}

// yuzu-app の SentimentChart.tsx を react-native-svg に移植（recharts の代わり）。
// hover の代わりに、タップした点に一番近いデータ点を選んでツールチップを出す。
export default function EmotionChart({ data }: { data: SentimentPoint[] }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // data.length < 2 のガードは後段の early return にもあるが、useMemo はその手前で
  // 無条件に走るため、ここでも同じ条件を課さないと buildPaths が空配列で呼ばれて
  // toArea 内の xs[0].toFixed(2) が undefined に対して例外を投げる（投稿0件でINSIGHTタブを
  // 開いた直後にクラッシュしていた実バグ。Sentry issue: TypeError: Cannot read property
  // 'toFixed' of undefined, in toArea/buildPaths）。
  const paths = useMemo(
    () => (width > 0 && data.length >= 2 ? buildPaths(data, width) : null),
    [data, width],
  );

  useEffect(() => setSelected(null), [data]);
  useEffect(() => {
    if (selected === null) return;
    const t = setTimeout(() => setSelected(null), TOOLTIP_AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [selected]);

  function handleChartPress(e: GestureResponderEvent) {
    if (!paths || paths.points.length === 0) return;
    const x = e.nativeEvent.locationX;
    let nearest = 0;
    let nearestDist = Infinity;
    paths.points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    haptics.selectionChanged();
    setSelected(nearest);
  }

  if (data.length === 0) {
    return (
      <View style={styles.empty} onLayout={onLayout}>
        <Text style={styles.emptyLabel}>SILENCE</Text>
        <Text style={styles.emptyMsg}>声紋が無い</Text>
      </View>
    );
  }
  if (data.length < 2) {
    return (
      <View style={styles.empty} onLayout={onLayout}>
        <Text style={styles.emptyLabel}>SPARSE</Text>
        <Text style={styles.emptyMsg}>声紋が 1 日分のみ、続けろ</Text>
      </View>
    );
  }

  const activePoint = selected !== null ? paths?.points[selected] : undefined;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && paths && (
        <Pressable onPress={handleChartPress} accessibilityLabel="日別の気分を見る" accessibilityRole="adjustable">
          <Svg width={width} height={CHART_H}>
            {/* ゼロラインに近づくほど薄くなる縦グラデ（yuzu-app と同構造）。
                POS はイエロー（#F5D84A）が薄いと背景に溶けるため、正典の 0.62→0.18 より
                濃い 0.85→0.22 に調整している（DESIGN.md 冒頭の意図的差分リスト参照）。 */}
            <Defs>
              <LinearGradient id="pos" x1="0" y1="0" x2="0" y2={CHART_H} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={SENTIMENT_POS} stopOpacity={0.85} />
                <Stop offset="0.5" stopColor={SENTIMENT_POS} stopOpacity={0.22} />
              </LinearGradient>
              <LinearGradient id="neg" x1="0" y1="0" x2="0" y2={CHART_H} gradientUnits="userSpaceOnUse">
                <Stop offset="0.5" stopColor={SENTIMENT_NEG} stopOpacity={0.18} />
                <Stop offset="1" stopColor={SENTIMENT_NEG} stopOpacity={0.62} />
              </LinearGradient>
            </Defs>
            <Path d={paths.posArea} fill="url(#pos)" />
            <Path d={paths.negArea} fill="url(#neg)" />
            {activePoint && <Circle cx={activePoint.x} cy={activePoint.y} r={5} fill={colors.ink} />}
          </Svg>
        </Pressable>
      )}
      {activePoint && (
        <View
          pointerEvents="none"
          style={[
            styles.pointTooltip,
            { left: clampTooltipLeft(activePoint.x, width), top: Math.max(0, activePoint.y - 44) },
          ]}
        >
          <Text style={styles.pointTooltipDate}>{formatPointDate(activePoint.date)}</Text>
          <Text style={styles.pointTooltipLabel}>気分・{scoreLabel(activePoint.score)}</Text>
        </View>
      )}
    </View>
  );
}

type Props = {
  data: SentimentPoint[];
};

export function EmotionSection({ data }: Props) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  function handleAllPress() {
    haptics.warning();
    setTooltipOpen(true);
    setTimeout(() => setTooltipOpen(false), 1800);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>EMOTION</Text>
        <View style={styles.filterRow}>
          <View style={[styles.filterItem, styles.filterItemActive]}>
            <Text style={[styles.filterLabel, styles.filterLabelActive]}>MONTH</Text>
          </View>
          <Pressable
            onPress={handleAllPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ALL（近日対応）"
            style={styles.filterItem}
          >
            <Text style={styles.filterLabel}>ALL</Text>
            {tooltipOpen && (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipLabel} numberOfLines={1}>COMING SOON</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <EmotionChart data={data} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: CHART_H, width: "100%", position: "relative" },
  pointTooltip: {
    position: "absolute",
    width: TOOLTIP_W,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pointTooltipDate: { fontFamily: fonts.displayBold, fontSize: 9, color: "rgba(255,255,255,0.6)" },
  pointTooltipLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.yuzuWhite },
  empty: { height: CHART_H, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  emptyLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: colors.inkMuted, letterSpacing: fontSize.sm * letterSpacing.widest },
  emptyMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkMuted },
  section: { gap: 10, paddingTop: 44 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
    textTransform: "uppercase",
  },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterItem: { paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  filterItemActive: { borderBottomColor: colors.yuzuZest },
  filterLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  filterLabelActive: { color: colors.ink },
  tooltip: {
    position: "absolute",
    top: -32,
    right: -8,
    width: 112,
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tooltipLabel: { fontFamily: fonts.displayBold, fontSize: 9, color: colors.yuzuWhite, letterSpacing: 0.6 },
});
