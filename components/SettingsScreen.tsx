import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { CaretLeftIcon, SignOutIcon, TrashIcon } from "phosphor-react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";

const VERSION = "1.0.0";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Props = {
  visible: boolean;
  session: Session;
  onClose: () => void;
};

export default function SettingsScreen({ visible, session, onClose }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const email = session.user.email ?? "―";
  const shortId = session.user.id.slice(0, 8) + "...";

  async function handleCopyId() {
    await Clipboard.setStringAsync(session.user.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1500);
  }

  function handleSignOut() {
    onClose();
    supabase.auth.signOut();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
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
            <Pressable onPress={handleCopyId} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Text style={styles.rowLabel}>ユーザーID</Text>
              <Text style={styles.rowValueMono}>{idCopied ? "COPIED" : shortId}</Text>
            </Pressable>
          </Section>

          <Section title="">
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <SignOutIcon size={16} color={colors.danger} weight="bold" />
              <Text style={styles.dangerLabel}>ログアウト</Text>
            </Pressable>
            <Pressable
              onPress={() => setDeleteOpen(true)}
              style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              <TrashIcon size={16} color={colors.danger} weight="bold" />
              <Text style={styles.dangerLabel}>アカウントを削除</Text>
            </Pressable>
          </Section>
        </ScrollView>

        <Text style={styles.version}>VERSION {VERSION}</Text>

        <DeleteAccountConfirm
          visible={deleteOpen}
          accessToken={session.access_token}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            onClose();
          }}
        />
      </SafeAreaView>
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
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function DeleteAccountConfirm({
  visible,
  accessToken,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  accessToken: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmText.trim().toUpperCase() === "YUZU";

  async function handleConfirm() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("delete failed");
      await supabase.auth.signOut();
      onDeleted();
    } catch {
      setDeleting(false);
      setError("削除できなかった。もう一度。");
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.confirmScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={deleting ? undefined : onClose} />
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
            <Pressable onPress={onClose} disabled={deleting} style={styles.confirmCancel}>
              <Text style={styles.confirmCancelLabel}>やめる</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={deleting || !canDelete}
              style={[styles.confirmConfirm, (deleting || !canDelete) && styles.confirmConfirmDisabled]}
            >
              <Text style={styles.confirmConfirmLabel}>{deleting ? "削除中…" : "消す"}</Text>
            </Pressable>
          </View>
        </View>
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
  rowLabel: { fontSize: fontSize.base, color: colors.ink },
  rowValue: { fontSize: fontSize.sm, color: colors.inkMuted },
  rowValueMono: { fontSize: fontSize.sm, color: colors.inkMuted, fontFamily: fonts.displayRegular },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  dangerLabel: { fontSize: fontSize.base, color: colors.danger },
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
  confirmPanel: {
    width: "100%",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  confirmTitle: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.ink },
  confirmBody: { fontSize: fontSize.base, color: colors.inkSecondary, marginBottom: spacing.sm },
  confirmPrompt: {
    fontFamily: fonts.displayBold,
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
  confirmError: { fontSize: fontSize.sm, color: colors.danger },
  confirmActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  confirmCancel: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  confirmCancelLabel: { fontSize: fontSize.base, color: colors.inkSecondary },
  confirmConfirm: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.danger,
  },
  confirmConfirmDisabled: { opacity: 0.4 },
  confirmConfirmLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: "#fff" },
});
