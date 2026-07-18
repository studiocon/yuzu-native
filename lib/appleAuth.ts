import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabase";

// ブラウザリダイレクト（Google）と違い、Apple はネイティブのサインインシート
// （ASAuthorizationController）で完結する。ディープリンクは経由しない。
// Supabase 側の signInWithIdToken に identityToken をそのまま渡せる。
//
// 実機で有効にするには yuzu-app#36 と同じ Apple Developer Console の設定
// （Sign In with Apple capability）と Supabase の Apple プロバイダ設定が必要
// （まだ未実施。config plugin による entitlement 自体はこの変更で入る）。

// null: 成功 or ユーザーがキャンセル（どちらもエラー表示は不要）。
// string: 表示すべきエラーメッセージ。
export async function signInWithApple(): Promise<string | null> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    if (isCancelledError(e)) return null;
    return "Appleサインインに失敗した";
  }

  if (!credential.identityToken) return "Appleサインインに失敗した";

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  return error ? "Appleサインインに失敗した" : null;
}

function isCancelledError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "ERR_REQUEST_CANCELED";
}
