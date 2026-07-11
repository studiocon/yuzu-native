# EAS本番ビルドに Supabase 環境変数が入っておらず起動即クラッシュする

`lib/supabase.ts` は `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` が
未設定だとモジュール読み込み時に同期的に `throw` する（意図的なフェイルファスト）。
`App.tsx` がトップレベルで `./lib/supabase` を import しているため、この throw は
どの画面が描画される前、JSバンドル評価中に発生する＝**起動直後に確実にクラッシュする**。

ローカル開発では `README.md` の手順通り `cp .env.example .env` すれば動くが、この
`.env` は `.gitignore` されておりリポジトリには含まれない。EAS Build はクラウド上で
リポジトリを新規cloneしてビルドするため、**EAS側で環境変数（`eas env:create` /
ダッシュボード、または `eas.json` の `build.production.env`）を設定していない限り、
本番ビルドには `EXPO_PUBLIC_SUPABASE_*` が一切埋め込まれない**。

2026-07-10時点でこのリポジトリの `eas.json` にはどのプロファイルにも `env` フィールドが
無く、`eas env:create` を実行した形跡（コミット・ドキュメント）も無い。TestFlight配布
build 3 まで起動クラッシュが続いている件と一致する、最有力の原因。

対処: Apple Developer Program 加入者（EASプロジェクトの管理者）が
`npx eas env:create --scope project --environment production` で
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` を登録してから
`npm run build:ios:production` を再実行する必要がある。実際の値はリポジトリに
コミットしないこと。

再発防止: `README.md` の「TestFlight 提出前チェックリスト」に本番EAS環境変数の設定を
項目として追加済み（未実施ならここを見て気づけるように）。
