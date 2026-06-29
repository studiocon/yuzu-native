# YUZU Native（Expo）

[YUZU 本体](https://github.com/studiocon/yuzu-app) のネイティブアプリ。方式は [#64](https://github.com/studiocon/yuzu-app/issues/64) で **Expo / React Native** に決定済み。

最初のマイルストーンは検証スパイク：**長押し録音 → Haptics → ElevenLabs STT（yuzu-app の `/api/transcribe` を直接叩く）が1本通るか**だけを確認する。UI・認証・永続化は作り込まない。

## 構成

- バックエンドは作らない。既存の [yuzu-app](https://github.com/studiocon/yuzu-app) の API（`https://app.yuzu.style/api/*`）をそのまま使う
- 認証は未実装。`/api/transcribe` の未ログイン anon 経路（cookie ベースで日次上限あり）で検証する
- `lib/` 配下の DOM 非依存ロジック（period.ts 等）は後続フェーズで yuzu-app からコピーして使う想定（今はまだ持ち込んでいない）

## 実機で動かす

⚠️ Haptics は **iOS Simulator では鳴らない**。物理 iPhone 必須。

```bash
npm install
npm run ios
```

初回は Xcode が開くので：

1. `App` ターゲット → Signing & Capabilities → Team を自分の Apple ID に設定
2. Bundle Identifier が衝突したら変更
3. iPhone を USB 接続 → デバイス選択 → ▶ 実行
4. iPhone 側「設定 → 一般 → VPN とデバイス管理」で証明書を信頼

無料 Apple ID（Personal Team）の場合、7日ごとに再インストールが必要。長く実機に置いておくには Apple Developer Program（[yuzu-app#63](https://github.com/studiocon/yuzu-app/issues/63)）への加入を検討。

## チェックポイント（#64 検証項目）

- [ ] 長押し → IMPACT MEDIUM が「録音開始」の手応えとして十分か
- [ ] リリース → NOTIFICATION SUCCESS が「録音完了」の余韻として十分か
- [ ] `/api/transcribe` への multipart アップロードが通り、文字起こしが返るか
- [ ] バックグラウンド/割り込み（電話・通知）時の録音挙動
- [ ] ネイティブでの Supabase Auth セッション保持（次フェーズ、[#100](https://github.com/studiocon/yuzu-app/issues/100)）
