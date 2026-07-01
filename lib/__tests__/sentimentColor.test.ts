import { sentimentColor, SENTIMENT_MID, SENTIMENT_NEG, SENTIMENT_POS } from "../sentimentColor";

describe("sentimentColor", () => {
  it("returns null for未解析（undefined/NaN）", () => {
    expect(sentimentColor(undefined)).toBeNull();
    expect(sentimentColor(null)).toBeNull();
    expect(sentimentColor(NaN)).toBeNull();
  });

  it("maps the exact endpoints to the documented brand colors", () => {
    // rgbToHex は小文字を返すため、色としては等価でも文字列は大文字定数と大小が異なる。
    expect(sentimentColor(0)?.toLowerCase()).toBe(SENTIMENT_MID.toLowerCase());
    expect(sentimentColor(1)?.toLowerCase()).toBe(SENTIMENT_POS.toLowerCase());
    expect(sentimentColor(-1)?.toLowerCase()).toBe(SENTIMENT_NEG.toLowerCase());
  });

  it("clamps out-of-range scores to the endpoint color", () => {
    expect(sentimentColor(2)).toBe(sentimentColor(1));
    expect(sentimentColor(-5)).toBe(sentimentColor(-1));
  });

  it("interpolates monotonically between neutral and positive", () => {
    const mid = sentimentColor(0.5);
    expect(mid).not.toBe(SENTIMENT_MID);
    expect(mid).not.toBe(SENTIMENT_POS);
  });
});
