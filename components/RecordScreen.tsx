import { useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

export default function RecordScreen({ session }: { session: Session }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const armedRef = useRef(false);
  const startedAtRef = useRef(0);

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
        setText(sttData?.message ?? sttData?.error ?? "STT 失敗");
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
        setText(saveData?.error ?? "保存失敗");
        return;
      }

      setPhase("carved");
      setText(`#${saveData.post.index}　${transcript}`);
    } catch {
      setPhase("error");
      setText("送れなかった。もう一度。");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: OFFWHITE },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
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
});
