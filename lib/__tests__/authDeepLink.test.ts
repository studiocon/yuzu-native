import { parseAuthCodeFromUrl, parseAuthTokensFromUrl } from "../authDeepLink";

describe("parseAuthTokensFromUrl", () => {
  it("implicit flow のフラグメントから access_token/refresh_token を拾う", () => {
    expect(
      parseAuthTokensFromUrl("yuzu://auth/callback#access_token=abc&refresh_token=def&expires_in=3600"),
    ).toEqual({ accessToken: "abc", refreshToken: "def" });
  });

  it("フラグメントが無い URL は null", () => {
    expect(parseAuthTokensFromUrl("yuzu://auth/callback")).toBeNull();
    expect(parseAuthTokensFromUrl("yuzu://auth/callback?code=abc")).toBeNull();
  });

  it("access_token/refresh_token のどちらかが欠けていれば null", () => {
    expect(parseAuthTokensFromUrl("yuzu://auth/callback#access_token=abc")).toBeNull();
    expect(parseAuthTokensFromUrl("yuzu://auth/callback#refresh_token=def")).toBeNull();
  });
});

describe("parseAuthCodeFromUrl", () => {
  it("pkce flow のクエリから code を拾う", () => {
    expect(parseAuthCodeFromUrl("yuzu://auth/callback?code=abc123")).toBe("abc123");
  });

  it("code の後にフラグメントが続いても正しく切り出す", () => {
    expect(parseAuthCodeFromUrl("yuzu://auth/callback?code=abc123#foo=bar")).toBe("abc123");
  });

  it("クエリが無い・code が無い URL は null", () => {
    expect(parseAuthCodeFromUrl("yuzu://auth/callback")).toBeNull();
    expect(parseAuthCodeFromUrl("yuzu://auth/callback?foo=bar")).toBeNull();
    expect(parseAuthCodeFromUrl("yuzu://auth/callback#access_token=abc")).toBeNull();
  });
});
