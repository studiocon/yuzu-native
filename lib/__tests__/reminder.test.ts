import { DEFAULT_REMINDER_SETTINGS, parseReminderSettings, pickReminderMessage } from "../reminder";

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

describe("pickReminderMessage", () => {
  it("title は常に YUZU 固定", () => {
    expect(pickReminderMessage(0, 0).title).toBe("YUZU");
    expect(pickReminderMessage(10, 0).title).toBe("YUZU");
  });

  it("経過0〜2日は日数を埋め込まない固定文言プールから選ばれる", () => {
    const { body } = pickReminderMessage(1, 0);
    expect(body).not.toMatch(/\d/);
  });

  it("経過3〜6日は実際の経過日数が文言に埋め込まれる", () => {
    expect(pickReminderMessage(4, 0).body).toContain("4日");
    expect(pickReminderMessage(6, 1).body).toContain("6日");
  });

  it("経過7日以上は7日以上向けのプールから選ばれる（日数を含まない候補もある）", () => {
    const bodies = [0, 1, 2].map((i) => pickReminderMessage(9, i).body);
    expect(bodies).toContain("SIGNALが真っ黒だ。話せ。");
    expect(bodies).toContain("1週間、黙ったままだ。声を刻め。");
  });

  it("rotationIndexが変わるとプール内で別の候補になる（同じ階層内でのローテーション）", () => {
    const seen = new Set([0, 1, 2, 3].map((i) => pickReminderMessage(1, i).body));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("同じ入力なら常に同じ結果を返す純粋関数", () => {
    expect(pickReminderMessage(5, 3)).toEqual(pickReminderMessage(5, 3));
  });

  it("負の経過日数は0として扱われる（Tier1の固定文言）", () => {
    expect(pickReminderMessage(-1, 0)).toEqual(pickReminderMessage(0, 0));
  });

  it("負のrotationIndexでも例外を投げずプール内の値を返す", () => {
    expect(() => pickReminderMessage(4, -1)).not.toThrow();
    expect(pickReminderMessage(4, -1).body).toContain("4日");
  });
});
