import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../lib/theme";

// yuzu-app の @keyframes skeleton-pulse（opacity 0.45↔0.85・1.4s ease-in-out infinite）を移植。
// API ロード中の placeholder。使い回せるよう単一プリミティブに切り出す。
export function useSkeletonPulse(): Animated.AnimatedInterpolation<number> {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
}

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Skeleton({ width = "100%", height = 14, radius = 2, style }: Props) {
  const opacity = useSkeletonPulse();
  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.divider },
});
