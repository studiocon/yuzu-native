import { parseCurrentUser, planTypeLabel, type CurrentUser } from "../currentUser";

const baseUser: CurrentUser = {
  id: "u1",
  email: "a@b.com",
  role: "user",
  plan: "free",
  limits: { maxDailySessions: 1, maxRecordMs: 60000 },
};

describe("parseCurrentUser", () => {
  it("正常なレスポンスをパースする", () => {
    expect(
      parseCurrentUser({
        id: "u1",
        email: "a@b.com",
        role: "admin",
        plan: "premium",
        limits: { maxDailySessions: null, maxRecordMs: null },
      }),
    ).toEqual({
      id: "u1",
      email: "a@b.com",
      role: "admin",
      plan: "premium",
      limits: { maxDailySessions: null, maxRecordMs: null },
    });
  });

  it("role が admin 以外の値なら user 扱い（フェイルセーフ）", () => {
    expect(parseCurrentUser({ id: "u1", role: "superuser", plan: "free", limits: {} }).role).toBe("user");
  });

  it("role が欠けていれば user 扱い", () => {
    expect(parseCurrentUser({}).role).toBe("user");
  });

  it("email 欠如は null", () => {
    expect(parseCurrentUser({ role: "user" }).email).toBeNull();
  });

  it("limits の数値以外のフィールドは null にフォールバックする", () => {
    expect(
      parseCurrentUser({ role: "user", limits: { maxDailySessions: "3", maxRecordMs: 60000 } }).limits,
    ).toEqual({
      maxDailySessions: null,
      maxRecordMs: 60000,
    });
  });

  it("limits 自体が欠けていれば両方 null", () => {
    expect(parseCurrentUser({ role: "user" }).limits).toEqual({ maxDailySessions: null, maxRecordMs: null });
  });
});

describe("planTypeLabel", () => {
  it("モックモード ON なら role/plan に関わらず「モック」（最優先）", () => {
    expect(planTypeLabel({ ...baseUser, role: "admin", plan: "premium" }, true)).toBe("モック");
    expect(planTypeLabel(null, true)).toBe("モック");
  });

  it("me が未取得（null）かつモック OFF なら「―」", () => {
    expect(planTypeLabel(null, false)).toBe("―");
  });

  it("role=admin なら plan に関わらず「Admin」", () => {
    expect(planTypeLabel({ ...baseUser, role: "admin", plan: "free" }, false)).toBe("Admin");
  });

  it("plan=free の一般ユーザーは「フリー」", () => {
    expect(planTypeLabel({ ...baseUser, role: "user", plan: "free" }, false)).toBe("フリー");
  });

  it("plan が free 以外（将来の課金プラン）は「プレミアム」", () => {
    expect(planTypeLabel({ ...baseUser, role: "user", plan: "premium" }, false)).toBe("プレミアム");
    expect(planTypeLabel({ ...baseUser, role: "user", plan: "light" }, false)).toBe("プレミアム");
  });
});
