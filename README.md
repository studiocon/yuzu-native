# YUZU Native（Expo）

[YUZU 本体](https://github.com/studiocon/yuzu-app) のネイティブアプリ。方式は [#64](https://github.com/studiocon/yuzu-app/issues/64) で **Expo / React Native** に決定済み。

最初のマイルストーンは検証スパイク：**Magic Link ログイン → 長押し録音 → Haptics → STT → /api/records 保存**が1本通るかを確認する。UI は作り込まない。

## 構成

- バックエンドは作らない。既存の [yuzu-app](https://github.com/studiocon/yuzu-app) の API（`https://app.yuzu.style/api/*`）をそのまま使う
- 認証は Magic Link（Supabase `signInWithOtp`）。`/api/transcribe`・`/api/records` は Bearer トークン認証に対応済み（yuzu-app [#100](https://github.com/studiocon/yuzu-app/issues/100)）
- セッションは `expo-secure-store` + `AsyncStorage` の LargeSecureStore パターンで永続化（[lib/supabase.ts](lib/supabase.ts)）
- `lib/` 配下の DOM 非依存ロジック（period.ts 等）は後続フェーズで yuzu-app からコピーして使う想定（今はまだ持ち込んでいない）

## セットアップ

```bash
cp .env.example .env  # 値は yuzu-app の .env.local の NEXT_PUBLIC_SUPABASE_* と同じ
npm install
```

### Magic Link を使うための一回限りの設定

Supabase の **Authentication → URL Configuration → Redirect URLs** に、アプリ起動中に AuthScreen 下部に表示される URL（例: `exp://192.168.11.14:8081/--/auth-callback`）を追加する。
[ダッシュボードを開く](https://supabase.com/dashboard/project/serdimqyazitwfnswvrg/auth/url-configuration)

⚠️ Expo Go 開発中はこの URL に Mac の LAN IP が入るため、**Wi-Fi を変えたら再登録が必要**。スタンドアロンビルドに移行すれば `style.yuzu.mobile://auth-callback` の固定 URL になる。

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

- [ ] Magic Link メールのリンクをタップして Expo Go に戻り、ログイン状態になるか
- [ ] 長押し → IMPACT MEDIUM が「録音開始」の手応えとして十分か
- [ ] リリース → NOTIFICATION SUCCESS が「録音完了」の余韻として十分か
- [ ] `/api/transcribe` → `/api/records` が通り、保存された INDEX が返るか
- [ ] アプリ再起動後もログイン状態が保持されるか（LargeSecureStore）
- [ ] バックグラウンド/割り込み（電話・通知）時の録音挙動
