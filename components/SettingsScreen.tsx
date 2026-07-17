import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { CaretLeftIcon, CaretRightIcon, SignOutIcon, TrashIcon } from "phosphor-react-native";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { parseCurrentUser, planTypeLabel, type CurrentUser } from "../lib/currentUser";
import { loadMockMode, setMockMode } from "../lib/mockMode";
import { supabase } from "../lib/supabase";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import { useApiGet } from "../lib/useApiGet";
import * as haptics from "../lib/haptics";
import ApiTokenScreen from "./ApiTokenScreen";
import ContactScreen from "./ContactScreen";
import NotificationScreen from "./NotificationScreen";

type Props = {
  visible: boolean;
  session: Session;
  onClose: () => void;
};

export default function SettingsScreen({ visible, session, onClose }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [mockEnabled, setMockEnabled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const email = session.user.email ?? "―";
  const shortId = session.user.id.slice(0, 8) + "...";

  // role は毎回開くたびに /api/me を叩いて確認する（useApiGet の SWR キャッシュ経由。
  // admin フラグをクライアントの永続状態として持ち回さない＝サーバ側の role が唯一の真実）。
  const me = useApiGet<CurrentUser>(visible ? `${API_BASE}/api/me` : null, parseCurrentUser);
  const isAdmin = me.data?.role === "admin";
  const typeLabel = planTypeLabel(me.data, mockEnabled);

  useEffect(() => {
    if (!visible) return;
    loadMockMode().then(setMockEnabled);
  }, [visible]);

  async function handleToggleMockMode(next: boolean) {
    haptics.tapLight();
    setMockEnabled(next);
    await setMockMode(next);
  }

  async function handleCopyId() {
    await Clipboard.setStringAsync(session.user.id);
    setIdCopied(true);
    haptics.success();
    setTimeout(() => setIdCopied(false), 1500);
  }

  // signOut() の結果を待たずに onClose() していたため、scope:"global" のサーバ側失敗
  // （オフライン等）で SIGNED_OUT が発火せずセッションが残ったままなのに、UI は成功したかの
  // ように閉じていた（#13）。await + エラーチェックし、失敗時はモーダルを閉じずに
  // フィードバックを出す（App.tsx の SIGNED_OUT ハンドラは signOut 成功時のみ発火し、
  // キャッシュクリア等はそちらに任せる）。
  async function handleSignOut() {
    haptics.tapMedium();
    setSignOutError(null);
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      onClose();
    } catch {
      setSignOutError("ログアウトできなかった。もう一度。");
      haptics.error();
    } finally {
      setSigningOut(false);
    }
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
          <Pressable
            onPress={() => {
              haptics.tapLight();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          >
            <CaretLeftIcon size={24} color={colors.ink} weight="bold" />
          </Pressable>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Section title="ACCOUNT">
            <Row label="メールアドレス" value={email} />
            <Row label="種類" value={typeLabel} />
            <Pressable
              onPress={handleCopyId}
              accessibilityRole="button"
              accessibilityLabel="ユーザーIDをコピー"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>ユーザーID</Text>
              <View style={styles.rowTrailing}>
                <Text style={styles.rowValueMono}>{idCopied ? "COPIED" : shortId}</Text>
              </View>
            </Pressable>
          </Section>

          <Section title="NOTIFICATIONS">
            <Pressable
              onPress={() => {
                haptics.tapLight();
                setNotifOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="通知設定を開く"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>通知</Text>
              <CaretRightIcon size={14} color={colors.inkMuted} />
            </Pressable>
          </Section>

          <Section title="CONNECT">
            <Pressable
              onPress={() => {
                haptics.tapLight();
                setTokenOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="API トークン設定を開く"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>API トークン</Text>
              <CaretRightIcon size={14} color={colors.inkMuted} />
            </Pressable>
          </Section>

          {isAdmin && (
            <Section title="DEVELOPER">
              <View style={styles.row}>
                <Text style={styles.rowLabel}>モックモード</Text>
                <View style={styles.rowTrailing}>
                  <Switch
                    value={mockEnabled}
                    onValueChange={handleToggleMockMode}
                    trackColor={{ false: colors.surfaceBorder, true: colors.yuzuZest }}
                    accessibilityLabel="モックモード"
                  />
                </View>
              </View>
            </Section>
          )}

          <Section title="SUPPORT">
            <Pressable
              onPress={() => {
                haptics.tapLight();
                setContactOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="問い合わせを開く"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowLabel}>問い合わせ</Text>
              <CaretRightIcon size={14} color={colors.inkMuted} />
            </Pressable>
          </Section>

          {/* LEGAL セクションはページ公開後に復活させる（審査対策で一時削除） */}

          <Section title="">
            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed, signingOut && styles.rowDisabled]}
              accessibilityRole="button"
              accessibilityLabel="ログアウト"
            >
              <SignOutIcon size={16} color={colors.danger} weight="bold" />
              <Text style={styles.dangerLabel}>{signingOut ? "ログアウト中…" : "ログアウト"}</Text>
            </Pressable>
            {signOutError && <Text style={styles.confirmError}>{signOutError}</Text>}
            <Pressable
              onPress={() => {
                haptics.warning();
                setDeleteOpen(true);
              }}
              style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel="アカウントを削除"
            >
              <TrashIcon size={16} color={colors.danger} weight="bold" />
              <Text style={styles.dangerLabel}>アカウントを削除</Text>
            </Pressable>
          </Section>
        </ScrollView>

        <Text style={styles.version}>VERSION {Constants.expoConfig?.version ?? "1.0.0"}</Text>

        <DeleteAccountConfirm
          visible={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            onClose();
          }}
        />

        <ApiTokenScreen visible={tokenOpen} onClose={() => setTokenOpen(false)} />
        <NotificationScreen visible={notifOpen} onClose={() => setNotifOpen(false)} />
        <ContactScreen
          visible={contactOpen}
          defaultEmail={session.user.email ?? ""}
          onClose={() => setContactOpen(false)}
        />
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title !== "" && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowTrailing}>
        {value !== "" && (
          <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function DeleteAccountConfirm({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmText.trim().toUpperCase() === "YUZU";

  async function handleConfirm() {
    if (!canDelete) return;
    haptics.tapHeavy();
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/account`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      await supabase.auth.signOut();
      onDeleted();
    } catch {
      setDeleting(false);
      setError("削除できなかった。もう一度。");
      haptics.error();
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.confirmScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={deleting ? undefined : onClose} />
        <KeyboardAvoidingView
          style={styles.confirmKeyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>全部消す</Text>
            <Text style={styles.confirmBody}>記録も、番号も、戻らない。</Text>
            <Text style={styles.confirmPrompt}>YUZU と打て</Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmText}
              onChangeText={setConfirmText}
              editable={!deleting}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="確認のため YUZU と入力"
            />
            {error && <Text style={styles.confirmError}>{error}</Text>}
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => {
                  haptics.tapLight();
                  onClose();
                }}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="やめる"
                style={styles.confirmCancel}
              >
                <Text style={styles.confirmCancelLabel}>やめる</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={deleting || !canDelete}
                accessibilityRole="button"
                accessibilityLabel="消す"
                style={[styles.confirmConfirm, (deleting || !canDelete) && styles.confirmConfirmDisabled]}
              >
                <Text style={styles.confirmConfirmLabel}>{deleting ? "削除中…" : "消す"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBg },
  backBtnPressed: { backgroundColor: colors.surfaceHover },
  headerSpacer: { width: 48, height: 48 },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    letterSpacing: fontSize.lg * letterSpacing.wider,
  },
  body: { padding: spacing.xl, gap: spacing.xxl },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.surfaceHover },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.ink, flexShrink: 0 },
  rowTrailing: { flex: 1, flexShrink: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs, marginLeft: spacing.md },
  rowValue: { flexShrink: 1, fontSize: fontSize.sm, color: colors.inkMuted, textAlign: "right" },
  rowValueMono: { fontSize: fontSize.sm, color: colors.inkMuted, fontFamily: fonts.displayRegular },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  dangerLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.danger },
  version: {
    textAlign: "center",
    fontFamily: fonts.displayRegular,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    paddingBottom: spacing.xl,
  },
  confirmScrim: {
    flex: 1,
    backgroundColor: "rgba(26,26,46,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  confirmKeyboardView: { width: "100%", alignItems: "center" },
  confirmPanel: {
    width: "100%",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  confirmTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.xl, color: colors.ink },
  confirmBody: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkSecondary, marginBottom: spacing.sm },
  confirmPrompt: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  confirmError: { fontFamily: fonts.bodyRegular, fontSize: fontSize.sm, color: colors.danger },
  confirmActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  confirmCancel: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  confirmCancelLabel: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkSecondary },
  confirmConfirm: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.danger,
  },
  confirmConfirmDisabled: { opacity: 0.4 },
  confirmConfirmLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: "#fff" },
});
