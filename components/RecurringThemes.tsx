import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fonts, spacing } from "../lib/theme";
import type { Theme } from "../lib/insightTypes";

// yuzu-app の RecurringThemes.tsx（Spotify Wrapped 風マインドシェアランキング）を移植。
export default function RecurringThemes({ themes }: { themes: Theme[] }) {
  const ranked = [...themes].sort((a, b) => b.count - a.count);
  const total = ranked.reduce((sum, t) => sum + t.count, 0) || 1;

  return (
    <View style={styles.list}>
      {ranked.map((t, i) => {
        const share = t.count / total;
        const sharePct = Math.round(share * 100);
        return <ThemeRow key={`${t.theme}-${i}`} theme={t} rank={i + 1} sharePct={sharePct} lead={i === 0} />;
      })}
    </View>
  );
}

function ThemeRow({ theme, rank, sharePct, lead }: { theme: Theme; rank: number; sharePct: number; lead: boolean }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: sharePct,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [sharePct, widthAnim]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.rank}>#{rank}</Text>
        <Text style={[styles.title, lead && styles.titleLead]} numberOfLines={1}>{theme.theme}</Text>
        <Text style={[styles.share, lead && styles.shareLead]}>{sharePct}%</Text>
      </View>
      <View style={[styles.barTrack, lead && styles.barTrackLead]}>
        <Animated.View
          style={[
            styles.barFill,
            lead && styles.barFillLead,
            { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>
      <Text style={styles.description}>{theme.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  card: { gap: spacing.xs },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rank: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: colors.inkMuted },
  title: { flex: 1, fontFamily: fonts.displayBold, fontSize: fontSize.base, color: colors.ink },
  titleLead: { fontSize: fontSize.lg },
  share: { fontFamily: fonts.displayBold, fontSize: fontSize.sm, color: colors.ink },
  shareLead: { fontSize: fontSize.base },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: "hidden" },
  barTrackLead: { height: 6 },
  barFill: { height: "100%", backgroundColor: colors.yuzuYellow, borderRadius: 2 },
  barFillLead: { backgroundColor: colors.yuzuYellow },
  description: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
    color: colors.inkSecondary,
  },
});
