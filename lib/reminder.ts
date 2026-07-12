// 毎日リマインダー：ローカル通知の権限リクエスト・スケジューリング・設定の永続化。
// バックエンドを経由しない完全ローカル機能（AGENTS.md の境界参照）。

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const STORAGE_KEY = "yuzu.reminder.v1";
const NOTIFICATION_IDENTIFIER = "yuzu-daily-reminder";
const ANDROID_CHANNEL_ID = "reminder";

export type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 21,
  minute: 0,
};

// 保存済みJSONの壊れた値・範囲外値を弾いてデフォルトへフォールバックする
export function parseReminderSettings(raw: string | null): ReminderSettings {
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
    const hour = Number(parsed?.hour);
    const minute = Number(parsed?.minute);
    if (
      typeof parsed?.enabled !== "boolean" ||
      !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59
    ) {
      return DEFAULT_REMINDER_SETTINGS;
    }
    return { enabled: parsed.enabled, hour, minute };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseReminderSettings(raw);
}

async function persistReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let handlerConfigured = false;

// フォアグラウンド受信時の表示挙動。アプリ起動のたびではなく初回呼び出し時に一度だけ設定する。
function ensureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "リマインダー",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  ensureNotificationHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  ensureNotificationHandler();
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER,
    content: {
      title: "YUZU",
      body: "今日はまだ話してない。話せ。",
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// 設定を永続化し、有効なら通知を再スケジュール・無効ならキャンセルする。
export async function applyReminderSettings(settings: ReminderSettings): Promise<void> {
  await persistReminderSettings(settings);
  if (settings.enabled) {
    await scheduleDailyReminder(settings.hour, settings.minute);
  } else {
    await cancelDailyReminder();
  }
}
