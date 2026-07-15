// 管理者限定モックモード（ストア用スクショ撮影用）。ON の間は全 API リクエストに
// X-Yuzu-Mock: 1 を付与する。バックエンド（yuzu-app）は role=admin のリクエストにしか
// 実際には反応しないため、このフラグが誤って ON のまま残っても admin 以外では無害。

import AsyncStorage from "@react-native-async-storage/async-storage";

export const MOCK_MODE_STORAGE_KEY = "yuzu.mockMode.v1";

// apiFetch.ts が同期的に読む必要があるため、AsyncStorage とは別にモジュール変数で保持する。
let mockModeEnabled = false;

export function isMockModeEnabled(): boolean {
  return mockModeEnabled;
}

// 永続化された ON/OFF を読み、モジュール変数へ反映して返す。起動時（RecordScreen マウント）は
// fire-and-forget、SettingsScreen が開くたびは最新値表示のため await して使う。
export async function loadMockMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(MOCK_MODE_STORAGE_KEY);
  mockModeEnabled = raw === "1";
  return mockModeEnabled;
}

export async function setMockMode(enabled: boolean): Promise<void> {
  mockModeEnabled = enabled;
  await AsyncStorage.setItem(MOCK_MODE_STORAGE_KEY, enabled ? "1" : "0");
}

// ログアウト時: 別アカウントへ切り替わっても前ユーザーの ON 状態を引き継がないようにする。
export function clearMockMode(): void {
  mockModeEnabled = false;
  AsyncStorage.removeItem(MOCK_MODE_STORAGE_KEY).catch(() => {});
}
