import { supabase } from "./supabase";
import { parseAuthCodeFromUrl, parseAuthTokensFromUrl } from "./authDeepLink";

// OAuth（Google 等）のリダイレクト URL を受け取り、Supabase セッションを確立する。
// AuthScreen（openAuthSessionAsync の戻り値）と App.tsx（Linking リスナーのフォールバック）
// の両方から呼ばれる想定。認証と無関係な URL（トークンも code も無い）は false を返すだけで無害。
export async function completeAuthRedirect(url: string): Promise<boolean> {
  const tokens = parseAuthTokensFromUrl(url);
  if (tokens) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    return !error;
  }
  const code = parseAuthCodeFromUrl(url);
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    return !error;
  }
  return false;
}
