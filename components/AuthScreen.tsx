import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { signInWithApple } from "../lib/appleAuth";
import { signInWithGoogle } from "../lib/googleAuth";
import { PRIVACY_URL, TERMS_URL } from "../lib/config";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import * as haptics from "../lib/haptics";

type Step = "select" | "email" | "code";

// 厳密なRFC検証はしない。明らかに未完成な入力（@や.が無い等）だけ弾いて
// 無駄な送信リクエストを減らすための軽いチェック。
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

type Props = {
  /** 指定時のみ email ステップに戻る導線を表示する（onboarding からの遷移用）。 */
  onBack?: () => void;
};

export default function AuthScreen({ onBack }: Props = {}) {
  const [step, setStep] = useState<Step>("select");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEmailValid = EMAIL_PATTERN.test(email.trim());

  async function handleApple() {
    setLoading(true);
    setError("");
    const message = await signInWithApple();
    setLoading(false);
    if (message) setError(message);
    // 成功時は App.tsx の onAuthStateChange が session を拾う
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    const message = await signInWithGoogle();
    setLoading(false);
    if (message) setError(message);
    // 成功時は App.tsx の onAuthStateChange が session を拾う
  }

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

          {step === "select" ? (
            <>
              <Text style={styles.h2}>SIGN IN</Text>
              <Text style={styles.sub}>声を刻め</Text>
              {error !== "" && (
                <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
              )}
              {Platform.OS === "ios" && (
                <Pressable
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  onPress={handleApple}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Appleで続ける"
                >
                  <Text style={styles.buttonLabel}>Apple で続ける</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleGoogle}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Googleで続ける"
              >
                <Text style={styles.buttonLabel}>Google で続ける</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.buttonOutline, pressed && styles.buttonPressed]}
                onPress={() => {
                  haptics.tapLight();
                  setStep("email");
                }}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="メールで続ける"
              >
                <Text style={styles.buttonOutlineLabel}>メールで続ける</Text>
              </Pressable>
              {onBack && (
                <Pressable
                  onPress={() => {
                    haptics.tapLight();
                    onBack();
                  }}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="戻る"
                >
                  <Text style={styles.back}>戻る</Text>
                </Pressable>
              )}
              <Text style={styles.legal}>
                続けることで
                <Text
                  onPress={() => {
                    haptics.tapLight();
                    Linking.openURL(TERMS_URL);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="利用規約を開く"
                  style={styles.legalLink}
                >
                  利用規約
                </Text>
                と
                <Text
                  onPress={() => {
                    haptics.tapLight();
                    Linking.openURL(PRIVACY_URL);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="プライバシーポリシーを開く"
                  style={styles.legalLink}
                >
                  プライバシーポリシー
                </Text>
                に同意したものとみなす
              </Text>
            </>
          ) : step === "email" ? (
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
              <Pressable
                onPress={() => {
                  haptics.tapLight();
                  setStep("select");
                  setError("");
                }}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="戻る"
              >
                <Text style={styles.back}>戻る</Text>
              </Pressable>
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
                onPress={() => {
                  haptics.tapLight();
                  setStep("email");
                  setCode("");
                  setError("");
                }}
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
  sub: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkSecondary, textAlign: "center", lineHeight: fontSize.base * 1.6 },
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
  error: { fontFamily: fonts.bodyRegular, color: colors.danger, fontSize: fontSize.sm },
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    letterSpacing: fontSize.sm * letterSpacing.wider,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  buttonOutlineLabel: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    letterSpacing: fontSize.sm * letterSpacing.wider,
  },
  back: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkSecondary, marginTop: spacing.xs },
  legal: {
    fontFamily: fonts.bodyRegular,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  legalLink: { color: colors.ink, textDecorationLine: "underline" },
});
