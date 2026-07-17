// LargeSecureStore.decrypt が壊れた blob（不正な hex の暗号化鍵 / 不正な hex の暗号文）でも
// throw しないことを検証する（#13）。ガードが無いと Supabase SDK の getSession() がここで
// reject し続け、以降のトークンリフレッシュ待ちの apiFetch も巻き添えで全滅する。
//
// expo-secure-store はネイティブモジュールなので、getItemAsync/setItemAsync/deleteItemAsync を
// インメモリの Map で差し替えて挙動を制御する。AsyncStorage は jest.config.js のグローバル
// モック（公式 async-storage-mock）を使う。aes-js は実物を使い、実際に throw する入力
// （下記 verified）で再現する。
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LargeSecureStore } from "../largeSecureStore";

// jest.mock はファイル先頭へ hoist されるため、import 文の後に書いても
// largeSecureStore が読み込む expo-secure-store はこのモックに差し替わる。
// モジュールファクトリはスコープ外変数を参照できない（hoisting の制約）が、
// "mock" prefix の変数名だけは例外的に許可される。
const mockSecureStoreMap = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreMap.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreMap.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreMap.delete(key);
    return Promise.resolve();
  }),
}));

describe("LargeSecureStore", () => {
  const KEY = "supabase.auth.token";

  beforeEach(() => {
    mockSecureStoreMap.clear();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("setItem → getItem でラウンドトリップする", async () => {
    const store = new LargeSecureStore();
    const value = JSON.stringify({ access_token: "abc", user: { id: "u1" } });
    await store.setItem(KEY, value);
    expect(await store.getItem(KEY)).toBe(value);
  });

  it("未保存キーは null", async () => {
    const store = new LargeSecureStore();
    expect(await store.getItem(KEY)).toBeNull();
  });

  it("removeItem で AsyncStorage/SecureStore 両方から消える", async () => {
    const store = new LargeSecureStore();
    await store.setItem(KEY, "value");
    await store.removeItem(KEY);
    expect(await store.getItem(KEY)).toBeNull();
    expect(mockSecureStoreMap.has(KEY)).toBe(false);
  });

  // AsyncStorage 側に暗号文があるのに SecureStore 側の AES 鍵が不正な hex（壊れたインストール・
  // OS 復元の不整合等を想定）。cipher の鍵配列生成時に aes-js が NaN を検出して throw する
  // （実測済み: aesjs.utils.hex.toBytes は不正文字を無検査で NaN に変換し、
  // ModeOfOperation.ctr のコンストラクタで NaN 混入配列を弾いて例外を投げる）。
  it("SecureStore 側の暗号化鍵が壊れた hex でも throw せず null を返し、エントリを破棄する", async () => {
    await AsyncStorage.setItem(KEY, "deadbeef"); // 暗号文自体は何でもよい
    mockSecureStoreMap.set(KEY, "zzzz-not-valid-hex-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

    const store = new LargeSecureStore();
    await expect(store.getItem(KEY)).resolves.toBeNull();
    // 破棄されるので、以降の呼び出しでも一貫して null（毎回同じ throw を繰り返さない）。
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockSecureStoreMap.has(KEY)).toBe(false);
  });

  // SecureStore 側の鍵は正常だが、AsyncStorage 側の暗号文が壊れている（破損した hex）ケース。
  // cipher.decrypt() 呼び出し時に同様に NaN 混入配列で throw する。
  it("AsyncStorage 側の暗号文が壊れた hex でも throw せず null を返し、エントリを破棄する", async () => {
    const store = new LargeSecureStore();
    // 正規の鍵を先に発行させておく（setItem 経由で SecureStore に妥当な鍵を書かせる）。
    await store.setItem(KEY, "seed-value-to-generate-a-real-key");
    // 暗号文だけ壊す。
    await AsyncStorage.setItem(KEY, "not-valid-hex-ciphertext-!!zzzz");

    await expect(store.getItem(KEY)).resolves.toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockSecureStoreMap.has(KEY)).toBe(false);
  });
});
