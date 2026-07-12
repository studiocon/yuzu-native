import { isReportUnread, parseSeenKeys } from "../reportSeen";

describe("parseSeenKeys", () => {
  it("未保存（null）は null（＝要seed）", () => {
    expect(parseSeenKeys(null)).toBeNull();
  });

  it("正常な配列JSONはSetにパースする", () => {
    expect(parseSeenKeys(JSON.stringify(["2026-w01", "2026-w02"]))).toEqual(
      new Set(["2026-w01", "2026-w02"])
    );
  });

  it("壊れたJSONは空Set（nullにはしない）", () => {
    expect(parseSeenKeys("{not json")).toEqual(new Set());
  });

  it("非配列JSONは空Set", () => {
    expect(parseSeenKeys(JSON.stringify({ foo: "bar" }))).toEqual(new Set());
  });

  it("配列内のstring以外の要素は除去する", () => {
    expect(parseSeenKeys(JSON.stringify(["2026-w01", 42, null, "2026-w02"]))).toEqual(
      new Set(["2026-w01", "2026-w02"])
    );
  });
});

describe("isReportUnread", () => {
  it("generated=falseなら未読扱いしない", () => {
    expect(isReportUnread({ generated: false, periodKey: "2026-w01" }, new Set())).toBe(false);
  });

  it("既読済み（seen）なら未読ではない", () => {
    expect(
      isReportUnread({ generated: true, periodKey: "2026-w01" }, new Set(["2026-w01"]))
    ).toBe(false);
  });

  it("generatedかつ未seenなら未読", () => {
    expect(isReportUnread({ generated: true, periodKey: "2026-w01" }, new Set())).toBe(true);
  });
});
