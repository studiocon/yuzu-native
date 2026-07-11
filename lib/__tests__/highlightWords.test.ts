import { recordWords, splitHighlights } from "../highlightWords";

describe("recordWords", () => {
  it("textが空なら空集合を返す", () => {
    expect(recordWords("", new Set(["猫の話"]))).toEqual(new Set());
  });

  it("globalWordsが空なら空集合を返す", () => {
    expect(recordWords("猫が好き", new Set())).toEqual(new Set());
  });

  it("漢字1文字はノイズが過ぎるので除外する", () => {
    expect(recordWords("猫が好き", new Set(["猫"]))).toEqual(new Set());
  });

  it("漢字・カタカナ2文字以上で本文に出現する語はヒットする", () => {
    const result = recordWords("黒猫が好きでコーヒーを飲む", new Set(["黒猫", "コーヒー"]));
    expect(result).toEqual(new Set(["黒猫", "コーヒー"]));
  });

  it("ひらがなのみの語は2文字以上でも除外する", () => {
    expect(recordWords("ねこが好き", new Set(["ねこ"]))).toEqual(new Set());
  });
});

describe("splitHighlights", () => {
  it("wordsが空なら単一セグメントで返す", () => {
    expect(splitHighlights("hello", new Set())).toEqual([{ text: "hello", mark: false }]);
  });

  it("重なる語は長い語を優先してマッチさせる", () => {
    const result = splitHighlights("東京タワーに行った", new Set(["東京", "東京タワー"]));
    expect(result[0]).toEqual({ text: "東京タワー", mark: true });
    expect(result.map((s) => s.text).join("")).toBe("東京タワーに行った");
  });

  it("正規表現の特殊文字を含む語はエスケープされてリテラルマッチする", () => {
    const result = splitHighlights("C++最高", new Set(["C++"]));
    expect(result).toEqual([
      { text: "C++", mark: true },
      { text: "最高", mark: false },
    ]);
  });

  it("textが語と完全一致する場合は単一のmarkセグメントになる", () => {
    expect(splitHighlights("こんにちは", new Set(["こんにちは"]))).toEqual([
      { text: "こんにちは", mark: true },
    ]);
  });

  it("textが空なら空配列を返す", () => {
    expect(splitHighlights("", new Set(["a"]))).toEqual([]);
  });
});
