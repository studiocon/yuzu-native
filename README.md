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

録音ロジックを `components/RecordScreen.tsx` から `lib/useRecording.ts` に抽出（フック化。逐語移動 + `onTranscribed` 化）。上記の「長押し」「リリース」「バックグラウンド/割り込み」の3項目はこの抽出の回帰確認を兼ねる。加えてこの抽出で新規追加した2点は未検証:

- [ ] 文字起こし結果が trim 後5文字未満のとき phase=error / 「短い、話せ」表示 + haptics.warning になるか
- [ ] `/api/transcribe` が 429 を返したとき、body の `error` フィールドに応じて login_required/daily_limit 分岐が機能するか（バックエンド側で 429 を再現できる状況が無いと能動的に踏めない可能性あり）

未ログイン onboarding フロー（`components/OnboardingScreen.tsx` 新規、`App.tsx` / `components/AuthScreen.tsx` / `components/RecordScreen.tsx` 変更）を追加。`RecordModal.tsx` / `lib/useRecording.ts` は無変更で再利用のみだが、録音・Haptics・AsyncStorage永続化・新規レイアウトが絡むため以下は未検証:

- [ ] hero（「声を刻め」+マイクボタン）→ 長押し録音 → プレビュー（CARVEDスタンプ + 「刻む」）→ ログイン → 保存、の一連が実機で通しで動くか
- [ ] 「刻む」タップ後に `savePendingRecord` が AsyncStorage に書き込まれ、ログイン成功後 `RecordScreen` マウント時の effect が読み出して `/api/records` に POST → 成功時 `CompleteView`（CARVED + streak/minutes）がそのまま表示されるか
- [ ] pending 保存が 4xx（daily_limit 等）で確定拒否された場合に silent に諦めて `clearPendingRecord` されるか、5xx/ネットワーク例外では pending が残り次回起動時に再試行されるか
- [ ] onboarding の `RecordModal` は `limitReached` を常に false 固定にしている（匿名側は日次上限をクライアントで追跡しないため）。実際に匿名 STT の 1日上限（429 daily_limit）を踏んだときログイン誘導に倒れるか
- [ ] `AuthScreen` に新設した email ステップの「戻る」導線（onboarding のプレビュー画面へ復帰）でレイアウト崩れが無いか
- [ ] hero 画面のマイクボタン（96px）・下部「ログイン」リンクのタップ領域とレイアウトが実機で意図通りか

キーボード回避を `ContactScreen` / `ApiTokenScreen` / `SettingsScreen`（削除確認）に追加（`KeyboardAvoidingView`、AuthScreen と同パターン）。レイアウト挙動のため以下は未検証:

- [ ] 上記3画面でキーボード表示時に入力欄・ボタンが隠れず、キーボードを出したままボタンをタップできるか（`keyboardShouldPersistTaps`）

LOG 一覧の無限スクロール（`?limit=20&offset=` ページネーション、id 重複排除、フッター `LOADING`）を追加。JSロジックのため Expo Go でも確認可:

- [ ] 21件以上の記録がある状態で末尾までスクロール → 追加読み込みされ、重複行やクラッシュが無いか

UX改善8件+sweep（触覚・SafeArea・チャート統一・アニメーション・レイアウト微調整）を追加。EAS ビルドを実施せず typecheck/lint/test のみで完了扱いにしているため、実機（またはExpo Go）での確認が必要:

- [ ] 録音を一度でも行った後、アプリ全体（タブ切替・ボタン押下等）で触覚フィードバックが鳴り続けるか（`lib/useRecording.ts` で録音停止時に `setAudioModeAsync({ allowsRecording: false })` を呼んで解除するようにした。iOS は録音セッション中は触覚を抑制するため、これが本題の修正）
- [ ] INSIGHT タブ（REPORTS一覧経由の詳細）→ 設定を開いた時、ヘッダーが Dynamic Island に隠れずに表示されるか（Modal を使う全コンポーネントに `SafeAreaProvider` を追加）
- [ ] EMOTION / REPORTS一覧 / REPORT詳細のグラフが同じ「枠線なし・グラデーション面のみ」の見た目に統一されているか
- [ ] REPORTS 一覧のグラフの上下が窮屈に見えないか（`SPARK_H` を 72→110 に拡大）
- [ ] WORDS のバブルをタップした時、押した円が「プルン」とバウンスし、隣接する円も少し遅れて連動バウンスするか。触覚（tapLight）も鳴るか
- [ ] EMOTION の ALL ボタンを押した時に「COMING SOON」ツールチップが折り返さず1行で収まるか
- [ ] LOG 詳細の LENGTH / DAY / CHARS ラベルが2行に折り返さないか
- [ ] LOG 詳細で MARK を押しても本文・声紋アニメーションが再生されない（再リビールしない）か

設定画面にリマインダー機能を追加（`lib/reminder.ts`、`components/SettingsScreen.tsx`）。トグルON時に `expo-notifications` で通知権限をリクエストし、許可されれば毎日指定時刻に DAILY トリガーでローカル通知をスケジュールする。時刻選択は `@react-native-community/datetimepicker`（iOS: カスタムシート内 spinner、Android: ネイティブダイアログ）。通知・権限ダイアログ・ネイティブ時刻ピッカーが絡むため実機（またはExpo Go）での確認が必要:

- [ ] トグルONで通知許可ダイアログが出て、許可すると指定時刻（デフォルト21:00）に通知が届くか
- [ ] 通知を拒否した場合、トグルがONのままにならず「通知を許可しろ」が一瞬表示されるか
- [ ] 時刻行をタップ→ iOS は spinner シートが開き「閉じる」で確定・閉じるか。Android はネイティブダイアログが開閉し、選択した時刻が反映されるか
- [ ] 時刻変更後、翌日以降も新しい時刻に通知が届くか（同一 identifier で再スケジュールされているか）
- [ ] トグルOFFで通知がキャンセルされ、以降届かなくなるか
- [ ] アプリを再起動しても設定（ON/OFF・時刻）が保持されるか（AsyncStorage永続化）

## TestFlight 提出前チェックリスト

コード側（lint / typecheck / test）は現状クリーン。CI（`.github/workflows/ci.yml`）で PR / main push ごとに typecheck・lint・test を自動実行するようになった。

- [x] Apple Developer Program 加入（[yuzu-app#63](https://github.com/studiocon/yuzu-app/issues/63)）
- [x] `eas init` 実施済み。EAS プロジェクトは `kyotakonnos-team/yuzu-native` にリンク済み（`app.json` の `expo.extra.eas.projectId`）
- [x] `npx eas env:create --scope project --environment production` で `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` を登録済み。未設定だと `lib/supabase.ts` が起動直後に throw して即クラッシュする不具合があったため対応（詳細: `.claude/lessons/eas-build-missing-supabase-env.md`）
- [x] `npm run build:ios:production` → `npm run submit:ios` でビルド・提出（内部テスターにTestFlight配信済み、起動時クラッシュ・スプラッシュ固まりは解消済み）
- [ ] App Store Connect 側でアプリレコード作成・プライバシーポリシー URL の用意（メールアドレス・音声データを扱うため必須。本文は `yuzu-app/notes/legal/privacy-v1-draft.md` に下書きあるが公開URL未確定。[yuzu-app#105](https://github.com/studiocon/yuzu-app/issues/105)）
- [ ] 外部テスターへの TestFlight 配布（Beta App Review が必要）を行う場合、審査ノートにメール OTP ログインの手順とレビュー用に受信可能なメールアドレスを明記する（固定パスワードが無い方式のため）。現状は内部テスターのみで未実施
- [ ] yuzu-app リポジトリの Supabase マイグレーションを本番ダッシュボードに適用: `20260702075418_report_jobs.sql` と `20260702130000_anon_stt_rate_limit.sql`（未適用。匿名STTのレート制限がcookieのみのフォールバック動作になっている）
- [x] 輸出コンプライアンス（暗号化申告）: 標準的な HTTPS 通信とローカルトークン暗号化（AES, `lib/supabase.ts` の `LargeSecureStore`）のみで独自暗号を実装していないため exempt 対象。`app.json` に `ITSAppUsesNonExemptEncryption: false` を設定済み

## App Store 公開（一般審査提出）までの残タスク

TestFlight（内部配信）は完了。ストアでの一般公開にはさらに以下が必要（詳細は [yuzu-app milestone v0.3 iOS Launch](https://github.com/studiocon/yuzu-app/milestone/3) 参照）:

- [ ] プライバシーポリシー・利用規約の公開URL確定（[yuzu-app#105](https://github.com/studiocon/yuzu-app/issues/105)）→ 確定後、設定画面の LEGAL セクションを復活（下記参照）
- [ ] App Store Connect の App Privacy（プライバシー栄養ラベル）開示 — マイク/メール/利用状況の収集内容を申告（[yuzu-app#98](https://github.com/studiocon/yuzu-app/issues/98)）
- [ ] ストア提出アセット一式 — App Icon 各サイズ・スクリーンショット（iPhoneのみ、iPad対応は撤去済み）・説明文・キーワード・年齢レーティング（[yuzu-app#99](https://github.com/studiocon/yuzu-app/issues/99)）
- [ ] App Store Connect で「Submit for Review」（一般審査。TestFlightのBeta App Reviewとは別）

上記が揃うまでは TestFlight 内部テスターのみでの検証運用が現実的。

## 既知の制約

- LINE Seed JP フォント未バンドル（上記「デザイン」参照）
- 感情スコアはDBに永続化されない（yuzu-app と同じ設計。端末を変えると再解析が必要）
- Android 実機での検証記録なし（手順は iOS 前提のみ）
- テストは `lib/` の純粋関数のみ。`components/` の画面コンポーネントは未カバー（RN実機/シミュレータでのE2E的な検証が必要なため）
- 設定画面の LEGAL / ALERT / プラン の各行は審査対策として一時的に非表示（実ページ未公開のため）。LEGAL セクションはページ公開後に復活予定（[components/SettingsScreen.tsx](components/SettingsScreen.tsx)）
- Apple/Google OAuth・Magic Linkのディープリンクは未対応（現状メールOTPのみ。[yuzu-app#100](https://github.com/studiocon/yuzu-app/issues/100)）
