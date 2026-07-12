// レポート通知：週次・月次レポート完成のお知らせ（ローカル通知）の権限リクエスト・スケジューリング・設定の永続化。
// バックエンドを経由しない完全ローカル機能（AGENTS.md の境界参照）。
//
// 週次レポートは毎週月曜0時JST、月次レポートは毎月1日0時JSTに集計期間が締まる。
// 締まった直後ではなく、ユーザーが確認しやすいその日の朝8時（端末ローカル時刻）に通知する。

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ensureAndroidChannel, ensureNotificationHandler } from "./notifications";

const STORAGE_KEY = "yuzu.reportNotifications.v1";
const WEEKLY_IDENTIFIER = "yuzu-weekly-report";
const MONTHLY_IDENTIFIER = "yuzu-monthly-report";
const ANDROID_CHANNEL_ID = "report";

export type ReportNotificationSettings = {
  enabled: boolean;
};

export const DEFAULT_REPORT_NOTIFICATION_SETTINGS: ReportNotificationSettings = {
  enabled: false,
};

// 保存済みJSONの壊れた値を弾いてデフォルトへフォールバックする
export function parseReportNotificationSettings(raw: string | null): ReportNotificationSettings {
  if (!raw) return DEFAULT_REPORT_NOTIFICATION_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.enabled !== "boolean") {
      return DEFAULT_REPORT_NOTIFICATION_SETTINGS;
    }
    return { enabled: parsed.enabled };
  } catch {
    return DEFAULT_REPORT_NOTIFICATION_SETTINGS;
  }
}

export async function loadReportNotificationSettings(): Promise<ReportNotificationSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseReportNotificationSettings(raw);
}

async function persistReportNotificationSettings(settings: ReportNotificationSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

async function scheduleWeeklyReport(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_IDENTIFIER,
    content: {
      title: "YUZU",
      body: "先週のレポートができた。読め。",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // 1=日曜始まりのため、月曜は2
      hour: 8,
      minute: 0,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
    },
  });
}

async function scheduleMonthlyReport(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_IDENTIFIER,
    content: {
      title: "YUZU",
      body: "先月のレポートができた。読め。",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1, // 1始まり（毎月1日）
      hour: 8,
      minute: 0,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
    },
  });
}

async function scheduleReportNotifications(): Promise<void> {
  ensureNotificationHandler();
  await ensureAndroidChannel(ANDROID_CHANNEL_ID, "レポート");
  await cancelReportNotifications();
  await scheduleWeeklyReport();
  await scheduleMonthlyReport();
}

async function cancelReportNotifications(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_IDENTIFIER);
  await Notifications.cancelScheduledNotificationAsync(MONTHLY_IDENTIFIER);
}

// 設定を永続化し、有効なら週次・月次の両通知を再スケジュール・無効なら両方キャンセルする。
export async function applyReportNotificationSettings(settings: ReportNotificationSettings): Promise<void> {
  await persistReportNotificationSettings(settings);
  if (settings.enabled) {
    await scheduleReportNotifications();
  } else {
    await cancelReportNotifications();
  }
}
