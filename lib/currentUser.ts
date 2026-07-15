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

// 設定画面「種類」行の表示ラベル。優先順位: モックモード（撮影中は最優先で明示） >
// admin（オーナーのみ） > 課金プラン（free 以外は「プレミアム」。light/premium 課金導入は
// 別 issue、それまでは到達しない）。
export function planTypeLabel(me: CurrentUser | null, mockEnabled: boolean): string {
  if (mockEnabled) return "モック";
  if (!me) return "―";
  if (me.role === "admin") return "Admin";
  return me.plan === "free" ? "フリー" : "プレミアム";
}
