// Sentry は他の import より先に初期化する（副作用 import）。起動直後のクラッシュも拾うため。
import "./lib/sentry";

import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
// バレル（"@expo-google-fonts/unbounded"）経由だと使わない5ウェイト分（約2.9MB）まで
// バンドルされてしまうため、使うウェイトだけ個別パスから直接 import する。
import { useFonts } from "@expo-google-fonts/unbounded/useFonts";
import Unbounded_400Regular from "@expo-google-fonts/unbounded/400Regular/Unbounded_400Regular.ttf";
import Unbounded_700Bold from "@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf";
import Unbounded_900Black from "@expo-google-fonts/unbounded/900Black/Unbounded_900Black.ttf";
import LINESeedJP_400Regular from "./assets/fonts/LINESeedJP_400Regular.ttf";
import LINESeedJP_700Bold from "./assets/fonts/LINESeedJP_700Bold.ttf";
import type { Session } from "@supabase/supabase-js";
import { PostHogProvider } from "posthog-react-native";
import { supabase } from "./lib/supabase";
import { identify, posthogClient, resetIdentity, track } from "./lib/analytics";
import { clearLogsCache } from "./lib/logsCache";
import { clearRequestCache } from "./lib/requestCache";
import { clearMockMode } from "./lib/mockMode";
import { clearSentimentCache } from "./lib/sentimentCache";
import { clearSeenKeys } from "./lib/reportSeen";
import { updateWidgetSignal } from "./lib/widgetSignal";
import { completeAuthRedirect } from "./lib/authSession";
import * as Linking from "expo-linking";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "./lib/theme";
import * as haptics from "./lib/haptics";
import ErrorBoundary from "./components/ErrorBoundary";
import OnboardingScreen from "./components/OnboardingScreen";
import RecordScreen from "./components/RecordScreen";

// セッション確認・フォント読み込みが終わるまでネイティブスプラッシュ（ブランドアイコン）を維持し、
// 素の白画面が一瞬挟まるのを防ぐ。
SplashScreen.preventAutoHideAsync().catch(() => {});

// フォント読み込み・セッション確認のどちらかが（プロダクションのアセット解決失敗や
// getSession のネットワーク不達などで）永久に解決しないと ready が立たず、スプラッシュで
// 固まる。実機標準ビルドでは redbox も出ないため無限スプラッシュに見える。保険として
// この時間を過ぎたら未解決要素を諦めて先に進め、UI を必ず出す。
const STARTUP_TIMEOUT_MS = 5000;

// AppInner を ErrorBoundary で包む前提の分割。ready フラグが立つ前（フォント/セッション
// 読み込み中）の early return もこの境界内に入れて、起動直後のクラッシュも取りこぼさない。
function AppInner() {
  // undefined = 起動直後の読み込み中（or セッション未確定）、null = 未ログイン、Session = ログイン済み
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // 起動が想定時間を超えたら true。未解決要素を諦めて先に進むためのフラグ（スプラッシュを
  // 隠すゲートとしてのみ使う。session の確定状態そのものは表さない）。
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  // "RETRY" ボタン押下のたびにインクリメントし、getSession() を再実行させる
  // （タイムアウトまでにセッションが確定しなかった場合の手動リトライ導線。#13）。
  const [retryTick, setRetryTick] = useState(0);
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_400Regular,
    Unbounded_700Bold,
    Unbounded_900Black,
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
  });
  // フォントは読み込み失敗・タイムアウト時も OS 標準フォントへフォールバックして先に進める。
  const fontsReady = fontsLoaded || !!fontError || startupTimedOut;
  // セッションが確定した（signed-in/signed-out のどちらかに決まった）かどうか。
  // タイムアウトはこれを確定させない：ready はタイムアウトでも成立させてスプラッシュは
  // 隠すが、実際に何を描画するかは下の session の値でそのまま判定する（#13: 低速回線で
  // ログイン済みユーザーが一瞬オンボーディングへ落ちて匿名操作できる窓を作らないため、
  // 未確定を signed-out に化けさせない）。
  const sessionSettled = session !== undefined;
  const ready = (sessionSettled || startupTimedOut) && fontsReady;

  // 初回マウント時 + リトライ時のセッション確認。retryTick を deps に含めることで
  // "RETRY" ボタンから再実行できる。
  useEffect(() => {
    let mounted = true;

    // getSession が reject すると .catch が無ければ session が永久に undefined になり、
    // スプラッシュが消えない。失敗時は未ログイン扱いで必ず先に進める
    // （ネットワーク不達と「本当に未ログイン」を区別できないための既存の割り切り。
    // タイムアウトによる自動昇格とは異なり、こちらは明示的な失敗なので signed-out 確定でよい）。
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
        // 起動時に既にセッションが復元されている場合も distinctId を紐づけておく
        // （SIGNED_IN イベントは発火しないため、ここでも identify を呼ぶ）。
        if (data.session?.user) identify(data.session.user.id);
      })
      .catch(() => {
        if (mounted) setSession(null);
      });

    return () => {
      mounted = false;
    };
  }, [retryTick]);

  // 認証状態の購読とタイムアウトタイマーは一度だけ張る（retryTick では再購読しない）。
  useEffect(() => {
    let mounted = true;

    const { data: authSub } = supabase.auth.onAuthStateChange((event, next) => {
      if (mounted) setSession(next);
      // ログイン直後: PostHog の distinctId をユーザー ID に紐づけて識別する。
      if (event === "SIGNED_IN" && next?.user) {
        identify(next.user.id);
        track("login_succeeded");
      }
      // ログアウト: distinctId をリセットして新しい匿名 ID を発行する。
      // LOG キャッシュ（AsyncStorage）と INSIGHT のメモリキャッシュも消す。loadLogsCache は
      // userId 一致チェックがあるため他ユーザーのデータが混入することは無いが、念のための保険。
      // センチメントスコアのキャッシュ（sentimentCache）とレポート既読状態（reportSeen）も
      // 同じ理由で消す：どちらも userId を保存しない素の AsyncStorage キーなので、消さないと
      // 別アカウントへの切替時に前ユーザーのスコア・既読状態がそのまま漏れる。
      // SettingsScreen の通常ログアウト・アカウント削除どちらも signOut() 経由でこのイベントを
      // 発火させるので、ここ一箇所で両方をカバーできる。
      if (event === "SIGNED_OUT") {
        resetIdentity();
        clearLogsCache().catch(() => {});
        clearRequestCache();
        clearMockMode();
        clearSentimentCache().catch(() => {});
        clearSeenKeys().catch(() => {});
        // SIGNAL ウィジェットも同じ理由でリセットする（他ユーザーの記録間隔を共有端末で見せない）。
        updateWidgetSignal(null);
      }
    });

    const timer = setTimeout(() => {
      if (mounted) setStartupTimedOut(true);
    }, STARTUP_TIMEOUT_MS);

    return () => {
      mounted = false;
      clearTimeout(timer);
      authSub.subscription.unsubscribe();
    };
  }, []);

  // OAuth（Google）のリダイレクトを拾うフォールバック。本来は AuthScreen 側の
  // openAuthSessionAsync が直接 URL を受け取って処理するが、ユーザーがブラウザを
  // 離れてから戻ってきた等で in-app browser の Promise が解決しないまま OS 側から
  // 直接アプリが起動されるケースをここで拾う（cold start は getInitialURL、
  // warm start は addEventListener）。認証と無関係な URL は何もしない。
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) completeAuthRedirect(url).catch(() => {});
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      completeAuthRedirect(url).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // onLayout は SafeAreaProvider のマウント時に発火するが、それに依存せず ready 成立時にも
  // 確実に隠す（二重の保険。hideAsync は冪等）。
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayoutRootView = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  function handleRetrySessionCheck() {
    haptics.tapLight();
    setRetryTick((t) => t + 1);
  }

  let body: React.ReactNode;
  if (session === undefined) {
    // タイムアウトで ready 自体は成立したが、セッションはまだ未確定。ログイン済みユーザーを
    // 誤ってオンボーディング（匿名操作可能な画面）へ落とさないよう、確定するまでは
    // 非操作のプレースホルダ（既存のネイティブスプラッシュと同じ配色・アイコン）を出し続ける。
    body = <SessionUnresolvedView onRetry={handleRetrySessionCheck} />;
  } else if (session) {
    body = <RecordScreen session={session} />;
  } else {
    body = <OnboardingScreen />;
  }

  const content = (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      {body}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );

  return posthogClient ? <PostHogProvider client={posthogClient}>{content}</PostHogProvider> : content;
}

// 起動タイムアウト後もセッションが未確定（getSession() がまだ解決していない）ときのプレー
// スホルダ。ネイティブスプラッシュ（app.json の expo-splash-screen 設定）と同じ配色・
// アイコンを流用し、ready 成立の前後で見た目が連続するようにする。OnboardingScreen とは
// 違って録音・ログイン操作ができない非操作ビュー（#13: ログイン済みが誤って匿名操作可能な
// 画面に落ちるのを防ぐ）。長時間解決しない回線向けに RETRY を出す。
function SessionUnresolvedView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.unresolvedContainer}>
      <Image
        source={require("./assets/splash-icon.png")}
        style={styles.unresolvedIcon}
        resizeMode="contain"
      />
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="再試行"
        style={styles.retryBtn}
      >
        <Text style={styles.retryLabel}>RETRY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  unresolvedContainer: {
    flex: 1,
    backgroundColor: colors.yuzuYellow,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  unresolvedIcon: { width: 120, height: 120 },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.ink,
    letterSpacing: fontSize.xs * letterSpacing.wide,
  },
});

// 実際のルート。AppInner 全体（ready 判定前の early return も含む）を ErrorBoundary で包む。
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
