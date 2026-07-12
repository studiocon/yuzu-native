// Sentry は他の import より先に初期化する（副作用 import）。起動直後のクラッシュも拾うため。
import "./lib/sentry";

import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
// バレル（"@expo-google-fonts/unbounded"）経由だと使わない5ウェイト分（約2.9MB）まで
// バンドルされてしまうため、使うウェイトだけ個別パスから直接 import する。
import { useFonts } from "@expo-google-fonts/unbounded/useFonts";
import Unbounded_400Regular from "@expo-google-fonts/unbounded/400Regular/Unbounded_400Regular.ttf";
import Unbounded_700Bold from "@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf";
import Unbounded_900Black from "@expo-google-fonts/unbounded/900Black/Unbounded_900Black.ttf";
import type { Session } from "@supabase/supabase-js";
import { PostHogProvider } from "posthog-react-native";
import { supabase } from "./lib/supabase";
import { identify, posthogClient, resetIdentity, track } from "./lib/analytics";
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
  // undefined = 起動直後の読み込み中、null = 未ログイン、Session = ログイン済み
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // 起動が想定時間を超えたら true。未解決要素を諦めて先に進むためのフラグ。
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_400Regular,
    Unbounded_700Bold,
    Unbounded_900Black,
  });
  // フォントは読み込み失敗・タイムアウト時も OS 標準フォントへフォールバックして先に進める。
  const fontsReady = fontsLoaded || !!fontError || startupTimedOut;
  // セッションはタイムアウト時は未ログイン扱い（undefined のままにしない）で先に進める。
  const sessionReady = session !== undefined || startupTimedOut;
  const ready = sessionReady && fontsReady;
  // タイムアウトで先に進む場合、session が undefined のままだと描画側で扱えないため null 扱いにする。
  const effectiveSession = session === undefined ? null : session;

  useEffect(() => {
    let mounted = true;

    // getSession が reject すると .catch が無ければ session が永久に undefined になり、
    // スプラッシュが消えない。失敗時は未ログイン扱いで必ず先に進める。
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

    const { data: authSub } = supabase.auth.onAuthStateChange((event, next) => {
      if (mounted) setSession(next);
      // ログイン直後: PostHog の distinctId をユーザー ID に紐づけて識別する。
      if (event === "SIGNED_IN" && next?.user) {
        identify(next.user.id);
        track("login_succeeded");
      }
      // ログアウト: distinctId をリセットして新しい匿名 ID を発行する。
      if (event === "SIGNED_OUT") {
        resetIdentity();
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

  // onLayout は SafeAreaProvider のマウント時に発火するが、それに依存せず ready 成立時にも
  // 確実に隠す（二重の保険。hideAsync は冪等）。
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayoutRootView = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const content = (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      {effectiveSession ? <RecordScreen session={effectiveSession} /> : <OnboardingScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );

  return posthogClient ? <PostHogProvider client={posthogClient}>{content}</PostHogProvider> : content;
}

// 実際のルート。AppInner 全体（ready 判定前の early return も含む）を ErrorBoundary で包む。
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
