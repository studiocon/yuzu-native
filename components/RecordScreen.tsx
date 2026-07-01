import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { MicrophoneIcon } from "phosphor-react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  colors,
  fontSize,
  fonts,
  letterSpacing,
  radius,
  recordingGlowShadow,
  spacing,
} from "../lib/theme";
import { seededHeights, voiceprintBarCount } from "../lib/voiceprint";
import { formatDuration } from "../lib/stats";
import { sentimentColor } from "../lib/sentimentColor";
import { useSentimentScores } from "../lib/useSentimentScores";
import type { Post } from "../lib/types";
import IndexDetailModal from "./IndexDetailModal";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Phase = "idle" | "recording" | "carving" | "carved" | "error";

type Stats = {
  streak: number;
  todayCount: number;
  maxDaily: number;
  totalCount: number;
  totalMinutes: number;
};

type CarvedPost = {
  index: number;
  text: string;
};

// 状態 pill は RECORDING → CARVING → CARVED の英語のみ（句点なし）。idle/error は日本語の地の文で表す。
const PHASE_LABEL: Partial<Record<Phase, string>> = {
  recording: "RECORDING",
  carving: "CARVING",
  carved: "CARVED",
};

// 部分的な更新パッチを既存 Stats にマージする（finishRecording 内の2箇所で同じ
// 「サーバ値があればそれを、無ければ前の値を使う」パターンが重複していたのを共通化）。
function mergeStats(prev: Stats | null, patch: Partial<Stats>): Stats {
  return {
    streak: patch.streak ?? prev?.streak ?? 0,
    todayCount: patch.todayCount ?? prev?.todayCount ?? 0,
    maxDaily: patch.maxDaily ?? prev?.maxDaily ?? 0,
    totalCount: patch.totalCount ?? prev?.totalCount ?? 0,
    totalMinutes: patch.totalMinutes ?? prev?.totalMinutes ?? 0,
  };
}

// LOG カード本文下の擬似「声紋」。録音長に比例した本数、id 由来の決定的な高さ。
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

// LOG 一覧の1行。声紋・感情カラーの再計算を親の再レンダーから切り離すため memo 化。
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
      style={({ pressed }) => [
        styles.logRow,
        post.marked && styles.logRowMarked,
        pressed && styles.logRowPressed,
      ]}
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

export default function RecordScreen({ session }: { session: Session }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [carvedPost, setCarvedPost] = useState<CarvedPost | null>(null);
  const [logs, setLogs] = useState<Post[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [firstPostAt, setFirstPostAt] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const armedRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const startedAtRef = useRef(0);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<Post>>(null);
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const carvedAnim = useRef(new Animated.Value(0)).current;

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
      if (typeof data?.firstPostAt === "number") {
        setFirstPostAt(data.firstPostAt);
      }
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

  // 録音中: mic-recording-pulse（scale 1 → 1.04 をループ）
  useEffect(() => {
    if (phase !== "recording") {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 700,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  // 変換中（CARVING）: spinner-rotate（360度を 0.9s でループ）
  useEffect(() => {
    if (phase !== "carving") {
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // CARVED カード: card-slide-up 相当（opacity 0→1 / translateY 20→0）
  useEffect(() => {
    if (!carvedPost) {
      carvedAnim.setValue(0);
      return;
    }
    Animated.timing(carvedAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [carvedPost, carvedAnim]);

  const carvedOpacity = carvedAnim;
  const carvedTranslateY = carvedAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  // 電話/通知で割り込まれた時に録音状態のまま固まらないよう、バックグラウンド遷移で中断する
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" || !armedRef.current) return;
      armedRef.current = false;
      recorderRef.current.stop().catch(() => {});
      setPhase("error");
      setText("中断された、もう一度");
    });
    return () => sub.remove();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }

  // MARK の確定状態は IndexDetailModal 側（PushPin トグル）で決める。ここはサーバ反映と一覧の同期だけ担う。
  async function applyMark(id: string, marked: boolean) {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, marked } : l)));
    setSelectedPost((prev) => (prev && prev.id === id ? { ...prev, marked } : prev));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API_BASE}/api/records/${id}/mark`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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

  async function handlePressIn() {
    if (phase === "carving" || limitReached) return;
    pendingReleaseRef.current = false;
    // 録音FABは画面下部に固定表示（LOGが伸びてスクロールしていても常に押せる）だが、
    // 状態pill・CARVEDカードはヘッダー側にあるので、録音開始時にトップへ戻して見えるようにする。
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase("error");
      setText("マイク許可、出せ");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    armedRef.current = true;
    startedAtRef.current = Date.now();
    setPhase("recording");
    setText("");
    setCarvedPost(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 録音開始の準備中（権限確認〜prepareToRecordAsync）に指が離れている、
    // つまり armedRef が立つ前に handlePressOut が来ていた場合はここで即座に止める。
    // でないと pressOut イベントは二度と来ず、録音が止められなくなる。
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
    await recorder.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const uri = recorder.uri;
    const durationMs = Date.now() - startedAtRef.current;
    if (!uri) {
      setPhase("error");
      setText("録音、失敗した");
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
        setText(sttRes.status === 401 ? "ログインし直せ" : `STT 失敗（${sttRes.status}）`);
        return;
      }
      const transcript: string = sttData.text || "";
      if (!transcript) {
        setPhase("error");
        setText("無音、話せ");
        return;
      }

      const saveRes = await fetch(`${API_BASE}/api/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: transcript, durationMs }),
      });
      const saveData = await saveRes.json();
      if (!mountedRef.current) return;
      if (!saveRes.ok) {
        setPhase("error");
        const errCode = saveData?.error;
        if (errCode === "daily_limit") {
          setText(`今日はここまで（${saveRes.status}）`);
          if (typeof saveData?.todayCount === "number") {
            setStats((prev) => mergeStats(prev, { todayCount: saveData.todayCount, maxDaily: saveData.maxDaily }));
          }
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          setText("ログインし直せ");
        } else {
          setText(`保存失敗（${saveRes.status}）`);
        }
        return;
      }

      setPhase("carved");
      setCarvedPost({ index: saveData.post.index, text: transcript });
      if (typeof saveData?.streak === "number") {
        setStats((prev) =>
          mergeStats(prev, {
            streak: saveData.streak,
            todayCount: saveData.todayCount,
            maxDaily: saveData.maxDaily,
          }),
        );
      }
      fetchLogs();
    } catch {
      if (!mountedRef.current) return;
      setPhase("error");
      setText("送れなかった。もう一度。");
    }
  }

  const phaseLabel = limitReached ? undefined : PHASE_LABEL[phase];
  const remaining = stats ? Math.max(0, stats.maxDaily - stats.todayCount) : 0;

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <LogRow post={item} edgeColor={sentimentColor(scores[item.id])} onPress={() => setSelectedPost(item)} />
    ),
    [scores],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <FlatList
        ref={listRef}
        contentContainerStyle={[styles.list, { paddingBottom: 96 + insets.bottom + spacing.xl * 2 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>YUZU</Text>
            <Text style={styles.sub}>{session.user.email}</Text>

            {stats && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>RECORDS</Text>
                  <Text style={styles.statValue}>{stats.totalCount}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>MINUTES</Text>
                  <Text style={styles.statValue}>{stats.totalMinutes}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>STREAK</Text>
                  <Text style={styles.statValue}>{stats.streak}</Text>
                </View>
              </View>
            )}

            {phaseLabel ? (
              <Text style={styles.pill}>{phaseLabel}</Text>
            ) : (
              <Text style={styles.hint}>{limitReached ? "今日はここまで" : "長押し。話せ"}</Text>
            )}

            {/* 残り回数は 3 回未満のときだけ出す（copy ルール） */}
            {!limitReached && stats && remaining > 0 && remaining < 3 && (
              <Text style={styles.leftHint}>{remaining} LEFT</Text>
            )}

            {phase === "carved" && carvedPost && (
              <Animated.View
                style={[
                  styles.carvedCard,
                  { opacity: carvedOpacity, transform: [{ translateY: carvedTranslateY }] },
                ]}
              >
                <Text style={styles.carvedIndex}>#{String(carvedPost.index).padStart(3, "0")}</Text>
                <Text style={styles.carvedText}>{carvedPost.text}</Text>
              </Animated.View>
            )}

            {text !== "" && (
              <Text style={styles.result} accessibilityLiveRegion="polite">{text}</Text>
            )}

            <Pressable
              onPress={() => supabase.auth.signOut()}
              accessibilityRole="button"
              accessibilityLabel="サインアウト"
            >
              <Text style={styles.signOut}>サインアウト</Text>
            </Pressable>

            {logsLoaded ? (
              <>
                {logs.length > 0 && <Text style={styles.logHeader}>LOG</Text>}
                {logs.length === 0 && <Text style={styles.empty}>話せ</Text>}
              </>
            ) : (
              <ActivityIndicator color={colors.inkMuted} style={styles.loadingIndicator} />
            )}
          </View>
        }
        data={logs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.inkMuted}
            colors={[colors.yuzuZest]}
          />
        }
        renderItem={renderItem}
      />

      {/* 録音FABはyuzu-appの .fab-record と同じく画面下部に固定。LOGが伸びてスクロールしていても常に押せる。 */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.fabWrap, { bottom: insets.bottom + spacing.xl, transform: [{ scale: pulseAnim }] }]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={limitReached || phase === "carving"}
          accessibilityRole="button"
          accessibilityLabel={phase === "recording" ? "録音を停止" : "長押しで録音開始"}
          style={({ pressed }) => [
            styles.fab,
            phase === "recording" && styles.fabRecording,
            limitReached && styles.fabDisabled,
            pressed && styles.fabPressed,
          ]}
        >
          {phase === "carving" ? (
            <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
          ) : (
            <MicrophoneIcon size={32} color={colors.ink} weight="bold" />
          )}
        </Pressable>
      </Animated.View>

      <IndexDetailModal
        post={selectedPost}
        firstPostAt={firstPostAt}
        score={selectedPost ? scores[selectedPost.id] : undefined}
        onClose={() => setSelectedPost(null)}
        onToggleMark={applyMark}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  list: { padding: spacing.xl, gap: spacing.md },
  header: { alignItems: "center", gap: spacing.xl, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.displayBlack, fontSize: fontSize.xxl, color: colors.ink },
  sub: { fontSize: fontSize.xs, color: colors.inkMuted, letterSpacing: fontSize.xs * letterSpacing.wide },
  statsRow: { flexDirection: "row", gap: spacing.lg },
  statCard: { alignItems: "center", gap: spacing.xs, minWidth: 64 },
  leftHint: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  carvedCard: {
    width: "100%",
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: 22,
    gap: spacing.sm,
  },
  carvedIndex: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    color: colors.yuzuWhite,
  },
  carvedText: {
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.92)",
    lineHeight: fontSize.base * 1.75,
  },
  statLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  statValue: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: colors.ink, lineHeight: fontSize.xxl },
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.yuzuYellow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...recordingGlowShadow,
  },
  fabRecording: { backgroundColor: colors.yuzuZest },
  fabDisabled: { opacity: 0.3 },
  fabPressed: { transform: [{ scale: 0.94 }] },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "rgba(26,26,46,0.25)",
    borderTopColor: colors.ink,
  },
  pill: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.ink,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  hint: { fontSize: fontSize.base, color: colors.inkSecondary },
  result: { fontSize: fontSize.base, color: colors.ink, textAlign: "left", paddingHorizontal: spacing.md, lineHeight: fontSize.base * 1.6 },
  signOut: { fontSize: fontSize.sm, color: colors.inkSecondary, marginTop: spacing.md },
  logHeader: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
    textTransform: "uppercase",
    alignSelf: "flex-start",
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    width: "100%",
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
  logIndex: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.wide,
  },
  logDuration: {
    fontFamily: fonts.displayRegular,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.wide,
  },
  logText: { fontSize: fontSize.base, color: colors.ink, lineHeight: fontSize.base * 1.6 },
  voiceprint: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20, marginTop: 2, opacity: 0.45 },
  voiceprintBar: { flex: 1, minWidth: 1, backgroundColor: colors.inkMuted },
  empty: { fontSize: fontSize.base, color: colors.inkMuted, paddingTop: spacing.xl },
  loadingIndicator: { paddingTop: spacing.xl },
});
