import {
  buildTickerEntries,
  deriveNextIndex,
  stepForElapsed,
  TICKER_MAX_ENTRIES,
  TICKER_EXCERPT_MAX_CHARS,
} from "../carvingStage";
import type { Post } from "../types";

const post = (overrides: Partial<Post>): Post => ({
  id: overrides.id ?? "id",
  text: overrides.text ?? "",
  index: overrides.index ?? 1,
  createdAt: overrides.createdAt ?? 0,
  marked: overrides.marked ?? false,
  durationMs: overrides.durationMs ?? 0,
  charCount: overrides.charCount ?? 0,
  ...overrides,
});

describe("buildTickerEntries", () => {
  it("marked が未 mark より先頭に来る", () => {
    const posts = [
      post({ id: "a", text: "unmarked", marked: false, createdAt: 100 }),
      post({ id: "b", text: "marked", marked: true, createdAt: 50 }),
    ];
    const entries = buildTickerEntries(posts);
    expect(entries.map((e) => e.excerpt)).toEqual(["marked", "unmarked"]);
  });

  it("marked・未markそれぞれ createdAt 降順で並ぶ", () => {
    const posts = [
      post({ id: "m1", text: "m1", marked: true, createdAt: 10 }),
      post({ id: "m2", text: "m2", marked: true, createdAt: 30 }),
      post({ id: "u1", text: "u1", marked: false, createdAt: 20 }),
      post({ id: "u2", text: "u2", marked: false, createdAt: 40 }),
    ];
    const entries = buildTickerEntries(posts);
    expect(entries.map((e) => e.excerpt)).toEqual(["m2", "m1", "u2", "u1"]);
  });

  it("最大 TICKER_MAX_ENTRIES 件に絞られる", () => {
    const posts = Array.from({ length: TICKER_MAX_ENTRIES + 5 }, (_, i) =>
      post({ id: `p${i}`, text: `text${i}`, createdAt: i }),
    );
    const entries = buildTickerEntries(posts);
    expect(entries).toHaveLength(TICKER_MAX_ENTRIES);
  });

  it("trim後に空になるテキストは除外される", () => {
    const posts = [
      post({ id: "a", text: "   \n\n  ", createdAt: 1 }),
      post({ id: "b", text: "本文あり", createdAt: 2 }),
    ];
    const entries = buildTickerEntries(posts);
    expect(entries).toHaveLength(1);
    expect(entries[0].excerpt).toBe("本文あり");
  });

  it("40字超は40字+…に切り詰められる", () => {
    const longText = "あ".repeat(TICKER_EXCERPT_MAX_CHARS + 10);
    const entries = buildTickerEntries([post({ text: longText, createdAt: 1 })]);
    expect(entries[0].excerpt).toBe(`${"あ".repeat(TICKER_EXCERPT_MAX_CHARS)}…`);
  });

  it("40字以下はそのまま（…が付かない）", () => {
    const exact = "あ".repeat(TICKER_EXCERPT_MAX_CHARS);
    const entries = buildTickerEntries([post({ text: exact, createdAt: 1 })]);
    expect(entries[0].excerpt).toBe(exact);
  });

  it("絵文字（サロゲートペア）を分割しない", () => {
    // 😀 はサロゲートペア（UTF-16で2コード単位）だが Array.from では1文字として数える。
    const text = "😀".repeat(TICKER_EXCERPT_MAX_CHARS + 1);
    const entries = buildTickerEntries([post({ text, createdAt: 1 })]);
    const expected = `${"😀".repeat(TICKER_EXCERPT_MAX_CHARS)}…`;
    expect(entries[0].excerpt).toBe(expected);
    // サロゲートペアが分割されていれば不正な文字（U+FFFD相当や単独サロゲート）が混ざるはずだが、
    // ここでは元の😀がそのまま維持されていることを確認する。
    expect(Array.from(entries[0].excerpt).slice(0, TICKER_EXCERPT_MAX_CHARS).every((c) => c === "😀")).toBe(true);
  });

  it("改行・連続空白を単一スペースへ正規化する", () => {
    const text = "一行目\n\n二行目   三行目\t四行目";
    const entries = buildTickerEntries([post({ text, createdAt: 1 })]);
    expect(entries[0].excerpt).toBe("一行目 二行目 三行目 四行目");
  });
});

describe("deriveNextIndex", () => {
  it("通常は max(index)+1", () => {
    const posts = [post({ index: 1 }), post({ index: 2 }), post({ index: 3 })];
    expect(deriveNextIndex(posts)).toBe(4);
  });

  it("歯抜け index でも max+1（例 [1,5,3]→6）", () => {
    const posts = [post({ index: 1 }), post({ index: 5 }), post({ index: 3 })];
    expect(deriveNextIndex(posts)).toBe(6);
  });

  it("空配列なら null", () => {
    expect(deriveNextIndex([])).toBeNull();
  });
});

describe("stepForElapsed", () => {
  it("0 → 0", () => {
    expect(stepForElapsed(0)).toBe(0);
  });

  it("3499 → 0", () => {
    expect(stepForElapsed(3499)).toBe(0);
  });

  it("3500 → 1", () => {
    expect(stepForElapsed(3500)).toBe(1);
  });

  it("6999 → 1", () => {
    expect(stepForElapsed(6999)).toBe(1);
  });

  it("7000 → 2", () => {
    expect(stepForElapsed(7000)).toBe(2);
  });

  it("巨大値 → 2", () => {
    expect(stepForElapsed(1_000_000)).toBe(2);
  });
});
