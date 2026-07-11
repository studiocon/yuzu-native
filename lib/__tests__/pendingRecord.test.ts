import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPendingRecord, loadPendingRecord, savePendingRecord } from "../pendingRecord";

describe("pendingRecord", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("save→load でラウンドトリップする", async () => {
    await savePendingRecord({ text: "考えてること", durationMs: 12345 });
    const loaded = await loadPendingRecord();
    expect(loaded).toEqual({ text: "考えてること", durationMs: 12345 });
  });

  it("未保存なら null を返す", async () => {
    const loaded = await loadPendingRecord();
    expect(loaded).toBeNull();
  });

  it("不正なJSONが入っていたら null を返す", async () => {
    await AsyncStorage.setItem("yuzu_pending_text", "{not valid json");
    const loaded = await loadPendingRecord();
    expect(loaded).toBeNull();
  });

  it("形式が一致しない値が入っていたら null を返す", async () => {
    await AsyncStorage.setItem("yuzu_pending_text", JSON.stringify({ foo: "bar" }));
    expect(await loadPendingRecord()).toBeNull();

    await AsyncStorage.setItem("yuzu_pending_text", JSON.stringify("plain string"));
    expect(await loadPendingRecord()).toBeNull();

    await AsyncStorage.setItem("yuzu_pending_text", JSON.stringify({ text: "ok", durationMs: "not-a-number" }));
    expect(await loadPendingRecord()).toBeNull();
  });

  it("clear で削除される", async () => {
    await savePendingRecord({ text: "消える", durationMs: 1000 });
    await clearPendingRecord();
    expect(await loadPendingRecord()).toBeNull();
  });
});
