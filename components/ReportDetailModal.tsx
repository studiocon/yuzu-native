import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import { periodLabel } from "../lib/period";
import EmotionChart from "./EmotionChart";
import Skeleton from "./Skeleton";
import type { ReportPayload } from "../lib/insightTypes";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://app.yuzu.style";

type Status = "loading" | "ok" | "no_posts" | "in_progress" | "error";
type FetchResult = "ok" | "pending" | "not_generated" | "in_progress" | "error";

type Props = {
  periodKey: string | null;
  accessToken: string;
  scores: Record<string, number>;
  onClose: () => void;
};

// POST は生成完了を待たない（yuzu-app と同じ非同期化。app/api/reports/[periodKey]/route.ts 参照）。
// 202 が返ったら GET をポーリングして完了を待つ。maxDuration(60s) + バッファぶんは粘る。
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 30; // 3s * 30 = 90s

export default function ReportDetailModal({ periodKey, accessToken, scores, onClose }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!periodKey) return;
    let cancelled = false;
    setStatus("loading");
    setPayload(null);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function tryFetchReport(): Promise<FetchResult> {
      const getRes = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(periodKey!)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (getRes.status === 422) return "in_progress";
      if (getRes.status === 202) return "pending";
      if (getRes.ok) {
        const data = (await getRes.json()) as { report?: { payload: ReportPayload } };
        if (!data.report) return "error";
        setPayload(data.report.payload);
        return "ok";
      }
      if (getRes.status === 404) return "not_generated";
      return "error";
    }

    (async () => {
      try {
        // 1) まず GET（すでに生成済み or 進行中のジョブがあるか確認）
        const first = await tryFetchReport();
        if (cancelled) return;
        if (first === "ok") return setStatus("ok");
        if (first === "in_progress") return setStatus("in_progress");
        if (first === "error") return setStatus("error");

        if (first === "not_generated") {
          // 未生成 → POST で起動（202 を即返すだけなので待たない）
          const postRes = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(periodKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ scores }),
          });
          if (cancelled) return;
          if (postRes.status === 404) return setStatus("no_posts");
          if (postRes.status === 422) return setStatus("in_progress");
          if (postRes.ok) {
            const data = (await postRes.json()) as { report?: { payload: ReportPayload } };
            if (data.report) {
              // すでにキャッシュ済みだった場合の即応答フォールバック
              setPayload(data.report.payload);
              return setStatus("ok");
            }
          } else {
            return setStatus("error");
          }
        }

        // 2) ポーリング（生成完了 or 失敗 or 上限まで）
        setStatus("loading");
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
          if (cancelled) return;
          await sleep(POLL_INTERVAL_MS);
          if (cancelled) return;
          const result = await tryFetchReport();
          if (cancelled) return;
          if (result === "ok") return setStatus("ok");
          if (result === "error") return setStatus("error");
          // "pending" / "not_generated"（stale ジョブ後の一時的な 404）はポーリング継続
        }
        setStatus("error");
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
      <StatusBar hidden hideTransitionAnimation="none" />
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
            <View style={styles.skeletonWrap}>
              <Skeleton width="70%" height={32} radius={4} />
              <Skeleton width="80%" height={14} />
              <Skeleton height={200} radius={4} />
              <Skeleton height={14} />
              <Skeleton height={14} />
              <Skeleton width="65%" height={14} />
              <Skeleton height={14} />
              <Skeleton height={14} />
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

              <Block title="FACT">
                <Paragraphs text={payload.fact} />
              </Block>

              {payload.proof.length > 0 && (
                <Block title="PROOF">
                  <Paragraphs text={payload.proof} />
                </Block>
              )}

              <Block title="SHADOW">
                <Paragraphs text={payload.shadow} />
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
  statusSub: { fontSize: fontSize.sm, color: colors.inkMuted },
  skeletonWrap: { gap: 14 },
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
