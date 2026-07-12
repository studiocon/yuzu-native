// ローカル通知の共有インフラ：通知ハンドラー設定・Androidチャンネル作成・権限リクエスト。
// reminder.ts / reportNotifications.ts など複数の通知機能から共通で利用する。

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let handlerConfigured = false;

// フォアグラウンド受信時の表示挙動。アプリ起動のたびではなく初回呼び出し時に一度だけ設定する。
export function ensureNotificationHandler(): void {
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

export async function ensureAndroidChannel(id: string, name: string): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
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
