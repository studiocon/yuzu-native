import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";

type Props = { children: ReactNode };
type State = { hasError: boolean };

// アプリ全体のクラッシュ最後の砦。App.tsx の return 全体をこれで包む
// （SafeAreaProvider の外側、最上位）。componentDidCatch で Sentry に送ってから
// フォールバック UI（BROKEN / 壊れた。読み込み直せ。/ RELOAD）を出す。
// expo-updates が未導入のため RELOAD は state リセット + 再レンダーのみ（過度に複雑にしない）。
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.body}>
            <Text style={styles.headline}>BROKEN</Text>
            <Text style={styles.message}>壊れた。読み込み直せ。</Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={this.handleReload}
              accessibilityRole="button"
              accessibilityLabel="読み込み直せ"
            >
              <Text style={styles.buttonLabel}>RELOAD</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxxl,
    color: colors.ink,
    letterSpacing: fontSize.xxxl * letterSpacing.wide,
    textTransform: "uppercase",
  },
  message: {
    fontSize: fontSize.base,
    color: colors.inkSecondary,
    textAlign: "center",
    lineHeight: fontSize.base * 1.6,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonLabel: {
    color: colors.yuzuWhite,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    letterSpacing: fontSize.sm * letterSpacing.wider,
  },
});
