// Sentry 初期化（副作用 import 専用ファイル）。App.tsx の一番上で `import "./lib/sentry"` する。
// yuzu-app の sentry.client.config.ts / sentry.server.config.ts のパターンを移植：
// EXPO_PUBLIC_SENTRY_DSN が未設定なら init を skip して noop にする（ローカル開発は無設定でよい）。
//
// PII 抑止：YUZU は post 本文（声の中身）・メールアドレスを絶対に Sentry へ送らない。
// sendDefaultPii: false に加え、beforeSend で request body があれば "[Filtered]" に置換する
// （yuzu-app の sentry.server.config.ts の beforeSend と同じ発想。ネイティブ側は自前 fetch の
// リクエストは breadcrumb/event に data として乗ることがあるため、event.request.data を必ず削る）。
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 本番は 0.1、開発は 1.0 で全部追う（yuzu-app と同じ比率）
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    environment: __DEV__ ? "development" : "production",

    // PII 抑止：post 本文・email を絶対に送らない
    sendDefaultPii: false,

    beforeSend(event) {
      // request body をスクラブ（transcribe/records の POST body が乗らないように）
      if (event.request?.data) {
        event.request.data = "[Filtered]";
      }
      // headers の Authorization/Cookie を削る
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h.authorization;
        delete h.cookie;
        delete h.Authorization;
        delete h.Cookie;
      }
      return event;
    },
  });
}
