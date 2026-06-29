import { useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

// #64 spike: 長押し録音 → Haptics → ElevenLabs STT（既存 yuzu-app の /api/transcribe）が
// Expo で1本通るかだけを確認する。UI は最小、認証なし（anon cookie の日次上限内で検証）。
const API_BASE = "https://app.yuzu.style";

type Phase = "idle" | "recording" | "carving" | "carved" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const armedRef = useRef(false);

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
    if (!uri) {
      setPhase("error");
      setText("録音、失敗した");
      return;
    }

    setPhase("carving");
    try {
      const form = new FormData();
      form.append("audio", {
        uri,
        name: "recording.m4a",
        type: "audio/m4a",
      } as unknown as Blob);

      const res = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setText(data?.message ?? data?.error ?? "失敗した");
        return;
      }
      setPhase("carved");
      setText(data.text || "（無音）");
    } catch {
      setPhase("error");
      setText("送れなかった。もう一度。");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>YUZU</Text>
        <Text style={styles.sub}>SPIKE / RECORD → HAPTICS → STT</Text>

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.fab,
            phase === "recording" && styles.fabRecording,
            pressed && styles.fabPressed,
          ]}
        >
          <Text style={styles.fabLabel}>
            {phase === "recording" ? "" : "話せ"}
          </Text>
        </Pressable>

        <Text style={styles.pill}>{phase.toUpperCase()}</Text>

        {text !== "" && <Text style={styles.result}>{text}</Text>}
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const INK = "#1A1A2E";
const OFFWHITE = "#FAFAF5";
const ZEST = "#F5D84A";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: OFFWHITE },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: INK,
    letterSpacing: 1,
  },
  sub: {
    fontSize: 12,
    color: INK,
    opacity: 0.5,
    letterSpacing: 1,
  },
  fab: {
    width: 140,
    height: 140,
    borderRadius: 9999,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  fabRecording: {
    backgroundColor: ZEST,
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabLabel: {
    color: OFFWHITE,
    fontSize: 18,
    fontWeight: "700",
  },
  pill: {
    fontSize: 14,
    fontWeight: "700",
    color: INK,
    letterSpacing: 2,
  },
  result: {
    fontSize: 16,
    color: INK,
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
