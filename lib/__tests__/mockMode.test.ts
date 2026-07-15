import AsyncStorage from "@react-native-async-storage/async-storage";
import { MOCK_MODE_STORAGE_KEY, clearMockMode, isMockModeEnabled, loadMockMode, setMockMode } from "../mockMode";

describe("mockMode", () => {
  afterEach(async () => {
    clearMockMode();
    await AsyncStorage.clear();
  });

  it("初期状態は OFF", () => {
    expect(isMockModeEnabled()).toBe(false);
  });

  it("setMockMode(true) で ON になり AsyncStorage にも永続化される", async () => {
    await setMockMode(true);
    expect(isMockModeEnabled()).toBe(true);
    expect(await AsyncStorage.getItem(MOCK_MODE_STORAGE_KEY)).toBe("1");
  });

  it("setMockMode(false) で OFF に戻る", async () => {
    await setMockMode(true);
    await setMockMode(false);
    expect(isMockModeEnabled()).toBe(false);
    expect(await AsyncStorage.getItem(MOCK_MODE_STORAGE_KEY)).toBe("0");
  });

  it("loadMockMode は永続化済みの ON を復元する", async () => {
    await AsyncStorage.setItem(MOCK_MODE_STORAGE_KEY, "1");
    expect(await loadMockMode()).toBe(true);
    expect(isMockModeEnabled()).toBe(true);
  });

  it("loadMockMode は未保存なら OFF", async () => {
    expect(await loadMockMode()).toBe(false);
  });

  it("clearMockMode で OFF に戻り AsyncStorage 側も消える", async () => {
    await setMockMode(true);
    clearMockMode();
    expect(isMockModeEnabled()).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem(MOCK_MODE_STORAGE_KEY)).toBeNull();
  });
});
