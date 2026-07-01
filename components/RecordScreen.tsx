import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import type { Session } from "@supabase/supabase-js";
import { colors, spacing } from "../lib/theme";
import { useSentimentScores } from "../lib/useSentimentScores";
import { pickPrompt } from "../lib/prompts";
import { computeStreak } from "../lib/streak";
import type { Post } from "../lib/types";
import AppHeader from "./AppHeader";
import TabBar, { type MainTab } from "./TabBar";
import RecordFab from "./RecordFab";
import LogScreen, { type LogRowItem } from "./LogScreen";
import InsightScreen from "./InsightScreen";
import SettingsScreen from "./SettingsScreen";
import IndexDetailModal from "./IndexDetailModal";
import RecordModal, { type ModalPhase } from "./RecordModal";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

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
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [carvedPost, setCarvedPost] = useState<CarvedPost | null>(null);
  const [logs, setLogs] = useState<Post[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [firstPostAt, setFirstPostAt] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prompt, setPrompt] = useState(() => pickPrompt());

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const armedRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const startedAtRef = useRef(0);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<LogRowItem>>(null);
  const insets = useSafeAreaInsets();

  const scores = useSentimentScores(logs, API_BASE, session.access_token);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/records?limit=20`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
  }, [session.access_token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 電話/通知で割り込まれた時に録音状態のまま固まらないよう、バックグラウンド遷移で中断する。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" || !armedRef.current) return;
      armedRef.current = false;
      pendingReleaseRef.current = false;
      setRecordingStartedAt(null);
      recorderRef.current.stop().catch(() => {});
      setPhase("error");
      setStatusText("中断された、もう一度");
    });
    return () => sub.remove();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }

  async function applyMark(id: string, marked: boolean) {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, marked } : l)));
    setSelectedPost((prev) => (prev && prev.id === id ? { ...prev, marked } : prev));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API_BASE}/api/records/${id}/mark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ marked }),
      });
      if (!res.ok) throw new Error("mark failed");
    } catch {
      if (!mountedRef.current) return;
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, marked: !marked } : l)));
      setSelectedPost((prev) => (prev && prev.id === id ? { ...prev, marked: !marked } : prev));
    }
  }

  const limitReached = stats !== null && stats.todayCount >= stats.maxDaily;

  function openRecord() {
    if (limitReached) {
      setRecordOpen(true);
      return;
    }
    setPrompt(pickPrompt());
    setPhase("idle");
    setStatusText("");
    setPermissionDenied(false);
    setCarvedPost(null);
    setRecordOpen(true);
  }

  function closeRecord() {
    setRecordOpen(false);
    armedRef.current = false;
    pendingReleaseRef.current = false;
    setPhase("idle");
    setStatusText("");
    setCarvedPost(null);
    setRecordingStartedAt(null);
  }

  async function handlePressIn() {
    if (phase === "carving" || limitReached) return;
    pendingReleaseRef.current = false;
    setStatusText("");
    setPermissionDenied(false);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase("error");
      setPermissionDenied(true);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    armedRef.current = true;
    startedAtRef.current = Date.now();
    setPhase("recording");
    setCarvedPost(null);
    setRecordingStartedAt(startedAtRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (pendingReleaseRef.current) {
      await finishRecording();
    }
  }

  function handlePressOut() {
    if (!armedRef.current) {
      pendingReleaseRef.current = true;
      return;
    }
    finishRecording();
  }

  async function finishRecording() {
    armedRef.current = false;
    pendingReleaseRef.current = false;
    setRecordingStartedAt(null);
    await recorder.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const uri = recorder.uri;
    const durationMs = Date.now() - startedAtRef.current;
    if (!uri) {
      setPhase("error");
      setStatusText("録音、失敗した");
      return;
    }

    setPhase("carving");
    try {
      const form = new FormData();
      form.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as unknown as Blob);

      const sttRes = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const sttData = await sttRes.json();
      if (!mountedRef.current) return;
      if (!sttRes.ok) {
        setPhase("error");
        setStatusText(sttRes.status === 401 ? "ログインし直せ" : `STT 失敗（${sttRes.status}）`);
        return;
      }
      const transcript: string = sttData.text || "";
      if (!transcript) {
        setPhase("error");
        setStatusText("無音、話せ");
        return;
      }

      const saveRes = await fetch(`${API_BASE}/api/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text: transcript, durationMs }),
      });
      const saveData = await saveRes.json();
      if (!mountedRef.current) return;
      if (!saveRes.ok) {
        setPhase("error");
        const errCode = saveData?.error;
        if (errCode === "daily_limit") {
          setStatusText("今日はここまで");
          if (typeof saveData?.todayCount === "number") {
            setStats((prev) => mergeStats(prev, { todayCount: saveData.todayCount, maxDaily: saveData.maxDaily }));
          }
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          setStatusText("ログインし直せ");
        } else {
          setStatusText(`保存失敗（${saveRes.status}）`);
        }
        return;
      }

      setPhase("carved");
      setCarvedPost({ index: saveData.post.index, text: transcript });
      if (typeof saveData?.streak === "number") {
        setStats((prev) => mergeStats(prev, { streak: saveData.streak, todayCount: saveData.todayCount, maxDaily: saveData.maxDaily }));
      }
      fetchLogs();
    } catch {
      if (!mountedRef.current) return;
      setPhase("error");
      setStatusText("送れなかった。もう一度。");
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
        />
      ) : (
        <InsightScreen posts={logs} scores={scores} accessToken={session.access_token} />
      )}

      <View pointerEvents="box-none" style={[styles.chromeRow, { bottom: insets.bottom + spacing.md, left: insets.left + spacing.lg, right: insets.right + spacing.lg }]}>
        <TabBar tab={tab} onChange={setTab} hidden={chromeHidden} />
        <RecordFab disabled={limitReached && !recordOpen} hidden={chromeHidden} onPress={openRecord} />
      </View>

      <RecordModal
        visible={recordOpen}
        phase={phase}
        statusText={statusText}
        permissionDenied={permissionDenied}
        recorder={recorder}
        recordingStartedAt={recordingStartedAt}
        prompt={prompt}
        remaining={remaining}
        maxDaily={maxDaily}
        limitReached={limitReached}
        carvedPost={carvedPost}
        week={week}
        totalMinutes={totalMinutes}
        streak={streak}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onClose={closeRecord}
      />

      <IndexDetailModal
        post={selectedPost}
        firstPostAt={firstPostAt}
        score={selectedPost ? scores[selectedPost.id] : undefined}
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
