import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
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

export default function App() {
  // undefined = 起動直後の読み込み中、null = 未ログイン、Session = ログイン済み
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular,
    Unbounded_700Bold,
    Unbounded_900Black,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => authSub.subscription.unsubscribe();
  }, []);

  if (session === undefined || !fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {session ? <RecordScreen session={session} /> : <AuthScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
