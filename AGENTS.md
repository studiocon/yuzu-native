# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## API 呼び出し

必ず `lib/apiFetch.ts`（`getSession` でトークンリフレッシュ）+ `lib/config.ts` の `API_BASE` を使う。生 `fetch` + `process.env` 直参照は禁止。

## ボイス&トーン

正典は yuzu-app リポの `DESIGN.md` §4（UIコピー表・NGワード: 癒し/寄り添う/育つ/やさしく/気づき 等）。文言変更時は必ず照合する。

## 日付処理

集計・期間は JST 固定（`lib/period.ts`）。streak/stats はローカル時間（意図的、`lib/streak.ts` のコメント参照）。

## 検証コマンド

`npm run typecheck` / `npm run lint` / `npm test`（テストは `lib/` の純関数のみ）。

## その他

`expo-audio` 等の挙動は必ず v54 のバージョン付きドキュメントを参照する。
