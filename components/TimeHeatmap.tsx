import { useMemo, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { useSkeletonPulse } from "./Skeleton";
import * as haptics from "../lib/haptics";
import type { HeatmapCell } from "../lib/insightTypes";

const BUCKETS = 12;
const DATE_LABEL_EVERY = 7;
const SKELETON_COLS = 28;

// yuzu-app の .time-heatmap-cell--skeleton（grid 形の読み込み中 placeholder）を移植。
export function TimeHeatmapSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View style={styles.grid}>
      {Array.from({ length: SKELETON_COLS }, (_, colIdx) => (
        <View key={colIdx} style={[styles.col, styles.skeletonCol, colIdx === 0 && styles.skeletonColFirst]}>
          {Array.from({ length: BUCKETS }, (_, bucket) => (
            <Animated.View
              key={bucket}
              style={[styles.skeletonCell, bucket !== 0 && styles.skeletonCellSpaced, { opacity }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function fmtDateLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${m}/${d}`;
}
function fmtHour(h: number): string {
  return h.toString().padStart(2, "0");
}

// yuzu-app の TimeHeatmap.tsx を移植。28日 x 12バケット(2時間刻み)の CSS Grid → RN の行/列 View。
export default function TimeHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [hover, setHover] = useState<HeatmapCell | null>(null);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const { maxChars, dates, hasAny, grid } = useMemo(() => {
    if (cells.length === 0) return { maxChars: 0, dates: [] as string[], hasAny: false, grid: new Map<string, HeatmapCell>() };
    let max = 0;
    let any = false;
    const dateSet = new Set<string>();
    const g = new Map<string, HeatmapCell>();
    for (const c of cells) {
      dateSet.add(c.date);
      g.set(`${c.date}|${c.bucket}`, c);
      if (c.charCount > max) max = c.charCount;
      if (c.charCount > 0) any = true;
    }
    return { maxChars: max, dates: [...dateSet], hasAny: any, grid: g };
  }, [cells]);

  if (!hasAny) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyMsg}>まだ声がない</Text>
      </View>
    );
  }

  const cols = dates.length;
  const cellSize = width > 0 ? (width - (cols - 1) * 2) / cols : 0;

  return (
    <View>
      <View onLayout={onLayout} style={styles.grid}>
        {dates.map((date, colIdx) => (
          <View key={date} style={[styles.col, { width: cellSize, marginLeft: colIdx === 0 ? 0 : 2 }]}>
            {Array.from({ length: BUCKETS }, (_, bucket) => {
              const c = grid.get(`${date}|${bucket}`);
              const charCount = c?.charCount ?? 0;
              const isEmpty = charCount === 0;
              const opacity = isEmpty ? 1 : 0.2 + (charCount / maxChars) * 0.8;
              return (
                <Pressable
                  key={bucket}
                  onPress={() => {
                    haptics.selectionChanged();
                    setHover(c ?? { date, bucket, charCount: 0 });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtDateLabel(date)} ${fmtHour(bucket * 2)}時台の文字数を見る`}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      marginTop: bucket === 0 ? 0 : 2,
                      backgroundColor: isEmpty ? colors.divider : colors.yuzuYellow,
                      opacity,
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.dateLabelRow}>
        {dates.map((date, i) =>
          i % DATE_LABEL_EVERY === 0 ? (
            <Text key={date} style={[styles.dateLabel, { left: cellSize > 0 ? i * (cellSize + 2) : 0 }]}>
              {fmtDateLabel(date)}
            </Text>
          ) : null,
        )}
      </View>

      {hover && (
        <Text style={styles.tooltip}>
          {fmtDateLabel(hover.date)} {fmtHour(hover.bucket * 2)}:00 / {hover.charCount} CHARS
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row" },
  col: { flexDirection: "column" },
  cell: { borderRadius: 2 },
  dateLabelRow: { height: 14, position: "relative", marginTop: spacing.xs },
  dateLabel: { position: "absolute", fontFamily: fonts.displayBold, fontSize: 9, color: colors.inkMuted },
  tooltip: {
    marginTop: spacing.sm,
    fontFamily: fonts.displayBold,
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 10 * letterSpacing.wide,
  },
  emptyWrap: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyMsg: { fontSize: fontSize.base, color: colors.inkMuted },
  skeletonCol: { flex: 1, marginLeft: 2 },
  skeletonColFirst: { marginLeft: 0 },
  skeletonCell: { width: "100%", aspectRatio: 1, borderRadius: 2, backgroundColor: colors.divider },
  skeletonCellSpaced: { marginTop: 2 },
});
