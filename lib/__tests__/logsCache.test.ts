import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLogsCache, loadLogsCache, saveLogsCache, type Stats } from "../logsCache";
import type { Post } from "../types";

const userA = "user-aaa";
const userB = "user-bbb";

const post: Post = {
  id: "p1",
  text: "考えてること",
  index: 3,
  createdAt: 1720000000000,
  marked: false,
  durationMs: 12345,
  charCount: 42,
};

const stats: Stats = {
  streak: 5,
  todayCount: 1,
  maxDaily: 3,
  totalCount: 20,
  totalMinutes: 45,
};

describe("logsCache", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("save→load でラウンドトリップする", async () => {
    await saveLogsCache(userA, { posts: [post], stats, firstPostAt: 1710000000000 });
    const loaded = await loadLogsCache(userA);
    expect(loaded).toEqual({ userId: userA, posts: [post], stats, firstPostAt: 1710000000000 });
  });

  it("stats/firstPostAt が null でもラウンドトリップする", async () => {
    await saveLogsCache(userA, { posts: [post], stats: null, firstPostAt: null });
    const loaded = await loadLogsCache(userA);
    expect(loaded).toEqual({ userId: userA, posts: [post], stats: null, firstPostAt: null });
  });

  it("未保存なら null を返す", async () => {
    expect(await loadLogsCache(userA)).toBeNull();
  });

  it("別ユーザーの userId で読むと null（他人データ混入防止）", async () => {
    await saveLogsCache(userA, { posts: [post], stats, firstPostAt: null });
    expect(await loadLogsCache(userB)).toBeNull();
  });

  it("壊れたJSONは null", async () => {
    await AsyncStorage.setItem("yuzu_logs_cache_v1", "{not valid json");
    expect(await loadLogsCache(userA)).toBeNull();
  });

  it("形式が一致しない値は null", async () => {
    await AsyncStorage.setItem("yuzu_logs_cache_v1", JSON.stringify({ foo: "bar" }));
    expect(await loadLogsCache(userA)).toBeNull();

    await AsyncStorage.setItem(
      "yuzu_logs_cache_v1",
      JSON.stringify({ userId: userA, posts: "not-an-array", stats: null, firstPostAt: null }),
    );
    expect(await loadLogsCache(userA)).toBeNull();

    await AsyncStorage.setItem(
      "yuzu_logs_cache_v1",
      JSON.stringify({ userId: userA, posts: [{ id: "p1" }], stats: null, firstPostAt: null }),
    );
    expect(await loadLogsCache(userA)).toBeNull();
  });

  it("clear で削除される", async () => {
    await saveLogsCache(userA, { posts: [post], stats, firstPostAt: null });
    await clearLogsCache();
    expect(await loadLogsCache(userA)).toBeNull();
  });
});
