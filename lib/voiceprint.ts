// yuzu-app の lib/voiceprint.ts を移植。id から決定的に擬似乱数を作るので、
// 同じ記録は常に同じ「声紋」になる。

export function seededHeights(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000; // 0..1
    out.push(0.28 + r * 0.72); // 28%〜100%
  }
  return out;
}

// durationMs から声紋バー本数を導く（8〜40 本、長さに比例）。
// durationMs<=0 の旧データは null（声紋を描かない）。
export function voiceprintBarCount(durationMs: number): number | null {
  if (!durationMs || durationMs <= 0) return null;
  return Math.max(8, Math.min(40, Math.round((durationMs / 1000) * 1.4)));
}
