import { memo, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { seededHeights, voiceprintBarCount } from "../lib/voiceprint";
import { formatDuration } from "../lib/stats";
import { sentimentColor } from "../lib/sentimentColor";
import { useCountUp } from "../lib/useCountUp";
import { jstDateString, DAY_MS } from "../lib/period";
import type { Post } from "../lib/types";

const WEEKDAY_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type Filter = "all" | "marked";
type DayGroup = { key: string; label: string; posts: Post[] };
// FlatList 用にフラット化した行データ（区切り or 投稿カード）。
export type LogRowItem = { kind: "divider"; key: string; label: string } | { kind: "post"; key: string; post: Post };
type Row = LogRowItem;

function dividerLabel(dateKey: string, todayKey: string, yesterdayKey: string): string {
  if (dateKey === todayKey) return "TODAY";
  if (dateKey === yesterdayKey) return "YESTERDAY";
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}.${d} ${WEEKDAY_EN[dow]}`;
}

const Voiceprint = memo(function Voiceprint({ id, durationMs }: { id: string; durationMs: number }) {
  const bars = useMemo(() => {
    const barCount = voiceprintBarCount(durationMs);
    return barCount === null ? null : seededHeights(id, barCount);
  }, [id, durationMs]);
  if (!bars) return null;
  return (
    <View style={styles.voiceprint}>
      {bars.map((h, i) => (
        <View key={i} style={[styles.voiceprintBar, { height: Math.max(1, Math.round(h * 20)) }]} />
      ))}
    </View>
  );
});

const LogRow = memo(function LogRow({
  post,
  edgeColor,
  onPress,
}: {
  post: Post;
  edgeColor: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`#${post.index} を開く`}
      style={({ pressed }) => [styles.logRow, post.marked && styles.logRowMarked, pressed && styles.logRowPressed]}
    >
      {edgeColor && <View style={[styles.logEdge, { backgroundColor: edgeColor }]} />}
      <View style={styles.logRowHead}>
        <Text style={styles.logIndex}>#{String(post.index).padStart(3, "0")}</Text>
        {post.durationMs > 0 && <Text style={styles.logDuration}>{formatDuration(post.durationMs)}</Text>}
      </View>
      <Text style={styles.logText} numberOfLines={5}>{post.text}</Text>
      <Voiceprint id={post.id} durationMs={post.durationMs} />
    </Pressable>
  );
});

type Stats = { streak: number; totalCount: number; totalMinutes: number };

type Props = {
  logs: Post[];
  logsLoaded: boolean;
  stats: Stats | null;
  scores: Record<string, number>;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenDetail: (post: Post) => void;
  listRef: React.RefObject<FlatList<LogRowItem> | null>;
  listFooterPadding: number;
};

export default function LogScreen({
  logs,
  logsLoaded,
  stats,
  scores,
  refreshing,
  onRefresh,
  onOpenDetail,
  listRef,
  listFooterPadding,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const recordsUp = useCountUp(stats?.totalCount ?? 0, { delayMs: 150 });
  const minutesUp = useCountUp(stats?.totalMinutes ?? 0, { delayMs: 150 });
  const streakUp = useCountUp(stats?.streak ?? 0, { delayMs: 150 });

  const filteredPosts = useMemo(
    () => (filter === "marked" ? logs.filter((p) => p.marked) : logs),
    [logs, filter],
  );

  const groups = useMemo<DayGroup[]>(() => {
    const now = Date.now();
    const todayKey = jstDateString(now);
    const yesterdayKey = jstDateString(now - DAY_MS);
    const out: DayGroup[] = [];
    for (const p of filteredPosts) {
      const key = jstDateString(p.createdAt);
      const last = out[out.length - 1];
      if (!last || last.key !== key) {
        out.push({ key, label: dividerLabel(key, todayKey, yesterdayKey), posts: [p] });
      } else {
        last.posts.push(p);
      }
    }
    return out;
  }, [filteredPosts]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: "divider", key: `d-${g.key}`, label: g.label });
      for (const p of g.posts) out.push({ kind: "post", key: p.id, post: p });
    }
    return out;
  }, [groups]);

  return (
    <FlatList
      ref={listRef}
      contentContainerStyle={[styles.list, { paddingBottom: listFooterPadding }]}
      ListHeaderComponent={
        <View style={styles.header}>
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>RECORDS</Text>
                <Text style={styles.statValue}>{recordsUp}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>MINUTES</Text>
                <Text style={styles.statValue}>{minutesUp}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>STREAK</Text>
                <Text style={styles.statValue}>{streakUp}</Text>
              </View>
            </View>
          )}

          {logsLoaded ? (
            <View style={styles.recordsSectionHead}>
              <Text style={styles.sectionTitle}>RECORDS</Text>
              <View style={styles.filterRow}>
                <Pressable onPress={() => setFilter("all")} style={styles.filterItem}>
                  <Text style={[styles.filterLabel, filter === "all" && styles.filterLabelActive]}>ALL</Text>
                </Pressable>
                <Pressable onPress={() => setFilter("marked")} style={styles.filterItem}>
                  <Text style={[styles.filterLabel, filter === "marked" && styles.filterLabelActive]}>MARKED</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ActivityIndicator color={colors.inkMuted} style={styles.loadingIndicator} />
          )}

          {logsLoaded && filteredPosts.length === 0 && (
            <Text style={styles.empty}>{filter === "marked" ? "MARK されたものは無い" : "話せ"}</Text>
          )}
        </View>
      }
      data={rows}
      keyExtractor={(item) => item.key}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkMuted} colors={[colors.yuzuZest]} />
      }
      renderItem={({ item }) =>
        item.kind === "divider" ? (
          <View style={styles.divider}>
            <View style={styles.dividerDot} />
            <Text style={styles.dividerLabel}>{item.label}</Text>
          </View>
        ) : (
          <LogRow post={item.post} edgeColor={sentimentColor(scores[item.post.id])} onPress={() => onOpenDetail(item.post)} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: spacing.xl, gap: spacing.md },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  statsRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  statValue: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: colors.ink, lineHeight: fontSize.xxl },
  recordsSectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: spacing.xl,
  },
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
  loadingIndicator: { paddingTop: spacing.xl },
  empty: { fontSize: fontSize.base, color: colors.inkMuted, paddingTop: spacing.md },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.md },
  dividerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkMuted },
  dividerLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  logRow: {
    position: "relative",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  logRowMarked: { borderTopColor: colors.yuzuZest },
  logEdge: { position: "absolute", left: 0, top: spacing.md, bottom: spacing.md, width: 3, borderRadius: 2 },
  logRowPressed: { backgroundColor: colors.surfaceHover },
  logRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logIndex: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: colors.inkMuted, letterSpacing: fontSize.xs * letterSpacing.wide },
  logDuration: { fontFamily: fonts.displayRegular, fontSize: fontSize.xs, color: colors.inkMuted, letterSpacing: fontSize.xs * letterSpacing.wide },
  logText: { fontSize: fontSize.base, color: colors.ink, lineHeight: fontSize.base * 1.6 },
  voiceprint: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20, marginTop: 2, opacity: 0.45 },
  voiceprintBar: { flex: 1, minWidth: 1, backgroundColor: colors.inkMuted },
});
