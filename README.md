# YUZU Native（Expo）

[YUZU 本体](https://github.com/studiocon/yuzu-app) のネイティブアプリ。方式は [#64](https://github.com/studiocon/yuzu-app/issues/64) で **Expo / React Native** に決定済み。

最初のマイルストーンは検証スパイク：**長押し録音 → Haptics → ElevenLabs STT（yuzu-app の `/api/transcribe` を直接叩く）が1本通るか**だけを確認する。UI・認証・永続化は作り込まない。

## 構成

- バックエンドは作らない。既存の [yuzu-app](https://github.com/studiocon/yuzu-app) の API（`https://app.yuzu.style/api/*`）をそのまま使う
- 認証は未実装。`/api/transcribe` の未ログイン anon 経路（cookie ベースで日次上限あり）で検証する
- `lib/` 配下の DOM 非依存ロジック（period.ts 等）は後続フェーズで yuzu-app からコピーして使う想定（今はまだ持ち込んでいない）

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

- [ ] 長押し → IMPACT MEDIUM が「録音開始」の手応えとして十分か
- [ ] リリース → NOTIFICATION SUCCESS が「録音完了」の余韻として十分か
- [ ] `/api/transcribe` への multipart アップロードが通り、文字起こしが返るか
- [ ] バックグラウンド/割り込み（電話・通知）時の録音挙動
- [ ] ネイティブでの Supabase Auth セッション保持（次フェーズ、[#100](https://github.com/studiocon/yuzu-app/issues/100)）
