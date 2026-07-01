import { Pressable, StyleSheet, Text, View } from "react-native";
import { GearIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, spacing } from "../lib/theme";

type Props = {
  title: "LOG" | "INSIGHT";
  onOpenSettings: () => void;
};

// yuzu-app の .app-header を移植。ロゴは置かず、ページ名（大）+ 設定アイコンのみ。
export default function AppHeader({ title, onOpenSettings }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}.</Text>
      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="設定"
        style={({ pressed }) => [styles.gearBtn, pressed && styles.gearBtnPressed]}
      >
        <GearIcon size={22} color={colors.ink} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxxl,
    color: colors.ink,
  },
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconBg,
  },
  gearBtnPressed: { backgroundColor: colors.surfaceHover },
});
