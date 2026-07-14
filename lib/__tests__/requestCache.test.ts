import { clearRequestCache, getCached, setCached } from "../requestCache";

describe("requestCache", () => {
  afterEach(() => {
    clearRequestCache();
  });

  it("未設定のキーは undefined を返す", () => {
    expect(getCached("missing")).toBeUndefined();
  });

  it("set→get でラウンドトリップする", () => {
    setCached("key-a", { hello: "world" });
    expect(getCached("key-a")).toEqual({ hello: "world" });
  });

  it("異なるキーは独立している", () => {
    setCached("key-a", 1);
    setCached("key-b", 2);
    expect(getCached("key-a")).toBe(1);
    expect(getCached("key-b")).toBe(2);
  });

  it("同じキーへの set は上書きする", () => {
    setCached("key-a", "old");
    setCached("key-a", "new");
    expect(getCached("key-a")).toBe("new");
  });

  it("clear で全キーが消える", () => {
    setCached("key-a", 1);
    setCached("key-b", 2);
    clearRequestCache();
    expect(getCached("key-a")).toBeUndefined();
    expect(getCached("key-b")).toBeUndefined();
  });
});
