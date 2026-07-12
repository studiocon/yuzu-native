// PostHog ラッパ。PII 抑止と silent-failure 防止のため
// イベント発火は **このファイル経由のみ** にする（直接 posthog インスタンスを呼ばない）。
//
// yuzu-app の lib/analytics.ts と一字一句パリティ（イベント名・EventProps・関数シグネチャ）。
// 内部実装だけ posthog-react-native 向け：この場所でシングルトンクライアントを管理し、
// track/identify/resetIdentity は素の関数呼び出しとして委譲する（呼び出し側のコードは
// yuzu-app と同じ書き方のまま使える）。App.tsx はこのシングルトンを
// `<PostHogProvider client={posthogClient}>` に渡して画面遷移の自動キャプチャ等を有効化する。
//
// イベント命名規則：snake_case + 過去形 / 進行形を統一
//   - record_started / record_finished
//   - transcribe_succeeded / transcribe_failed
//   - post_created
//   - login_attempted / login_succeeded
//   - daily_limit_hit
//   - paywall_shown / paywall_dismissed
//   - report_opened

import PostHog from "posthog-react-native";

type EventName =
  | "record_started"
  | "record_finished"
  | "transcribe_succeeded"
  | "transcribe_failed"
  | "post_created"
  | "login_attempted"
  | "login_succeeded"
  | "daily_limit_hit"
  | "paywall_shown"
  | "paywall_dismissed"
  | "report_opened";

// イベントに含めて良い properties の型。
// post 本文・email・電話番号など PII を絶対に含めないようホワイトリスト化。
type EventProps = {
  // 録音メタ
  durationMs?: number;
  charCount?: number;
  // login 経路
  provider?: "google" | "apple" | "magic_link";
  // STT エラー種別
  errorCode?: string;
  // レポート期間
  periodKey?: string;
  periodKind?: "week" | "month";
};

// DSN 未設定（EXPO_PUBLIC_POSTHOG_KEY 無し）なら null のまま = 全関数 silent no-op。
// App.tsx はこのインスタンスを PostHogProvider の client として渡す。
export const posthogClient: PostHog | null = (() => {
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  try {
    return new PostHog(key, {
      host,
      // PII 抑止：post 本文は autocapture 経由でも送らない方針（呼び出し側でも渡さない）
      captureAppLifecycleEvents: true,
    });
  } catch {
    // native module 初期化失敗時も noop にフォールバック
    return null;
  }
})();

export function track(name: EventName, props?: EventProps): void {
  try {
    if (!posthogClient) return; // PostHog 未初期化なら noop
    posthogClient.capture(name, props);
  } catch {
    // 解析の失敗が本体に影響しないように silent fail（解析側は壊れても UX は壊れない）
  }
}

// ログイン直後に呼ぶ。userId は Supabase の auth.users.id（UUID）。
// 未ログイン時の distinctId を userId に alias する。
export function identify(userId: string): void {
  try {
    if (!posthogClient) return;
    posthogClient.identify(userId);
  } catch {
    // noop
  }
}

// ログアウト時に呼ぶ。distinctId をリセットして新しい匿名 ID を発行。
export function resetIdentity(): void {
  try {
    if (!posthogClient) return;
    posthogClient.reset();
  } catch {
    // noop
  }
}
