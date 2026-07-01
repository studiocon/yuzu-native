import { seededHeights, voiceprintBarCount } from "../voiceprint";

describe("voiceprintBarCount", () => {
  it("returns null for durationMs <= 0 (旧データは声紋を描かない)", () => {
    expect(voiceprintBarCount(0)).toBeNull();
    expect(voiceprintBarCount(-1000)).toBeNull();
  });

  it("clamps to a minimum of 8 bars for very short recordings", () => {
    expect(voiceprintBarCount(1000)).toBe(8);
  });

  it("clamps to a maximum of 40 bars for long recordings", () => {
    expect(voiceprintBarCount(60_000)).toBe(40);
  });

  it("scales roughly linearly with duration within the clamp range", () => {
    expect(voiceprintBarCount(10_000)).toBe(14); // round(10 * 1.4)
  });
});

describe("seededHeights", () => {
  it("returns `count` values, all within the documented 0.28–1.0 range", () => {
    const heights = seededHeights("post-1", 12);
    expect(heights).toHaveLength(12);
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(0.28);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for the same seed (同じ記録は常に同じ声紋になる)", () => {
    expect(seededHeights("post-1", 10)).toEqual(seededHeights("post-1", 10));
  });

  it("differs for different seeds", () => {
    expect(seededHeights("post-1", 10)).not.toEqual(seededHeights("post-2", 10));
  });
});
