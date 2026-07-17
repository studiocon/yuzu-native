// レポート未読インジケータ：既読済み periodKey の集合を AsyncStorage に保持する。
// バックエンドを経由しない完全ローカル機能（AGENTS.md の境界参照）。
//
// 高水位（generatedAt の最大値を覚えて「それより新しいものは未読」とする）方式ではなく
// seen-set（既読 periodKey の集合）方式を採る。REPORTS はプル生成（ユーザーがタップ or
// バックグラウンドの先読みで初めて生成される）のため、生成順が期間順と一致しない
// ——古い期間のレポートが後から生成されることがあり、高水位方式だと見逃してしまう。

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "yuzu.reports.seen.v1";

// 保存済みJSONをパースして既読 periodKey の Set にする。
// raw が null（＝ストレージキー未作成、アプリ初回起動 or 機能追加直後）なら null を返す。
// これは呼び出し側に「まだ seed（初期シード）していない」ことを伝えるシグナルであり、
// 壊れたJSON・非配列とは区別する（壊れている場合を null にすると seed し直しが走り、
// 既読が全部復活してしまうため、その場合は空の Set にする）。
export function parseSeenKeys(raw: string | null): Set<string> | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

// 未生成のレポートは未読表示の対象外（読むものがまだ無い）。
export function isReportUnread(
  meta: { generated: boolean; periodKey: string },
  seen: ReadonlySet<string>,
): boolean {
  return meta.generated && !seen.has(meta.periodKey);
}

export async function loadSeenKeys(): Promise<Set<string> | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseSeenKeys(raw);
}

export async function saveSeenKeys(seen: ReadonlySet<string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
}

// read-modify-write：他の書き込みと競合しないよう都度ストレージから読み直して1件追加する。
export async function markReportSeen(periodKey: string): Promise<void> {
  const current = (await loadSeenKeys()) ?? new Set<string>();
  current.add(periodKey);
  await saveSeenKeys(current);
}

// ログアウト時: 別アカウントへ切り替わっても前ユーザーの既読状態を引き継がないようにする。
export async function clearSeenKeys(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // 削除失敗は致命的ではない
  }
}
