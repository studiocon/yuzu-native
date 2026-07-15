// GET /api/me（yuzu-app）のレスポンス型とパース。admin 判定・エンタイトルメント確認に使う。
export type CurrentUser = {
  id: string;
  email: string | null;
  role: "user" | "admin";
  plan: string;
  limits: { maxDailySessions: number | null; maxRecordMs: number | null };
};

// 不正・欠損値は role="user"（非 admin）側へフェイルセーフする
// （パース失敗で誤って admin メニューを出さないため）。
export function parseCurrentUser(payload: Record<string, unknown>): CurrentUser {
  const limits =
    payload.limits && typeof payload.limits === "object" ? (payload.limits as Record<string, unknown>) : {};
  return {
    id: typeof payload.id === "string" ? payload.id : "",
    email: typeof payload.email === "string" ? payload.email : null,
    role: payload.role === "admin" ? "admin" : "user",
    plan: typeof payload.plan === "string" ? payload.plan : "free",
    limits: {
      maxDailySessions: typeof limits.maxDailySessions === "number" ? limits.maxDailySessions : null,
      maxRecordMs: typeof limits.maxRecordMs === "number" ? limits.maxRecordMs : null,
    },
  };
}
