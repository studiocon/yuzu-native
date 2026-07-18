// SIGNAL ウィジェット（yuzu-app#125 由来）。最後に話してからの経過時間だけを
// 色で示す。テキストは出さない。@bacons/apple-targets が prebuild 時にこの
// フォルダを WidgetKit extension target として ios/ にリンクする。
module.exports = (config) => ({
  type: "widget",
  name: "yuzu_signal",
  displayName: "SIGNAL",
  deploymentTarget: "16.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  bundleIdentifier: ".signal",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"],
  },
});
