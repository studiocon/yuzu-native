// API のベース URL。EXPO_PUBLIC_ 環境変数で環境ごとに差し替え、未設定時は本番を既定値にする。
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";
