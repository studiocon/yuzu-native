import {
  DEFAULT_REPORT_NOTIFICATION_SETTINGS,
  parseReportNotificationSettings,
} from "../reportNotifications";

describe("parseReportNotificationSettings", () => {
  it("未保存（null）はデフォルト設定", () => {
    expect(parseReportNotificationSettings(null)).toEqual(DEFAULT_REPORT_NOTIFICATION_SETTINGS);
  });

  it("正常なJSONはそのままパースする", () => {
    expect(parseReportNotificationSettings(JSON.stringify({ enabled: true }))).toEqual({
      enabled: true,
    });
  });

  it("壊れたJSONはデフォルトへフォールバック", () => {
    expect(parseReportNotificationSettings("{not json")).toEqual(DEFAULT_REPORT_NOTIFICATION_SETTINGS);
  });

  it("enabledが真偽値でないならデフォルトへフォールバック", () => {
    expect(parseReportNotificationSettings(JSON.stringify({ enabled: "yes" }))).toEqual(
      DEFAULT_REPORT_NOTIFICATION_SETTINGS
    );
  });
});
