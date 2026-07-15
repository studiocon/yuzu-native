import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { AudioRecorder } from "expo-audio";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { MicrophoneIcon, MicrophoneSlashIcon, XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing } from "../lib/theme";
import type { WeekDay } from "../lib/streak";
import type { Post } from "../lib/types";
import { buildTickerEntries, CARVING_STEP_AT_MS, type TickerEntry } from "../lib/carvingStage";
import { useCountUp } from "../lib/useCountUp";
import FloatingDots from "./FloatingDots";
import Waveform from "./Waveform";

// CARVING タイトルの刻印演出は常にこの文字列を1文字ずつアニメーションする
// （topStatus とは独立。isBusy 中は statusText が入らないため常に "CARVING" 表示で一致する）。
const CARVING_CHARS = "CARVING".split("");

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
  /** CARVING 中のティッカーに流す過去 LOG。空/未指定なら FloatingDots にフォールバック。 */
  pastLogs?: Post[];
  /** CARVING 完了後に刻まれる番号。null/未指定なら NEXT ステップ自体を出さない。 */
  nextIndex?: number | null;
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
      {/* RN の Modal は別ネイティブウィンドウに描画され、root の SafeAreaProvider から inset を
          正しく継承できないことがある（マウント順依存でヘッダーが Dynamic Island に隠れる事故）。
          react-native-safe-area-context の推奨どおり、Modal 直下に新しい SafeAreaProvider を置く。 */}
      <SafeAreaProvider>
        <View style={styles.root}>
          <RecordModalBackground />
          <ModalBody {...props} />
        </View>
      </SafeAreaProvider>
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
  pastLogs,
  nextIndex,
  onPressIn,
  onPressOut,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isRecording = phase === "recording";
  const isBusy = phase === "carving";
  const isCarved = phase === "carved";
  const isIdleHero = phase === "idle" && !permissionDenied && statusText === "";

  // CARVING 演出（刻印タイトル・ステップ進行・ティッカー）はすべてこのフラグに従う。
  // IndexDetailModal と同じパターンで一度だけ取得し、子コンポーネントに配る。
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
          {isBusy ? (
            <CarvedTitle reduceMotion={reduceMotion} />
          ) : (
            topStatus !== "" && (
              <Text style={[styles.speakTop, topStatus === "RECORDING" && styles.speakTopEn]}>{topStatus}</Text>
            )
          )}
          {isRecording && <Text style={styles.timer}>{formatCountdown(remainingMs)}</Text>}
          {isBusy && <CarvingSteps nextIndex={nextIndex} reduceMotion={reduceMotion} />}

          <View style={styles.stage}>
            {phase === "idle" && <FloatingDots />}
            {isRecording && <Waveform recorder={recorder} />}
            {isBusy && <CarvingStage pastLogs={pastLogs} reduceMotion={reduceMotion} />}
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

// CARVING タイトル：「CARVING」を1文字ずつ刻印するように opacity/translateY を stagger させる。
// 文字数は固定なので常に全 Text をレンダリングし、アニメーションだけで出し分ける
// （途中で文字数が変わるとレイアウトが跳ねるため）。
function CarvedTitle({ reduceMotion }: { reduceMotion: boolean }) {
  const anims = useRef(CARVING_CHARS.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;

  useEffect(() => {
    if (reduceMotion) {
      anims.forEach((v) => v.setValue(1));
      return;
    }
    anims.forEach((v) => v.setValue(0));
    const anim = Animated.stagger(
      70,
      anims.map((v) => Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true })),
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, anims]);

  return (
    <View style={[styles.carvedTitleRow, styles.speakTopBusy]}>
      {CARVING_CHARS.map((c, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
        return (
          <Animated.Text key={i} style={[styles.carvedTitleChar, { opacity: anims[i], transform: [{ translateY }] }]}>
            {c}
          </Animated.Text>
        );
      })}
    </View>
  );
}

// CARVING ステップラベル：表示されるたびに 200ms でフェードインする。
// step の切り替えごとに別要素として mount/unmount されるので、mount = 切替タイミングになる。
function CarvingStepLabel({ reduceMotion, children }: { reduceMotion: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const anim = Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, opacity]);
  return <Animated.Text style={[styles.carvingStepLabel, { opacity }]}>{children}</Animated.Text>;
}

// step2（NEXT #NNN）で初めてマウントされる。マウント時に 0→nextIndex のカウントアップが走る。
function CarvingNextLabel({ nextIndex }: { nextIndex: number }) {
  const count = useCountUp(nextIndex, { durationMs: 800 });
  return <>{`NEXT #${String(count).padStart(3, "0")}`}</>;
}

// CARVING ステップドット：アクティブなドットだけ白パルス（scale 1→1.25、1.2秒ループ）。
function CarvingDot({ active, passed, reduceMotion }: { active: boolean; passed: boolean; reduceMotion: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduceMotion) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, scale]);

  const opacity = active ? 1 : passed ? 0.9 : 0.3;
  return <Animated.View style={[styles.carvingDot, { opacity, transform: [{ scale }] }]} />;
}

// CARVING ステップ進行：ドット3つ（nextIndex が無ければ2つ）+ アクティブなステップのラベル。
// マウント時に CARVING_STEP_AT_MS[1]/[2] で setTimeout を張るだけで、時間では最終ステップから
// 進めない（実際の phase 変化だけが終端 —— 待ちが長引いてもステップは足踏みする）。
function CarvingSteps({ nextIndex, reduceMotion }: { nextIndex: number | null | undefined; reduceMotion: boolean }) {
  const hasStep2 = typeof nextIndex === "number";
  const dotCount = hasStep2 ? 3 : 2;
  const [step, setStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setStep(1), CARVING_STEP_AT_MS[1]),
    ];
    if (hasStep2) {
      timers.push(setTimeout(() => setStep(2), CARVING_STEP_AT_MS[2]));
    }
    return () => timers.forEach(clearTimeout);
  }, [hasStep2]);

  return (
    <View style={styles.carvingSteps}>
      <View style={styles.carvingDots}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <CarvingDot key={i} active={i === step} passed={i < step} reduceMotion={reduceMotion} />
        ))}
      </View>
      {/* ステップ2（中間）はラベルを出さない。正典の状態ナラティブは RECORDING→CARVING→CARVED で
          統一されており、中間状態語（SAVING 等）の挿入は語幹表の意味逸脱になる（copy-review 判定）。
          進行はドットの前進だけで示す。 */}
      {step === 2 && hasStep2 && (
        <CarvingStepLabel reduceMotion={reduceMotion}>
          <CarvingNextLabel nextIndex={nextIndex} />
        </CarvingStepLabel>
      )}
    </View>
  );
}

// CARVING センターステージ：過去 LOG があればティッカー、無ければ（オンボーディング直後の
// 匿名フォールバック）既存の FloatingDots を表示する。
function CarvingStage({ pastLogs, reduceMotion }: { pastLogs: Post[] | undefined; reduceMotion: boolean }) {
  const entries = useMemo(() => buildTickerEntries(pastLogs ?? []), [pastLogs]);
  if (entries.length === 0) return <FloatingDots />;
  return <CarvingTicker entries={entries} reduceMotion={reduceMotion} />;
}

// #NNN + 抜粋を fade-in(400ms) → hold(1800ms) → fade-out(400ms) で繰り返す。
// Animated.loop はコンテンツ差し替えができないため、start() のコールバックで次のエントリに
// 進めてから同じ sequence を再度組み立てる自前ループにしている。
function CarvingTicker({ entries, reduceMotion }: { entries: TickerEntry[]; reduceMotion: boolean }) {
  const [entryIdx, setEntryIdx] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const firstRunRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const single = reduceMotion || entries.length <= 1;
    if (single) {
      if (reduceMotion) {
        anim.setValue(1);
        firstRunRef.current = false;
        return;
      }
      anim.setValue(0);
      const anim1 = Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: firstRunRef.current ? 600 : 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });
      firstRunRef.current = false;
      anim1.start();
      return () => anim1.stop();
    }

    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: firstRunRef.current ? 600 : 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]);
    firstRunRef.current = false;
    seq.start(({ finished }) => {
      if (finished && mountedRef.current) {
        setEntryIdx((i) => (i + 1) % entries.length);
      }
    });
    return () => seq.stop();
    // entryIdx が変わるたびに次のエントリの sequence を組み立て直す（= 自前ループの駆動）。
  }, [entryIdx, entries.length, reduceMotion, anim]);

  const entry = entries[entryIdx] ?? entries[0];
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[styles.carvingTicker, { opacity: anim, transform: [{ translateY }] }]}>
      <Text style={styles.carvingTickerIndex}>{`#${String(entry.index).padStart(3, "0")}`}</Text>
      <Text style={styles.carvingTickerExcerpt} numberOfLines={2}>
        {entry.excerpt}
      </Text>
    </Animated.View>
  );
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

  // 録音本文は上限緩和（プラン差・admin 無制限）で長くなりうる。固定 flex View + gap では
  // カードが伸びた分だけ下の「閉じる」がレイアウト外へ押し出され、タップ不能になっていた。
  // 本文＋ストリークをスクロール領域に閉じ込め、「閉じる」だけ画面下部に固定フッターとして
  // 分離することで、文字量に関わらず常にタップできる位置に留める。
  return (
    <View style={styles.completeRoot}>
      <ScrollView
        style={styles.completeScroll}
        contentContainerStyle={[styles.completeScrollContent, { paddingTop: insets.top + 56 }]}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>

      <View style={[styles.completeFooter, { paddingBottom: 48 + bottomInset }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Text style={styles.backBtnLabel}>閉じる</Text>
        </Pressable>
      </View>
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xxl,
    color: "#fff",
    letterSpacing: fontSize.xxl * 0.02,
    alignSelf: "stretch",
  },
  // "RECORDING" 等の英語状態ラベルのみ Unbounded に戻す（topStatus は基本的に日本語メッセージ）。
  speakTopEn: { fontFamily: fonts.displayBold },
  speakTopBusy: { opacity: 0.7 },
  timer: { marginTop: 4, fontSize: fontSize.xl, color: "rgba(255,255,255,0.85)", alignSelf: "stretch", letterSpacing: fontSize.xl * letterSpacing.wide },
  stage: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", minHeight: 240 },
  bottom: { width: "100%", alignItems: "center", gap: 28 },
  promptText: { fontSize: 28, lineHeight: 28 * 1.35, fontFamily: fonts.bodyBold, color: "#fff", textAlign: "center", maxWidth: 320 },
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

  // CARVING タイトル：既存 speakTop の見た目を保ちつつ per-char に分解する必要があるため、
  // レイアウト（余白・センター配置）はここ、フォント指定は carvedTitleChar 側に分ける。
  carvedTitleRow: { marginTop: 24, flexDirection: "row", justifyContent: "center", alignSelf: "stretch" },
  carvedTitleChar: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxl,
    color: "#fff",
    letterSpacing: fontSize.xxl * 0.02,
  },

  carvingSteps: { marginTop: 16, alignItems: "center", gap: 10 },
  carvingDots: { flexDirection: "row", alignItems: "center", gap: 8 },
  carvingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  carvingStepLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: fontSize.xs * letterSpacing.label,
  },

  carvingTicker: { alignItems: "center", gap: 6 },
  carvingTickerIndex: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  carvingTickerExcerpt: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: "rgba(255,255,255,0.85)", textAlign: "center", maxWidth: 320 },

  limitView: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  limitCount: { fontFamily: fonts.displayBold, fontSize: fontSize.xxxl, color: "#fff", letterSpacing: fontSize.xxxl * letterSpacing.wider, opacity: 0.9 },
  limitMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.7, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  completeRoot: { flex: 1, width: "100%", alignItems: "center" },
  completeScroll: { flex: 1, width: "100%" },
  completeScrollContent: { alignItems: "center", paddingHorizontal: 24, gap: 28, paddingBottom: 8 },
  completeFooter: { width: "100%", alignItems: "center", paddingHorizontal: 24, paddingTop: 20 },
  completeStamp: { fontFamily: fonts.displayBlack, fontSize: 40, color: "#fff", letterSpacing: -0.8 },
  completeIndex: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: "#fff", marginTop: -16 },
  completeCard: { width: "100%", maxWidth: 420, backgroundColor: colors.ink, borderRadius: 2, padding: 22 },
  completeText: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.75, color: "#fff" },
  streakBlock: { width: "100%", maxWidth: 420, alignItems: "center", gap: 16 },
  streakWeek: { flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 4 },
  streakDay: { flex: 1, alignItems: "center", gap: 6 },
  streakDayLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.xs, color: "rgba(255,255,255,0.85)" },
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
  backBtnLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: colors.ink, letterSpacing: fontSize.sm * letterSpacing.wider },
});
