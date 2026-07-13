import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MicrophoneIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, recordingGlowShadow, spacing } from "../lib/theme";
import { useRecording, type TranscribeOutcome } from "../lib/useRecording";
import { savePendingRecord, type PendingRecord } from "../lib/pendingRecord";
import * as haptics from "../lib/haptics";
import AuthScreen from "./AuthScreen";
import RecordModal from "./RecordModal";

// yuzu-app app/page.tsx:447 と同じ固定プロンプト（オンボーディングでは pickPrompt は使わない）。
const ONBOARDING_PROMPT = "10秒でいい、考えてることを刻め。";

// 未ログイン onboarding: hero（マイク起動）→ 録音モーダル → プレビュー（刻む）→ ログイン → 保存。
// 実際のサーバ保存は RecordScreen マウント時（ログイン後）に pendingRecord 経由で行う。
export default function OnboardingScreen() {
  const [pending, setPending] = useState<PendingRecord | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const recording = useRecording({
    onTranscribed: handleTranscribed,
  });

  async function handleTranscribed(outcome: TranscribeOutcome) {
    if (outcome.kind === "text") {
      setRecordOpen(false);
      setPending({ text: outcome.text, durationMs: outcome.durationMs });
      return;
    }
    // login_required と daily_limit（匿名では通常発生しないが 429 body 破損時等の防御）は
    // どちらもログイン誘導に倒す。yuzu-app app/page.tsx:103-106 と同じ扱い。メッセージは出さない。
    if (outcome.kind === "login_required" || outcome.kind === "daily_limit") {
      setRecordOpen(false);
      setAuthOpen(true);
      return;
    }
    // "error" はフック側で phase/statusText を設定済み。モーダル内にそのまま表示されるので何もしない。
  }

  function openRecord() {
    haptics.tapLight();
    recording.reset();
    setRecordOpen(true);
  }

  function closeRecord() {
    haptics.tapLight();
    setRecordOpen(false);
    recording.reset();
  }

  async function handleSave() {
    if (!pending) return;
    haptics.tapMedium();
    // ここではサーバに保存しない。ログイン後に RecordScreen が pendingRecord を読み出して POST する
    // （yuzu-app の handleOnboardingSave と同じ二段構え）。
    await savePendingRecord(pending);
    setAuthOpen(true);
  }

  if (authOpen) {
    return <AuthScreen onBack={() => setAuthOpen(false)} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {pending ? (
        <PreviewView pending={pending} onSave={handleSave} />
      ) : (
        <HeroView
          onOpenRecord={openRecord}
          onLogin={() => {
            haptics.tapLight();
            setAuthOpen(true);
          }}
        />
      )}

      <RecordModal
        visible={recordOpen}
        phase={recording.phase}
        statusText={recording.statusText}
        permissionDenied={recording.permissionDenied}
        recorder={recording.recorder}
        recordingStartedAt={recording.recordingStartedAt}
        prompt={ONBOARDING_PROMPT}
        // carved 系 props は onboarding では実際には参照されない（"text" outcome で即座に
        // モーダルを閉じてプレビュー画面に遷移するため carved phase に入らない）。
        // limitReached は常に false 固定: 匿名ユーザーの1日上限はクライアント側で追跡せず、
        // サーバの 429(daily_limit) レスポンスをそのままログイン誘導に倒す（RecordModal.tsx 側は変更不可のため、
        // limitReached=true 用の別ビューに迷い込ませないダミー値として安全に埋める）。
        remaining={1}
        maxDaily={1}
        limitReached={false}
        carvedPost={null}
        week={[]}
        totalMinutes={0}
        streak={0}
        onPressIn={recording.handlePressIn}
        onPressOut={recording.handlePressOut}
        onClose={closeRecord}
      />
    </SafeAreaView>
  );
}

function HeroView({ onOpenRecord, onLogin }: { onOpenRecord: () => void; onLogin: () => void }) {
  return (
    <View style={styles.hero}>
      <View />
      <View style={styles.heroCenter}>
        <View style={styles.heroCopy}>
          <Text style={styles.headline}>声を刻め</Text>
          <Text style={styles.sub}>長押しで話せ</Text>
        </View>

        <Pressable
          onPress={onOpenRecord}
          accessibilityRole="button"
          accessibilityLabel="録音を開く"
          style={({ pressed }) => [styles.mic, pressed && styles.micPressed]}
        >
          <MicrophoneIcon size={40} color={colors.ink} weight="fill" />
        </Pressable>
      </View>

      {/* 既存ユーザー向けの控えめなログイン導線。yuzu-app には無いネイティブ独自の要素。 */}
      <Pressable
        onPress={onLogin}
        accessibilityRole="button"
        accessibilityLabel="ログイン"
        style={({ pressed }) => [styles.loginLink, pressed && styles.loginLinkPressed]}
      >
        <Text style={styles.loginLinkLabel}>ログイン</Text>
      </Pressable>
    </View>
  );
}

function PreviewView({ pending, onSave }: { pending: PendingRecord; onSave: () => void }) {
  return (
    <View style={styles.preview}>
      <Text style={styles.stamp}>CARVED</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>{pending.text}</Text>
      </View>
      <View style={styles.actions}>
        <Text style={styles.guide}>残すには、登録しろ</Text>
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel="刻む"
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
        >
          <Text style={styles.saveBtnLabel}>刻む</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  heroCenter: { alignItems: "center", gap: spacing.xxl },
  heroCopy: { alignItems: "center", gap: spacing.sm },
  headline: {
    fontSize: fontSize.xxxl,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    letterSpacing: fontSize.xxxl * letterSpacing.tight,
    textAlign: "center",
  },
  sub: { fontSize: fontSize.base, color: colors.inkSecondary, textAlign: "center" },
  mic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.yuzuYellow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    ...recordingGlowShadow,
  },
  micPressed: { transform: [{ scale: 0.94 }] },
  loginLink: { padding: spacing.sm },
  loginLinkPressed: { opacity: 0.6 },
  loginLinkLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkMuted },

  preview: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.md,
    gap: spacing.lg,
  },
  stamp: { alignSelf: "flex-start", fontFamily: fonts.displayBlack, fontSize: 40, color: colors.ink, letterSpacing: -0.8 },
  card: { width: "100%", backgroundColor: colors.ink, borderRadius: radius.card, padding: 22 },
  cardText: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.75, color: colors.yuzuWhite },
  actions: { width: "100%", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  guide: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkSecondary, textAlign: "center" },
  saveBtn: {
    width: "100%",
    height: 52,
    backgroundColor: colors.ink,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnPressed: { transform: [{ scale: 0.97 }] },
  saveBtnLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.base,
    color: colors.yuzuYellow,
    letterSpacing: fontSize.base * letterSpacing.wide,
  },
});
