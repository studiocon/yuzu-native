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
import { supabase } from "./lib/supabase";
import AuthScreen from "./components/AuthScreen";
import RecordScreen from "./components/RecordScreen";

// セッション確認・フォント読み込みが終わるまでネイティブスプラッシュ（ブランドアイコン）を維持し、
// 素の白画面が一瞬挟まるのを防ぐ。
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // undefined = 起動直後の読み込み中、null = 未ログイン、Session = ログイン済み
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_400Regular,
    Unbounded_700Bold,
    Unbounded_900Black,
  });
  // フォント読み込み失敗時も画面が永久に真っ白のまま止まらないよう、
  // OS標準フォントへのフォールバックで先に進める（致命的にしない）。
  const ready = session !== undefined && (fontsLoaded || !!fontError);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => authSub.subscription.unsubscribe();
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      {session ? <RecordScreen session={session} /> : <AuthScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
