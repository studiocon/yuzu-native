import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { MicrophoneIcon, PushPinIcon } from "phosphor-react-native";
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

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Phase = "idle" | "recording" | "carving" | "carved" | "error";

type LogEntry = {
  id: string;
  text: string;
  index: number;
  createdAt: number;
  marked: boolean;
};

type Stats = {
  streak: number;
  todayCount: number;
  maxDaily: number;
};

// 状態 pill は RECORDING → CARVING → CARVED の英語のみ（句点なし）。idle/error は日本語の地の文で表す。
const PHASE_LABEL: Partial<Record<Phase, string>> = {
  recording: "RECORDING",
  carving: "CARVING",
  carved: "CARVED",
};

export default function RecordScreen({ session }: { session: Session }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const armedRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const startedAtRef = useRef(0);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/records?limit=20`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      setLogs(
        posts.map((p: { id: string; text: string; index: number; createdAt: number; marked?: boolean }) => ({
          id: p.id,
          text: p.text,
          index: p.index,
          createdAt: p.createdAt,
          marked: p.marked ?? false,
        })),
      );
      if (typeof data?.streak === "number") {
        setStats({
          streak: data.streak,
          todayCount: data.todayCount ?? 0,
          maxDaily: data.maxDaily ?? 0,
        });
      }
    } catch {
      // 一覧取得失敗は録音フローを止めない。silent skip。
    }
  }, [session.access_token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  async function handleToggleMark(entry: LogEntry) {
    const next = !entry.marked;
    setLogs((prev) => prev.map((l) => (l.id === entry.id ? { ...l, marked: next } : l)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API_BASE}/api/records/${entry.id}/mark`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ marked: next }),
      });
      if (!res.ok) throw new Error("mark failed");
    } catch {
      setLogs((prev) => prev.map((l) => (l.id === entry.id ? { ...l, marked: !next } : l)));
    }
  }

  const limitReached = stats !== null && stats.todayCount >= stats.maxDaily;

  async function handlePressIn() {
    if (phase === "carving" || limitReached) return;
    pendingReleaseRef.current = false;
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
      if (!saveRes.ok) {
        setPhase("error");
        const errCode = saveData?.error;
        if (errCode === "daily_limit") {
          setText(`今日はここまで（${saveRes.status}）`);
          if (typeof saveData?.todayCount === "number") {
            setStats((prev) => ({
              streak: prev?.streak ?? 0,
              todayCount: saveData.todayCount,
              maxDaily: saveData.maxDaily ?? prev?.maxDaily ?? 0,
            }));
          }
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          setText("ログインし直せ");
        } else {
          setText(`保存失敗（${saveRes.status}）`);
        }
        return;
      }

      setPhase("carved");
      setText(`#${saveData.post.index}　${transcript}`);
      if (typeof saveData?.streak === "number") {
        setStats((prev) => ({
          streak: saveData.streak,
          todayCount: saveData.todayCount ?? prev?.todayCount ?? 0,
          maxDaily: saveData.maxDaily ?? prev?.maxDaily ?? 0,
        }));
      }
      fetchLogs();
    } catch {
      setPhase("error");
      setText("送れなかった。もう一度。");
    }
  }

  const phaseLabel = limitReached ? undefined : PHASE_LABEL[phase];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>YUZU</Text>
            <Text style={styles.sub}>{session.user.email}</Text>

            {stats && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>STREAK</Text>
                  <Text style={styles.statValue}>{stats.streak}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>LEFT</Text>
                  <Text style={styles.statValue}>{Math.max(0, stats.maxDaily - stats.todayCount)}</Text>
                </View>
              </View>
            )}

            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={limitReached}
              style={({ pressed }) => [
                styles.fab,
                phase === "recording" && styles.fabRecording,
                limitReached && styles.fabDisabled,
                pressed && styles.fabPressed,
              ]}
            >
              <MicrophoneIcon size={32} color={colors.ink} weight="bold" />
            </Pressable>

            {phaseLabel ? (
              <Text style={styles.pill}>{phaseLabel}</Text>
            ) : (
              <Text style={styles.hint}>{limitReached ? "今日はここまで" : "長押し。話せ"}</Text>
            )}

            {text !== "" && <Text style={styles.result}>{text}</Text>}

            <Pressable onPress={() => supabase.auth.signOut()}>
              <Text style={styles.signOut}>サインアウト</Text>
            </Pressable>

            {logs.length > 0 && <Text style={styles.logHeader}>LOG</Text>}
          </View>
        }
        data={logs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleToggleMark(item)}
            style={({ pressed }) => [
              styles.logRow,
              item.marked && styles.logRowMarked,
              pressed && styles.logRowPressed,
            ]}
          >
            <View style={styles.logRowHead}>
              <Text style={styles.logIndex}>#{String(item.index).padStart(3, "0")}</Text>
              {item.marked && <PushPinIcon size={14} color={colors.yuzuZest} weight="fill" />}
            </View>
            <Text style={styles.logText} numberOfLines={3}>{item.text}</Text>
          </Pressable>
        )}
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
  statsRow: { flexDirection: "row", gap: spacing.xl },
  statCard: { alignItems: "center", gap: spacing.xs },
  statLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  statValue: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: colors.ink, lineHeight: fontSize.xxl },
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
  logRow: { borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.md, gap: spacing.xs },
  logRowMarked: { borderTopColor: colors.yuzuZest },
  logRowPressed: { backgroundColor: colors.surfaceHover },
  logRowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logIndex: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.wide,
  },
  logText: { fontSize: fontSize.base, color: colors.ink, lineHeight: fontSize.base * 1.6 },
});
