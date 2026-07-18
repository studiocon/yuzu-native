# YUZU Native — エージェント向け指示

音声ジャーナル YUZU のネイティブ版（Expo/React Native）。アーキテクチャ・セットアップ・実機手順・既知の制約は `README.md` を参照。

## 境界

- バックエンドを作らない。姉妹リポ yuzu-app が提供する既存 API（`https://app.yuzu.style/api/*`）を使う
- API 呼び出しは必ず `lib/apiFetch.ts`（`getSession` でトークンリフレッシュ）+ `lib/config.ts` の `API_BASE` を経由する。生 `fetch` や `process.env` の直参照は禁止

## Expo ドキュメント

Expo は変化が速く、学習時の知識が古い可能性が高い。`expo-*` パッケージの API に触る変更をするときは、`package.json` の `expo` メジャーバージョンに対応する versioned docs（`https://docs.expo.dev/versions/vXX.0.0/`）を参照する。

## デザイン

`DESIGN.md`（このリポジトリのルート）は yuzu-app リポの `DESIGN.md` を移植したコピー。**正典は yuzu-app 側**で、ローカルの内容が古くなりうる（冒頭の「ネイティブ版での位置づけ」に元コミットハッシュと、ネイティブ側の意図的差分一覧を記載）。ローカルに無ければ `../yuzu-app/DESIGN.md`、それも無ければ GitHub `studiocon/yuzu-app` を参照する。

- UI 文言（§4 VOICE & TONE）を作成・変更したら `copy-review` スキル（`.claude/skills/copy-review/`）で照合する
- 色・シェイプ・コンポーネント・アニメーションなど見た目を作成・変更したら `design-review` スキル（`.claude/skills/design-review/`）で照合する

## 日付処理

集計・期間は JST 固定（`lib/period.ts`）。streak/stats はローカル時間（意図的、`lib/streak.ts` のコメント参照）。

## 完了の定義

変更種別ごとに必要な検証が異なる。すべて満たして初めて完了とする。

| 変更種別 | 必要な検証 |
|---|---|
| すべての変更 | `npm run typecheck` / `npm run lint` / `npm test` が green |
| `lib/` の純ロジック | 上記に加え、該当ユニットテストの追加・更新 |
| UI 文言の作成・変更 | `copy-review` スキルで正典照合 |
| UI の見た目（色・シェイプ・コンポーネント・アニメーション）の作成・変更 | `design-review` スキルで正典照合 |
| 画面・録音・ネイティブ挙動 | `verify-device` スキルで実機検証の要否を判定 |

## 学びの記録

セッションをまたいで役立つ学びは `.claude/lessons/` に記録する。運用ルールは `.claude/lessons/README.md` を参照。
