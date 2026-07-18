import { useMemo, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { useSkeletonPulse } from "./Skeleton";
import * as haptics from "../lib/haptics";
import type { HeatmapCell } from "../lib/insightTypes";
import { buildDailyWeeks, type DailyCell } from "../lib/dailyHeatmap";

const ROWS = 7;
const CELL_GAP = 3;
const SKELETON_COLS = 12;

// GitHub 風のコントリビューションカレンダー。1マス=1日、列=週(日曜始まり)。
// TimeHeatmap（日×2時間バケット）の後継 — 時間帯という変化の乏しい軸を捨て、
// 日ごとの合計文字数という実際に変動する軸だけを見せる。
export function DailyHeatmapSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <View style={styles.grid}>
      {Array.from({ length: SKELETON_COLS }, (_, colIdx) => (
        <View key={colIdx} style={[styles.skeletonCol, colIdx === 0 && styles.skeletonColFirst]}>
          {Array.from({ length: ROWS }, (_, row) => (
            <Animated.View
              key={row}
              style={[styles.skeletonCell, row !== 0 && styles.skeletonCellSpaced, { opacity }]}
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
function monthLabel(date: string): string {
  const [, m] = date.split("-");
  return `${Number(m)}月`;
}

export default function DailyHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [hover, setHover] = useState<DailyCell | null>(null);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const { weeks, maxChars, hasAny } = useMemo(() => buildDailyWeeks(cells), [cells]);

  if (!hasAny) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyMsg}>まだ声がない</Text>
      </View>
    );
  }

  const cols = weeks.length;
  const cellSize = width > 0 ? (width - (cols - 1) * CELL_GAP) / cols : 0;

  // 月が変わった週の先頭付近（1〜7日目を含む列）にだけラベルを出す（GitHub の月ラベルと同じ考え方）。
  const monthLabels: { label: string; colIdx: number }[] = [];
  let lastMonth = "";
  weeks.forEach((week, colIdx) => {
    const first = week.find((c): c is DailyCell => c !== null);
    if (!first) return;
    const label = monthLabel(first.date);
    const day = Number(first.date.split("-")[2]);
    if (label !== lastMonth && day <= 7) {
      monthLabels.push({ label, colIdx });
      lastMonth = label;
    }
  });

  return (
    <View>
      <View style={styles.monthLabelRow}>
        {monthLabels.map(({ label, colIdx }) => (
          <Text
            key={colIdx}
            style={[styles.monthLabel, { left: cellSize > 0 ? colIdx * (cellSize + CELL_GAP) : 0 }]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View onLayout={onLayout} style={styles.grid}>
        {weeks.map((week, colIdx) => (
          <View key={colIdx} style={[styles.col, { width: cellSize, marginLeft: colIdx === 0 ? 0 : CELL_GAP }]}>
            {week.map((c, row) => {
              const marginTop = row === 0 ? 0 : CELL_GAP;
              if (!c) {
                return (
                  <View
                    key={row}
                    style={[styles.cell, styles.cellPad, { width: cellSize, height: cellSize, marginTop }]}
                  />
                );
              }
              const isEmpty = c.charCount === 0;
              const opacity = isEmpty ? 1 : 0.2 + (c.charCount / maxChars) * 0.8;
              return (
                <Pressable
                  key={row}
                  onPress={() => {
                    haptics.selectionChanged();
                    setHover(c);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtDateLabel(c.date)}の文字数を見る`}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      marginTop,
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

      {hover && (
        <Text style={styles.tooltip}>
          {fmtDateLabel(hover.date)} / {hover.charCount} CHARS
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row" },
  col: { flexDirection: "column" },
  cell: { borderRadius: 2 },
  cellPad: { backgroundColor: "transparent" },
  monthLabelRow: { height: 14, position: "relative", marginBottom: spacing.xs },
  monthLabel: { position: "absolute", fontFamily: fonts.displayBold, fontSize: 9, color: colors.inkMuted },
  tooltip: {
    marginTop: spacing.sm,
    fontFamily: fonts.displayBold,
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 10 * letterSpacing.wide,
  },
  emptyWrap: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkMuted },
  skeletonCol: { flex: 1, marginLeft: CELL_GAP },
  skeletonColFirst: { marginLeft: 0 },
  skeletonCell: { width: "100%", aspectRatio: 1, borderRadius: 2, backgroundColor: colors.divider },
  skeletonCellSpaced: { marginTop: CELL_GAP },
});
