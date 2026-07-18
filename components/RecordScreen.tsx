import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { colors, spacing } from "../lib/theme";
import { useApiGet } from "../lib/useApiGet";
import { useSentimentScores } from "../lib/useSentimentScores";
import { useRecording, type TranscribeOutcome } from "../lib/useRecording";
import { pickPrompt } from "../lib/prompts";
import { clearPendingRecord, loadPendingRecord } from "../lib/pendingRecord";
import { computeStreak } from "../lib/streak";
import { deriveNextIndex } from "../lib/carvingStage";
import { track } from "../lib/analytics";
import * as haptics from "../lib/haptics";
import { loadLogsCache, saveLogsCache, type Stats } from "../lib/logsCache";
import {
  FALLBACK_MAX_DAILY,
  isDailyLimitReached,
  mergeStats,
  parseMaxDaily,
  remainingToday,
  statsPatchFromResponse,
} from "../lib/dailyLimit";
import { parseSaveResponse } from "../lib/saveResponse";
import { hydrateRequestCache } from "../lib/requestCache";
import { loadMockMode } from "../lib/mockMode";
import { buildMockPosts, buildMockScores, buildMockStats, MOCK_WORDS } from "../lib/mockData";
import { updateWidgetSignal } from "../lib/widgetSignal";
import { refreshReminderContent } from "../lib/reminder";
import { DAY_MS } from "../lib/period";
import type { Post } from "../lib/types";
import type { WordFreq } from "../lib/insightTypes";
import AppHeader from "./AppHeader";
import TabBar, { type MainTab } from "./TabBar";
import RecordFab from "./RecordFab";
import LogScreen, { type LogRowItem } from "./LogScreen";
import InsightScreen from "./InsightScreen";
import SettingsScreen from "./SettingsScreen";
import IndexDetailModal from "./IndexDetailModal";
import RecordModal from "./RecordModal";

// 起動直後の帯域を records 取得に譲るため、WORDS（INSIGHT 未訪問でも LOG から詳細を開ける
// ようにする頻出語取得）は初回 fetchLogs 完了 or この遅延のどちらか早い方まで遅らせる。
const WORDS_FETCH_DELAY_MS = 1000;

type CarvedPost = { index: number; text: string };

export default function RecordScreen({ session }: { session: Session }) {
  const [tab, setTab] = useState<MainTab>("log");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [carvedPost, setCarvedPost] = useState<CarvedPost | null>(null);
  const [logs, setLogs] = useState<Post[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [firstPostAt, setFirstPostAt] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prompt, setPrompt] = useState(() => pickPrompt());
  // fetchLogs のネットワーク応答が確定した（成功/失敗いずれか）ことを示す。logsLoaded は
  // キャッシュ表示でも true になるため、WORDS 遅延の判定にはこちらを使う
  // （帯域を records のネットワーク取得に譲る目的のため、キャッシュ即表示では早めない）。
  const [logsNetworkSettled, setLogsNetworkSettled] = useState(false);
  // 管理者限定モックモード。ON の間は LOG/INSIGHT の全データをネットワークに触れず
  // lib/mockData.ts のローカル生成物で表示する（バックエンドは X-Yuzu-Mock を一切
  // 見ておらず本物のデータを返し続けるため、表示側で完全にすり替える必要がある）。
  const [mockOn, setMockOn] = useState(false);

  const limitReached = isDailyLimitReached(stats);
  const recording = useRecording({
    canStart: () => !limitReached,
    onRecordingStart: () => setCarvedPost(null),
    onTranscribed: handleTranscribed,
  });
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<LogRowItem>>(null);
  const insets = useSafeAreaInsets();
  // fetchLogs のレスポンスが setLogs まで到達したら true。以降、キャッシュ読み込みが遅れて
  // 解決してもネットワークの新しい結果を古いキャッシュで上書きしないためのレース対策。
  const networkLoadedRef = useRef(false);
  // fetchLogs は毎回全項目を返すとは限らない（例: streak を含まない応答）ため、キャッシュ保存時に
  // 直前の値へフォールバックできるよう最新の stats/firstPostAt を ref にも保持しておく。
  const statsRef = useRef<Stats | null>(null);
  const firstPostAtRef = useRef<number | null>(null);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  useEffect(() => {
    firstPostAtRef.current = firstPostAt;
  }, [firstPostAt]);

  // mockOn 中は logs がモック投稿なので実 API を叩かず、代わりに固定スコアを使う。
  const rawScores = useSentimentScores(mockOn ? [] : logs, API_BASE);
  const scores = mockOn ? buildMockScores() : rawScores;
  // WORDS 自動ハイライト用の頻出語（INSIGHT タブ未訪問でも LOG から詳細を開けるよう、ここで取得しておく）。
  // 起動直後の帯域を records 取得に譲るため、初回 fetchLogs 完了 or 一定時間のどちらか早い方まで遅らせる。
  const [wordsUrl, setWordsUrl] = useState<string | null>(null);
  useEffect(() => {
    if (mockOn) return;
    if (logsNetworkSettled) {
      setWordsUrl(`${API_BASE}/api/insights/words`);
      return;
    }
    const timer = setTimeout(() => setWordsUrl(`${API_BASE}/api/insights/words`), WORDS_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [logsNetworkSettled, mockOn]);
  const words = useApiGet<WordFreq[]>(
    mockOn ? null : wordsUrl,
    (r) => (Array.isArray(r.words) ? (r.words as WordFreq[]) : []),
  );
  const wordsForDisplay = mockOn ? { data: MOCK_WORDS, error: null } : words;
  const topWords = useMemo(
    () => new Set((wordsForDisplay.data ?? []).map((w) => w.word)),
    [wordsForDisplay.data],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    // loadMockMode() は AsyncStorage 読み込みで非同期のため、ここで毎回 await して
    // 最新値を確定させてから分岐する（起動直後の初回呼び出しと他 effect のロードが
    // 競合しても、ここでは必ず永続化済みの値を見てから判断できる）。
    if (await loadMockMode()) {
      setMockOn(true);
      networkLoadedRef.current = true;
      const mockPosts = buildMockPosts();
      setLogs(mockPosts);
      setStats(buildMockStats());
      setFirstPostAt(mockPosts.length > 0 ? mockPosts[mockPosts.length - 1].createdAt : null);
      setNextOffset(null);
      setLogsLoaded(true);
      setLogsNetworkSettled(true);
      return;
    }
    setMockOn(false);
    try {
      const res = await apiFetch(`${API_BASE}/api/records?limit=20`);
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      if (!mountedRef.current) return;
      // ネットワーク応答が届いた以上、後から解決するキャッシュ読み込みでこれを上書きさせない。
      networkLoadedRef.current = true;
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const mapped: Post[] = posts.map((p: { id: string; text: string; index: number; createdAt: number; marked?: boolean; durationMs?: number; char_count?: number }) => ({
        id: p.id,
        text: p.text,
        index: p.index,
        createdAt: p.createdAt,
        marked: p.marked ?? false,
        durationMs: p.durationMs ?? 0,
        charCount: p.char_count ?? 0,
      }));
      setLogs(mapped);
      const lastPostAt = mapped.length > 0 ? Math.max(...mapped.map((p) => p.createdAt)) : null;
      updateWidgetSignal(lastPostAt);
      const daysSinceLastPost = lastPostAt === null ? 0 : Math.floor((Date.now() - lastPostAt) / DAY_MS);
      refreshReminderContent(daysSinceLastPost).catch(() => {});
      setNextOffset(typeof data?.nextOffset === "number" ? data.nextOffset : null);
      const nextFirstPostAt = typeof data?.firstPostAt === "number" ? data.firstPostAt : firstPostAtRef.current;
      if (typeof data?.firstPostAt === "number") setFirstPostAt(data.firstPostAt);
      let nextStats: Stats | null = statsRef.current;
      if (typeof data?.streak === "number") {
        nextStats = {
          streak: data.streak,
          todayCount: data.todayCount ?? 0,
          maxDaily: parseMaxDaily(data.maxDaily),
          totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
          totalMinutes: typeof data.totalDurationMs === "number" ? Math.floor(data.totalDurationMs / 60000) : 0,
        };
        setStats(nextStats);
      }
      saveLogsCache(session.user.id, { posts: mapped, stats: nextStats, firstPostAt: nextFirstPostAt }).catch(() => {});
    } catch {
      // 一覧取得失敗は録音フローを止めない。silent skip。
    } finally {
      if (mountedRef.current) {
        setLogsLoaded(true);
        setLogsNetworkSettled(true);
      }
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 起動直後: 前回このアカウントでログインした際にキャッシュした LOG 先頭ページ・統計を
  // ネットワークより先に表示する（stale-while-revalidate）。nextOffset はキャッシュから
  // 復元しない（古い offset でのページネーションずれ防止。ネットワーク応答が来るまで
  // hasMore=false のまま＝無限スクロールは発火しない。LogScreen.handleEndReached 参照）。
  useEffect(() => {
    // INSIGHT 系 GET（heatmap/themes/words/reports）の永続キャッシュもここで復元しておく
    // （fire-and-forget。INSIGHT タブ初回マウント前に完了していれば即表示が効き、間に合わ
    // なければ従来のネットワーク待ちに自然フォールバックする。requestCache 側でメモリに
    // 既にあるキーは上書きしないため、ネットワーク応答とのレースも安全）。
    hydrateRequestCache(session.user.id).catch(() => {});
    // 管理者限定モックモードの ON/OFF もここで復元する（apiFetch が同期的に参照するため、
    // 以降の全リクエストが確定する前にモジュール変数へ反映しておく必要がある）。
    loadMockMode().catch(() => {});
    let cancelled = false;
    loadLogsCache(session.user.id).then((cached) => {
      if (cancelled || !mountedRef.current || networkLoadedRef.current || !cached) return;
      setLogs(cached.posts);
      setStats(cached.stats);
      setFirstPostAt(cached.firstPostAt);
      setLogsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // session.user.id は同一マウント中は不変（アカウント切替は必ず一度アンマウントを挟む）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ログイン直後: 未ログイン onboarding で退避した pendingRecord（AsyncStorage）を読み出して保存する。
  // Web（app/page.tsx:224-274）は POST 前に sessionStorage のキーを削除するが、ネイティブは
  // 「成功時」または「4xx の確定拒否時」にのみ削除する意図的ドリフト。ネットワーク例外/5xxでは
  // pending を残し、次回起動時の同じ effect で再試行できるようにする（Web はタブを離れたら
  // 再試行の機会が無いが、ネイティブは次回起動が自然な再試行ポイントになるため）。
  useEffect(() => {
    (async () => {
      const pending = await loadPendingRecord();
      if (!pending) return;
      try {
        const res = await apiFetch(`${API_BASE}/api/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pending.text, durationMs: pending.durationMs }),
        });
        if (!mountedRef.current) return;

        if (res.ok) {
          // ok の時点でサーバの保存は成功している。body の JSON parse 失敗や post 欠損で
          // ここが例外を投げると catch に落ちて「pending を残し次回再試行」に回ってしまい、
          // 実際には保存済みなのに次回起動時にもう一度 POST して重複させるリスクがある
          // （#14）。parse 失敗は空オブジェクト扱いにして必ず carved 側へ進める。
          let data: unknown = null;
          try {
            data = await res.json();
          } catch {
            data = null;
          }
          await clearPendingRecord();
          if (!mountedRef.current) return;
          const saved = parseSaveResponse(data);
          setCarvedPost({ index: saved.index, text: pending.text });
          recording.setPhase("carved");
          setRecordOpen(true); // CompleteView をそのまま見せる
          const streak = (data as { streak?: unknown } | null)?.streak;
          if (typeof streak === "number") {
            setStats((prev) => mergeStats(prev, statsPatchFromResponse(data)));
          }
          haptics.success();
          fetchLogs();
          return;
        }

        // 4xx（daily_limit 等の確定拒否）: サーバが恒久的に拒否したので再試行しても無駄。
        // Web と同じく何も表示せず silent に諦める。
        if (res.status >= 400 && res.status < 500) {
          await clearPendingRecord();
        }
        // 5xx はサーバ側の一時的な不調とみなし、pending を残して次回起動時に再試行する。
      } catch {
        // ネットワーク例外: pending を残す（次回起動時に再試行）
      }
    })();
    // マウント時（ログイン直後）に一度だけ実行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2ページ目以降。ページ境界に新規投稿が挟まると offset がずれて前ページ末尾と重複しうるため id で除外する。
  const loadMore = useCallback(async () => {
    if (loadingMore || nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/records?limit=20&offset=${nextOffset}`);
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      if (!mountedRef.current) return;
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const mapped: Post[] = posts.map((p: { id: string; text: string; index: number; createdAt: number; marked?: boolean; durationMs?: number; char_count?: number }) => ({
        id: p.id,
        text: p.text,
        index: p.index,
        createdAt: p.createdAt,
        marked: p.marked ?? false,
        durationMs: p.durationMs ?? 0,
        charCount: p.char_count ?? 0,
      }));
      setLogs((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...mapped.filter((p) => !seen.has(p.id))];
      });
      setNextOffset(typeof data?.nextOffset === "number" ? data.nextOffset : null);
    } catch {
      // silent: 次回 onEndReached が再発火すれば再試行できる
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, nextOffset]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }

  async function applyMark(id: string, marked: boolean) {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, marked } : l)));
    setSelectedPost((prev) => (prev && prev.id === id ? { ...prev, marked } : prev));
    haptics.tapLight();
    // モック投稿はサーバー上に存在しないため、ローカル state の更新だけで完結させる。
    if (mockOn) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/records/${id}/mark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marked }),
      });
      if (!res.ok) throw new Error("mark failed");
    } catch {
      if (!mountedRef.current) return;
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, marked: !marked } : l)));
      setSelectedPost((prev) => (prev && prev.id === id ? { ...prev, marked: !marked } : prev));
    }
  }

  function openRecord() {
    if (limitReached) {
      haptics.warning();
      setRecordOpen(true);
      return;
    }
    haptics.tapLight();
    setPrompt(pickPrompt());
    recording.reset();
    setCarvedPost(null);
    setRecordOpen(true);
  }

  function closeRecord() {
    haptics.tapLight();
    setRecordOpen(false);
    recording.reset();
    setCarvedPost(null);
  }

  // useRecording の STT 完了コールバック。text は保存処理を行い、daily_limit/login_required は
  // 対応する表示にフォールバックする（詳細は lib/useRecording.ts の TranscribeOutcome を参照）。
  async function handleTranscribed(outcome: TranscribeOutcome) {
    if (outcome.kind === "daily_limit") {
      recording.setPhase("error");
      recording.setStatusText("今日はここまで");
      haptics.warning();
      return;
    }
    if (outcome.kind === "login_required") {
      // ログイン済み画面では実質発生しない想定。念のためのフォールバック表示。
      recording.setPhase("error");
      recording.setStatusText("ログインし直せ");
      haptics.warning();
      return;
    }
    if (outcome.kind !== "text") return;

    const { text: transcript, durationMs } = outcome;
    try {
      const saveRes = await apiFetch(`${API_BASE}/api/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, durationMs }),
      });
      if (!mountedRef.current) return;
      // saveRes.ok の判定・エラーコード読み取りに body が要るので先に parse するが、
      // JSON parse 自体が失敗しても（ok/status だけで）分岐を続行できるよう握り潰す
      // （parse 失敗を outer catch に投げると saveRes.ok=true のケースまで「送れなかった」
      // 表示になり、実際は保存済みなのに失敗扱いされる #14 の再発になる）。
      let saveData: unknown = null;
      try {
        saveData = await saveRes.json();
      } catch {
        saveData = null;
      }
      const errCode = (saveData as { error?: unknown } | null)?.error;
      if (!saveRes.ok) {
        recording.setPhase("error");
        if (errCode === "daily_limit") {
          track("daily_limit_hit");
          recording.setStatusText("今日はここまで");
          const todayCount = (saveData as { todayCount?: unknown } | null)?.todayCount;
          if (typeof todayCount === "number") {
            setStats((prev) => mergeStats(prev, statsPatchFromResponse(saveData)));
          }
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          recording.setStatusText("ログインし直せ");
        } else {
          recording.setStatusText(`保存失敗（${saveRes.status}）`);
        }
        haptics.warning();
        return;
      }

      // ここに来た時点で saveRes.ok=true＝サーバの保存は成功している。body の形状が
      // 壊れていても（post 欠損・parse 失敗）失敗扱いにしない。index が取れなければ 0 で
      // 進め、直後の fetchLogs() が正しい値へ補正する（#14）。
      recording.setPhase("carved");
      const saved = parseSaveResponse(saveData);
      setCarvedPost({ index: saved.index, text: transcript });
      const streak = (saveData as { streak?: unknown } | null)?.streak;
      if (typeof streak === "number") {
        setStats((prev) => mergeStats(prev, statsPatchFromResponse(saveData)));
      }
      if (saved.durationMs !== null && saved.charCount !== null) {
        track("post_created", { durationMs: saved.durationMs, charCount: saved.charCount });
      }
      haptics.success();
      fetchLogs();
    } catch {
      if (!mountedRef.current) return;
      recording.setPhase("error");
      recording.setStatusText("送れなかった。もう一度。");
      haptics.error();
    }
  }

  // stats 未取得時のフォールバックはサーバ側の実際の上限（lib/constants.ts MAX_DAILY_SESSIONS）と揃える。
  const maxDaily: number | null = stats ? stats.maxDaily : FALLBACK_MAX_DAILY;
  const todayCount = stats?.todayCount ?? 0;
  const remaining = remainingToday(maxDaily, todayCount);
  const chromeHidden = !!selectedPost || settingsOpen || recordOpen;

  // CompleteView 用の 7 日帯 + STREAK（サーバ値と client 計算の大きい方）。
  const { streak: clientStreak, week } = useMemo(() => computeStreak(logs), [logs]);
  const streak = Math.max(stats?.streak ?? 0, clientStreak);
  const totalMinutes = stats?.totalMinutes ?? 0;
  const nextIndex = useMemo(() => deriveNextIndex(logs), [logs]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppHeader title={tab === "insight" ? "INSIGHT" : "LOG"} onOpenSettings={() => setSettingsOpen(true)} />

      {tab === "log" ? (
        <LogScreen
          logs={logs}
          logsLoaded={logsLoaded}
          stats={stats}
          scores={scores}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onOpenDetail={setSelectedPost}
          listRef={listRef}
          listFooterPadding={96 + insets.bottom + spacing.xl * 2}
          hasMore={nextOffset !== null}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      ) : (
        <InsightScreen posts={logs} scores={scores} words={wordsForDisplay} mockOn={mockOn} />
      )}

      <View pointerEvents="box-none" style={[styles.chromeRow, { bottom: insets.bottom + spacing.md, left: insets.left + spacing.lg, right: insets.right + spacing.lg }]}>
        <TabBar tab={tab} onChange={setTab} hidden={chromeHidden} />
        <RecordFab disabled={limitReached && !recordOpen} hidden={chromeHidden} onPress={openRecord} />
      </View>

      <RecordModal
        visible={recordOpen}
        phase={recording.phase}
        statusText={recording.statusText}
        permissionDenied={recording.permissionDenied}
        recorder={recording.recorder}
        recordingStartedAt={recording.recordingStartedAt}
        prompt={prompt}
        remaining={remaining}
        maxDaily={maxDaily}
        todayCount={todayCount}
        limitReached={limitReached}
        carvedPost={carvedPost}
        week={week}
        totalMinutes={totalMinutes}
        streak={streak}
        pastLogs={logs}
        nextIndex={nextIndex}
        onPressIn={recording.handlePressIn}
        onPressOut={recording.handlePressOut}
        onClose={closeRecord}
      />

      <IndexDetailModal
        post={selectedPost}
        firstPostAt={firstPostAt}
        score={selectedPost ? scores[selectedPost.id] : undefined}
        topWords={topWords}
        onClose={() => setSelectedPost(null)}
        onToggleMark={applyMark}
      />

      <SettingsScreen visible={settingsOpen} session={session} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  chromeRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
