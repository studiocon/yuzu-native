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
import * as haptics from "../lib/haptics";
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

type Stats = {
  streak: number;
  todayCount: number;
  maxDaily: number;
  totalCount: number;
  totalMinutes: number;
};

type CarvedPost = { index: number; text: string };

function mergeStats(prev: Stats | null, patch: Partial<Stats>): Stats {
  return {
    streak: patch.streak ?? prev?.streak ?? 0,
    todayCount: patch.todayCount ?? prev?.todayCount ?? 0,
    maxDaily: patch.maxDaily ?? prev?.maxDaily ?? 0,
    totalCount: patch.totalCount ?? prev?.totalCount ?? 0,
    totalMinutes: patch.totalMinutes ?? prev?.totalMinutes ?? 0,
  };
}

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

  const limitReached = stats !== null && stats.todayCount >= stats.maxDaily;
  const recording = useRecording({
    canStart: () => !limitReached,
    onRecordingStart: () => setCarvedPost(null),
    onTranscribed: handleTranscribed,
  });
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<LogRowItem>>(null);
  const insets = useSafeAreaInsets();

  const scores = useSentimentScores(logs, API_BASE);
  // WORDS 自動ハイライト用の頻出語（INSIGHT タブ未訪問でも LOG から詳細を開けるよう、ここで取得しておく）。
  const words = useApiGet<WordFreq[]>(
    `${API_BASE}/api/insights/words`,
    (r) => (Array.isArray(r.words) ? (r.words as WordFreq[]) : []),
  );
  const topWords = useMemo(() => new Set((words.data ?? []).map((w) => w.word)), [words.data]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/records?limit=20`);
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      if (!mountedRef.current) return;
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      setLogs(
        posts.map((p: { id: string; text: string; index: number; createdAt: number; marked?: boolean; durationMs?: number; char_count?: number }) => ({
          id: p.id,
          text: p.text,
          index: p.index,
          createdAt: p.createdAt,
          marked: p.marked ?? false,
          durationMs: p.durationMs ?? 0,
          charCount: p.char_count ?? 0,
        })),
      );
      setNextOffset(typeof data?.nextOffset === "number" ? data.nextOffset : null);
      if (typeof data?.firstPostAt === "number") setFirstPostAt(data.firstPostAt);
      if (typeof data?.streak === "number") {
        setStats({
          streak: data.streak,
          todayCount: data.todayCount ?? 0,
          maxDaily: data.maxDaily ?? 0,
          totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
          totalMinutes: typeof data.totalDurationMs === "number" ? Math.floor(data.totalDurationMs / 60000) : 0,
        });
      }
    } catch {
      // 一覧取得失敗は録音フローを止めない。silent skip。
    } finally {
      if (mountedRef.current) setLogsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
          const data = await res.json();
          await clearPendingRecord();
          if (!mountedRef.current) return;
          setCarvedPost({ index: data.post.index, text: pending.text });
          recording.setPhase("carved");
          setRecordOpen(true); // CompleteView をそのまま見せる
          if (typeof data?.streak === "number") {
            setStats((prev) => mergeStats(prev, { streak: data.streak, todayCount: data.todayCount, maxDaily: data.maxDaily }));
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
      const saveData = await saveRes.json();
      if (!mountedRef.current) return;
      if (!saveRes.ok) {
        recording.setPhase("error");
        const errCode = saveData?.error;
        if (errCode === "daily_limit") {
          recording.setStatusText("今日はここまで");
          if (typeof saveData?.todayCount === "number") {
            setStats((prev) => mergeStats(prev, { todayCount: saveData.todayCount, maxDaily: saveData.maxDaily }));
          }
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          recording.setStatusText("ログインし直せ");
        } else {
          recording.setStatusText(`保存失敗（${saveRes.status}）`);
        }
        haptics.warning();
        return;
      }

      recording.setPhase("carved");
      setCarvedPost({ index: saveData.post.index, text: transcript });
      if (typeof saveData?.streak === "number") {
        setStats((prev) => mergeStats(prev, { streak: saveData.streak, todayCount: saveData.todayCount, maxDaily: saveData.maxDaily }));
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
  const maxDaily = stats?.maxDaily ?? 1;
  const remaining = stats ? Math.max(0, stats.maxDaily - stats.todayCount) : maxDaily;
  const chromeHidden = !!selectedPost || settingsOpen || recordOpen;

  // CompleteView 用の 7 日帯 + STREAK（サーバ値と client 計算の大きい方）。
  const { streak: clientStreak, week } = useMemo(() => computeStreak(logs), [logs]);
  const streak = Math.max(stats?.streak ?? 0, clientStreak);
  const totalMinutes = stats?.totalMinutes ?? 0;

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
        <InsightScreen posts={logs} scores={scores} words={words} />
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
        limitReached={limitReached}
        carvedPost={carvedPost}
        week={week}
        totalMinutes={totalMinutes}
        streak={streak}
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
