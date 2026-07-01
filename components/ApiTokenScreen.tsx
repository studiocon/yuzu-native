import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";
const NAME_MAX = 40;

type TokenItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
};

type Step = "list" | "created";

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type Props = {
  visible: boolean;
  accessToken: string;
  onClose: () => void;
};

// yuzu-app の ApiTokenModal.tsx を移植（CONNECT 設定内・MCP 用パーソナルアクセストークン発行）。
export default function ApiTokenScreen({ visible, accessToken, onClose }: Props) {
  const [step, setStep] = useState<Step>("list");
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [justIssued, setJustIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep("list");
    setNewTokenName("");
    setJustIssued(null);
    setCopied(false);
    setError(null);
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function loadTokens() {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/tokens`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
    } catch {
      setError("読み込めなかった。もう一度。");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleIssue() {
    if (issuing) return;
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/account/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: newTokenName.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTokens((prev) => [
        { id: data.id, name: data.name, tokenPrefix: data.tokenPrefix, createdAt: data.createdAt, lastUsedAt: data.lastUsedAt },
        ...prev,
      ]);
      setJustIssued(data.token);
      setNewTokenName("");
      setStep("created");
    } catch {
      setError("発行できなかった。もう一度。");
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/account/tokens?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("削除できなかった。もう一度。");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!justIssued) return;
    await Clipboard.setStringAsync(justIssued);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{step === "created" ? "ISSUED" : "CONNECT"}</Text>
          <Pressable
            onPress={onClose}
            disabled={issuing}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <XIcon size={22} color={colors.ink} weight="bold" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {step === "list" ? (
            <>
              <Text style={styles.sub}>
                トークンを渡せば、外部の AI から記録を読める。{"\n"}漏れたら声が読まれる。人に見せるな。
              </Text>

              {loadingList ? (
                <ActivityIndicator color={colors.inkMuted} />
              ) : tokens.length === 0 ? (
                <Text style={styles.empty}>トークンは無い</Text>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {tokens.map((t) => (
                    <View key={t.id} style={styles.tokenItem}>
                      <View style={styles.tokenItemMain}>
                        <Text style={styles.tokenName}>{t.name}</Text>
                        <Text style={styles.tokenPrefix}>{t.tokenPrefix}…</Text>
                      </View>
                      <Text style={styles.tokenMeta}>
                        {formatDate(t.createdAt)} 発行 · {t.lastUsedAt ? `${formatDate(t.lastUsedAt)} 使用` : "未使用"}
                      </Text>
                      <Pressable
                        onPress={() => handleRevoke(t.id)}
                        disabled={revokingId === t.id}
                        style={({ pressed }) => [styles.revokeBtn, pressed && styles.revokeBtnPressed]}
                      >
                        <Text style={styles.revokeLabel}>削除</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>名前（任意）</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MCP"
                  placeholderTextColor={colors.inkMuted}
                  value={newTokenName}
                  onChangeText={setNewTokenName}
                  maxLength={NAME_MAX}
                  editable={!issuing}
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={handleIssue}
                disabled={issuing}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              >
                <Text style={styles.primaryBtnLabel}>{issuing ? "発行中…" : "トークンを発行"}</Text>
              </Pressable>
            </>
          ) : (
            justIssued && (
              <>
                <Text style={styles.sub}>
                  今だけ表示する。コピーしろ。{"\n"}閉じたら二度と見れない。
                </Text>

                <View style={styles.secretBox}>
                  <Text style={styles.secretValue} selectable>{justIssued}</Text>
                </View>

                <Pressable onPress={handleCopy} style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
                  <Text style={styles.primaryBtnLabel}>{copied ? "COPIED" : "コピー"}</Text>
                </Pressable>

                <Pressable onPress={() => setStep("list")} style={styles.backLink}>
                  <Text style={styles.backLinkLabel}>一覧へ戻る</Text>
                </Pressable>
              </>
            )
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
  body: { padding: spacing.xl, gap: spacing.xl },
  sub: { fontSize: fontSize.base, color: colors.inkSecondary, lineHeight: fontSize.base * 1.6 },
  empty: { fontSize: fontSize.base, color: colors.inkMuted },
  tokenItem: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  tokenItemMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tokenName: { fontSize: fontSize.base, color: colors.ink, fontWeight: "700" },
  tokenPrefix: { fontFamily: fonts.displayRegular, fontSize: fontSize.xs, color: colors.inkMuted },
  tokenMeta: { fontSize: fontSize.xs, color: colors.inkMuted },
  revokeBtn: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  revokeBtnPressed: { opacity: 0.6 },
  revokeLabel: { fontSize: fontSize.sm, color: colors.danger },
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
  error: { fontSize: fontSize.sm, color: colors.danger },
  primaryBtn: { backgroundColor: colors.ink, borderRadius: radius.button, paddingVertical: spacing.md, alignItems: "center" },
  primaryBtnPressed: { opacity: 0.85 },
  primaryBtnLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: "#fff", letterSpacing: fontSize.sm * letterSpacing.wide },
  secretBox: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radius.button, padding: spacing.md, backgroundColor: colors.surfaceCard },
  secretValue: { fontFamily: fonts.displayRegular, fontSize: fontSize.sm, color: colors.ink },
  backLink: { alignItems: "center", paddingVertical: spacing.sm },
  backLinkLabel: { fontSize: fontSize.sm, color: colors.inkSecondary },
});
