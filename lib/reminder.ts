// 毎日リマインダー：ローカル通知の権限リクエスト・スケジューリング・設定の永続化。
// バックエンドを経由しない完全ローカル機能（AGENTS.md の境界参照）。

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ensureAndroidChannel, ensureNotificationHandler } from "./notifications";
import { DAY_MS } from "./period";

export { requestNotificationPermission } from "./notifications";

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

export type ReminderMessage = { title: string; body: string };

// 経過0〜2日（軽い）。日数を埋め込まない固定文言のプール。
const TIER1_BODIES = [
  "今日はまだ話してない。話せ。",
  "今日の分、まだ刻んでない。話せ。",
  "今日、まだ声を出してない。話せ。",
  "今日はまだ無音だ。話せ。",
];

// 経過3〜6日（中）。SIGNAL ウィジェットの「沈黙」語彙と揃える。
const TIER2_TEMPLATES: ((days: number) => string)[] = [
  (days) => `もう${days}日、黙ってる。話せ。`,
  (days) => `${days}日、沈黙が続いてる。話せ。`,
  (days) => `${days}日、声を刻んでない。話せ。`,
];

// 経過7日以上（強め）。タグライン「声を刻め」を再利用。
const TIER3_TEMPLATES: ((days: number) => string)[] = [
  (days) => `${days}日、沈黙したままだ。声を刻め。`,
  () => "SIGNALが真っ黒だ。話せ。",
  () => "1週間、黙ったままだ。声を刻め。",
];

function pickFromPool<T>(pool: T[], index: number): T {
  return pool[((index % pool.length) + pool.length) % pool.length];
}

// 最終投稿からの経過日数でトーンを3段階に分け、rotationIndex（呼び出し側は日カウンタを渡す想定）で
// プール内をローテーションする。同じ入力なら常に同じ文言を返す純粋関数。
export function pickReminderMessage(daysSinceLastPost: number, rotationIndex: number): ReminderMessage {
  const days = Math.max(0, Math.floor(daysSinceLastPost));
  const body =
    days <= 2
      ? pickFromPool(TIER1_BODIES, rotationIndex)
      : days <= 6
        ? pickFromPool(TIER2_TEMPLATES, rotationIndex)(days)
        : pickFromPool(TIER3_TEMPLATES, rotationIndex)(days);
  return { title: "YUZU", body };
}

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

async function scheduleDailyReminder(hour: number, minute: number, daysSinceLastPost: number): Promise<void> {
  ensureNotificationHandler();
  await ensureAndroidChannel(ANDROID_CHANNEL_ID, "リマインダー");
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
  // 日カウンタをローテーション軸にする（同じ日なら同じ文言、日が変われば次の候補へ進む）。
  const rotationIndex = Math.floor(Date.now() / DAY_MS);
  const { title, body } = pickReminderMessage(daysSinceLastPost, rotationIndex);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
    },
  });
}

async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
}

// 設定を永続化し、有効なら通知を再スケジュール・無効ならキャンセルする。
// daysSinceLastPost は文言のトーン選択にのみ使う（省略時は0＝直近投稿ありの体で組む）。
export async function applyReminderSettings(settings: ReminderSettings, daysSinceLastPost = 0): Promise<void> {
  await persistReminderSettings(settings);
  if (settings.enabled) {
    await scheduleDailyReminder(settings.hour, settings.minute, daysSinceLastPost);
  } else {
    await cancelDailyReminder();
  }
}

// hour/minute はいじらず、文言だけを最新の経過日数で更新する。投稿一覧の取得のたび
// （SIGNALウィジェット更新 lib/widgetSignal.ts と同じタイミング）に呼ぶ想定。
// リマインダー無効時は何もしない。
export async function refreshReminderContent(daysSinceLastPost: number): Promise<void> {
  const settings = await loadReminderSettings();
  if (!settings.enabled) return;
  await scheduleDailyReminder(settings.hour, settings.minute, daysSinceLastPost);
}
