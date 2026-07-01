import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

// yuzu-app の float-dot（待機中の浮遊ドット）を移植。白い半透明の円が緩やかに上下する。
const DOT_COUNT = 14;

type Dot = { left: number; top: number; size: number; dur: number; delay: number };

function seedDots(): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    out.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 6 + Math.random() * 20,
      dur: 3000 + Math.random() * 4000,
      delay: Math.random() * 2000,
    });
  }
  return out;
}

function FloatingDot({ dot }: { dot: Dot }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dot.dur, delay: dot.delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dot.dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, dot.dur, dot.delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.1] });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: `${dot.left}%`,
          top: `${dot.top}%`,
          width: dot.size,
          height: dot.size,
          borderRadius: dot.size / 2,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

export default function FloatingDots() {
  const dots = useMemo(seedDots, []);
  return (
    <View style={styles.layer} pointerEvents="none">
      {dots.map((d, i) => (
        <FloatingDot key={i} dot={d} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject },
  dot: { position: "absolute", backgroundColor: "#fff" },
});
