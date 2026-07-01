# YUZU Native（Expo）

[YUZU 本体](https://github.com/studiocon/yuzu-app) のネイティブアプリ。方式は [#64](https://github.com/studiocon/yuzu-app/issues/64) で **Expo / React Native** に決定済み。

最初のマイルストーンは検証スパイク：**メールOTPログイン → 長押し録音 → Haptics → STT → /api/records 保存**が1本通るかを確認する。UI は作り込まない。

## 構成

- バックエンドは作らない。既存の [yuzu-app](https://github.com/studiocon/yuzu-app) の API（`https://app.yuzu.style/api/*`）をそのまま使う
- 認証は **メールOTP（数字コード。桁数はメールテンプレート依存、入力欄は最大10桁まで許容）**。Supabase `signInWithOtp` → `verifyOtp`。Magic Link（タップ式）はカスタムスキーム `exp://` の redirect_to が Supabase 側で握り潰され Site URL にフォールバックする現象が実機で確認されたため不採用（ディープリンクに依存しない方式に統一）
- `/api/transcribe`・`/api/records`・`/api/analyze-sentiment` は Bearer トークン認証に対応済み（yuzu-app [#100](https://github.com/studiocon/yuzu-app/issues/100)・[#127](https://github.com/studiocon/yuzu-app/pull/127)）
- 感情カラー（LOGカードの左端バー・INDEX詳細の声紋ヒーロー）は yuzu-app と同じく DB非永続化。未解析の投稿本文を `POST /api/analyze-sentiment` に渡してClaudeでスコア化し、結果を `AsyncStorage`（Web版の localStorage 相当）にキャッシュする（[lib/sentimentCache.ts](lib/sentimentCache.ts)・[lib/sentimentColor.ts](lib/sentimentColor.ts)）
- セッションは `expo-secure-store` + `AsyncStorage` の LargeSecureStore パターンで永続化（[lib/supabase.ts](lib/supabase.ts)）
- 録音保存後は `GET /api/records` で直近のログ一覧（LOG）・STATS（RECORDS/MINUTES/STREAK）・残り回数（LEFT）を取得して表示（[components/RecordScreen.tsx](components/RecordScreen.tsx)）。1日上限超過時のエラーコピーは yuzu-app の `app/page.tsx` と同じ文言に統一
- LOG カードをタップすると yuzu-app の IndexDetailModal 相当の全文表示モーダル（[components/IndexDetailModal.tsx](components/IndexDetailModal.tsx)）が開く。MARK（ピン留め）と COPY（クリップボードコピー、Notion移行期間限定の一時機能）はここに集約し、一覧カード自体にはボタンを置かない（yuzu-app と同じ設計）
- 通話・通知などでアプリが background/inactive に遷移した時は `AppState` を監視して録音を強制停止し、固まった状態にならないようにしている
- `lib/` 配下の DOM 非依存ロジック（period.ts 等）は後続フェーズで yuzu-app からコピーして使う想定（今はまだ持ち込んでいない）
- デザインは [yuzu-app の DESIGN.md](https://github.com/studiocon/yuzu-app/blob/main/DESIGN.md) を Source of Truth とし、`lib/theme.ts` にトークン化（カラー・タイプスケール・角丸・easing）。英字ラベル/数値は Unbounded（`@expo-google-fonts/unbounded`）、アイコンは Phosphor（`phosphor-react-native`）に統一。**LINE Seed JP（日本語本文用フォント）はフォントファイル未取得のためネイティブには未バンドル**で、日本語テキストは OS 標準フォントにフォールバックしている（Web 版は Google Fonts CDN から読むため未対応で問題にならないが、Native は CDN `<link>` が使えないため要対応）

## セットアップ

```bash
cp .env.example .env  # 値は yuzu-app の .env.local の NEXT_PUBLIC_SUPABASE_* と同じ
npm install
```

ログインはメールアドレス送信 → 届いたメール内のコードを入力するだけ。Redirect URL の登録は不要。

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

## チェックポイント（#64 検証項目）

- [x] メールで届いたコードを入力してログインできるか
- [ ] 長押し → IMPACT MEDIUM が「録音開始」の手応えとして十分か
- [ ] リリース → NOTIFICATION SUCCESS が「録音完了」の余韻として十分か
- [ ] `/api/transcribe` → `/api/records` が通り、保存された INDEX が返るか
- [ ] アプリ再起動後もログイン状態が保持されるか（LargeSecureStore）
- [ ] バックグラウンド/割り込み（電話・通知）時の録音挙動
