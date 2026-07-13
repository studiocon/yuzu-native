import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { XIcon } from "phosphor-react-native";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import * as haptics from "../lib/haptics";

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
  onClose: () => void;
};

// yuzu-app の ApiTokenModal.tsx を移植（CONNECT 設定内・MCP 用パーソナルアクセストークン発行）。
export default function ApiTokenScreen({ visible, onClose }: Props) {
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
  }, [visible]);

  async function loadTokens() {
    setLoadingList(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/account/tokens`);
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
      const res = await apiFetch(`${API_BASE}/api/account/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      haptics.success();
    } catch {
      setError("発行できなかった。もう一度。");
      haptics.error();
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/account/tokens?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setTokens((prev) => prev.filter((t) => t.id !== id));
      haptics.tapLight();
    } catch {
      setError("削除できなかった。もう一度。");
      haptics.error();
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!justIssued) return;
    await Clipboard.setStringAsync(justIssued);
    setCopied(true);
    haptics.success();
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden hideTransitionAnimation="none" />
      {/* RN の Modal は別ネイティブウィンドウに描画され、root の SafeAreaProvider から inset を
          正しく継承できないことがある（マウント順依存でヘッダーが Dynamic Island に隠れる事故）。
          react-native-safe-area-context の推奨どおり、Modal 直下に新しい SafeAreaProvider を置く。 */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{step === "created" ? "ISSUED" : "CONNECT"}</Text>
          <Pressable
            onPress={() => {
              haptics.tapLight();
              onClose();
            }}
            disabled={issuing}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <XIcon size={22} color={colors.ink} weight="bold" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
                        <Text style={styles.tokenName} numberOfLines={1}>{t.name}</Text>
                        <Text style={styles.tokenPrefix}>{t.tokenPrefix}…</Text>
                      </View>
                      <Text style={styles.tokenMeta}>
                        {formatDate(t.createdAt)} 発行 · {t.lastUsedAt ? `${formatDate(t.lastUsedAt)} 使用` : "未使用"}
                      </Text>
                      <Pressable
                        onPress={() => handleRevoke(t.id)}
                        disabled={revokingId === t.id}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.name} を削除`}
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
                accessibilityRole="button"
                accessibilityLabel="トークンを発行"
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

                <Pressable
                  onPress={handleCopy}
                  accessibilityRole="button"
                  accessibilityLabel="トークンをコピー"
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                >
                  <Text style={styles.primaryBtnLabel}>{copied ? "COPIED" : "コピー"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    haptics.tapLight();
                    setStep("list");
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="一覧へ戻る"
                  style={styles.backLink}
                >
                  <Text style={styles.backLinkLabel}>一覧へ戻る</Text>
                </Pressable>
              </>
            )
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  flex: { flex: 1 },
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
  sub: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkSecondary, lineHeight: fontSize.base * 1.6 },
  empty: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkMuted },
  tokenItem: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  tokenItemMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  tokenName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: fontSize.base, color: colors.ink },
  tokenPrefix: { fontFamily: fonts.displayRegular, fontSize: fontSize.xs, color: colors.inkMuted },
  tokenMeta: { fontFamily: fonts.bodyRegular, fontSize: fontSize.xs, color: colors.inkMuted },
  revokeBtn: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  revokeBtnPressed: { opacity: 0.6 },
  revokeLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.danger },
  field: { gap: spacing.xs },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
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
  error: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.danger },
  primaryBtn: { backgroundColor: colors.ink, borderRadius: radius.button, paddingVertical: spacing.md, alignItems: "center" },
  primaryBtnPressed: { opacity: 0.85 },
  primaryBtnLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: "#fff", letterSpacing: fontSize.sm * letterSpacing.wide },
  secretBox: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radius.button, padding: spacing.md, backgroundColor: colors.surfaceCard },
  secretValue: { fontFamily: fonts.displayRegular, fontSize: fontSize.sm, color: colors.ink },
  backLink: { alignItems: "center", paddingVertical: spacing.sm },
  backLinkLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.inkSecondary },
});
