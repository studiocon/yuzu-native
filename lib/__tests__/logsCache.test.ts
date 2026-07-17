import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLogsCache, loadLogsCache, saveLogsCache, type Stats } from "../logsCache";
import { jstDateString } from "../period";
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

  it("save→load でラウンドトリップする（保存当日は todayCount を保つ）", async () => {
    await saveLogsCache(userA, { posts: [post], stats, firstPostAt: 1710000000000 });
    const loaded = await loadLogsCache(userA);
    expect(loaded).toEqual({
      userId: userA,
      posts: [post],
      stats,
      firstPostAt: 1710000000000,
      statsDate: jstDateString(Date.now()),
    });
  });

  it("stats/firstPostAt が null でもラウンドトリップする", async () => {
    await saveLogsCache(userA, { posts: [post], stats: null, firstPostAt: null });
    const loaded = await loadLogsCache(userA);
    expect(loaded).toEqual({
      userId: userA,
      posts: [post],
      stats: null,
      firstPostAt: null,
      statsDate: jstDateString(Date.now()),
    });
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

  // 「今日はまだ録音していないのに 1/1（上限到達）で録音できない」の再発防止。
  // JST の日付を跨いだキャッシュの todayCount は当日の値ではない。
  it("JST 日付が変わったキャッシュは todayCount を 0 に戻す", async () => {
    await AsyncStorage.setItem(
      "yuzu_logs_cache_v1",
      JSON.stringify({
        userId: userA,
        posts: [post],
        stats, // todayCount: 1
        firstPostAt: null,
        statsDate: "2020-01-01", // 明らかに過去の JST 日付
      }),
    );
    const loaded = await loadLogsCache(userA);
    expect(loaded?.stats?.todayCount).toBe(0);
    // todayCount 以外は保持する
    expect(loaded?.stats?.streak).toBe(stats.streak);
    expect(loaded?.stats?.totalCount).toBe(stats.totalCount);
  });

  it("statsDate を持たない旧キャッシュも todayCount を 0 に戻す", async () => {
    await AsyncStorage.setItem(
      "yuzu_logs_cache_v1",
      JSON.stringify({ userId: userA, posts: [post], stats, firstPostAt: null }),
    );
    const loaded = await loadLogsCache(userA);
    expect(loaded?.stats?.todayCount).toBe(0);
  });

  // maxDaily は null = 無制限（admin）が有効値。number 固定にすると admin が
  // todayCount >= 0 で常に上限到達になり録音できなくなる。
  it("maxDaily が null（admin 無制限）のキャッシュを保持する", async () => {
    const adminStats: Stats = { ...stats, maxDaily: null };
    await saveLogsCache(userA, { posts: [post], stats: adminStats, firstPostAt: null });
    const loaded = await loadLogsCache(userA);
    expect(loaded?.stats?.maxDaily).toBeNull();
  });

  it("maxDaily が数値でも null でもない値は形式不一致で null", async () => {
    await AsyncStorage.setItem(
      "yuzu_logs_cache_v1",
      JSON.stringify({
        userId: userA,
        posts: [post],
        stats: { ...stats, maxDaily: "3" },
        firstPostAt: null,
      }),
    );
    expect(await loadLogsCache(userA)).toBeNull();
  });
});
