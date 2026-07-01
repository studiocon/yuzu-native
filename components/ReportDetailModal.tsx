import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import { periodLabel } from "../lib/period";
import EmotionChart from "./EmotionChart";
import type { ReportPayload } from "../lib/insightTypes";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Status = "loading" | "ok" | "no_posts" | "in_progress" | "error";

type Props = {
  periodKey: string | null;
  accessToken: string;
  scores: Record<string, number>;
  onClose: () => void;
};

const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 4000;

export default function ReportDetailModal({ periodKey, accessToken, scores, onClose }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const autoRetriesRef = useRef(0);

  // periodKey が変わったら自動リトライ回数をリセット
  useEffect(() => {
    autoRetriesRef.current = 0;
  }, [periodKey]);

  // 生成タイムアウトで error になった場合、サーバは裏で生成を完了していることが多い。
  // 少し待ってから GET を再試行するとキャッシュヒットで成功する（MONTH の初回対策）。
  useEffect(() => {
    if (status !== "error" || autoRetriesRef.current >= MAX_AUTO_RETRIES) return;
    const t = setTimeout(() => {
      autoRetriesRef.current += 1;
      setRetryNonce((n) => n + 1);
    }, AUTO_RETRY_DELAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!periodKey) return;
    let cancelled = false;
    setStatus("loading");
    setPayload(null);

    (async () => {
      try {
        const getRes = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(periodKey)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (cancelled) return;
        if (getRes.status === 422) return setStatus("in_progress");
        if (getRes.ok) {
          const data = (await getRes.json()) as { report?: { payload: ReportPayload } };
          if (data.report) {
            setPayload(data.report.payload);
            setStatus("ok");
            return;
          }
          return setStatus("error");
        }
        if (getRes.status !== 404) return setStatus("error");

        const postRes = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(periodKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ scores }),
        });
        if (cancelled) return;
        if (postRes.status === 404) return setStatus("no_posts");
        if (postRes.status === 422) return setStatus("in_progress");
        if (!postRes.ok) return setStatus("error");
        const data = (await postRes.json()) as { report?: { payload: ReportPayload } };
        if (!data.report) return setStatus("error");
        setPayload(data.report.payload);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // scores はキャプチャ依存（生成トリガーは periodKey/retryNonce のみ。新規スコア到着での再生成は不要）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, accessToken, retryNonce]);

  if (!periodKey) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>REPORTS</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <XIcon size={22} color={colors.ink} weight="bold" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {status === "loading" && (
            <View style={styles.statusWrap}>
              <ActivityIndicator color={colors.inkMuted} />
              <Text style={styles.statusSub}>AI が刻んでいる。画面を離れても、閉じても止まらない。</Text>
            </View>
          )}
          {status === "no_posts" && <Text style={styles.status}>この期間は何も無い</Text>}
          {status === "in_progress" && <Text style={styles.status}>まだ進行中の期間だ</Text>}
          {status === "error" && (
            <View style={styles.statusWrap}>
              <Text style={styles.status}>失敗、話せ</Text>
              <Pressable onPress={() => setRetryNonce((n) => n + 1)} style={styles.retryBtn}>
                <Text style={styles.retryLabel}>RETRY</Text>
              </Pressable>
            </View>
          )}

          {status === "ok" && payload && (
            <View style={styles.article}>
              <Text style={styles.title}>{periodLabel(periodKey)}</Text>
              <Text style={styles.headline}>{payload.headline}</Text>

              <Block title="EMOTION">
                <EmotionChart data={payload.sentimentSeries} />
              </Block>

              {payload.topics.length > 0 && (
                <Block title="TOPICS">
                  <View style={styles.topics}>
                    {payload.topics.map((t, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipLabel}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </Block>
              )}

              <Block title="SURFACE">
                <Paragraphs text={payload.manifest} />
              </Block>

              <Block title="DEPTH">
                <Paragraphs text={payload.latent} />
              </Block>

              <Block title="ADVICE">
                <Text style={styles.advice}>{payload.advice}</Text>
                {payload.adviceDetail && <Paragraphs text={payload.adviceDetail} />}
              </Block>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => (
        <Text key={i} style={styles.paragraph}>{b}</Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.yuzuWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    color: colors.inkMuted,
    letterSpacing: fontSize.sm * letterSpacing.widest,
  },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBg },
  closeBtnPressed: { backgroundColor: colors.surfaceHover },
  body: { padding: spacing.xl, gap: spacing.xl },
  statusWrap: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xxl },
  status: { fontSize: fontSize.base, color: colors.inkSecondary, textAlign: "center" },
  statusSub: { fontSize: fontSize.sm, color: colors.inkMuted, textAlign: "center" },
  retryBtn: { borderWidth: 1, borderColor: colors.ink, borderRadius: radius.button, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryLabel: { fontFamily: fonts.displayBold, fontSize: fontSize.xs, color: colors.ink, letterSpacing: fontSize.xs * letterSpacing.wide },
  article: { gap: spacing.xxl },
  title: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.ink },
  headline: { fontSize: fontSize.lg, fontWeight: "700", color: colors.ink, marginTop: -spacing.md },
  block: { gap: spacing.sm },
  blockTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.sm,
    color: colors.inkMuted,
    letterSpacing: fontSize.sm * letterSpacing.widest,
  },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { backgroundColor: colors.surfaceHover, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  chipLabel: { fontSize: fontSize.xs, color: colors.inkSecondary },
  paragraph: { fontSize: fontSize.base, lineHeight: fontSize.base * 1.75, color: colors.ink },
  advice: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.ink },
});
