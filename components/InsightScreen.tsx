import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { colors, fontSize, fonts, letterSpacing, spacing } from "../lib/theme";
import { useApiGet } from "../lib/useApiGet";
import { getCached, setCached } from "../lib/requestCache";
import { computeSentimentSeries } from "../lib/sentimentSeries";
import { DAY_MS } from "../lib/period";
import { EmotionSection } from "./EmotionChart";
import DailyHeatmap, { DailyHeatmapSkeleton } from "./DailyHeatmap";
import WordBubbleMap, { WordBubbleMapSkeleton } from "./WordBubbleMap";
import RecurringThemes, { RecurringThemesSkeleton } from "./RecurringThemes";
import ReportCard, { ReportCardSkeleton } from "./ReportCard";
import ReportDetailModal from "./ReportDetailModal";
import { isReportUnread, loadSeenKeys, markReportSeen, saveSeenKeys } from "../lib/reportSeen";
import { buildMockHeatmapCells, buildMockReportMetas, MOCK_THEMES } from "../lib/mockData";
import type { Post } from "../lib/types";
import { MIN_POSTS_FOR_THEMES, type HeatmapCell, type ReportMeta, type Theme, type WordFreq } from "../lib/insightTypes";

const SENTIMENT_WINDOW_MS = 30 * DAY_MS;
// REPORTS の生成待ちポーリング間隔・上限（サーバの非同期生成が終わるのを黙って待つ）。
const REPORTS_POLL_INTERVAL_MS = 5000;
const REPORTS_POLL_TIMEOUT_MS = 2 * 60 * 1000;
// REPORTS 一覧の requestCache キー。useApiGet 系（heatmap/themes/words）と同じく URL 文字列。
const REPORTS_URL = `${API_BASE}/api/reports?scope=all`;

type Props = {
  posts: Post[];
  scores: Record<string, number>;
  words: { data: WordFreq[] | null; error: string | null };
  mockOn: boolean;
};

export default function InsightScreen({ posts, scores, words, mockOn }: Props) {
  const [openReport, setOpenReport] = useState<string | null>(null);

  // 既読 periodKey の集合（null=未ロード。未ロード中はチラつき防止のため未読バッジを出さない）。
  const [seenKeys, setSeenKeys] = useState<Set<string> | null>(null);
  // ストレージ読み出し自体が完了したか（seenKeys が null のままでも「未ロード」と
  // 「読んだ結果が null＝要seed」を区別する必要がある。ref だと読み出し結果が null の場合
  // setSeenKeys(null) が前回と同値のため再レンダーが起きず、下の seed effect の再評価も
  // 起きないことがあるため、必ず再レンダーを起こす state として持つ）。
  const [seenLoaded, setSeenLoaded] = useState(false);
  useEffect(() => {
    loadSeenKeys().then((keys) => {
      setSeenLoaded(true);
      setSeenKeys(keys);
    });
  }, []);

  const emotionData = useMemo(() => {
    const cutoff = Date.now() - SENTIMENT_WINDOW_MS;
    const filtered = posts.filter((p) => p.createdAt >= cutoff);
    return computeSentimentSeries(filtered, scores);
  }, [posts, scores]);

  const heatmapFetch = useApiGet<HeatmapCell[]>(
    mockOn ? null : `${API_BASE}/api/insights/heatmap`,
    (r) => (Array.isArray(r.cells) ? (r.cells as HeatmapCell[]) : []),
  );
  const heatmap = mockOn
    ? { data: buildMockHeatmapCells(posts), error: null }
    : heatmapFetch;
  const themesFetch = useApiGet<{ themes: Theme[]; notEnough: boolean }>(
    mockOn ? null : `${API_BASE}/api/insights/themes`,
    (r) => ({ themes: Array.isArray(r.themes) ? (r.themes as Theme[]) : [], notEnough: r.notEnough === true }),
  );
  const themes = mockOn
    ? { data: { themes: MOCK_THEMES, notEnough: posts.length < MIN_POSTS_FOR_THEMES }, error: null }
    : themesFetch;
  // REPORTS 一覧は独自管理（useApiGet だとポーリングの度に data が null に戻ってスケルトンへ
  // 戻ってしまうため、既存データを保持したまま裏で再取得できるよう手書きする）。
  // 初期値は requestCache から取り（SWR）、タブ切替の再マウントでスケルトンに戻さない。
  const [reportsData, setReportsData] = useState<ReportMeta[] | null>(
    () => getCached<ReportMeta[]>(REPORTS_URL) ?? null,
  );
  const [reportsError, setReportsError] = useState<string | null>(null);
  // 表示中のデータがある（キャッシュ由来 or 取得済み）間は、再取得失敗を error に落とさず
  // キャッシュ表示を維持する（useApiGet と同じ方針）。
  const reportsHasDataRef = useRef(reportsData !== null);
  // ネットワーク応答由来の reportsData が入ったか。キャッシュ由来の stale データで
  // pregen（先読み POST）・既読 seed を発火させないためのゲート。
  const [reportsNetworkLoaded, setReportsNetworkLoaded] = useState(false);
  const fetchReports = useCallback(async () => {
    if (mockOn) {
      const reports = buildMockReportMetas();
      reportsHasDataRef.current = true;
      setReportsData(reports);
      setReportsError(null);
      setReportsNetworkLoaded(true);
      return;
    }
    try {
      const res = await apiFetch(REPORTS_URL);
      if (!res.ok) {
        if (!reportsHasDataRef.current) setReportsError("失敗、話せ");
        return;
      }
      const data = await res.json();
      const reports: ReportMeta[] = Array.isArray(data.reports) ? data.reports : [];
      setCached(REPORTS_URL, reports);
      reportsHasDataRef.current = true;
      setReportsData(reports);
      setReportsError(null);
      setReportsNetworkLoaded(true);
    } catch {
      if (!reportsHasDataRef.current) setReportsError("失敗、話せ");
    }
  }, [mockOn]);
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const pendingCount = useMemo(
    () => (reportsData ?? []).filter((m) => !m.generated && m.postCount > 0).length,
    [reportsData],
  );

  // 既読ストレージが未作成（＝キー未作成で null）だった場合の初期シード。
  // レポート一覧・ストレージ読み出しの両方が確定した最初のタイミングで、現在 generated な
  // 全 periodKey を既読として書き込む。狙い: 機能追加アップデート直後に既存レポートが
  // 全部 NEW になるのを防ぐ（新規ユーザーはレポートが無いので空 seed で無害）。
  // キャッシュ由来の stale な一覧で seed すると、キャッシュ取得後に生成されたレポートの
  // 既読が漏れる（永遠に NEW のまま等のずれ）ため、ネットワーク応答由来のデータでのみ発火する。
  const seedFiredRef = useRef(false);
  useEffect(() => {
    if (seedFiredRef.current) return;
    if (reportsData === null || !reportsNetworkLoaded) return;
    if (!seenLoaded || seenKeys !== null) return;
    seedFiredRef.current = true;
    const initial = new Set(reportsData.filter((m) => m.generated).map((m) => m.periodKey));
    saveSeenKeys(initial).catch(() => {});
    setSeenKeys(initial);
  }, [reportsData, reportsNetworkLoaded, seenLoaded, seenKeys]);

  // yuzu-app の InsightView と同じく、未生成かつ投稿ありのレポートを背景で先読み生成する
  // （fire-and-forget POST。サーバは即 202 を返しバックグラウンドで生成を続ける）。
  // これでユーザーがカードをタップした時にはキャッシュが温まっており、詳細モーダルの GET が即ヒットする。
  // POST 自体はサーバ側で冪等なので stale データで発火しても実害は無いが、キャッシュ由来だと
  // 生成済みのレポートに無駄な POST を撃つことがあるため、ネットワーク応答由来でのみ発火する。
  const pregenFiredRef = useRef(false);
  useEffect(() => {
    if (pregenFiredRef.current || reportsData === null || !reportsNetworkLoaded) return;
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
  }, [reportsData, reportsNetworkLoaded, scores]);

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
          <DailyHeatmapSkeleton />
        ) : (
          <DailyHeatmap cells={heatmap.data} />
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
              <ReportCard
                key={meta.periodKey}
                meta={meta}
                unread={seenKeys !== null && isReportUnread(meta, seenKeys)}
                onPress={() => {
                  setOpenReport(meta.periodKey);
                  if (seenKeys !== null && isReportUnread(meta, seenKeys)) {
                    setSeenKeys((prev) => {
                      const next = new Set(prev ?? []);
                      next.add(meta.periodKey);
                      return next;
                    });
                    markReportSeen(meta.periodKey).catch(() => {});
                  }
                }}
              />
            ))}
          </View>
        )}
      </Section>

      <ReportDetailModal
        periodKey={openReport}
        scores={scores}
        mockOn={mockOn}
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
  errorMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkMuted },
  emptyMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkMuted },
  reportsEmpty: { gap: spacing.xs, paddingVertical: spacing.lg },
  reportsEmptyHeadline: { fontFamily: fonts.displayBold, fontSize: fontSize.base, color: colors.ink, letterSpacing: fontSize.base * letterSpacing.wide },
  reportsEmptyBody: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkMuted },
});
