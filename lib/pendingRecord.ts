// 未ログイン onboarding で録音したテキストの一時退避。ログイン前に録音した内容を
// 認証完了後まで保持し、RecordScreen マウント時に読み出して保存する。
// yuzu-app の STORAGE_KEYS.pendingText（sessionStorage）と同じキー名・JSON 形式
// （{text, durationMs}）で揃えているが、永続先は端末の AsyncStorage。
import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_RECORD_KEY = "yuzu_pending_text";

export type PendingRecord = { text: string; durationMs: number };

function isPendingRecord(value: unknown): value is PendingRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === "string" && typeof v.durationMs === "number";
}

export async function savePendingRecord(record: PendingRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_RECORD_KEY, JSON.stringify(record));
  } catch {
    // 書き込み失敗は致命的ではない（ログイン後に保存できないだけ）。silent。
  }
}

export async function loadPendingRecord(): Promise<PendingRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isPendingRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPendingRecord(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_RECORD_KEY);
  } catch {
    // 削除失敗は致命的ではない
  }
}
