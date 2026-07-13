import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { hierarchy, pack, type HierarchyCircularNode } from "d3-hierarchy";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { colors, fontSize, fonts } from "../lib/theme";
import * as haptics from "../lib/haptics";
import { useSkeletonPulse } from "./Skeleton";
import type { WordFreq } from "../lib/insightTypes";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Datum = { word: string; count: number; value: number };

const VIEW = 320;
const PADDING = 6;
const LABEL_MIN_RADIUS = 18;

// yuzu-app の SKELETON_DOTS（バブル形に寄せた読み込み中 placeholder）を移植。
const SKELETON_DOTS = [
  { cx: 160, cy: 150, r: 68 },
  { cx: 96, cy: 205, r: 42 },
  { cx: 226, cy: 200, r: 40 },
  { cx: 240, cy: 108, r: 32 },
  { cx: 92, cy: 96, r: 28 },
  { cx: 168, cy: 248, r: 24 },
  { cx: 54, cy: 160, r: 20 },
];

export function WordBubbleMapSkeleton() {
  const opacity = useSkeletonPulse();
  return (
    <Svg width="100%" height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      {SKELETON_DOTS.map((d, i) => (
        <AnimatedCircle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={colors.divider} opacity={opacity} />
      ))}
    </Svg>
  );
}

// yuzu-app の WordBubbleMap.tsx を移植。d3-hierarchy は DOM 非依存なので RN でもそのまま使える。
export default function WordBubbleMap({ words }: { words: WordFreq[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const nodes = useMemo(() => {
    if (words.length === 0) return [];
    const root = hierarchy<{ children?: Datum[] }>({
      children: words.map((w) => ({ word: w.word, count: w.count, value: w.count })),
    }).sum((d) => (d as Datum).value ?? 0);
    pack<typeof root.data>().size([VIEW, VIEW]).padding(PADDING)(root);
    return (root.leaves() as unknown as HierarchyCircularNode<Datum>[]).filter((n) => n.r > 0);
  }, [words]);

  // タップした瞬間に「プルン」とバウンスさせる演出用のスケール値（1 = 等倍）。
  // circle の r を直接アニメーションするので useNativeDriver は使えない。
  const bubbleScales = useMemo(() => nodes.map(() => new Animated.Value(1)), [nodes]);
  const bubbleScalesRef = useRef(bubbleScales);
  bubbleScalesRef.current = bubbleScales;

  function bounce(scaleValue: Animated.Value, peak: number, delayMs = 0) {
    scaleValue.stopAnimation();
    scaleValue.setValue(1);
    Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(scaleValue, { toValue: peak, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(scaleValue, { toValue: 1, useNativeDriver: false, friction: 5, tension: 140 }),
    ]).start();
  }

  // yuzu-app の pop/ripple 挙動を移植：タップしたバブルは大きめに、隣接バブル
  // （dist < source.r + n.r + 24）は距離に応じた遅延で小さめにバウンスする。
  function handleBubblePress(i: number) {
    setSelected(i);
    // 触覚はモーション削減設定とは別物なので、reduce motion でもタップの手応えは返す。
    haptics.tapLight();
    if (reduceMotion) return;
    const scales = bubbleScalesRef.current;
    const source = nodes[i];
    bounce(scales[i], 1.12);
    nodes.forEach((n, j) => {
      if (j === i || !source) return;
      const dist = Math.hypot(n.x - source.x, n.y - source.y);
      if (dist < source.r + n.r + 24) {
        bounce(scales[j], 1.06, 40 + dist * 0.6);
      }
    });
  }

  const opacityRange = useMemo(() => {
    if (nodes.length === 0) return { min: 1, max: 1 };
    const counts = nodes.map((n) => n.data.count);
    return { min: Math.min(...counts), max: Math.max(...counts) };
  }, [nodes]);

  if (words.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyMsg}>まだ声がない</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      {nodes.map((n, i) => {
        const { min, max } = opacityRange;
        const t = max === min ? 1 : (n.data.count - min) / (max - min);
        const opacity = 0.3 + 0.7 * t;
        const fontSizePx = Math.min(n.r * 0.55, 22);
        const showLabel = n.r >= LABEL_MIN_RADIUS;
        const animatedR = bubbleScales[i]?.interpolate({ inputRange: [0, 1], outputRange: [0, n.r] });
        return (
          <G key={`${n.data.word}-${i}`} transform={`translate(${n.x},${n.y})`}>
            <AnimatedCircle
              r={animatedR ?? n.r}
              fill={colors.yuzuYellow}
              opacity={selected === i ? Math.min(1, opacity + 0.15) : opacity}
              onPress={() => handleBubblePress(i)}
            />
            {showLabel && (
              <SvgText
                textAnchor="middle"
                dy={fontSizePx * 0.35}
                fontSize={fontSizePx}
                fontFamily={fonts.bodyBold}
                fill={colors.ink}
              >
                {n.data.word}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyMsg: { fontFamily: fonts.bodyRegular, fontSize: fontSize.base, color: colors.inkMuted },
});
