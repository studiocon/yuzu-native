import { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line as SvgLine, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { SENTIMENT_NEG, SENTIMENT_POS } from "../lib/sentimentColor";
import type { SentimentPoint } from "../lib/sentimentSeries";

const CHART_H = 160;
const PAD_X = 8;

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

  const line = ys.map((y, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(2)},${y.toFixed(2)}`).join("");
  const toArea = (vals: number[]) => {
    const body = vals.map((v, i) => `L${xs[i].toFixed(2)},${v.toFixed(2)}`).join("");
    return `M${xs[0].toFixed(2)},${zero}${body}L${xs[xs.length - 1].toFixed(2)},${zero}Z`;
  };
  return { line, posArea: toArea(posYs), negArea: toArea(negYs), zero };
}

// yuzu-app の SentimentChart.tsx を react-native-svg に移植（recharts の代わり）。
export default function EmotionChart({ data }: { data: SentimentPoint[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const paths = useMemo(() => (width > 0 ? buildPaths(data, width) : null), [data, width]);

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

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && paths && (
        <Svg width={width} height={CHART_H}>
          <Defs>
            <LinearGradient id="pos" x1="0" y1="0" x2="0" y2={CHART_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={SENTIMENT_POS} stopOpacity={0.62} />
              <Stop offset="0.5" stopColor={SENTIMENT_POS} stopOpacity={0.18} />
            </LinearGradient>
            <LinearGradient id="neg" x1="0" y1="0" x2="0" y2={CHART_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0.5" stopColor={SENTIMENT_NEG} stopOpacity={0.18} />
              <Stop offset="1" stopColor={SENTIMENT_NEG} stopOpacity={0.62} />
            </LinearGradient>
          </Defs>
          <SvgLine x1={0} y1={paths.zero} x2={width} y2={paths.zero} stroke={colors.inkMuted} strokeDasharray="4 4" strokeWidth={1} />
          <Path d={paths.posArea} fill="url(#pos)" />
          <Path d={paths.negArea} fill="url(#neg)" />
          <Path d={paths.line} stroke={colors.ink} strokeOpacity={0.3} strokeWidth={1.5} fill="none" />
        </Svg>
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
    setTooltipOpen(true);
    setTimeout(() => setTooltipOpen(false), 1800);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>EMOTION</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={[styles.filterLabel, styles.filterLabelActive]}>MONTH</Text>
          </View>
          <Pressable onPress={handleAllPress} style={styles.filterItem}>
            <Text style={styles.filterLabel}>ALL</Text>
            {tooltipOpen && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipLabel}>COMING SOON</Text>
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
  wrap: { height: CHART_H, width: "100%" },
  empty: { height: CHART_H, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  emptyLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: colors.inkMuted, letterSpacing: fontSize.sm * letterSpacing.widest },
  emptyMsg: { fontSize: fontSize.sm, color: colors.inkMuted },
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
  filterItem: { paddingVertical: 6, paddingHorizontal: 10 },
  filterLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  filterLabelActive: { color: colors.ink, textDecorationLine: "underline", textDecorationColor: colors.yuzuZest },
  tooltip: { position: "absolute", top: -28, right: 0, backgroundColor: colors.ink, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  tooltipLabel: { fontFamily: fonts.displayBold, fontSize: 9, color: colors.yuzuWhite, letterSpacing: 0.6 },
});
