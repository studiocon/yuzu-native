// アプリ全体の触覚フィードバックを一箇所に集約。
// 直接 expo-haptics を呼ぶ代わりにこれを使うことで、強度の統一・調整がしやすくなる。
import * as Haptics from "expo-haptics";

/** 一般的なボタン・行タップ（ナビゲーション、開閉、選択など）。 */
export function tapLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** 意味のある操作の開始（録音開始、送信の確定など）。 */
export function tapMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** 破壊的操作（アカウント削除の確定など）。 */
export function tapHeavy(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** タブ切替・フィルタ切替など、セグメント選択の変化。 */
export function selectionChanged(): void {
  Haptics.selectionAsync();
}

/** 操作が成功して完了した（CARVED、送信完了など）。 */
export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * 記録の保存が完了した瞬間の祝祭（CARVED）。
 * expo-haptics に単発の「めでたい」プリミティブは無いため、
 * Success 通知 → 軽→中の追い打ちで「ブルッ」と続く連鎖を合成する。
 */
export function celebrate(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 150);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
}

/** 権限拒否・上限到達など、進めないが致命的ではない状態。 */
export function warning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** 保存失敗・通信エラーなど、操作が失敗した。 */
export function error(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
