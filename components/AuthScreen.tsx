import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";

type Step = "email" | "code";

// 厳密なRFC検証はしない。明らかに未完成な入力（@や.が無い等）だけ弾いて
// 無駄な送信リクエストを減らすための軽いチェック。
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

type Props = {
  /** 指定時のみ email ステップに戻る導線を表示する（onboarding からの遷移用）。 */
  onBack?: () => void;
};

export default function AuthScreen({ onBack }: Props = {}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEmailValid = EMAIL_PATTERN.test(email.trim());

  // ディープリンク（exp://）のリダイレクト一致が不安定なため、6桁コード入力に統一。
  // emailRedirectTo を渡さなければメールのリンクではなく数字コードが主導線になる。
  async function handleSend() {
    if (!isEmailValid) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) {
      setError("送れなかった。もう一度。");
      return;
    }
    setStep("code");
  }

  async function handleVerify() {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError("コードが違う。もう一度。");
      return;
    }
    // 成功時は App.tsx の onAuthStateChange が session を拾う
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <View style={styles.brand}>
            <Text style={styles.logo}>YUZU</Text>
            <Text style={styles.tagline}>BE TRUE</Text>
          </View>

          {step === "email" ? (
            <>
              <Text style={styles.h2}>MAIL</Text>
              <Text style={styles.sub}>アドレスを入れろ</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                accessibilityLabel="メールアドレス"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              {error !== "" && (
                <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleSend}
                disabled={loading || !isEmailValid}
                accessibilityRole="button"
                accessibilityLabel="コードを送れ"
              >
                <Text style={styles.buttonLabel}>{loading ? "送信中…" : "送れ"}</Text>
              </Pressable>
              {onBack && (
                <Pressable
                  onPress={onBack}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="戻る"
                >
                  <Text style={styles.back}>戻る</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={styles.h2}>CODE</Text>
              <Text style={styles.sub}>{email}{"\n"}に届いたコードを入れろ</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={colors.inkMuted}
                keyboardType="number-pad"
                maxLength={10}
                value={code}
                onChangeText={setCode}
                editable={!loading}
                accessibilityLabel="認証コード"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
              {error !== "" && (
                <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleVerify}
                disabled={loading || code.trim().length < 4}
                accessibilityRole="button"
                accessibilityLabel="コードを確認"
              >
                <Text style={styles.buttonLabel}>{loading ? "確認中…" : "確認"}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setStep("email"); setCode(""); setError(""); }}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="メール入力に戻る"
              >
                <Text style={styles.back}>戻る</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  flex: { flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  brand: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  logo: {
    fontFamily: fonts.displayBlack,
    fontSize: fontSize.xxl,
    color: colors.ink,
  },
  tagline: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  sub: { fontSize: fontSize.base, color: colors.inkSecondary, textAlign: "center", lineHeight: fontSize.base * 1.6 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: fontSize.lg,
    color: colors.ink,
    textAlign: "center",
  },
  error: { color: colors.danger, fontSize: fontSize.sm },
  button: {
    backgroundColor: colors.ink,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonLabel: {
    color: colors.yuzuWhite,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    letterSpacing: fontSize.sm * letterSpacing.wider,
  },
  back: { fontSize: fontSize.sm, color: colors.inkSecondary, marginTop: spacing.xs },
});
