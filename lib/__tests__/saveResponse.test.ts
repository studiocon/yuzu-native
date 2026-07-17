import { parseSaveResponse } from "../saveResponse";

describe("parseSaveResponse", () => {
  it("正常な応答は post.index/durationMs/char_count を拾う", () => {
    const parsed = parseSaveResponse({
      post: { index: 7, durationMs: 12345, char_count: 42 },
      streak: 3,
    });
    expect(parsed).toEqual({ index: 7, durationMs: 12345, charCount: 42 });
  });

  // #14: saveRes.ok=true なのに post が欠けている壊れた body でも例外を投げず、
  // index は 0 にフォールバックする（呼び出し側の fetchLogs() が後で補正する）。
  it("post が無い応答は index=0・durationMs/charCount=null にフォールバックする", () => {
    expect(parseSaveResponse({ streak: 3 })).toEqual({ index: 0, durationMs: null, charCount: null });
  });

  it("応答自体が null/非オブジェクトでも例外を投げない", () => {
    expect(parseSaveResponse(null)).toEqual({ index: 0, durationMs: null, charCount: null });
    expect(parseSaveResponse(undefined)).toEqual({ index: 0, durationMs: null, charCount: null });
    expect(parseSaveResponse("not-json-object")).toEqual({ index: 0, durationMs: null, charCount: null });
  });

  it("post がオブジェクトでない場合もフォールバックする", () => {
    expect(parseSaveResponse({ post: "broken" })).toEqual({ index: 0, durationMs: null, charCount: null });
    expect(parseSaveResponse({ post: null })).toEqual({ index: 0, durationMs: null, charCount: null });
  });

  it("index/durationMs/char_count の型が不正なフィールドは個別にフォールバックする", () => {
    expect(parseSaveResponse({ post: { index: "7", durationMs: "123", char_count: "42" } })).toEqual({
      index: 0,
      durationMs: null,
      charCount: null,
    });
  });

  it("一部フィールドだけ欠けている場合は取れるものだけ拾う", () => {
    expect(parseSaveResponse({ post: { index: 2 } })).toEqual({ index: 2, durationMs: null, charCount: null });
  });
});
