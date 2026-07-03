import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { AudioRecorder } from "expo-audio";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { MicrophoneIcon, MicrophoneSlashIcon, XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing } from "../lib/theme";
import type { WeekDay } from "../lib/streak";
import { useCountUp } from "../lib/useCountUp";
import FloatingDots from "./FloatingDots";
import Waveform from "./Waveform";

// yuzu-app の lib/constants.ts MAX_RECORD_MS と同じ値を維持すること。
// 初期リリースはボリューム抑制のため 1 分に制限。
export const MAX_RECORD_MS = 1 * 60 * 1000;
const RING = 54;
const CIRC = 2 * Math.PI * RING;

// yuzu-app の SpeakView.tsx の沈黙ナッジ(SILENCE_NUDGE_MS)を移植。
// Web は AnalyserNode の time-domain 振幅で無音判定するが、native は expo-audio の
// metering(dB) しか取れないため、Waveform.tsx と同じ (db+60)/55 正規化を無音判定に流用する。
const SILENCE_NUDGE_MS = 5000;
const SILENCE_LEVEL_THRESHOLD = 0.15;

export type ModalPhase = "idle" | "recording" | "carving" | "carved" | "error";

type CarvedPost = { index: number; text: string };

type Props = {
  visible: boolean;
  phase: ModalPhase;
  statusText: string;
  permissionDenied: boolean;
  recorder: AudioRecorder;
  /** 録音開始時刻（Date.now()）。録音中でなければ null。経過時間の算出用。 */
  recordingStartedAt: number | null;
  prompt: string;
  remaining: number;
  maxDaily: number;
  limitReached: boolean;
  carvedPost: CarvedPost | null;
  week: WeekDay[];
  totalMinutes: number;
  streak: number;
  onPressIn: () => void;
  onPressOut: () => void;
  onClose: () => void;
};

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RecordModal(props: Props) {
  const { visible } = props;
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={props.onClose} statusBarTranslucent>
      <StatusBar hidden hideTransitionAnimation="none" />
      <View style={styles.root}>
        <RecordModalBackground />
        <ModalBody {...props} />
      </View>
    </Modal>
  );
}

// yuzu-app の .record-modal 背景（linear-gradient(160deg, #F5D84A 0%, #E8A020 60%, #D4880A 100%)）を移植。
// フェーズによる切り替えではなく常時この斜めグラデーション（CSSの160degをSVGのobjectBoundingBox座標に変換）。
function RecordModalBackground() {
  const { width, height } = Dimensions.get("window");
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="recordBg" x1="0.33" y1="0.03" x2="0.67" y2="0.97">
          <Stop offset="0" stopColor="#F5D84A" />
          <Stop offset="0.6" stopColor="#E8A020" />
          <Stop offset="1" stopColor="#D4880A" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#recordBg)" />
    </Svg>
  );
}

function ModalBody({
  phase,
  statusText,
  permissionDenied,
  recorder,
  recordingStartedAt,
  prompt,
  remaining,
  maxDaily,
  limitReached,
  carvedPost,
  week,
  totalMinutes,
  streak,
  onPressIn,
  onPressOut,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isRecording = phase === "recording";
  const isBusy = phase === "carving";
  const isCarved = phase === "carved";
  const isIdleHero = phase === "idle" && !permissionDenied && statusText === "";

  const [promptShown, setPromptShown] = useState(false);
  useEffect(() => {
    if (!isIdleHero) {
      setPromptShown(false);
      return;
    }
    const t = setTimeout(() => setPromptShown(true), 1500);
    return () => clearTimeout(t);
  }, [isIdleHero]);

  // 録音中、連続無音が SILENCE_NUDGE_MS を超えたらプロンプトを再表示する（話し出したら消える）。
  const [recordingNudge, setRecordingNudge] = useState(false);
  const silenceStartRef = useRef<number | null>(null);

  // カウントダウン表示とリングの進捗だけがこの経過時間を必要とする。以前は RecordScreen が
  // 200ms ごとに state 更新し、そのたびに LOG/INSIGHT タブを含む画面全体を再レンダーしていた。
  // ここに閉じ込めることで、再レンダー範囲を「モーダルが開いている間だけ」に限定する。
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  useEffect(() => {
    if (!isRecording || recordingStartedAt === null) {
      setRecordingElapsed(0);
      setRecordingNudge(false);
      silenceStartRef.current = null;
      return;
    }
    setRecordingElapsed(Date.now() - recordingStartedAt);
    const id = setInterval(() => {
      setRecordingElapsed(Date.now() - recordingStartedAt);

      let level = 0;
      try {
        const status = recorder.getStatus();
        const db = typeof status.metering === "number" ? status.metering : -60;
        level = Math.max(0, Math.min(1, (db + 60) / 55));
      } catch {
        level = 0;
      }
      if (level < SILENCE_LEVEL_THRESHOLD) {
        if (silenceStartRef.current === null) silenceStartRef.current = Date.now();
        else if (Date.now() - silenceStartRef.current >= SILENCE_NUDGE_MS) setRecordingNudge(true);
      } else {
        silenceStartRef.current = null;
        setRecordingNudge(false);
      }
    }, 200);
    return () => clearInterval(id);
  }, [isRecording, recordingStartedAt, recorder]);

  const promptVisible = (isIdleHero && promptShown) || (isRecording && recordingNudge);
  const promptOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (promptVisible) {
      promptOpacity.setValue(0);
      Animated.timing(promptOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      promptOpacity.setValue(0);
    }
  }, [promptVisible, promptOpacity]);

  const canClose = phase === "idle" || phase === "carved" || phase === "error";
  const remainingMs = Math.max(0, MAX_RECORD_MS - recordingElapsed);
  const progress = Math.min(recordingElapsed / MAX_RECORD_MS, 1);
  const ringOffset = CIRC * (1 - progress);

  const topStatus =
    permissionDenied ? "マイクを許可しろ" : statusText !== "" ? statusText : isBusy ? "CARVING" : isRecording ? "RECORDING" : "";

  return (
    <>
      <Pressable
        onPress={onClose}
        disabled={!canClose}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        style={[styles.closeBtn, { top: insets.top + 12 }, !canClose && styles.closeBtnDisabled]}
      >
        <XIcon size={22} color={colors.ink} weight="bold" />
      </Pressable>

      {isCarved && carvedPost ? (
        <CompleteView
          carvedPost={carvedPost}
          week={week}
          totalMinutes={totalMinutes}
          streak={streak}
          bottomInset={insets.bottom}
          onBack={onClose}
        />
      ) : limitReached ? (
        <View style={styles.limitView}>
          <Text style={styles.limitCount}>{maxDaily} / {maxDaily}</Text>
          <Text style={styles.limitMsg}>今日はここまで。{"\n"}明日また話せ。</Text>
        </View>
      ) : (
        <View style={[styles.speakView, { paddingTop: insets.top + 24 }]}>
          {topStatus !== "" && <Text style={[styles.speakTop, isBusy && styles.speakTopBusy]}>{topStatus}</Text>}
          {isRecording && <Text style={styles.timer}>{formatCountdown(remainingMs)}</Text>}

          <View style={styles.stage}>
            {phase === "idle" && <FloatingDots />}
            {isRecording && <Waveform recorder={recorder} />}
            {isBusy && <Spinner />}
          </View>

          <View style={[styles.bottom, { paddingBottom: 80 + insets.bottom }]}>
            {(isIdleHero || isRecording) && promptVisible && (
              <Animated.Text style={[styles.promptText, { opacity: promptOpacity }]}>{prompt}</Animated.Text>
            )}
            {isIdleHero && remaining < 3 && <Text style={styles.remaining}>{remaining} LEFT</Text>}

            <View style={styles.micWrap}>
              {isRecording && (
                <Svg width={116} height={116} style={styles.ring}>
                  <Circle cx={58} cy={58} r={RING} stroke="rgba(255,255,255,0.25)" strokeWidth={3} fill="none" />
                  <Circle
                    cx={58}
                    cy={58}
                    r={RING}
                    stroke="#fff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 58 58)"
                  />
                </Svg>
              )}
              <MicButton
                recording={isRecording}
                busy={isBusy}
                denied={permissionDenied}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
              />
            </View>
          </View>
        </View>
      )}
    </>
  );
}

function MicButton({
  recording,
  busy,
  denied,
  onPressIn,
  onPressOut,
}: {
  recording: boolean;
  busy: boolean;
  denied: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="長押しで録音"
        accessibilityState={{ selected: recording }}
        style={({ pressed }) => [styles.micButton, denied && styles.micDenied, busy && styles.micDisabled, pressed && styles.micPressed]}
      >
        {denied ? (
          <MicrophoneSlashIcon size={40} color={colors.yuzuZest} weight="fill" />
        ) : (
          <MicrophoneIcon size={40} color={colors.yuzuZest} weight="fill" />
        )}
      </Pressable>
    </Animated.View>
  );
}

function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

function CompleteView({
  carvedPost,
  week,
  totalMinutes,
  streak,
  bottomInset,
  onBack,
}: {
  carvedPost: CarvedPost;
  week: WeekDay[];
  totalMinutes: number;
  streak: number;
  bottomInset: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const minutesView = useCountUp(totalMinutes, { delayMs: 1200 });
  const streakView = useCountUp(streak, { delayMs: 1200 });

  return (
    <View style={[styles.completeView, { paddingTop: insets.top + 56, paddingBottom: 48 + bottomInset }]}>
      <Text style={styles.completeStamp}>CARVED</Text>
      <Text style={styles.completeIndex}>#{carvedPost.index}</Text>
      <View style={styles.completeCard}>
        <Text style={styles.completeText}>{carvedPost.text}</Text>
      </View>

      <View style={styles.streakBlock}>
        <View style={styles.streakWeek}>
          {week.map((d, i) => (
            <View key={i} style={styles.streakDay}>
              <Text style={styles.streakDayLabel}>{d.label}</Text>
              <View style={[styles.streakCheck, d.done && styles.streakCheckDone, d.isToday && styles.streakCheckToday]}>
                {d.done && <Text style={styles.streakCheckMark}>✓</Text>}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.completeStats}>
          <View style={styles.completeStatCard}>
            <Text style={styles.completeStatLabel}>MINUTES</Text>
            <Text style={styles.completeStatValue}>{minutesView}</Text>
          </View>
          <View style={styles.completeStatCard}>
            <Text style={styles.completeStatLabel}>STREAK</Text>
            <Text style={styles.completeStatValue}>{streakView}</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
        <Text style={styles.backBtnLabel}>閉じる</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.yuzuYellow },
  closeBtn: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    zIndex: 3,
  },
  closeBtnDisabled: { opacity: 0.35 },

  speakView: { flex: 1, width: "100%", alignItems: "center", paddingHorizontal: 20 },
  speakTop: {
    marginTop: 24,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxl,
    color: "#fff",
    letterSpacing: fontSize.xxl * 0.02,
    alignSelf: "stretch",
  },
  speakTopBusy: { opacity: 0.7 },
  timer: { marginTop: 4, fontSize: fontSize.xl, color: "rgba(255,255,255,0.85)", alignSelf: "stretch", letterSpacing: fontSize.xl * letterSpacing.wide },
  stage: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", minHeight: 240 },
  bottom: { width: "100%", alignItems: "center", gap: 28 },
  promptText: { fontSize: 28, lineHeight: 28 * 1.35, fontWeight: "700", color: "#fff", textAlign: "center", maxWidth: 320 },
  remaining: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: "rgba(255,255,255,0.5)", letterSpacing: fontSize.xs * letterSpacing.label },

  micWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", top: -10, left: -10 },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  micDenied: { opacity: 0.6 },
  micDisabled: { opacity: 0.55 },
  micPressed: { transform: [{ scale: 0.93 }] },

  spinner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
  },

  limitView: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  limitCount: { fontFamily: fonts.displayBold, fontSize: fontSize.xxxl, color: "#fff", letterSpacing: fontSize.xxxl * letterSpacing.wider, opacity: 0.9 },
  limitMsg: { fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.7, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  completeView: { flex: 1, width: "100%", alignItems: "center", paddingHorizontal: 24, gap: 28 },
  completeStamp: { fontFamily: fonts.displayBlack, fontSize: 40, color: "#fff", letterSpacing: -0.8 },
  completeIndex: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: "#fff", marginTop: -16 },
  completeCard: { width: "100%", maxWidth: 420, backgroundColor: colors.ink, borderRadius: 2, padding: 22 },
  completeText: { fontSize: fontSize.base, lineHeight: fontSize.base * 1.75, color: "#fff" },
  streakBlock: { width: "100%", maxWidth: 420, alignItems: "center", gap: 16 },
  streakWeek: { flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 4 },
  streakDay: { flex: 1, alignItems: "center", gap: 6 },
  streakDayLabel: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.85)" },
  streakCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  streakCheckDone: { backgroundColor: "#fff", borderColor: "#fff" },
  streakCheckToday: { borderColor: "rgba(255,255,255,0.9)", borderWidth: 2 },
  streakCheckMark: { fontSize: 14, fontWeight: "700", color: colors.yuzuZest },
  completeStats: { flexDirection: "row", width: "100%", gap: 12 },
  completeStatCard: {
    flex: 1,
    alignItems: "flex-start",
    gap: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 2,
  },
  completeStatLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: "rgba(255,255,255,0.6)", letterSpacing: fontSize.xs * letterSpacing.widest, textTransform: "uppercase" },
  completeStatValue: { fontFamily: fonts.displayBlack, fontSize: 44, color: "#fff", lineHeight: 44 },
  backBtn: { backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 36, borderRadius: 4 },
  backBtnPressed: { transform: [{ scale: 0.97 }] },
  backBtnLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: colors.ink, letterSpacing: fontSize.sm * letterSpacing.wider },
});
