import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import * as haptics from "../lib/haptics";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";
const SUBJECT_MAX = 200;
const BODY_MAX = 4000;

type Step = "input" | "sent";

type Props = {
  visible: boolean;
  accessToken: string;
  defaultEmail: string;
  onClose: () => void;
};

// yuzu-app の ContactModal.tsx を移植（設定 > SUPPORT > 問い合わせ）。
export default function ContactScreen({ visible, accessToken, defaultEmail, onClose }: Props) {
  const [step, setStep] = useState<Step>("input");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep("input");
    setSubject("");
    setBody("");
    setEmail(defaultEmail);
    setError(null);
  }, [visible, defaultEmail]);

  const submittable = subject.trim().length > 0 && body.trim().length > 0 && subject.length <= SUBJECT_MAX && body.length <= BODY_MAX;

  async function handleSubmit() {
    if (!submittable || loading) return;
    haptics.tapMedium();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), email: email.trim() || undefined }),
      });
      if (!res.ok) {
        let code = "";
        try {
          const data = await res.json();
          if (data && typeof data.error === "string") code = data.error;
        } catch {
          // noop
        }
        if (res.status === 429 || code === "rate_limited") setError("立て続けだ。間を置いてもう一度。");
        else if (code === "too_long") setError("長すぎる。少し削ってもう一度。");
        else if (code === "missing_fields") setError("タイトルと本文を埋めろ。");
        else if (res.status >= 500) setError("いま送れなかった。間を置いてもう一度。");
        else setError("送れなかった。内容を確かめてもう一度。");
        haptics.error();
        setLoading(false);
        return;
      }
      setStep("sent");
      haptics.success();
    } catch {
      setError("届かなかった。電波のいい所でもう一度。");
      haptics.error();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden hideTransitionAnimation="none" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{step === "sent" ? "SENT" : "CONTACT"}</Text>
          <Pressable
            onPress={() => {
              haptics.tapLight();
              onClose();
            }}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <XIcon size={22} color={colors.ink} weight="bold" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {step === "input" ? (
            <>
              <Text style={styles.sub}>改善要望、不具合、感想。{"\n"}声を聞かせてくれ。</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>タイトル</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例: ◯◯がうまく動かない"
                  placeholderTextColor={colors.inkMuted}
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={SUBJECT_MAX}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>本文</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="うまくいかない所、ほしい機能。なんでも出せ"
                  placeholderTextColor={colors.inkMuted}
                  value={body}
                  onChangeText={setBody}
                  maxLength={BODY_MAX}
                  multiline
                  numberOfLines={6}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>返信用メールアドレス（任意）</Text>
                <TextInput
                  style={styles.input}
                  placeholder="返信がいるなら書け"
                  placeholderTextColor={colors.inkMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={handleSubmit}
                disabled={loading || !submittable}
                style={({ pressed }) => [styles.primaryBtn, (loading || !submittable) && styles.primaryBtnDisabled, pressed && styles.primaryBtnPressed]}
              >
                <Text style={styles.primaryBtnLabel}>{loading ? "送信中..." : "送る"}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.sub}>受け取りました。{"\n"}必要があれば返信します。</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    color: colors.inkMuted,
    letterSpacing: fontSize.sm * letterSpacing.widest,
  },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBg },
  closeBtnPressed: { backgroundColor: colors.surfaceHover },
  body: { padding: spacing.xl, gap: spacing.lg },
  sub: { fontSize: fontSize.base, color: colors.inkSecondary, lineHeight: fontSize.base * 1.6 },
  field: { gap: spacing.xs },
  fieldLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  error: { fontSize: fontSize.sm, color: colors.danger },
  primaryBtn: { backgroundColor: colors.ink, borderRadius: radius.button, paddingVertical: spacing.md, alignItems: "center" },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnPressed: { opacity: 0.85 },
  primaryBtnLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: "#fff", letterSpacing: fontSize.sm * letterSpacing.wide },
});
