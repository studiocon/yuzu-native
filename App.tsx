import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Unbounded_400Regular,
  Unbounded_700Bold,
  Unbounded_900Black,
} from "@expo-google-fonts/unbounded";
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
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular,
    Unbounded_700Bold,
    Unbounded_900Black,
  });
  const ready = session !== undefined && fontsLoaded;

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
