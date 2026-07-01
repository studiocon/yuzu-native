import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { useApiGet } from "../lib/useApiGet";
import { computeSentimentSeries } from "../lib/sentimentSeries";
import { DAY_MS } from "../lib/period";
import { EmotionSection } from "./EmotionChart";
import TimeHeatmap from "./TimeHeatmap";
import WordBubbleMap from "./WordBubbleMap";
import RecurringThemes from "./RecurringThemes";
import ReportCard from "./ReportCard";
import ReportDetailModal from "./ReportDetailModal";
import type { Post } from "../lib/types";
import type { HeatmapCell, ReportMeta, Theme, WordFreq } from "../lib/insightTypes";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";
const SENTIMENT_WINDOW_MS = 30 * DAY_MS;

type Props = {
  posts: Post[];
  scores: Record<string, number>;
  accessToken: string;
};

export default function InsightScreen({ posts, scores, accessToken }: Props) {
  const [openReport, setOpenReport] = useState<string | null>(null);

  const emotionData = useMemo(() => {
    const cutoff = Date.now() - SENTIMENT_WINDOW_MS;
    const filtered = posts.filter((p) => p.createdAt >= cutoff);
    return computeSentimentSeries(filtered, scores);
  }, [posts, scores]);

  const words = useApiGet<WordFreq[]>(
    `${API_BASE}/api/insights/words`,
    accessToken,
    (r) => (Array.isArray(r.words) ? (r.words as WordFreq[]) : []),
  );
  const heatmap = useApiGet<HeatmapCell[]>(
    `${API_BASE}/api/insights/heatmap`,
    accessToken,
    (r) => (Array.isArray(r.cells) ? (r.cells as HeatmapCell[]) : []),
  );
  const themes = useApiGet<{ themes: Theme[]; notEnough: boolean }>(
    `${API_BASE}/api/insights/themes`,
    accessToken,
    (r) => ({ themes: Array.isArray(r.themes) ? (r.themes as Theme[]) : [], notEnough: r.notEnough === true }),
  );
  const reports = useApiGet<ReportMeta[]>(
    `${API_BASE}/api/reports?scope=all`,
    accessToken,
    (r) => (Array.isArray(r.reports) ? (r.reports as ReportMeta[]) : []),
  );

  // yuzu-app の InsightView と同じく、未生成かつ投稿ありのレポートを背景で先読み生成する
  // （fire-and-forget POST）。これでユーザーがカードをタップした時にはサーバ側キャッシュが
  // 温まっており、詳細モーダルの GET が即ヒットする。初回タップで生成待ち → タイムアウトで
  // 「失敗、話せ」になる問題（特に投稿数の多い MONTH）を防ぐ。
  const pregenFiredRef = useRef(false);
  useEffect(() => {
    if (pregenFiredRef.current || reports.data === null) return;
    const pending = reports.data.filter((m) => !m.generated && m.postCount > 0).slice(0, 4);
    if (pending.length === 0) return;
    pregenFiredRef.current = true;
    for (const m of pending) {
      fetch(`${API_BASE}/api/reports/${encodeURIComponent(m.periodKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ scores }),
      }).catch(() => {});
    }
  }, [reports.data, accessToken, scores]);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <EmotionSection data={emotionData} />

      <Section title="SIGNAL">
        {heatmap.error ? (
          <ErrorMsg message={heatmap.error} />
        ) : heatmap.data === null ? (
          <ActivityIndicator color={colors.inkMuted} />
        ) : (
          <TimeHeatmap cells={heatmap.data} />
        )}
      </Section>

      <Section title="WORDS">
        {words.error ? (
          <ErrorMsg message={words.error} />
        ) : words.data === null ? (
          <ActivityIndicator color={colors.inkMuted} />
        ) : (
          <WordBubbleMap words={words.data} />
        )}
      </Section>

      <Section title="PATTERN">
        {themes.error ? (
          <ErrorMsg message={themes.error} />
        ) : themes.data === null ? (
          <ActivityIndicator color={colors.inkMuted} />
        ) : themes.data.notEnough ? (
          <EmptyMsg message="もっと話せ、パターンが見えてくる" />
        ) : themes.data.themes.length === 0 ? (
          <EmptyMsg message="まだパターンがない" />
        ) : (
          <RecurringThemes themes={themes.data.themes} />
        )}
      </Section>

      <Section title="REPORTS">
        {reports.error ? (
          <ErrorMsg message={reports.error} />
        ) : reports.data === null ? (
          <ActivityIndicator color={colors.inkMuted} />
        ) : reports.data.length === 0 ? (
          <View style={styles.reportsEmpty}>
            <Text style={styles.reportsEmptyHeadline}>NOTHING TO READ YET</Text>
            <Text style={styles.reportsEmptyBody}>沈黙は記録されない、話せ</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {reports.data.map((meta) => (
              <ReportCard key={meta.periodKey} meta={meta} onPress={() => setOpenReport(meta.periodKey)} />
            ))}
          </View>
        )}
      </Section>

      <ReportDetailModal
        periodKey={openReport}
        accessToken={accessToken}
        scores={scores}
        onClose={() => setOpenReport(null)}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return <Text style={styles.errorMsg}>{message}</Text>;
}
function EmptyMsg({ message }: { message: string }) {
  return <Text style={styles.emptyMsg}>{message}</Text>;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: 140, gap: 0 },
  section: { gap: 10, paddingTop: 44 },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
    textTransform: "uppercase",
  },
  errorMsg: { fontSize: fontSize.base, color: colors.inkMuted },
  emptyMsg: { fontSize: fontSize.base, color: colors.inkMuted },
  reportsEmpty: { gap: spacing.xs, paddingVertical: spacing.lg },
  reportsEmptyHeadline: { fontFamily: fonts.displayBold, fontSize: fontSize.base, color: colors.ink, letterSpacing: fontSize.base * letterSpacing.wide },
  reportsEmptyBody: { fontSize: fontSize.sm, color: colors.inkMuted },
});
