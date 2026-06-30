import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { INK, OFFWHITE, ZEST } from "../lib/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Phase = "idle" | "recording" | "carving" | "carved" | "error";

type LogEntry = {
  id: string;
  text: string;
  index: number;
  createdAt: number;
};

export default function RecordScreen({ session }: { session: Session }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const armedRef = useRef(false);
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
        posts.map((p: { id: string; text: string; index: number; createdAt: number }) => ({
          id: p.id,
          text: p.text,
          index: p.index,
          createdAt: p.createdAt,
        })),
      );
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

  async function handlePressIn() {
    if (phase === "carving") return;
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
  }

  async function handlePressOut() {
    if (!armedRef.current) return;
    armedRef.current = false;
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
        } else if (saveRes.status === 401 || errCode === "unauthorized") {
          setText("ログインし直せ");
        } else {
          setText(`保存失敗（${saveRes.status}）`);
        }
        return;
      }

      setPhase("carved");
      setText(`#${saveData.post.index}　${transcript}`);
      fetchLogs();
    } catch {
      setPhase("error");
      setText("送れなかった。もう一度。");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>YUZU</Text>
            <Text style={styles.sub}>{session.user.email}</Text>

            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={({ pressed }) => [
                styles.fab,
                phase === "recording" && styles.fabRecording,
                pressed && styles.fabPressed,
              ]}
            >
              <Text style={styles.fabLabel}>{phase === "recording" ? "" : "話せ"}</Text>
            </Pressable>

            <Text style={styles.pill}>{phase.toUpperCase()}</Text>

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
          <View style={styles.logRow}>
            <Text style={styles.logIndex}>#{item.index}</Text>
            <Text style={styles.logText} numberOfLines={3}>{item.text}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: OFFWHITE },
  list: { padding: 24, gap: 12 },
  header: { alignItems: "center", gap: 24, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: "900", color: INK, letterSpacing: 1 },
  sub: { fontSize: 12, color: INK, opacity: 0.5, letterSpacing: 1 },
  fab: {
    width: 140,
    height: 140,
    borderRadius: 9999,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  fabRecording: { backgroundColor: ZEST },
  fabPressed: { opacity: 0.85 },
  fabLabel: { color: OFFWHITE, fontSize: 18, fontWeight: "700" },
  pill: { fontSize: 14, fontWeight: "700", color: INK, letterSpacing: 2 },
  result: { fontSize: 16, color: INK, textAlign: "center", paddingHorizontal: 16 },
  signOut: { fontSize: 13, color: INK, opacity: 0.5, marginTop: 16 },
  logHeader: { fontSize: 14, fontWeight: "700", color: INK, letterSpacing: 2, alignSelf: "flex-start" },
  logRow: { borderTopWidth: 1, borderTopColor: "#1A1A2E22", paddingVertical: 12, gap: 4 },
  logIndex: { fontSize: 12, fontWeight: "700", color: INK, opacity: 0.5 },
  logText: { fontSize: 15, color: INK },
});
