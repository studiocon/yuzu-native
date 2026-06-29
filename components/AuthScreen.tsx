import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { INK, OFFWHITE } from "../lib/theme";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = Linking.createURL("auth-callback");

  async function handleSend() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) {
      setError("送れなかった。もう一度。");
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>YUZU</Text>

        {sent ? (
          <>
            <Text style={styles.h2}>SENT</Text>
            <Text style={styles.sub}>メールを送った。{"\n"}確認しろ。</Text>
            <Text style={styles.hint}>{email}</Text>
          </>
        ) : (
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
        )}

        {/* デバッグ用：この URL を Supabase の Redirect URLs に追加しないと #100 のコールバックが拒否される */}
        <Text style={styles.debug}>{redirectTo}</Text>
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
  hint: { fontSize: 14, color: INK, fontWeight: "600" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: INK,
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
  debug: { fontSize: 10, color: INK, opacity: 0.35, marginTop: 24, textAlign: "center" },
});
