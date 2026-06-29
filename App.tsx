import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { applySessionFromUrl } from "./lib/authLinking";
import AuthScreen from "./components/AuthScreen";
import RecordScreen from "./components/RecordScreen";

export default function App() {
  // undefined = 起動直後の読み込み中、null = 未ログイン、Session = ログイン済み
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    Linking.getInitialURL().then((url) => {
      if (url) applySessionFromUrl(url);
    });
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      applySessionFromUrl(url);
    });

    return () => {
      authSub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  if (session === undefined) return null;

  return (
    <>
      {session ? <RecordScreen session={session} /> : <AuthScreen />}
      <StatusBar style="dark" />
    </>
  );
}
