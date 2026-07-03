import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { useApiGet } from "../lib/useApiGet";
import { computeSentimentSeries } from "../lib/sentimentSeries";
import { DAY_MS } from "../lib/period";
import { EmotionSection } from "./EmotionChart";
import TimeHeatmap, { TimeHeatmapSkeleton } from "./TimeHeatmap";
import WordBubbleMap, { WordBubbleMapSkeleton } from "./WordBubbleMap";
import RecurringThemes, { RecurringThemesSkeleton } from "./RecurringThemes";
import ReportCard, { ReportCardSkeleton } from "./ReportCard";
import ReportDetailModal from "./ReportDetailModal";
import type { Post } from "../lib/types";
import type { HeatmapCell, ReportMeta, Theme, WordFreq } from "../lib/insightTypes";

const SENTIMENT_WINDOW_MS = 30 * DAY_MS;
// REPORTS の生成待ちポーリング間隔・上限（サーバの非同期生成が終わるのを黙って待つ）。
const REPORTS_POLL_INTERVAL_MS = 5000;
const REPORTS_POLL_TIMEOUT_MS = 2 * 60 * 1000;

type Props = {
  posts: Post[];
  scores: Record<string, number>;
  words: { data: WordFreq[] | null; error: string | null };
};

export default function InsightScreen({ posts, scores, words }: Props) {
  const [openReport, setOpenReport] = useState<string | null>(null);

  const emotionData = useMemo(() => {
    const cutoff = Date.now() - SENTIMENT_WINDOW_MS;
    const filtered = posts.filter((p) => p.createdAt >= cutoff);
    return computeSentimentSeries(filtered, scores);
  }, [posts, scores]);

  const heatmap = useApiGet<HeatmapCell[]>(
    `${API_BASE}/api/insights/heatmap`,
    (r) => (Array.isArray(r.cells) ? (r.cells as HeatmapCell[]) : []),
  );
  const themes = useApiGet<{ themes: Theme[]; notEnough: boolean }>(
    `${API_BASE}/api/insights/themes`,
    (r) => ({ themes: Array.isArray(r.themes) ? (r.themes as Theme[]) : [], notEnough: r.notEnough === true }),
  );
  // REPORTS 一覧は独自管理（useApiGet だとポーリングの度に data が null に戻ってスケルトンへ
  // 戻ってしまうため、既存データを保持したまま裏で再取得できるよう手書きする）。
  const [reportsData, setReportsData] = useState<ReportMeta[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const fetchReports = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/reports?scope=all`);
      if (!res.ok) {
        setReportsError("失敗、話せ");
        return;
      }
      const data = await res.json();
      setReportsData(Array.isArray(data.reports) ? data.reports : []);
      setReportsError(null);
    } catch {
      setReportsError("失敗、話せ");
    }
  }, []);
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const pendingCount = useMemo(
    () => (reportsData ?? []).filter((m) => !m.generated && m.postCount > 0).length,
    [reportsData],
  );

  // yuzu-app の InsightView と同じく、未生成かつ投稿ありのレポートを背景で先読み生成する
  // （fire-and-forget POST。サーバは即 202 を返しバックグラウンドで生成を続ける）。
  // これでユーザーがカードをタップした時にはキャッシュが温まっており、詳細モーダルの GET が即ヒットする。
  const pregenFiredRef = useRef(false);
  useEffect(() => {
    if (pregenFiredRef.current || reportsData === null) return;
    const pending = reportsData.filter((m) => !m.generated && m.postCount > 0).slice(0, 4);
    if (pending.length === 0) return;
    pregenFiredRef.current = true;
    for (const m of pending) {
      apiFetch(`${API_BASE}/api/reports/${encodeURIComponent(m.periodKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      }).catch(() => {});
    }
  }, [reportsData, scores]);

  // 生成待ちが残っている間は、カードが完了状態に切り替わるのを裏で定期的に確認する。
  // タブを離れずに待てるように（＝バッジ表示のまま自然に更新される）。上限を超えたら止める。
  useEffect(() => {
    if (pendingCount === 0) return;
    const interval = setInterval(fetchReports, REPORTS_POLL_INTERVAL_MS);
    const timeout = setTimeout(() => clearInterval(interval), REPORTS_POLL_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingCount, fetchReports]);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <EmotionSection data={emotionData} />

      <Section title="SIGNAL">
        {heatmap.error ? (
          <ErrorMsg message={heatmap.error} />
        ) : heatmap.data === null ? (
          <TimeHeatmapSkeleton />
        ) : (
          <TimeHeatmap cells={heatmap.data} />
        )}
      </Section>

      <Section title="WORDS">
        {words.error ? (
          <ErrorMsg message={words.error} />
        ) : words.data === null ? (
          <WordBubbleMapSkeleton />
        ) : (
          <WordBubbleMap words={words.data} />
        )}
      </Section>

      <Section title="PATTERN">
        {themes.error ? (
          <ErrorMsg message={themes.error} />
        ) : themes.data === null ? (
          <RecurringThemesSkeleton />
        ) : themes.data.notEnough ? (
          <EmptyMsg message="もっと話せ、パターンが見えてくる" />
        ) : themes.data.themes.length === 0 ? (
          <EmptyMsg message="まだパターンがない" />
        ) : (
          <RecurringThemes themes={themes.data.themes} />
        )}
      </Section>

      <Section title="REPORTS" badge={pendingCount > 0 ? `${pendingCount} GENERATING` : undefined}>
        {reportsError ? (
          <ErrorMsg message={reportsError} />
        ) : reportsData === null ? (
          <ReportCardSkeleton />
        ) : reportsData.length === 0 ? (
          <View style={styles.reportsEmpty}>
            <Text style={styles.reportsEmptyHeadline}>NOTHING TO READ YET</Text>
            <Text style={styles.reportsEmptyBody}>沈黙は記録されない、話せ</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {reportsData.map((meta) => (
              <ReportCard key={meta.periodKey} meta={meta} onPress={() => setOpenReport(meta.periodKey)} />
            ))}
          </View>
        )}
      </Section>

      <ReportDetailModal
        periodKey={openReport}
        scores={scores}
        onClose={() => setOpenReport(null)}
      />
    </ScrollView>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeLabel}>{badge}</Text>
          </View>
        )}
      </View>
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
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
    textTransform: "uppercase",
  },
  sectionBadge: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 9999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sectionBadgeLabel: {
    fontFamily: fonts.displayBold,
    fontSize: 10,
    color: colors.inkSecondary,
    letterSpacing: 10 * letterSpacing.wide,
  },
  errorMsg: { fontSize: fontSize.base, color: colors.inkMuted },
  emptyMsg: { fontSize: fontSize.base, color: colors.inkMuted },
  reportsEmpty: { gap: spacing.xs, paddingVertical: spacing.lg },
  reportsEmptyHeadline: { fontFamily: fonts.displayBold, fontSize: fontSize.base, color: colors.ink, letterSpacing: fontSize.base * letterSpacing.wide },
  reportsEmptyBody: { fontSize: fontSize.sm, color: colors.inkMuted },
});
