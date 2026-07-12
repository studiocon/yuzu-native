import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import * as haptics from "../lib/haptics";
import {
  applyReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  requestNotificationPermission,
  type ReminderSettings,
} from "../lib/reminder";
import {
  applyReportNotificationSettings,
  DEFAULT_REPORT_NOTIFICATION_SETTINGS,
  loadReportNotificationSettings,
  type ReportNotificationSettings,
} from "../lib/reportNotifications";

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
  onClose: () => void;
};

export default function NotificationScreen({ visible, onClose }: Props) {
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [reminderDenied, setReminderDenied] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [reports, setReports] = useState<ReportNotificationSettings>(DEFAULT_REPORT_NOTIFICATION_SETTINGS);
  const [reportsDenied, setReportsDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadReminderSettings().then(setReminder);
    loadReportNotificationSettings().then(setReports);
  }, [visible]);

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

  async function handleToggleReports(next: boolean) {
    haptics.tapLight();
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        haptics.warning();
        setReportsDenied(true);
        setTimeout(() => setReportsDenied(false), 2000);
        return;
      }
    }
    const updated = { ...reports, enabled: next };
    setReports(updated);
    await applyReportNotificationSettings(updated);
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
          <Text style={styles.headerLabel}>NOTIFICATIONS</Text>
          <Pressable
            onPress={() => {
              haptics.tapLight();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <XIcon size={22} color={colors.ink} weight="bold" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
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

          <Section title="REPORTS">
            <View style={styles.row}>
              <Text style={styles.rowLabel}>レポート通知</Text>
              <View style={styles.rowTrailing}>
                {reportsDenied && <Text style={styles.rowError}>通知を許可しろ</Text>}
                <Switch
                  value={reports.enabled}
                  onValueChange={handleToggleReports}
                  trackColor={{ false: colors.surfaceBorder, true: colors.yuzuZest }}
                  accessibilityLabel="レポート通知"
                />
              </View>
            </View>
          </Section>
        </ScrollView>

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
  confirmScrim: {
    flex: 1,
    backgroundColor: "rgba(26,26,46,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
});
