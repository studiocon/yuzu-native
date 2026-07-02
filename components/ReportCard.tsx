import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import { formatPeriodRange } from "../lib/period";
import { sentimentColor, SENTIMENT_NEG, SENTIMENT_POS } from "../lib/sentimentColor";
import Skeleton from "./Skeleton";
import * as haptics from "../lib/haptics";
import type { ReportMeta } from "../lib/insightTypes";

const SPARK_H = 40;
const SPARK_ZERO = SPARK_H / 2;
const SPARK_AMP = SPARK_H / 2 - 4;
const SPARK_W = 100;
const SKELETON_REPORT_COUNT = 3;

// yuzu-app の .report-card-skeleton（kind/label/headline block + chips行）を移植。
export function ReportCardSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: SKELETON_REPORT_COUNT }, (_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={60} height={10} />
          <Skeleton width="50%" height={18} />
          <Skeleton width="80%" height={14} />
          <View style={styles.skeletonChips}>
            <Skeleton width={60} height={22} radius={9999} />
            <Skeleton width={60} height={22} radius={9999} />
            <Skeleton width={60} height={22} radius={9999} />
          </View>
        </View>
      ))}
    </View>
  );
}

function buildSparkPaths(series: { score: number }[]) {
  if (series.length < 2) return null;
  const n = series.length;
  const xs = series.map((_, i) => (i / (n - 1)) * SPARK_W);
  const clamp = (s: number) => Math.max(-1, Math.min(1, s));
  const posYs = series.map((p) => SPARK_ZERO - Math.max(0, clamp(p.score)) * SPARK_AMP);
  const negYs = series.map((p) => SPARK_ZERO - Math.min(0, clamp(p.score)) * SPARK_AMP);
  const toArea = (vals: number[]) => {
    const lastX = xs[xs.length - 1].toFixed(2);
    const body = vals.map((v, i) => `L${xs[i].toFixed(2)},${v.toFixed(2)}`).join("");
    return `M${xs[0].toFixed(2)},${SPARK_ZERO}${body}L${lastX},${SPARK_ZERO}Z`;
  };
  return { posArea: toArea(posYs), negArea: toArea(negYs) };
}

// yuzu-app の ReportCard.tsx を移植。
export default function ReportCard({ meta, onPress }: { meta: ReportMeta; onPress: () => void }) {
  const kindLabel = meta.kind === "week" ? "WEEK" : "MONTH";
  const span = formatPeriodRange(meta.rangeStart, meta.rangeEnd, meta.kind);
  const series = meta.payload?.sentimentSeries ?? [];
  const avg = series.length > 0 ? series.reduce((s, p) => s + p.score, 0) / series.length : undefined;
  const edgeColor = sentimentColor(avg);
  const spark = buildSparkPaths(series);
  const posGradId = `spark-pos-${meta.periodKey}`;
  const negGradId = `spark-neg-${meta.periodKey}`;

  return (
    <Pressable
      onPress={() => {
        haptics.tapLight();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {edgeColor && <View style={[styles.edge, { backgroundColor: edgeColor }]} />}
      <View style={styles.head}>
        <Text style={[styles.kind, meta.kind === "month" && styles.kindFilled]}>{kindLabel}</Text>
        <Text style={styles.span}>{span}</Text>
      </View>
      {meta.headline && <Text style={styles.headline} numberOfLines={2}>{meta.headline}</Text>}
      {meta.topics && meta.topics.length > 0 && (
        <View style={styles.topics}>
          {meta.topics.slice(0, 3).map((t, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipLabel}>{t}</Text>
            </View>
          ))}
        </View>
      )}
      {spark && (
        <Svg width="100%" height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
          <Defs>
            <LinearGradient id={posGradId} x1="0" y1="0" x2="0" y2={SPARK_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={SENTIMENT_POS} stopOpacity={0.62} />
              <Stop offset="0.5" stopColor={SENTIMENT_POS} stopOpacity={0.18} />
            </LinearGradient>
            <LinearGradient id={negGradId} x1="0" y1="0" x2="0" y2={SPARK_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0.5" stopColor={SENTIMENT_NEG} stopOpacity={0.18} />
              <Stop offset="1" stopColor={SENTIMENT_NEG} stopOpacity={0.62} />
            </LinearGradient>
          </Defs>
          <Path d={spark.posArea} fill={`url(#${posGradId})`} />
          <Path d={spark.negArea} fill={`url(#${negGradId})`} />
        </Svg>
      )}
      {!meta.generated && (
        <Text style={styles.pending}>{meta.postCount} RECORDS · TAP TO READ</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    paddingLeft: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    borderRadius: radius.card,
  },
  cardPressed: { backgroundColor: colors.surfaceHover },
  edge: { position: "absolute", left: 0, top: spacing.md, bottom: spacing.md, width: 3, borderRadius: 2 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kind: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.ink,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  kindFilled: { backgroundColor: colors.ink, color: colors.yuzuWhite },
  span: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: colors.inkMuted },
  headline: { fontSize: fontSize.base, fontWeight: "700", color: colors.ink },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { backgroundColor: colors.surfaceHover, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  chipLabel: { fontSize: fontSize.xs, color: colors.inkSecondary },
  pending: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.wide,
  },
  skeletonList: { gap: spacing.md },
  skeletonCard: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
  },
  skeletonChips: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
