import { parseReportPayload, parseReportResponse } from "../insightTypes";

const validPayload = {
  headline: "見出し",
  topics: ["仕事", "睡眠"],
  fact: "事実",
  proof: "根拠",
  shadow: "影",
  advice: "助言",
  adviceDetail: "助言の詳細",
  sentimentSeries: [
    { date: "2026-07-01", score: 0.4 },
    { date: "2026-07-02", score: -0.1 },
  ],
};

describe("parseReportPayload", () => {
  it("正常な payload をそのまま通す", () => {
    expect(parseReportPayload(validPayload)).toEqual(validPayload);
  });

  it("payload がオブジェクトでなければ null（エラー扱い）", () => {
    expect(parseReportPayload(null)).toBeNull();
    expect(parseReportPayload(undefined)).toBeNull();
    expect(parseReportPayload("broken")).toBeNull();
    expect(parseReportPayload(42)).toBeNull();
  });

  it("文字列フィールドの欠損は空文字にフォールバックする", () => {
    const result = parseReportPayload({});
    expect(result).toEqual({
      headline: "",
      topics: [],
      fact: "",
      proof: "",
      shadow: "",
      advice: "",
      adviceDetail: "",
      sentimentSeries: [],
    });
  });

  it("文字列フィールドが誤った型なら空文字にフォールバックする", () => {
    const result = parseReportPayload({ ...validPayload, headline: 123, fact: { ja: "text" }, advice: null });
    expect(result?.headline).toBe("");
    expect(result?.fact).toBe("");
    expect(result?.advice).toBe("");
  });

  it("topics が配列でなければ空配列にフォールバックする", () => {
    expect(parseReportPayload({ ...validPayload, topics: "仕事" })?.topics).toEqual([]);
    expect(parseReportPayload({ ...validPayload, topics: null })?.topics).toEqual([]);
  });

  it("topics 配列内の文字列以外の要素は除外する", () => {
    expect(parseReportPayload({ ...validPayload, topics: ["仕事", 1, null, "睡眠"] })?.topics).toEqual([
      "仕事",
      "睡眠",
    ]);
  });

  it("sentimentSeries が配列でなければ空配列にフォールバックする", () => {
    expect(parseReportPayload({ ...validPayload, sentimentSeries: "broken" })?.sentimentSeries).toEqual([]);
    expect(parseReportPayload({ ...validPayload, sentimentSeries: undefined })?.sentimentSeries).toEqual([]);
  });

  it("sentimentSeries 内の不正な要素（date/score の型不一致・欠損）は除外する", () => {
    const result = parseReportPayload({
      ...validPayload,
      sentimentSeries: [
        { date: "2026-07-01", score: 0.4 },
        { date: 20260702, score: 0.1 }, // date が数値
        { date: "2026-07-03", score: "0.5" }, // score が文字列
        { score: 0.2 }, // date 欠損
        null, // 要素自体が壊れている
      ],
    });
    expect(result?.sentimentSeries).toEqual([{ date: "2026-07-01", score: 0.4 }]);
  });
});

describe("parseReportResponse", () => {
  it("正常な { report: { payload } } をパースする", () => {
    expect(parseReportResponse({ report: { payload: validPayload } })).toEqual(validPayload);
  });

  it("report が無ければ null（エラー扱い）", () => {
    expect(parseReportResponse({})).toBeNull();
    expect(parseReportResponse({ report: null })).toBeNull();
  });

  it("data 自体がオブジェクトでなければ null", () => {
    expect(parseReportResponse(null)).toBeNull();
    expect(parseReportResponse("broken")).toBeNull();
  });

  it("report はあるが payload がオブジェクトでなければ null", () => {
    expect(parseReportResponse({ report: { payload: null } })).toBeNull();
    expect(parseReportResponse({ report: {} })).toBeNull();
  });

  it("payload の一部フィールドが壊れていてもフィールド単位でフェイルセーフして通す", () => {
    const result = parseReportResponse({ report: { payload: { ...validPayload, topics: null } } });
    expect(result).not.toBeNull();
    expect(result?.topics).toEqual([]);
  });
});
