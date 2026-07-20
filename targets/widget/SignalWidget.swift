import SwiftUI
import WidgetKit

// App Group の suite 名・キーは lib/widgetSignal.ts と一致させること。
private let appGroupID = "group.style.yuzu.mobile"
private let lastRecordedKey = "lastRecordedAt"

// DESIGN.md のトークンをそのまま埋め込む（--ink / --yuzu-yellow）。
// 録音直後は信号(ゆず黄)が灯り、48時間の沈黙で線形にインク色へ消えていく。文字は出さない。
// （当初は沈黙側が起点だったが、録音直後にほぼ黒＝故障と見分けがつかないため反転した）
private let silenceRGB = (r: 0x1A, g: 0x1A, b: 0x2E)
private let signalRGB = (r: 0xF5, g: 0xD8, b: 0x4A)
private let fullSignalHours: Double = 48

private func signalColor(elapsedHours: Double) -> Color {
    let t = min(max(elapsedHours / fullSignalHours, 0), 1)
    let r = Double(signalRGB.r) + (Double(silenceRGB.r) - Double(signalRGB.r)) * t
    let g = Double(signalRGB.g) + (Double(silenceRGB.g) - Double(signalRGB.g)) * t
    let b = Double(signalRGB.b) + (Double(silenceRGB.b) - Double(signalRGB.b)) * t
    return Color(red: r / 255, green: g / 255, blue: b / 255)
}

struct SignalEntry: TimelineEntry {
    let date: Date
    let elapsedHours: Double
}

struct SignalProvider: TimelineProvider {
    func placeholder(in context: Context) -> SignalEntry {
        SignalEntry(date: Date(), elapsedHours: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (SignalEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SignalEntry>) -> Void) {
        let now = Date()
        guard let lastDate = lastRecordedDate() else {
            // 未記録: 信号は灯さず沈黙（インク色）のまま。6時間後に再評価。
            let entry = SignalEntry(date: now, elapsedHours: fullSignalHours)
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(6 * 3600))))
            return
        }

        // 1時間刻みで48時間先まで用意し、以降は OS の再取得に任せる。
        var entries: [SignalEntry] = []
        for hourOffset in 0...Int(fullSignalHours) {
            guard let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: now) else {
                continue
            }
            let elapsed = entryDate.timeIntervalSince(lastDate) / 3600
            entries.append(SignalEntry(date: entryDate, elapsedHours: elapsed))
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(fullSignalHours * 3600))))
    }

    private func currentEntry() -> SignalEntry {
        guard let lastDate = lastRecordedDate() else {
            return SignalEntry(date: Date(), elapsedHours: fullSignalHours)
        }
        return SignalEntry(date: Date(), elapsedHours: Date().timeIntervalSince(lastDate) / 3600)
    }

    private func lastRecordedDate() -> Date? {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return nil }
        let raw = defaults.double(forKey: lastRecordedKey)
        guard raw > 0 else { return nil }
        return Date(timeIntervalSince1970: raw / 1000)
    }
}

struct SignalWidgetEntryView: View {
    var entry: SignalProvider.Entry

    var body: some View {
        signalColor(elapsedHours: entry.elapsedHours)
    }
}

struct SignalWidget: Widget {
    let kind: String = "yuzu_signal"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SignalProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                SignalWidgetEntryView(entry: entry)
                    .containerBackground(signalColor(elapsedHours: entry.elapsedHours), for: .widget)
            } else {
                SignalWidgetEntryView(entry: entry)
                    .background(signalColor(elapsedHours: entry.elapsedHours))
            }
        }
        .configurationDisplayName("SIGNAL")
        .description("最後に話してからの沈黙を、色だけで示す。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct SignalWidgetBundle: WidgetBundle {
    var body: some Widget {
        SignalWidget()
    }
}
