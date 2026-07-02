import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { PulseIcon, WaveformIcon } from "phosphor-react-native";
import { colors, fonts } from "../lib/theme";
import * as haptics from "../lib/haptics";

export type MainTab = "log" | "insight";

// yuzu-app の .tab-bar 実測値。220x64、pill は top/bottom 6px・left 13px・width 84px、
// INSIGHT で translateX(110)（= 1セル幅）。ラベルはアイコン下（column）・10px。
const BAR_WIDTH = 220;
const BAR_HEIGHT = 64;
const CELL_WIDTH = BAR_WIDTH / 2; // 110

type Props = {
  tab: MainTab;
  onChange: (tab: MainTab) => void;
  hidden?: boolean;
};

export default function TabBar({ tab, onChange, hidden }: Props) {
  const slide = useRef(new Animated.Value(tab === "insight" ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: tab === "insight" ? 1 : 0,
      duration: 420,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [tab, slide]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, CELL_WIDTH] });

  return (
    <View pointerEvents={hidden ? "none" : "auto"} style={[styles.bar, hidden && styles.hidden]} accessibilityRole="tablist">
      <Animated.View style={[styles.activePill, { transform: [{ translateX }] }]} />
      <TabCell
        active={tab === "log"}
        label="LOG"
        icon={<WaveformIcon size={24} color={tab === "log" ? colors.ink : colors.inkMuted} weight={tab === "log" ? "fill" : "regular"} />}
        onPress={() => {
          if (tab !== "log") haptics.selectionChanged();
          onChange("log");
        }}
      />
      <TabCell
        active={tab === "insight"}
        label="INSIGHT"
        icon={<PulseIcon size={24} color={tab === "insight" ? colors.ink : colors.inkMuted} weight={tab === "insight" ? "fill" : "regular"} />}
        onPress={() => {
          if (tab !== "insight") haptics.selectionChanged();
          onChange("insight");
        }}
      />
    </View>
  );
}

function TabCell({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
    >
      {icon}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 9999,
    flexDirection: "row",
    backgroundColor: "rgba(250,250,245,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    overflow: "hidden",
    shadowColor: "#1A1A30",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 6,
  },
  hidden: { opacity: 0 },
  activePill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 13,
    width: 84,
    borderRadius: 9999,
    backgroundColor: colors.yuzuYellow,
  },
  cell: {
    width: CELL_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  cellPressed: { opacity: 0.7 },
  label: {
    fontFamily: fonts.displayBold,
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 10 * 0.08,
    textTransform: "uppercase",
    lineHeight: 12,
  },
  labelActive: { color: colors.ink },
});
