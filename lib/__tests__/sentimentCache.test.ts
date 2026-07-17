import AsyncStorage from "@react-native-async-storage/async-storage";
import { SENTIMENT_CACHE_KEY, clearSentimentCache, loadSentimentCache, saveSentimentCache } from "../sentimentCache";

describe("sentimentCache", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("save→load でラウンドトリップする", async () => {
    const cache = { "post-1": 0.5, "post-2": -0.2 };
    await saveSentimentCache(cache);
    expect(await loadSentimentCache()).toEqual(cache);
  });

  it("未保存なら空オブジェクトを返す", async () => {
    expect(await loadSentimentCache()).toEqual({});
  });

  it("壊れたJSONは空オブジェクト", async () => {
    await AsyncStorage.setItem(SENTIMENT_CACHE_KEY, "{not valid json");
    expect(await loadSentimentCache()).toEqual({});
  });

  it("非オブジェクトJSONは空オブジェクト", async () => {
    await AsyncStorage.setItem(SENTIMENT_CACHE_KEY, JSON.stringify("not-an-object"));
    expect(await loadSentimentCache()).toEqual({});
  });

  it("clearSentimentCache で削除される（別アカウント切替時に前ユーザーのスコアを引き継がない）", async () => {
    await saveSentimentCache({ "post-1": 0.5 });
    await clearSentimentCache();
    expect(await loadSentimentCache()).toEqual({});
    expect(await AsyncStorage.getItem(SENTIMENT_CACHE_KEY)).toBeNull();
  });
});
