import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { AudioRecorder } from "expo-audio";

// yuzu-app の Waveform.tsx（録音中・音量反応バー）を移植。
// Web Audio の AnalyserNode の代わりに expo-audio の metering(dB) を level(0..1) に正規化して使う。
//
// metering の読み取りは Animated.Value を直接動かす rAF ループの中で行う（React state を経由しない）。
// 以前は親（RecordScreen）が setInterval(90ms) で level を state 更新し、その prop 変化がここまで
// 伝播していたが、その state 更新が RecordScreen 全体（LogScreen/InsightScreen 含む）を録音中ずっと
// 11fps 相当で再レンダーさせていた。recorder の参照は録音セッション中不変なので、rAF ループ自体は
// 一度張ったら録音終了まで張りっぱなしで済み、React 側の再レンダーを一切発生させない。
const BAR_COUNT = 40;

type Props = {
  recorder: AudioRecorder | null;
};

// 各バーは中心からの距離で最大高さが変わる（中央が高い山型）+ level で伸縮。
export default function Waveform({ recorder }: Props) {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.1)),
  ).current;
  const phaseRef = useRef(0);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      phaseRef.current += 0.18;
      let level = 0;
      if (recorder) {
        try {
          const status = recorder.getStatus();
          const db = typeof status.metering === "number" ? status.metering : -60;
          // dB(-60..0) を 0..1 に正規化。弱声も反応するよう底上げ。
          level = Math.max(0, Math.min(1, (db + 60) / 55));
        } catch {
          level = 0;
        }
      }
      for (let i = 0; i < BAR_COUNT; i++) {
        // 中央ほど高い山型ウェイト
        const center = (BAR_COUNT - 1) / 2;
        const dist = Math.abs(i - center) / center;
        const shape = 1 - dist * 0.7;
        // idle でも軽く波打たせ、level が乗ると大きく揺れる
        const wave = 0.5 + 0.5 * Math.sin(phaseRef.current + i * 0.5);
        const target = 0.08 + shape * (0.12 + level * 0.9) * wave;
        bars[i].setValue(Math.min(1, target));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bars, recorder]);

  return (
    <View style={styles.row}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              transform: [
                { scaleY: v },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 220,
    width: "100%",
    gap: 3,
  },
  bar: {
    flex: 1,
    maxWidth: 5,
    height: 200,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
