import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "./supabase";
import { completeAuthRedirect } from "./authSession";

// Supabase 側の Google プロバイダは Web 版で既に稼働中（同一 Supabase プロジェクト）。
// native は Authentication > URL Configuration の Additional Redirect URLs に
// "yuzu://auth/callback" を追加する必要がある（yuzu-app 側のダッシュボード作業、未実施）。
const REDIRECT_TO = makeRedirectUri({ scheme: "yuzu", path: "auth/callback" });

// null: 成功 or ユーザーがキャンセル（どちらもエラー表示は不要）。
// string: 表示すべきエラーメッセージ。
export async function signInWithGoogle(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return "Googleでのサインインに失敗した";

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
  if (result.type !== "success") return null; // cancel/dismiss は silent

  const ok = await completeAuthRedirect(result.url);
  return ok ? null : "セッションを確立できなかった";
}
