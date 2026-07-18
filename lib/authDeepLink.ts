// Supabase の OAuth リダイレクトは flowType により2通りの形で戻ってくる：
// implicit -> yuzu://auth/callback#access_token=...&refresh_token=...
// pkce     -> yuzu://auth/callback?code=...
// どちらが来ても拾えるように両方をパースする。
//
// supabase クライアントに依存しない純粋関数のみをここに置く（lib/supabase.ts は
// 環境変数未設定時にモジュール読み込み時 throw するため、テストで import すると
// 環境変数無しの Jest 環境で全滅する。呼び出し側の lib/authSession.ts で分離）。

export function parseAuthTokensFromUrl(
  url: string,
): { accessToken: string; refreshToken: string } | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function parseAuthCodeFromUrl(url: string): string | null {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return null;
  const hashIndex = url.indexOf("#", queryIndex);
  const queryStr = hashIndex === -1 ? url.slice(queryIndex + 1) : url.slice(queryIndex + 1, hashIndex);
  return new URLSearchParams(queryStr).get("code");
}
