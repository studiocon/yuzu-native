import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { apiFetch } from "./apiFetch";
import { API_BASE } from "./config";
import * as haptics from "./haptics";
import { track } from "./analytics";
import { MAX_RECORD_MS, type ModalPhase } from "../components/RecordModal";

export type TranscribeOutcome =
  | { kind: "text"; text: string; durationMs: number }
  | { kind: "login_required" }
  | { kind: "daily_limit" }
  | { kind: "error" }; // phase/statusText はフック内で設定済み

type Options = {
  /** false を返すと録音開始しない（limitReached ゲート用） */
  canStart?: () => boolean;
  /** STT 完了時に呼ぶ。呼び出し側で「保存する / ログイン誘導する」等を振り分ける */
  onTranscribed: (outcome: TranscribeOutcome) => void | Promise<void>;
  /** 実際に録音が始まった直後に呼ぶ（呼び出し側の carvedPost クリア等、UI 状態リセット用のフック） */
  onRecordingStart?: () => void;
};

export function useRecording({ canStart, onTranscribed, onRecordingStart }: Options) {
  // android.audioSource: 'voice_communication' で OS レベルの AGC/エコーキャンセルを有効化。
  // 未指定だと小声の入力がそのまま低レベルでエンコードされ、ElevenLabs 側の音声検出（VAD）で
  // 無音判定される事故につながる（yuzu-app 側の同事象を getUserMedia の autoGainControl で修正、
  // ネイティブ側は expo-audio の Android audioSource で同等の効果を狙う）。
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    android: { ...RecordingPresets.HIGH_QUALITY.android, audioSource: "voice_communication" },
    isMeteringEnabled: true,
  });
  const armedRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const startedAtRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoStopTimerRef.current !== null) clearTimeout(autoStopTimerRef.current);
    };
  }, []);

  function clearAutoStopTimer() {
    if (autoStopTimerRef.current !== null) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }

  // 電話/通知で割り込まれた時に録音状態のまま固まらないよう、バックグラウンド遷移で中断する。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" || !armedRef.current) return;
      armedRef.current = false;
      pendingReleaseRef.current = false;
      clearAutoStopTimer();
      setRecordingStartedAt(null);
      recorderRef.current
        .stop()
        .then(() =>
          // iOS は録音セッション有効中は触覚を抑制するため、停止時に必ず解除する。
          setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
        )
        .catch(() => {});
      setPhase("error");
      setStatusText("中断された、もう一度");
      haptics.warning();
    });
    return () => sub.remove();
  }, []);

  async function handlePressIn() {
    if (phase === "carving") return;
    if (canStart && !canStart()) return;
    pendingReleaseRef.current = false;
    setStatusText("");
    setPermissionDenied(false);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase("error");
      setPermissionDenied(true);
      haptics.warning();
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    armedRef.current = true;
    track("record_started");
    startedAtRef.current = Date.now();
    setPhase("recording");
    onRecordingStart?.();
    setRecordingStartedAt(startedAtRef.current);
    haptics.tapMedium();
    // 制限時間（MAX_RECORD_MS）に達したら、指を離していなくても自動で CARVING に入る。
    clearAutoStopTimer();
    autoStopTimerRef.current = setTimeout(() => {
      autoStopTimerRef.current = null;
      if (armedRef.current) finishRecording();
    }, MAX_RECORD_MS);

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
    clearAutoStopTimer();
    setRecordingStartedAt(null);
    await recorder.stop();
    // iOS は録音セッション有効中は触覚を抑制するため、停止時に必ず解除する。
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

    const uri = recorder.uri;
    const durationMs = Date.now() - startedAtRef.current;
    if (!uri) {
      setPhase("error");
      setStatusText("録音、失敗した");
      haptics.error();
      return;
    }

    // 録音停止 → 変換・保存中（CARVING）に入ったことを伝える軽いタップ。
    // 実際に成功/失敗したかは後続の分岐でそれぞれ success()/error() を鳴らす。
    haptics.tapLight();
    setPhase("carving");
    try {
      const form = new FormData();
      form.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as unknown as Blob);

      const sttRes = await apiFetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: form,
      });

      if (!sttRes.ok && sttRes.status === 429) {
        // 429: body の error フィールドで login_required / daily_limit を判定し、呼び出し側に委譲する。
        let errCode: string | undefined;
        try {
          const body = await sttRes.json();
          errCode = body && typeof body === "object" ? body.error : undefined;
        } catch {
          errCode = undefined;
        }
        if (!mountedRef.current) return;
        if (errCode === "login_required") {
          setPhase("idle");
          await onTranscribed({ kind: "login_required" });
          return;
        }
        if (errCode === "daily_limit") {
          setPhase("idle");
          await onTranscribed({ kind: "daily_limit" });
          return;
        }
        // JSON parse 失敗、または未知の error コード: 従来どおりの汎用 STT エラー表示。
        track("transcribe_failed", { errorCode: String(sttRes.status) });
        setPhase("error");
        setStatusText(`STT 失敗（${sttRes.status}）`);
        haptics.error();
        return;
      }

      const sttData = await sttRes.json();
      if (!mountedRef.current) return;
      if (!sttRes.ok) {
        track("transcribe_failed", { errorCode: String(sttRes.status) });
        setPhase("error");
        setStatusText(sttRes.status === 401 ? "ログインし直せ" : `STT 失敗（${sttRes.status}）`);
        haptics.error();
        return;
      }
      const transcript: string = sttData.text || "";
      if (!transcript) {
        track("transcribe_failed", { errorCode: "silence" });
        setPhase("error");
        setStatusText("無音、話せ");
        haptics.warning();
        return;
      }

      // 短文チェック: trim 後5文字未満は成功扱いにしない（web版 useRecorder.ts:236 とパリティ）。
      if (transcript.trim().length < 5) {
        track("transcribe_failed", { errorCode: "short" });
        setPhase("error");
        setStatusText("短い、話せ");
        haptics.warning();
        return;
      }

      track("transcribe_succeeded", { durationMs, charCount: transcript.length });
      await onTranscribed({ kind: "text", text: transcript, durationMs });
    } catch {
      if (!mountedRef.current) return;
      track("transcribe_failed", { errorCode: "network" });
      setPhase("error");
      setStatusText("送れなかった。もう一度。");
      haptics.error();
    }
  }

  function reset() {
    armedRef.current = false;
    pendingReleaseRef.current = false;
    clearAutoStopTimer();
    setPhase("idle");
    setStatusText("");
    setPermissionDenied(false);
    setRecordingStartedAt(null);
  }

  return {
    recorder,
    phase,
    setPhase,
    statusText,
    setStatusText,
    permissionDenied,
    recordingStartedAt,
    handlePressIn,
    handlePressOut,
    reset,
  };
}
