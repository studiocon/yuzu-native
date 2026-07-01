import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { CopyIcon, PushPinIcon, PushPinSlashIcon, XIcon } from "phosphor-react-native";
import { colors, fontSize, fonts, letterSpacing, radius, spacing } from "../lib/theme";
import { dayNumberSince, formatDuration } from "../lib/stats";
import { seededHeights, voiceprintBarCount } from "../lib/voiceprint";
import { sentimentColor } from "../lib/sentimentColor";
import type { Post } from "../lib/types";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

type Props = {
  post: Post | null;
  firstPostAt: number | null;
  /** 感情スコア（-1.0〜1.0）。未解析なら undefined → 見出し帯の左端バー・声紋ヒーローは無色。 */
  score?: number;
  onClose: () => void;
  onToggleMark: (id: string, marked: boolean) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatStamp(ts: number): string {
  const d = new Date(ts);
  const wd = WEEKDAY_JA[d.getDay()];
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} (${wd}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 「。」直後で段落に割る（句点は残す）。
function splitParagraphs(text: string): string[] {
  const parts = text
    .split(/(?<=。)\s*\n?/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [text];
}

export default function IndexDetailModal({ post, firstPostAt, score, onClose, onToggleMark }: Props) {
  const [marked, setMarked] = useState(false);
  const [justMarked, setJustMarked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (post) setMarked(post.marked);
  }, [post]);

  if (!post) return null;

  const lengthLabel = post.durationMs > 0 ? formatDuration(post.durationMs) : null;
  const dayNumber = typeof firstPostAt === "number" ? dayNumberSince(post.createdAt, firstPostAt) : 0;
  const dayLabel = dayNumber > 0 ? String(dayNumber) : null;
  const charsLabel = post.charCount > 0 ? String(post.charCount) : null;
  const hasStats = lengthLabel !== null || dayLabel !== null || charsLabel !== null;

  const barCount = voiceprintBarCount(post.durationMs);
  const bars = barCount === null ? null : seededHeights(post.id, barCount);
  const paragraphs = splitParagraphs(post.text);
  const moodColor = sentimentColor(score);

  function fireMark() {
    if (!post) return;
    const next = !marked;
    setMarked(next);
    onToggleMark(post.id, next);
    if (next) {
      setJustMarked(true);
      setTimeout(() => setJustMarked(false), 900);
    }
  }

  // TEMPORARY: Notion 移行期間限定のコピー機能。YUZU 運用が完全移行したら削除する。
  async function handleCopy() {
    if (!post) return;
    const payload = `#${String(post.index).padStart(3, "0")}  ${formatTimestamp(post.createdAt)}\n${post.text}`;
    try {
      await Clipboard.setStringAsync(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // コピー失敗は静かに無視（破壊的操作ではない）
    }
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <SafeAreaView style={styles.safe}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          hitSlop={12}
          accessibilityLabel="閉じる"
          accessibilityRole="button"
        >
          <XIcon size={22} color={colors.yuzuWhite} weight="bold" />
        </Pressable>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.band}>
            {moodColor && <View style={[styles.bandEdge, { backgroundColor: moodColor }]} />}
            <Text style={styles.num}>#{String(post.index).padStart(3, "0")}</Text>

            {bars && (
              <View style={styles.voiceprint}>
                {bars.map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.voiceprintBar,
                      { height: Math.max(1, Math.round(h * 80)), backgroundColor: moodColor ?? "rgba(255,255,255,0.4)" },
                    ]}
                  />
                ))}
              </View>
            )}

            <Text style={styles.stamp}>{formatStamp(post.createdAt)}</Text>
          </View>

          {hasStats && (
            <View style={styles.statsRow}>
              {lengthLabel !== null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>LENGTH</Text>
                  <Text style={styles.statValue}>{lengthLabel}</Text>
                </View>
              )}
              {dayLabel !== null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>DAY</Text>
                  <Text style={styles.statValue}>{dayLabel}</Text>
                </View>
              )}
              {charsLabel !== null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>CHARS</Text>
                  <Text style={styles.statValue}>{charsLabel}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.textBlock}>
            {paragraphs.map((para, i) => (
              <Text key={i} style={styles.para}>{para}</Text>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={fireMark}
              style={({ pressed }) => [styles.actionBtn, marked && styles.actionBtnActive, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={marked ? "MARK を外す" : "MARK する"}
            >
              {marked ? (
                <PushPinIcon size={18} color={colors.yuzuZest} weight="fill" />
              ) : (
                <PushPinSlashIcon size={18} color="rgba(255,255,255,0.7)" weight="regular" />
              )}
              <Text style={[styles.actionLabel, marked && styles.actionLabelActive]}>
                {justMarked ? "MARKED" : "MARK"}
              </Text>
            </Pressable>

            {/* TEMPORARY: Notion 移行期間限定のコピー機能。YUZU 運用が完全移行したら削除する。 */}
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [styles.actionBtn, copied && styles.actionBtnActive, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="本文をコピー"
            >
              <CopyIcon size={18} color={copied ? colors.yuzuZest : "rgba(255,255,255,0.7)"} weight="regular" />
              <Text style={[styles.actionLabel, copied && styles.actionLabelActive]}>
                {copied ? "COPIED" : "COPY"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  closeBtn: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    zIndex: 1,
  },
  closeBtnPressed: { backgroundColor: "rgba(255,255,255,0.26)" },
  body: { padding: spacing.xl, paddingTop: spacing.xxl + spacing.xxl, gap: spacing.xl },
  band: { position: "relative", paddingLeft: spacing.md, gap: spacing.md },
  bandEdge: { position: "absolute", left: 0, top: 4, bottom: 4, width: 3, borderRadius: 2 },
  num: {
    fontFamily: fonts.displayBlack,
    fontSize: 72,
    color: colors.yuzuYellow,
    letterSpacing: -2,
  },
  voiceprint: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 80 },
  voiceprintBar: { flex: 1, minWidth: 2, backgroundColor: "rgba(255,255,255,0.4)" },
  stamp: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: colors.inkMuted,
    letterSpacing: fontSize.xs * letterSpacing.label,
  },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: {
    flex: 1,
    alignItems: "flex-start",
    gap: spacing.xs,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.card,
  },
  statLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: fontSize.xs * letterSpacing.widest,
    textTransform: "uppercase",
  },
  statValue: { fontFamily: fonts.displayBlack, fontSize: 36, color: colors.yuzuWhite },
  textBlock: { gap: 14 },
  para: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.85,
    color: "rgba(255,255,255,0.92)",
  },
  actions: { flexDirection: "row", gap: spacing.md },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.card,
  },
  actionBtnActive: { borderColor: colors.yuzuZest },
  actionBtnPressed: { transform: [{ scale: 0.96 }] },
  actionLabel: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: fontSize.xs * letterSpacing.widest,
  },
  actionLabelActive: { color: colors.yuzuZest },
});
