import { Pressable, StyleSheet } from "react-native";
import { MicrophoneIcon } from "phosphor-react-native";
import { colors, recordingGlowShadow } from "../lib/theme";

type Props = {
  disabled: boolean;
  hidden?: boolean;
  onPress: () => void;
};

// yuzu-app の .fab-record（右端の独立した録音ボタン）。タップで RecordModal を開く。
export default function RecordFab({ disabled, hidden, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || hidden}
      accessibilityRole="button"
      accessibilityLabel="録音を開く"
      style={({ pressed }) => [styles.fab, hidden && styles.hidden, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <MicrophoneIcon size={28} color={colors.ink} weight="fill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: colors.yuzuYellow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...recordingGlowShadow,
  },
  hidden: { opacity: 0 },
  disabled: { opacity: 0.3 },
  pressed: { transform: [{ scale: 0.94 }] },
});
