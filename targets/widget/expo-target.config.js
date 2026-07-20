// SIGNAL ウィジェット（yuzu-app#125 由来）。最後に話してからの経過時間だけを
// 色で示す。テキストは出さない。@bacons/apple-targets が prebuild 時にこの
// フォルダを WidgetKit extension target として ios/ にリンクする。
module.exports = (config) => ({
  type: "widget",
  // "_" 等の非英数字を含めると、Xcodeターゲット名（PBXNativeTarget.name、アンダースコア維持）と
  // EAS側が突合に使うproductName（sanitizeNameForNonDisplayUseで非英数字除去済み）がズレて
  // "Could not find target 'yuzusignal' in project.pbxproj" でproduction buildが必ず失敗する
  // （@bacons/apple-targets のバグ、ローカルprebuildで再現・特定済み）。英数字のみにすること。
  name: "yuzusignal",
  displayName: "SIGNAL",
  deploymentTarget: "16.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  bundleIdentifier: ".signal",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"],
  },
});
