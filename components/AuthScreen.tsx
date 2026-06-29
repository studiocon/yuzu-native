import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { INK, OFFWHITE } from "../lib/theme";

type Step = "email" | "code";

export default function AuthScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ディープリンク（exp://）のリダイレクト一致が不安定なため、6桁コード入力に統一。
  // emailRedirectTo を渡さなければメールのリンクではなく数字コードが主導線になる。
  async function handleSend() {
    if (!email.trim()) return;
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
      <View style={styles.body}>
        <Text style={styles.title}>YUZU</Text>

        {step === "email" ? (
          <>
            <Text style={styles.h2}>MAIL</Text>
            <Text style={styles.sub}>アドレスを入れろ</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#1A1A2E66"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSend}
              disabled={loading || !email.trim()}
            >
              <Text style={styles.buttonLabel}>{loading ? "送信中..." : "送れ"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.h2}>CODE</Text>
            <Text style={styles.sub}>{email}{"\n"}に届いたコードを入れろ</Text>
            <TextInput
              style={styles.input}
              placeholder="12345678"
              placeholderTextColor="#1A1A2E66"
              keyboardType="number-pad"
              maxLength={10}
              value={code}
              onChangeText={setCode}
              editable={!loading}
            />
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleVerify}
              disabled={loading || code.trim().length < 4}
            >
              <Text style={styles.buttonLabel}>{loading ? "確認中..." : "確認"}</Text>
            </Pressable>
            <Pressable onPress={() => { setStep("email"); setCode(""); setError(""); }} disabled={loading}>
              <Text style={styles.back}>戻る</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: OFFWHITE },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: "900", color: INK, letterSpacing: 1 },
  h2: { fontSize: 20, fontWeight: "800", color: INK, marginTop: 8 },
  sub: { fontSize: 14, color: INK, opacity: 0.7, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: INK,
    textAlign: "center",
  },
  error: { color: "#C0392B", fontSize: 13 },
  button: {
    backgroundColor: INK,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: OFFWHITE, fontWeight: "700", fontSize: 15 },
  back: { fontSize: 13, color: INK, opacity: 0.5, marginTop: 4 },
});
