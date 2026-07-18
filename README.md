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
- `/api/transcribe`・`/api/records`・`/api/analyze-sentiment` は Bearer トークン認証に対応済み（yuzu-app [#127](https://github.com/studiocon/yuzu-app/pull/127)）
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

レイアウト微調整3件を追加。typecheck/lint/test のみで完了扱いのため実機確認が必要:

- [ ] LOG / INSIGHT ヘッダーのページ名末尾のピリオドが削除されているか（正典 yuzu-app に合わせた）
- [ ] INSIGHT の REPORTS 一覧、カード同士の余白が詰まりすぎ・窮屈に見えないか（`paddingVertical` を spacing.md→sm に変更）
- [ ] LOG 詳細の LENGTH / CHARS の値（`statValue`、36→28px + `adjustsFontSizeToFit`）が2行に折り返さなくなったか。長い録音時間・大きい文字数でも1行に収まるか

CARVING 待機画面のリッチ化（`components/RecordModal.tsx`、`lib/carvingStage.ts`）。スピナーを廃止し、刻印タイプライター（タイトル1文字ずつ・センター配置）+ ステップドット + 過去LOGティッカー + NEXT #NNN カウントアップの一体演出に置き換えた。アニメーション・タイミング・アクセシビリティが絡むため実機（またはExpo Go）での確認が必要:

- [ ] 実録音 → CARVING 突入でタイトル刻印 → ティッカー → ドット前進 → NEXT #NNN の順に演出が出るか
- [ ] 高速完了（~3秒・良回線）でも演出途中から CompleteView へ違和感なく切り替わるか
- [ ] 低速回線（15-20秒）でティッカー循環・ドットパルスが継続し、フリーズや演出の「偽完了」が無いか
- [ ] carving 中に機内モードにすると error 表示へクリーンに遷移するか（アニメ残留・警告なし）
- [ ] iOS「視差効果を減らす」ON でタイトル・ティッカーが静的表示になるか
- [ ] 匿名オンボーディングの CARVING で FloatingDots フォールバック + ドット2つ構成（NEXT 非表示）になるか
- [ ] マイクボタン無効表示・閉じる無効（carving 中）が従来どおりか

通知機能一式を追加。設定画面に「通知」サブ画面（`components/NotificationScreen.tsx`）を新設し、毎日リマインダー（`lib/reminder.ts`、トグル+時刻設定）とレポート通知（`lib/reportNotifications.ts`、毎週月曜8:00・毎月1日8:00 のローカル通知、1トグル）を集約。レポート一覧には未読バッジ（`lib/reportSeen.ts`、NEW ピル）を追加。通知・権限ダイアログ・ネイティブ時刻ピッカーが絡むため実機（またはExpo Go）での確認が必要:

- [ ] 設定 →「通知」で NOTIFICATIONS 画面が開閉するか。リマインダーのトグル・時刻 picker（iOS: spinner シート、Android: ネイティブダイアログ）が移設後も動くか
- [ ] リマインダーONで通知許可ダイアログが出て、許可すると指定時刻（デフォルト21:00）に毎日通知が届くか
- [ ] 通知を拒否した場合、トグルがONのままにならず「通知を許可しろ」が一瞬表示されるか（リマインダー・レポート通知の両トグル）
- [ ] 時刻変更後、翌日以降も新しい時刻に通知が届くか（同一 identifier で再スケジュールされているか）
- [ ] リマインダーON + レポート通知ON の状態で `Notifications.getAllScheduledNotificationsAsync()` に3本（daily/weekly/monthly）並ぶか（cancelAll による相互消去バグ修正の確認）。片方をOFFにしてももう片方が残るか
- [ ] レポート通知ONで毎週月曜8:00・毎月1日8:00 に通知が届くか（`getAllScheduledNotificationsAsync` の nextTriggerDate 目視でも代替可）
- [ ] Android: OS の通知設定にチャンネル「リマインダー」「レポート」が別々に表示されるか
- [ ] アプリを再起動しても設定（ON/OFF・時刻）が保持されるか（AsyncStorage永続化）
- [ ] INSIGHT の REPORTS 一覧: 新しく生成されたレポートに NEW ピルが付き、タップで消え、アプリ再起動後も既読が保持されるか。機能追加後の初回起動では既存レポートが全部 NEW にならない（初期シード）か

スプラッシュ画面をブランド化（`app.json` の `expo-splash-screen` プラグイン設定 + `assets/splash-icon.png`）。背景をデフォルトの `#FAFAF5` から YUZUイエロー（`#F5D84A`、`lib/theme.ts` の `colors.yuzuYellow` と一致）に変更し、画像をデフォルトの同心円プレースホルダーから「YUZU」ロゴ + タグライン「声を刻め」の合成画像（透過PNG）に差し替えた。この設定はネイティブの起動画面（Storyboard / drawable）としてビルド時に焼き込まれるため、Expo Go では確認できず実機または `expo prebuild` 後のシミュレータでの確認が必要:

- [ ] 起動直後、JSバンドル読み込み前の段階でYUZUイエロー背景 + ロゴ + タグラインが表示されるか（白背景やデフォルトの同心円に戻っていないか）
- [ ] ロゴ・タグラインが画面中央に適切なサイズで表示され、余白の偏りや欠けが無いか（Dynamic Island機種・小型機種の両方）
- [ ] ダークモード設定時にも背景色・ロゴが意図通り（黒背景に切り替わらないか。`expo-splash-screen` はOSのダークモード用背景色を別途指定しない限りライトの値のみ使われる想定）

LINE Seed JP（App/TTF、Regular/Bold の2ウェイトのみ）を `assets/fonts/` に新規バンドルし、`App.tsx` の `useFonts` に追加（`lib/theme.ts` の `fonts.bodyRegular` / `fonts.bodyBold`）。yuzu-app DESIGN.md §4 のフォント適用ルール（日本語UI・本文・タグライン＝LINE Seed JP、ロゴ・英語ラベル・数値・タイムスタンプ＝Unbounded）に合わせて `components/*.tsx` 全19ファイルの日本語 `<Text>` を洗い出して一括適用した。ロゴ「YUZU」・英語状態ラベル（"CARVING"/"LOG"等）・数値・タイムスタンプ表記はUnboundedのまま。フォント読み込み・グリフ描画のため実機（またはExpo Go）での確認が必要:

- [ ] 主要画面（オンボーディング・録音・LOG一覧・LOG詳細・INSIGHT・レポート詳細・設定・認証・お問い合わせ・APIトークン・通知設定）で日本語本文がLINE Seed JPで表示されるか（OSのシステムフォントにフォールバックしていないか）
- [ ] 英語状態ラベル・ロゴ・数値・タイムスタンプが従来通りUnboundedのままか（意図せずLINE Seed JPに変わっていないか）
- [ ] `RecordModal.tsx` の録音中ステータス表示（`speakTop`）: 日本語エラーメッセージ（「マイクを許可しろ」等）はLINE Seed JP Bold、"RECORDING"のみUnboundedで出し分けられているか
- [ ] `WordBubbleMap.tsx` の頻出語バブル内テキスト（`SvgText`、react-native-svg経由）がLINE Seed JP Boldで描画されるか（RNの`Text`とはフォント適用経路が異なるため個別確認）
- [ ] フォント読み込み失敗時に `STARTUP_TIMEOUT_MS`（5秒）超過でも起動がフリーズせず先に進むか（`App.tsx` の既存フォールバック挙動の回帰確認）

録音の制限時間（`MAX_RECORD_MS`＝1分）到達時に自動で停止するよう `lib/useRecording.ts` に修正を入れた。従来は `RecordModal.tsx` のカウントダウン表示だけで、指を離さない限り実際の録音は止まらなかった不具合（1分を過ぎても録音が続く）を修正。`handlePressIn` で録音開始時に `setTimeout(MAX_RECORD_MS)` を張り、時間到達時点でまだ録音中（`armedRef`）なら `finishRecording()` を呼んで通常のリリース時と同じ CARVING 遷移に入る。バックグラウンド割り込み・手動リリース・アンマウントの各経路でタイマーを確実にクリアしている（多重発火・別セッションへの誤爆防止）。expo-audio の実録音挙動のため実機（またはExpo Go）での確認が必要:

- [ ] 1分間長押しを維持したまま自然経過した場合、指を離さなくてもカウントダウンが0:00になった時点で自動的に録音が停止し CARVING に遷移するか（従来は録音が続いてしまっていた）
- [ ] 自動停止時も通常のリリース時と同じ haptics（tapLight）・文字起こしフローが動くか
- [ ] 1分未満で自分から指を離した場合の挙動（既存の手動停止フロー）に回帰が無いか
- [ ] 録音を自動停止後、間を置かず再度長押しして新しい録音を始めた場合、古いタイマーが新しい録音を誤って早期停止させないか

アプリ起動後の LOG 画面ローディング改善（`lib/logsCache.ts` 新規・`lib/requestCache.ts` 新規・`lib/useApiGet.ts` / `components/RecordScreen.tsx` / `App.tsx` 変更）。LOG 先頭ページ+統計を AsyncStorage にキャッシュして起動時に即表示する stale-while-revalidate、INSIGHT の heatmap/themes/words をモジュールメモリでキャッシュしてタブ切替時のスケルトン再表示を防ぐ SWR、WORDS 取得の起動時遅延を追加した。JSロジック中心だがキャッシュ表示→ネットワーク差し替えの見た目・タイミングは実機でしか確認できないため以下が必要:

- [ ] コールドスタート時、前回起動時の LOG 一覧・RECORDS/MINUTES/STREAK がスケルトンを経ずに即表示され、その後ネットワーク応答で最新内容に差し替わるか（新規投稿があれば反映されるか）
- [ ] 別アカウントでログインし直したとき、前ユーザーの LOG・統計が一瞬でも表示されないか（`loadLogsCache` の userId 検証、および `App.tsx` の `SIGNED_OUT` での `clearLogsCache`/`clearRequestCache`）
- [ ] 初回起動（キャッシュ無し）でも従来通りスケルトン→表示の流れが崩れていないか
- [ ] LOG ⇄ INSIGHT のタブ切替を繰り返したとき、SIGNAL（heatmap）/ PATTERN（themes）/ WORDS が毎回スケルトンに戻らず、直近の内容がすぐ表示されるか（裏で再取得され、内容が更新されるタイミングがあれば違和感が無いか）
- [ ] LOG のプルリフレッシュが従来通り動作し、キャッシュ追加後も二重更新やちらつきが無いか
- [ ] LOG 詳細から開く WORDS 自動ハイライト（頻出語）が、起動直後の遅延後も正しく表示されるか（`RecordScreen.tsx` の `WORDS_FETCH_DELAY_MS`）
- [ ] 21件以上の記録がある状態で起動直後にスクロールしても、キャッシュ由来の `nextOffset` 未設定により無限スクロールが誤発火しない（ネットワーク応答後は通常通り追加読み込みできる）か
- [ ] コールドスタート後に INSIGHT タブを開いたとき、SIGNAL / WORDS / PATTERN / REPORTS の各セクションが前回起動時の内容で即表示され、その後ネットワーク応答で最新内容に差し替わるか（`requestCache` の AsyncStorage 永続化 + `RecordScreen` マウント時の `hydrateRequestCache`）
- [ ] LOG ⇄ INSIGHT のタブ切替で REPORTS 一覧がスケルトンに戻らず、直近の内容がすぐ表示されるか（`InsightScreen` の reportsData を requestCache 対応にした分）
- [ ] 別アカウントでログインし直したとき、前ユーザーの INSIGHT データ（heatmap/themes/words/reports）が一瞬でも表示されないか（`hydrateRequestCache` の userId 検証、`SIGNED_OUT` での `clearRequestCache` が AsyncStorage 側も消す）
- [ ] レポート生成待ちの5秒ポーリング・未生成レポートの先読み POST・NEW バッジの初期シードに回帰が無いか（pregen と seed はキャッシュ由来の stale データでは発火せず、ネットワーク応答後にのみ発火するようゲートした）

セッション/認証ライフサイクルのロバスト性を改善（`App.tsx` / `components/SettingsScreen.tsx` / `lib/largeSecureStore.ts` 新規）。(1) 起動タイムアウト（`STARTUP_TIMEOUT_MS`=5秒）超過時にセッションがまだ未確定なら、誤って `OnboardingScreen`（匿名操作可能）へ落とさず、非操作のプレースホルダ（スプラッシュと同じ配色・アイコン + RETRY ボタン）を出すようにした。(2) `SettingsScreen` の signOut を await + エラーチェックし、失敗時はモーダルを閉じずにエラー表示するようにした。(3) `LargeSecureStore.decrypt` を try/catch でガードし、壊れた blob は破棄して null を返すようにした（`lib/__tests__/largeSecureStore.test.ts` で実際に throw する壊れた hex 入力を使い単体検証済み）。低速回線・オフライン signOut・壊れたセッション永続化は実機でしか再現しづらいため以下が必要:

- [ ] 低速回線（Network Link Conditioner 等で 5 秒超の遅延を再現）でログイン済み端末を起動したとき、一瞬でも `OnboardingScreen` が表示されず、RETRY 画面 → セッション確定後に自動で `RecordScreen` へ遷移するか
- [ ] RETRY 画面で "RETRY" を押すと `getSession()` が再試行され、成功すればそのまま `RecordScreen`／`OnboardingScreen` に遷移するか
- [ ] 機内モード等で完全にオフラインのまま起動タイムアウトを迎えた場合、RETRY 画面から抜けられない状態が続かないか（ネットワーク復帰後に RETRY で復旧できるか）
- [ ] オフライン状態で設定画面からログアウトを試みたとき、モーダルが閉じずに「ログアウトできなかった。もう一度。」が表示され、再度オンラインでログアウトを押すと正常に閉じてオンボーディングに戻るか
- [ ] アプリ削除・再インストールや OS の Keychain リセット等で `expo-secure-store` のエントリが壊れた状態を作れた場合、起動がクラッシュ/無限スプラッシュにならず未ログイン扱いで先に進むか（単体テストではロジックのみ検証、実際の Keychain 破損は再現困難）

SIGNAL セクションのヒートマップを、日×2時間バケットのグリッド（`TimeHeatmap`）から GitHub 風の週間カレンダー（1日1マス、`components/DailyHeatmap.tsx`、集計ロジックは `lib/dailyHeatmap.ts` でユニットテスト済み）に置き換えた。同じ時間帯に投稿し続けるユーザーには旧グリッドが「明るい行が1本あるだけ」で日々代わり映えせず退屈だったため、時間帯という変化の乏しい軸を捨てて日ごとの合計文字数だけを見せる。集計・週割り・パディングのロジックはユニットテストでカバー済みだが、`LayoutChangeEvent` に基づくセル幅の動的計算・タップ時のツールチップ・月ラベルの位置は画面上でしか確認できないため以下が必要:

- [ ] INSIGHT タブの SIGNAL セクションで週間カレンダーが崩れず表示され、投稿がある日ほど濃い黄色になっているか
- [ ] セルをタップすると haptics + `MM/DD / N CHARS` のツールチップが表示されるか（列の端・空セルも含めて）
- [ ] 月が変わる列の先頭に「M月」ラベルが正しい位置に出るか（列幅の実測値ベースの絶対配置のため、端末幅によってズレていないか）
- [ ] 投稿が1件も無い期間は「まだ声がない」の空状態表示に戻るか

リマインダー通知の本文を、固定1文言から「最終投稿からの経過日数」で3段階トーン分けした文言プールのローテーション（`lib/reminder.ts` の `pickReminderMessage`）に変更した。集計・文言選択ロジックはユニットテストでカバー済みだが、`expo-notifications` が実際にスケジュールした通知の中身が端末の通知センターに意図通り反映されるかはコードレベルでは確認できないため以下が必要:

- [ ] リマインダーONの状態でアプリを開くと（`components/RecordScreen.tsx` の投稿一覧取得時）、`refreshReminderContent` 経由で次回通知の本文が更新されるか（通知センターのスケジュール済み通知、または `Notifications.getAllScheduledNotificationsAsync()` の `content.body` 目視で確認）
- [ ] 直近投稿から0〜2日・3〜6日・7日以上でそれぞれ狙ったトーンの文言（日数埋め込みの有無含む）が選ばれるか
- [ ] 同じ日に何度もアプリを開いても本文が短時間でチラつかず、日が変わったタイミングでのみ次の候補にローテーションするか

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
- [ ] App Store Connect の App Privacy（プライバシー栄養ラベル）開示 — マイク/メール/利用状況の収集内容を申告（[#18](https://github.com/studiocon/yuzu-native/issues/18)）
- [ ] ストア提出アセット一式 — App Icon 各サイズ・スクリーンショット（iPhoneのみ、iPad対応は撤去済み）・説明文・キーワード・年齢レーティング（[#19](https://github.com/studiocon/yuzu-native/issues/19)）
- [ ] App Store Connect で「Submit for Review」（一般審査。TestFlightのBeta App Reviewとは別）

上記が揃うまでは TestFlight 内部テスターのみでの検証運用が現実的。

## 既知の制約

- LINE Seed JP フォント未バンドル（上記「デザイン」参照）
- 感情スコアはDBに永続化されない（yuzu-app と同じ設計。端末を変えると再解析が必要）
- Android 実機での検証記録なし（手順は iOS 前提のみ）
- テストは `lib/` の純粋関数のみ。`components/` の画面コンポーネントは未カバー（RN実機/シミュレータでのE2E的な検証が必要なため）
- 設定画面の LEGAL / ALERT / プラン の各行は審査対策として一時的に非表示（実ページ未公開のため）。LEGAL セクションはページ公開後に復活予定（[components/SettingsScreen.tsx](components/SettingsScreen.tsx)）
- Apple/Google OAuth・Magic Linkのディープリンクは未対応（現状メールOTPのみ。[#20](https://github.com/studiocon/yuzu-native/issues/20)）
