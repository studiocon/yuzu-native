import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CaretLeftIcon, CaretRightIcon, SignOutIcon, TrashIcon } from "phosphor-react-native";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";
import { apiFetch } from "../lib/apiFetch";
import { API_BASE } from "../lib/config";
import { supabase } from "../lib/supabase";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import * as haptics from "../lib/haptics";
import {
  applyReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  requestNotificationPermission,
  type ReminderSettings,
} from "../lib/reminder";
import ApiTokenScreen from "./ApiTokenScreen";
import ContactScreen from "./ContactScreen";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

type Props = {
  visible: boolean;
  session: Session;
  onClose: () => void;
};

export default function SettingsScreen({ visible, session, onClose }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [reminderDenied, setReminderDenied] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const email = session.user.email ?? "―";
  const shortId = session.user.id.slice(0, 8) + "...";

  useEffect(() => {
    loadReminderSettings().then(setReminder);
  }, []);

  async function handleToggleReminder(next: boolean) {
    haptics.tapLight();
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        haptics.warning();
        setReminderDenied(true);
        setTimeout(() => setReminderDenied(false), 2000);
        return;
      }
    }
    const updated = { ...reminder, enabled: next };
    setReminder(updated);
    await applyReminderSettings(updated);
  }

  async function handleTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setTimePickerOpen(false);
    if (event.type !== "set" || !date) return;
    const updated = { ...reminder, hour: date.getHours(), minute: date.getMinutes() };
    setReminder(updated);
    await applyReminderSettings(updated);
  }

  async function handleCopyId() {
    await Clipboard.setStringAsync(session.user.id);
    setIdCopied(true);
    haptics.success();
    setTimeout(() => setIdCopied(false), 1500);
  }

  function handleSignOut() {
    haptics.tapMedium();
    onClose();
    supabase.auth.signOut();
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

          <Section title="REMINDER">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>リマインダー</Text>
              <View style={styles.rowTrailing}>
                {reminderDenied && <Text style={styles.rowError}>通知を許可しろ</Text>}
                <Switch
                  value={reminder.enabled}
                  onValueChange={handleToggleReminder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.yuzuZest }}
                  accessibilityLabel="リマインダー"
                />
              </View>
            </View>
            {reminder.enabled && (
              <Pressable
                onPress={() => {
                  haptics.tapLight();
                  setTimePickerOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="リマインド時刻を変更"
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowLabel}>時刻</Text>
                <View style={styles.rowTrailing}>
                  <Text style={styles.rowValueMono}>{formatTime(reminder.hour, reminder.minute)}</Text>
                </View>
              </Pressable>
            )}
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
              style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel="ログアウト"
            >
              <SignOutIcon size={16} color={colors.danger} weight="bold" />
              <Text style={styles.dangerLabel}>ログアウト</Text>
            </Pressable>
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
        <ContactScreen
          visible={contactOpen}
          defaultEmail={session.user.email ?? ""}
          onClose={() => setContactOpen(false)}
        />

        {Platform.OS === "android" && timePickerOpen && (
          <DateTimePicker
            value={timeToDate(reminder.hour, reminder.minute)}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {Platform.OS === "ios" && (
          <Modal visible={timePickerOpen} transparent animationType="fade" onRequestClose={() => setTimePickerOpen(false)}>
            <View style={styles.confirmScrim}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setTimePickerOpen(false)} />
              <View style={styles.timeSheet}>
                <DateTimePicker
                  value={timeToDate(reminder.hour, reminder.minute)}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
                <Pressable
                  onPress={() => setTimePickerOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  style={styles.timeCloseBtn}
                >
                  <Text style={styles.timeCloseLabel}>閉じる</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}
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
  rowLabel: { fontSize: fontSize.base, color: colors.ink, flexShrink: 0 },
  rowTrailing: { flex: 1, flexShrink: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs, marginLeft: spacing.md },
  rowValue: { flexShrink: 1, fontSize: fontSize.sm, color: colors.inkMuted, textAlign: "right" },
  rowValueMono: { fontSize: fontSize.sm, color: colors.inkMuted, fontFamily: fonts.displayRegular },
  rowError: { fontSize: fontSize.sm, color: colors.danger },
  timeSheet: {
    width: "100%",
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  timeCloseBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  timeCloseLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: colors.ink },
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
