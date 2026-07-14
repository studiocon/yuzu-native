import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  REQUEST_CACHE_KEY,
  clearRequestCache,
  getCached,
  hydrateRequestCache,
  setCached,
} from "../requestCache";

const userA = "user-aaa";
const userB = "user-bbb";

// setCached の永続化・clear の AsyncStorage 削除は fire-and-forget（microtask デバウンス）
// なので、検証前にキューを掃く。
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("requestCache（メモリ）", () => {
  afterEach(async () => {
    clearRequestCache();
    await flush();
    await AsyncStorage.clear();
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

describe("requestCache（AsyncStorage 永続化）", () => {
  afterEach(async () => {
    clearRequestCache();
    await flush();
    await AsyncStorage.clear();
  });

  it("hydrate 後の setCached が AsyncStorage に書き込まれる", async () => {
    await hydrateRequestCache(userA);
    setCached("key-a", { hello: "world" });
    await flush();
    const raw = await AsyncStorage.getItem(REQUEST_CACHE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      userId: userA,
      entries: { "key-a": { hello: "world" } },
    });
  });

  it("hydrate 前の setCached は永続化しない（userId 未確定のため）", async () => {
    setCached("key-a", 1);
    await flush();
    expect(await AsyncStorage.getItem(REQUEST_CACHE_KEY)).toBeNull();
  });

  it("永続化されたエントリを hydrate でメモリへ復元できる", async () => {
    await AsyncStorage.setItem(
      REQUEST_CACHE_KEY,
      JSON.stringify({ userId: userA, entries: { "key-a": [1, 2, 3] } }),
    );
    await hydrateRequestCache(userA);
    expect(getCached("key-a")).toEqual([1, 2, 3]);
  });

  it("userId 不一致の永続データは破棄される（他人データ混入防止）", async () => {
    await AsyncStorage.setItem(
      REQUEST_CACHE_KEY,
      JSON.stringify({ userId: userB, entries: { "key-a": "userBのデータ" } }),
    );
    await hydrateRequestCache(userA);
    expect(getCached("key-a")).toBeUndefined();
  });

  it("壊れたJSONは無視される（throw しない・キャッシュ無し扱い）", async () => {
    await AsyncStorage.setItem(REQUEST_CACHE_KEY, "{not valid json");
    await expect(hydrateRequestCache(userA)).resolves.toBeUndefined();
    expect(getCached("key-a")).toBeUndefined();
  });

  it("entries が object でない永続データは無視される", async () => {
    await AsyncStorage.setItem(
      REQUEST_CACHE_KEY,
      JSON.stringify({ userId: userA, entries: ["not", "a", "record"] }),
    );
    await hydrateRequestCache(userA);
    expect(getCached("0")).toBeUndefined();
  });

  it("hydrate はメモリに既にあるキーを上書きしない（新鮮なネットワーク応答を守る）", async () => {
    await AsyncStorage.setItem(
      REQUEST_CACHE_KEY,
      JSON.stringify({ userId: userA, entries: { "key-a": "stale", "key-b": "persisted" } }),
    );
    setCached("key-a", "fresh");
    await hydrateRequestCache(userA);
    expect(getCached("key-a")).toBe("fresh");
    expect(getCached("key-b")).toBe("persisted");
  });

  it("clear で AsyncStorage 側も消える", async () => {
    await hydrateRequestCache(userA);
    setCached("key-a", 1);
    await flush();
    expect(await AsyncStorage.getItem(REQUEST_CACHE_KEY)).not.toBeNull();
    clearRequestCache();
    await flush();
    expect(await AsyncStorage.getItem(REQUEST_CACHE_KEY)).toBeNull();
    expect(getCached("key-a")).toBeUndefined();
  });

  it("clear 後の再ログイン（別ユーザーで hydrate）では前ユーザーのデータが残らない", async () => {
    await hydrateRequestCache(userA);
    setCached("key-a", "userAのデータ");
    await flush();
    clearRequestCache();
    await flush();
    await hydrateRequestCache(userB);
    expect(getCached("key-a")).toBeUndefined();
  });
});
