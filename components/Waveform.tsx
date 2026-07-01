import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// yuzu-app の Waveform.tsx（録音中・音量反応バー）を移植。
// Web Audio の AnalyserNode の代わりに expo-audio の metering(dB) を level(0..1) に正規化して渡す。
const BAR_COUNT = 40;

type Props = {
  // 0..1 の音量レベル（RecordScreen が metering から算出して渡す）
  level: number;
};

// 各バーは中心からの距離で最大高さが変わる（中央が高い山型）+ level で伸縮。
export default function Waveform({ level }: Props) {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.1)),
  ).current;
  const phaseRef = useRef(0);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      phaseRef.current += 0.18;
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
  }, [bars, level]);

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
