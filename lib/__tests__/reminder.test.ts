import { DEFAULT_REMINDER_SETTINGS, parseReminderSettings } from "../reminder";

describe("parseReminderSettings", () => {
  it("未保存（null）はデフォルト設定", () => {
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it("正常なJSONはそのままパースする", () => {
    expect(parseReminderSettings(JSON.stringify({ enabled: true, hour: 7, minute: 30 }))).toEqual({
      enabled: true,
      hour: 7,
      minute: 30,
    });
  });

  it("壊れたJSONはデフォルトへフォールバック", () => {
    expect(parseReminderSettings("{not json")).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it("hourが範囲外（24）ならデフォルトへフォールバック", () => {
    expect(parseReminderSettings(JSON.stringify({ enabled: true, hour: 24, minute: 0 }))).toEqual(
      DEFAULT_REMINDER_SETTINGS
    );
  });

  it("minuteが範囲外（-1）ならデフォルトへフォールバック", () => {
    expect(parseReminderSettings(JSON.stringify({ enabled: true, hour: 9, minute: -1 }))).toEqual(
      DEFAULT_REMINDER_SETTINGS
    );
  });

  it("enabledが真偽値でないならデフォルトへフォールバック", () => {
    expect(parseReminderSettings(JSON.stringify({ enabled: "yes", hour: 9, minute: 0 }))).toEqual(
      DEFAULT_REMINDER_SETTINGS
    );
  });
});
