import {
  buildMockHeatmapCells,
  buildMockPosts,
  buildMockReportMetas,
  buildMockReportPayload,
  buildMockScores,
  buildMockStats,
} from "../mockData";

describe("buildMockPosts", () => {
  it("20件を新着順（createdAt降順）で返す", () => {
    const posts = buildMockPosts();
    expect(posts).toHaveLength(20);
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].createdAt).toBeGreaterThanOrEqual(posts[i].createdAt);
    }
  });

  it("id は buildMockScores のキーと一致する", () => {
    const posts = buildMockPosts();
    const scores = buildMockScores();
    for (const p of posts) {
      expect(scores[p.id]).toBeDefined();
    }
  });
});

describe("buildMockStats", () => {
  it("0〜13日前まで連続して投稿があるため streak は14", () => {
    expect(buildMockStats().streak).toBe(14);
  });

  it("todayCount は daysAgo=0 の件数（2件）", () => {
    expect(buildMockStats().todayCount).toBe(2);
  });

  it("maxDaily は管理者扱いで無制限（null）", () => {
    expect(buildMockStats().maxDaily).toBeNull();
  });

  it("totalCount は seed 総数と一致する", () => {
    expect(buildMockStats().totalCount).toBe(20);
  });
});

describe("buildMockHeatmapCells", () => {
  it("28日 x 12バケットのセルを返し、投稿がある日は charCount > 0", () => {
    const now = Date.now();
    const posts = buildMockPosts(now);
    const cells = buildMockHeatmapCells(posts, 28, now);
    expect(cells).toHaveLength(28 * 12);
    const total = cells.reduce((s, c) => s + c.charCount, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe("buildMockReportMetas / buildMockReportPayload", () => {
  it("生成済み(generated=true)のレポート一覧を返す", () => {
    const metas = buildMockReportMetas();
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) expect(m.generated).toBe(true);
  });

  it("一覧に無い periodKey は null", () => {
    expect(buildMockReportPayload("w-1999-01-01")).toBeNull();
  });

  it("一覧にある periodKey は本文 payload を返す", () => {
    const metas = buildMockReportMetas();
    const payload = buildMockReportPayload(metas[0].periodKey);
    expect(payload).not.toBeNull();
    expect(payload?.headline).toBe(metas[0].headline);
  });
});
