// yuzu-app の lib/userClient.ts（localStorage 版）を AsyncStorage 向けに移植。
// センチメントスコアはDBに永続化されない（yuzu-app 側の意図的な設計）ので、
// クライアント側キャッシュも同じ役割をここで担う。

import AsyncStorage from "@react-native-async-storage/async-storage";

export const SENTIMENT_CACHE_KEY = "yuzu-sentiment-cache-v2";

export async function loadSentimentCache(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SENTIMENT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function saveSentimentCache(cache: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(SENTIMENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // キャッシュ書き込み失敗は装飾機能のため無視してよい
  }
}

// ログアウト時: 別アカウントへ切り替わっても前ユーザーのセンチメントスコアを引き継がないようにする。
export async function clearSentimentCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SENTIMENT_CACHE_KEY);
  } catch {
    // 削除失敗は致命的ではない
  }
}
