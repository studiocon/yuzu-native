新しいネイティブターゲット（Widget等）追加後、初回の本番ビルドは非対話モードでは失敗する。

`@bacons/apple-targets` で `targets/` 配下に新規ターゲット（例: `style.yuzu.mobile.signal` ウィジェット）を追加すると、そのターゲット用の Distribution Certificate / Provisioning Profile が EAS 側にまだ存在しない。`npm run build:ios:production`（内部で `eas build --platform ios --profile production` を実行、TTY無しのためnon-interactive扱い）はこの初回セットアップを許可せず

```
Distribution Certificate is not validated for non-interactive builds.
Failed to set up credentials.
Credentials are not set up. Run this command again in interactive mode.
```

で失敗する。`eas credentials` コマンド自体が `--non-interactive` フラグを持たず、常に対話専用（Bashツール経由のスクリプト実行では突破不可）。

対処: ユーザー本人が対話可能なターミナルで一度だけ `eas credentials --platform ios` を実行し、「All: Set up all the required credentials」で新ターゲットの証明書/プロビジョニングプロファイルをセットアップする必要がある。Apple Team Type（Individual / Company/Organization、Enterpriseはストア公開不可なので対象外）を聞かれるので、実際の加入種別を答える。一度セットアップすれば、以降の non-interactive ビルドは通常通り動く。

## `expo-target.config.js` の `name` にアンダースコア等を使うとproduction buildが必ず失敗する

上記の対話セットアップを済ませても、`targets/widget/expo-target.config.js` の `name: "yuzu_signal"`（アンダースコア入り）が原因で production build が毎回

```
Could not find target 'yuzusignal' in project.pbxproj
```

で CONFIGURE_XCODE_PROJECT フェーズ失敗した（EASビルドログはbrotli圧縮なので `brotli -d` で展開して調査。`eas build:view <id> --json` の `logFiles[0]` から署名付きURLを取得できる）。

原因: `@bacons/apple-targets` 内部で、Xcodeターゲットの実際の名前（`PBXNativeTarget.name`）は `props.name` をそのまま使うが、EAS側が証明書突合に使う `productName`（`extra.eas.build.experimental.ios.appExtensions[].targetName`）は `sanitizeNameForNonDisplayUse()` で非英数字（アンダースコア含む）を除去した文字列になる。`name: "yuzu_signal"` だと pbxproj 上のターゲット名は `"yuzu_signal"` のままなのに、EAS は `"yuzusignal"`（アンダースコアなし）で検索するため見つからない。

再現・検証は `git clone --depth 1` でリポジトリを scratchpad にコピーし、`npx expo prebuild --platform ios --no-install` → `xcodebuild -list -project ios/*.xcodeproj` でターゲット名を確認する方法が安全（本体の `ios/` を汚さない）。

対処: `expo-target.config.js` の `name` は英数字のみにする（今回 `"yuzu_signal"` → `"yuzusignal"` に修正）。`displayName`（ホーム画面表示名）は影響を受けないので `"SIGNAL"` のまま変更不要。今後 apple-targets で新規ターゲットを追加するときは、最初から `name` にアンダースコア・ハイフン等の非英数字を使わないこと。
