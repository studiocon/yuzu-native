const { withEntitlementsPlist } = require("@expo/config-plugins");

/**
 * expo-notifications はローカル通知しか使わない場合でも、iOS ビルドに
 * `aps-environment`（Push Notifications capability）を自動付与する。
 *
 * 本アプリの通知はすべてローカル通知（`lib/reminder.ts` /
 * `lib/reportNotifications.ts` の `scheduleNotificationAsync`）で、リモートプッシュ
 * （push token 取得）は使っていない。ローカル通知に aps-environment は不要だが、
 * これが付くと push capability を持たない provisioning profile とビルド時に衝突して
 * fastlane が失敗する（"Provisioning profile doesn't include the aps-environment
 * entitlement"）。生成 entitlements から aps-environment を取り除き、push 無しの
 * profile と整合させる。
 *
 * 【重要・plugin 順序】app.json の plugins 配列で **expo-notifications より前** に置くこと。
 * @expo/config-plugins は同種 mod（ここでは iOS entitlements）のアクションを登録の
 * 逆順（LIFO）で実行するため、この plugin を後ろに置くと expo-notifications が
 * aps-environment を書き込む「前」に delete が走って無効になる（実測で確認済み）。
 * 前に置くことで expo-notifications 付与後に delete が走る。
 *
 * 将来リモートプッシュを導入するときは、この plugin を外し、代わりに Apple Developer の
 * App ID に Push capability を有効化して provisioning profile を再生成すること。
 */
module.exports = function withNoApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
};
