import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { hierarchy, pack, type HierarchyCircularNode } from "d3-hierarchy";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { colors, fontSize } from "../lib/theme";
import type { WordFreq } from "../lib/insightTypes";

type Datum = { word: string; count: number; value: number };

const VIEW = 320;
const PADDING = 6;
const LABEL_MIN_RADIUS = 18;

// yuzu-app の WordBubbleMap.tsx を移植。d3-hierarchy は DOM 非依存なので RN でもそのまま使える。
export default function WordBubbleMap({ words }: { words: WordFreq[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  const nodes = useMemo(() => {
    if (words.length === 0) return [];
    const root = hierarchy<{ children?: Datum[] }>({
      children: words.map((w) => ({ word: w.word, count: w.count, value: w.count })),
    }).sum((d) => (d as Datum).value ?? 0);
    pack<typeof root.data>().size([VIEW, VIEW]).padding(PADDING)(root);
    return (root.leaves() as unknown as HierarchyCircularNode<Datum>[]).filter((n) => n.r > 0);
  }, [words]);

  const opacityRange = useMemo(() => {
    if (nodes.length === 0) return { min: 1, max: 1 };
    const counts = nodes.map((n) => n.data.count);
    return { min: Math.min(...counts), max: Math.max(...counts) };
  }, [nodes]);

  if (words.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyMsg}>まだ声がない</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      {nodes.map((n, i) => {
        const { min, max } = opacityRange;
        const t = max === min ? 1 : (n.data.count - min) / (max - min);
        const opacity = 0.3 + 0.7 * t;
        const fontSizePx = Math.min(n.r * 0.55, 22);
        const showLabel = n.r >= LABEL_MIN_RADIUS;
        return (
          <G key={`${n.data.word}-${i}`} transform={`translate(${n.x},${n.y})`}>
            <Circle
              r={n.r}
              fill={colors.yuzuYellow}
              opacity={selected === i ? Math.min(1, opacity + 0.15) : opacity}
              onPress={() => setSelected(i)}
            />
            {showLabel && (
              <SvgText
                textAnchor="middle"
                dy={fontSizePx * 0.35}
                fontSize={fontSizePx}
                fontWeight="700"
                fill={colors.ink}
              >
                {n.data.word}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyMsg: { fontSize: fontSize.base, color: colors.inkMuted },
});
