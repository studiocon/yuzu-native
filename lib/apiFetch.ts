import { supabase } from "./supabase";
import { isMockModeEnabled } from "./mockMode";

// session.access_token を props/クロージャで持ち回すと、Supabase SDK がバックグラウンドで
// 自動更新した新トークンに追従できず、1時間後に 401 で落ちる。呼び出し直前に必ず
// getSession() を通すことで、期限切れなら SDK 内部のリフレッシュを経由してから使う。
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  // 管理者限定モックモード（ストア用スクショ撮影用）。サーバは role=admin にしか反応しない
  // ため、非 admin アカウントでこのフラグが立っていても無害。
  if (isMockModeEnabled()) headers.set("X-Yuzu-Mock", "1");
  return fetch(input, { ...init, headers });
}
