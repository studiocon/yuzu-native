import { supabase } from "./supabase";

// Magic Link は implicit flow（デフォルト）。リダイレクト URL の #fragment に
// access_token / refresh_token が載るので、ここで取り出して setSession する。
export async function applySessionFromUrl(url: string): Promise<boolean> {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return false;

  const params = new URLSearchParams(url.substring(hashIndex + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}
