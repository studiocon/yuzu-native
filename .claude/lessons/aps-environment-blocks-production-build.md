# expo-notifications の aps-environment が push 非対応 profile と衝突し本番ビルドが落ちる

`expo-notifications` は**ローカル通知しか使っていなくても**、iOS prebuild で生成する
entitlements に `aps-environment`（Push Notifications capability）を自動付与する。
本アプリの通知は全てローカル通知（`lib/reminder.ts` / `lib/reportNotifications.ts` の
`scheduleNotificationAsync`）で、リモートプッシュ（push token 取得）は未使用。

にもかかわらず `aps-environment` が付くと、push capability を持たない provisioning
profile と fastlane/Xcode 段階で衝突し、EAS production build が失敗する：

```
Provisioning profile doesn't support the Push Notifications capability
Provisioning profile doesn't include the aps-environment entitlement
```

## 対処（採用した方法）

リモートプッシュを使わないので、生成 entitlements から `aps-environment` を除去する
config plugin `plugins/with-no-aps-environment.js` を追加し、app.json の plugins に登録。

### 落とし穴：plugin の順序（LIFO）

`@expo/config-plugins` は**同種 mod（ここでは iOS entitlements）のアクションを登録の
逆順（LIFO）で実行する**。そのため削除 plugin を `expo-notifications` より**後ろ**に
置くと、`aps-environment` が書き込まれる**前**に delete が走って無効になる
（`console.warn` で `BEFORE: {}` を実測して判明）。

→ 削除 plugin は **`expo-notifications` より前** に置く。こうすると付与後に delete が
走り、最終 entitlements が空 dict になる。

## 検証方法（EAS ビルドを無駄撃ちしない）

`/ios` `/android` は `.gitignore` 済みなので、ローカルで
`npx expo prebuild --platform ios --no-install --clean` を実行し、
`ios/YUZU/YUZU.entitlements` が `<dict/>`（= aps-environment 無し）になることを
確認してから EAS build に回す。※ prebuild は `package.json` の scripts を
`expo run:*` に書き換えるので、確認後 `git checkout package.json` と `rm -rf ios` で戻す。

これで build 15 が成功し App Store Connect 提出まで通った（2026-07-16）。

## 将来リモートプッシュを導入するとき

この plugin を外し、代わりに Apple Developer の App ID に Push capability を有効化して
provisioning profile を再生成する（`eas credentials` は対話フローなので手動実行が要る）。
