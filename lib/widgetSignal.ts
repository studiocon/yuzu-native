import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";

const APP_GROUP = "group.style.yuzu.mobile";
const LAST_RECORDED_KEY = "lastRecordedAt";

let storage: ExtensionStorage | null = null;

function getStorage(): ExtensionStorage | null {
  if (Platform.OS !== "ios") return null;
  if (!storage) {
    try {
      storage = new ExtensionStorage(APP_GROUP);
    } catch {
      return null;
    }
  }
  return storage;
}

// LOG 一覧の取得のたびに呼び、最後に話した時刻を SIGNAL ウィジェットへ渡す。
// ネイティブモジュール未搭載のビルド（Expo Go 等）では no-op。録音フローは止めない。
export function updateWidgetSignal(lastRecordedAtMs: number | null) {
  const s = getStorage();
  if (!s) return;
  try {
    s.set(LAST_RECORDED_KEY, lastRecordedAtMs ?? 0);
    ExtensionStorage.reloadWidget();
  } catch {
    // silent skip
  }
}
