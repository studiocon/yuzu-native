import { parseCurrentUser } from "../currentUser";

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
