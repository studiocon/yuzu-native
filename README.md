# YUZU Native（Expo）

[YUZU 本体](https://github.com/studiocon/yuzu-app) のネイティブアプリ。方式は [#64](https://github.com/studiocon/yuzu-app/issues/64) で **Expo / React Native** に決定済み。

検証スパイクとして始まったが、現在は yuzu-app（Web版）の LOG 機能一式（メールOTPログイン → 長押し録音 → STT → 保存 → STATS/LOG一覧 → INDEX詳細）をひととおり実装済み。バックエンドは持たず、既存の yuzu-app API をそのまま使う。

## 機能

- **ログイン**: メールOTP（数字コード）。Supabase `signInWithOtp` → `verifyOtp`
- **録音 → 保存**: 長押しで録音（Haptics） → `/api/transcribe` でSTT → `/api/records` に保存。1日上限・エラー文言は yuzu-app と統一
- **STATS**: RECORDS / MINUTES / STREAK をヘッダーに表示。上限間近は `{N} LEFT` を表示
- **LOG 一覧**: 直近の投稿をカード表示（録音長・声紋バー・感情カラーの左端バー）。タップで INDEX 詳細モーダルを開く
- **INDEX 詳細モーダル**: 全文・LENGTH/DAY/CHARS・MARK（ピン留め）・COPY（クリップボードコピー、Notion移行期間限定の一時機能）
- **感情カラー**: 投稿本文を `/api/analyze-sentiment` でスコア化し、LOGカード左端バー・INDEX詳細の声紋ヒーローを着色。DBには永続化されない装飾情報で、クライアント側（`AsyncStorage`）にキャッシュ
- **録音の割り込み耐性**: 電話・通知でアプリが background/inactive に遷移した際は `AppState` を監視して録音を強制停止し、固まった状態にならないようにしている

## アーキテクチャ

- バックエンドは作らない。既存の [yuzu-app](https://github.com/studiocon/yuzu-app) の API（`https://app.yuzu.style/api/*`）をそのまま使う
- 認証は **メールOTP（数字コード。桁数はメールテンプレート依存、入力欄は最大10桁まで許容）**。Magic Link（タップ式）はカスタムスキーム `exp://` の redirect_to が Supabase 側で握り潰され Site URL にフォールバックする現象が実機で確認されたため不採用（ディープリンクに依存しない方式に統一）
- `/api/transcribe`・`/api/records`・`/api/analyze-sentiment` は Bearer トークン認証に対応済み（yuzu-app [#100](https://github.com/studiocon/yuzu-app/issues/100)・[#127](https://github.com/studiocon/yuzu-app/pull/127)）
- セッションは `expo-secure-store` + `AsyncStorage` の LargeSecureStore パターンで永続化（[lib/supabase.ts](lib/supabase.ts)）
- `lib/` 配下の DOM 非依存ロジック（period.ts 等）は後続フェーズで yuzu-app からコピーして使う想定（今はまだ持ち込んでいない）

## デザイン

- [yuzu-app の DESIGN.md](https://github.com/studiocon/yuzu-app/blob/main/DESIGN.md) を Source of Truth とし、`lib/theme.ts` にトークン化（カラー・タイプスケール・角丸・easing）
- 英字ラベル/数値は Unbounded（`@expo-google-fonts/unbounded`）、アイコンは Phosphor（`phosphor-react-native`）に統一
- **LINE Seed JP（日本語本文用フォント）はフォントファイル未取得のためネイティブには未バンドル**で、日本語テキストは OS 標準フォントにフォールバックしている（Web 版は Google Fonts CDN から読むため未対応で問題にならないが、Native は CDN `<link>` が使えないため要対応）
- 録音FABは yuzu-app の `.fab-record`（画面下部固定表示）に合わせ、スクロール位置に関係なく常時アクセス可能な位置に固定している（[components/RecordScreen.tsx](components/RecordScreen.tsx)）

## セキュリティ・パフォーマンス

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` は起動時にバリデーションし、未設定なら分かりやすいエラーで即座に落とす（[lib/supabase.ts](lib/supabase.ts)）
- Unbounded フォントはバレル（`@expo-google-fonts/unbounded`）経由だと使わないウェイトまでバンドルされる（Metroの制約でCJS requireがtree-shakeされない）ため、`App.tsx` では使うウェイトだけ個別パスから直接importしてバンドルサイズを約2.9MB削減している（`declarations.d.ts` に `.ttf` の型宣言）
- LOG一覧の行は `React.memo` 化し、録音中の頻繁な状態変化で全行の声紋バーを再計算しないようにしている
- サインアウト等でのアンマウント後にネットワーク応答が返ってきてもstate更新しない `mountedRef` ガードあり

## セットアップ

```bash
cp .env.example .env  # 値は yuzu-app の .env.local の NEXT_PUBLIC_SUPABASE_* と同じ
npm install
```

ログインはメールアドレス送信 → 届いたメール内のコードを入力するだけ。Redirect URL の登録は不要。

## 開発

```bash
npm run lint   # eslint-config-expo（flat config, eslint.config.js）
npm test       # jest-expo。DOM非依存ロジック（voiceprint/sentimentColor/stats）の単体テスト
```

RN 実機/シミュレータが必要な画面コンポーネント（`components/`）は現状テスト対象外。`lib/` 配下の純粋関数から優先的にカバーしている。

## 実機で動かす

⚠️ Haptics は **iOS Simulator では鳴らない**。物理 iPhone 必須。

### 最速：Expo Go（署名不要・再インストール不要）

`expo-audio` / `expo-haptics` はどちらも Expo Go にバンドルされている標準モジュールなので、Xcode 不要・証明書の7日失効も無い。「しばらく実機で触る」検証はこれで十分。

1. iPhone に App Store から **Expo Go** をインストール
2. Mac で:
   ```bash
   npm install
   npx expo start
   ```
3. 表示される QR を iPhone のカメラで読み取る → Expo Go で起動

### 本格ビルド（TestFlight 提出前の確認・Expo Go の制約を超える検証用）

Expo Go では試せない挙動（Bundle ID 固有の権限文言、スタンドアロンでの起動速度等）を見たい時に使う。

```bash
npm run ios
```

初回は Xcode が開くので：

1. `App` ターゲット → Signing & Capabilities → Team を自分の Apple ID に設定
2. iPhone を USB 接続 → デバイス選択 → ▶ 実行
3. iPhone 側「設定 → 一般 → VPN とデバイス管理」で証明書を信頼

無料 Apple ID（Personal Team）の場合、7日ごとに再インストールが必要。TestFlight に進むには Apple Developer Program（[yuzu-app#63](https://github.com/studiocon/yuzu-app/issues/63)）への加入が必須。

### EAS Build（TestFlight 提出用）

`eas.json` に `development` / `preview` / `production` の3プロファイルを用意済み。ただしこのリポジトリはまだ **EAS プロジェクトに未リンク**（`eas init` 未実施）。Apple Developer Program 加入者が以下を一度だけ実行する必要がある:

```bash
npx eas login          # Expo アカウントでログイン
npx eas init            # app.json に expo.extra.eas.projectId が書き込まれる
npx eas build:configure # iOS の Bundle Identifier / 証明書設定を対話的に行う
```

リンク後は：

```bash
npm run build:ios:preview     # 社内配布用（Ad Hoc / internal distribution）
npm run build:ios:production  # ストア提出用
npm run submit:ios             # ビルド済みアーカイブを App Store Connect に提出
```

## 実機検証待ち（#64 チェックリスト）

コードレベルでは実装・監査済みだが、この開発環境には物理iPhoneが無いため未確認の項目:

- [x] メールで届いたコードを入力してログインできるか
- [ ] 長押し → IMPACT MEDIUM が「録音開始」の手応えとして十分か
- [ ] リリース → NOTIFICATION SUCCESS が「録音完了」の余韻として十分か
- [ ] `/api/transcribe` → `/api/records` が通り、保存された INDEX が返るか
- [ ] アプリ再起動後もログイン状態が保持されるか（LargeSecureStore）
- [ ] バックグラウンド/割り込み（電話・通知）時の録音挙動
- [ ] 録音FABの固定位置・スクロール中のタップ可否

トークンリフレッシュ絡みの 401（長時間バックグラウンド後にAPIが401で落ちる問題）は解消済み: `lib/apiFetch.ts` が呼び出し直前に毎回 `getSession()` を通し、期限切れなら Supabase SDK 内部のリフレッシュを経由してから叩くため、実機検証でも stale session による 401 リスクは無い。

## TestFlight 提出前チェックリスト

コード側（lint / typecheck / test）は現状クリーン。CI（`.github/workflows/ci.yml`）で PR / main push ごとに typecheck・lint・test を自動実行するようになった。残るのはアカウント・提出作業・インフラ側のタスク:

- [ ] Apple Developer Program 加入（[yuzu-app#63](https://github.com/studiocon/yuzu-app/issues/63)）。無料 Apple ID では TestFlight に進めない
- [ ] `eas init` / `eas build:configure` を実行し EAS プロジェクトをリンク（加入者が一度だけ実施）
- [ ] `npm run build:ios:production` → `npm run submit:ios` でビルド・提出
- [ ] App Store Connect 側でアプリレコード作成・プライバシーポリシー URL の用意（メールアドレス・音声データを扱うため必須）
- [ ] 外部テスターへの TestFlight 配布（Beta App Review が必要）を行う場合、審査ノートにメール OTP ログインの手順とレビュー用に受信可能なメールアドレスを明記する（固定パスワードが無い方式のため）
- [ ] yuzu-app リポジトリの Supabase マイグレーションを本番ダッシュボードに適用: `20260702075418_report_jobs.sql` と `20260702130000_anon_stt_rate_limit.sql`（未適用。本体側の機能に必要なため提出前に反映すること）
- [x] 輸出コンプライアンス（暗号化申告）: 標準的な HTTPS 通信とローカルトークン暗号化（AES, `lib/supabase.ts` の `LargeSecureStore`）のみで独自暗号を実装していないため exempt 対象。`app.json` に `ITSAppUsesNonExemptEncryption: false` を設定済み

## 既知の制約

- LINE Seed JP フォント未バンドル（上記「デザイン」参照）
- 感情スコアはDBに永続化されない（yuzu-app と同じ設計。端末を変えると再解析が必要）
- `eas.json` は用意済みだが EAS プロジェクト自体は未リンク（`eas init` 未実施。Apple Developer Program 加入者が実施する想定）
- Android 実機での検証記録なし（手順は iOS 前提のみ）
- テストは `lib/` の純粋関数のみ。`components/` の画面コンポーネントは未カバー（RN実機/シミュレータでのE2E的な検証が必要なため）
- 設定画面の LEGAL / ALERT / プラン の各行は審査対策として一時的に非表示（実ページ未公開のため）。LEGAL セクションはページ公開後に復活予定（[components/SettingsScreen.tsx](components/SettingsScreen.tsx)）
