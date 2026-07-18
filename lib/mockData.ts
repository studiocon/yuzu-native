// 管理者限定モックモード（ストア用スクショ撮影用）のコンテンツ本体。
//
// yuzu-app のバックエンド API は X-Yuzu-Mock ヘッダーを一切見ておらず（役割/権限に関わらず
// 常に本物のデータを返す）、モックはあくまで yuzu-app 側の Web クライアントがローカルで
// 差し替えているだけの機構だった。ネイティブ側にサーバー契約は存在しないため、この
// ファイルで LOG/INSIGHT の表示データをネイティブだけで完結して生成する
// （API 呼び出し自体を行わない。yuzu-app の lib/mockPosts.ts, lib/mockReports.ts,
// lib/themes.ts の内容を移植）。
import { jstHour, jstDateString, recentClosedPeriods, DAY_MS } from "./period";
import type { HeatmapCell, ReportMeta, ReportPayload, Theme, WordFreq } from "./insightTypes";
import type { Stats } from "./logsCache";
import type { Post } from "./types";

// daysAgo: 何日前か（0=今日）。0〜13 の全日に投稿があるため streak は途切れず14。
type Seed = { daysAgo: number; hour: number; minute: number; text: string; score: number };

const SEEDS: Seed[] = [
  { daysAgo: 13, hour: 23, minute: 11, text: "始めた。何も変わらないと思うけど、とりあえず声に出してる。", score: -0.05 },
  { daysAgo: 12, hour: 8, minute: 42, text: "朝が重い。布団が地面みたいに張り付いてくる。", score: -0.45 },
  { daysAgo: 12, hour: 22, minute: 30, text: "夜になると少しマシになる。なんでだろう。", score: 0.05 },
  { daysAgo: 11, hour: 13, minute: 5, text: "コンビニのコーヒー、思ったよりうまかった。", score: 0.35 },
  { daysAgo: 10, hour: 19, minute: 50, text: "今日は最悪。全部うまくいかなかった。寝る。", score: -0.7 },
  { daysAgo: 9, hour: 9, minute: 15, text: "電車で泣いてる人がいた。声かけられなかった自分が嫌だ。", score: -0.5 },
  { daysAgo: 9, hour: 21, minute: 0, text: "ご飯ちゃんと食べた。それだけで一日として成立する気がする。", score: 0.25 },
  { daysAgo: 8, hour: 11, minute: 22, text: "穏やか。特に何もない。これでいい。", score: 0.1 },
  { daysAgo: 7, hour: 16, minute: 40, text: "走った。息が切れて、頭が空になった瞬間がよかった。", score: 0.55 },
  { daysAgo: 6, hour: 0, minute: 8, text: "眠れない。なぜか過去の失敗ばかり再生される。", score: -0.55 },
  { daysAgo: 6, hour: 18, minute: 33, text: "友達と話した。笑えた。久しぶりに。", score: 0.6 },
  { daysAgo: 5, hour: 10, minute: 0, text: "雨。傘忘れた。でもまあ、濡れて歩くのも悪くなかった。", score: 0.15 },
  { daysAgo: 4, hour: 14, minute: 12, text: "仕事でミスした。怒られた。当然だ。", score: -0.4 },
  { daysAgo: 4, hour: 23, minute: 45, text: "ミスのこと、まだ引きずってる。でも明日は別の日。", score: -0.1 },
  { daysAgo: 3, hour: 12, minute: 30, text: "昼休み、空が異常に青かった。立ち止まって見た。", score: 0.45 },
  { daysAgo: 2, hour: 20, minute: 18, text: "今日はずっと機嫌が良かった。理由はわからない。", score: 0.65 },
  { daysAgo: 1, hour: 7, minute: 55, text: "また朝。ただ繰り返してるだけかもしれない。", score: -0.2 },
  { daysAgo: 1, hour: 22, minute: 10, text: "本物でいろ。それだけは守りたい。", score: 0.3 },
  { daysAgo: 0, hour: 9, minute: 30, text: "今日こそ何か残したい。意気込みすぎかな。", score: 0.2 },
  { daysAgo: 0, hour: 15, minute: 5, text: "最高、とは言わないけど、悪くない。", score: 0.4 },
];

function timestampFor(seed: Seed, now: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - seed.daysAgo);
  d.setHours(seed.hour, seed.minute, 0, 0);
  return d.getTime();
}

// 呼び出し時点の Date.now() を基準に seed する。スクショ撮影時に常に「直近14日分」に
// 見えるよう、モジュール読み込み時ではなく参照のたびに再計算する。
export function buildMockPosts(now: number = Date.now()): Post[] {
  const posts: Post[] = SEEDS.map((seed, i) => ({
    id: `mock-${String(i + 1).padStart(2, "0")}`,
    text: seed.text,
    index: i + 1,
    createdAt: timestampFor(seed, now),
    marked: false,
    durationMs: seed.text.length * 1200,
    charCount: seed.text.length,
  }));
  posts.sort((a, b) => b.createdAt - a.createdAt);
  return posts;
}

export function buildMockScores(): Record<string, number> {
  const scores: Record<string, number> = {};
  for (let i = 0; i < SEEDS.length; i++) {
    scores[`mock-${String(i + 1).padStart(2, "0")}`] = SEEDS[i].score;
  }
  return scores;
}

// today から連続する daysAgo が途切れるまでの日数。
function computeMockStreak(): number {
  const daysPresent = new Set(SEEDS.map((s) => s.daysAgo));
  let streak = 0;
  while (daysPresent.has(streak)) streak++;
  return streak;
}

export function buildMockStats(): Stats {
  const todayCount = SEEDS.filter((s) => s.daysAgo === 0).length;
  const totalDurationMs = SEEDS.reduce((sum, s) => sum + s.text.length * 1200, 0);
  return {
    streak: computeMockStreak(),
    todayCount,
    // 管理者限定機能のため null（無制限）扱い。lib/dailyLimit.ts 参照。
    maxDaily: null,
    totalCount: SEEDS.length,
    totalMinutes: Math.floor(totalDurationMs / 60000),
  };
}

// yuzu-app の lib/heatmap.ts の buildHeatmap を移植（"日 x 2時間帯" 集計 → DailyHeatmap 側で日次に再集計する）。
export function buildMockHeatmapCells(posts: Post[], days = 28, now: number = Date.now()): HeatmapCell[] {
  const dates: string[] = [];
  const dateSet = new Set<string>();
  for (let i = days - 1; i >= 0; i--) {
    const d = jstDateString(now - i * DAY_MS);
    dates.push(d);
    dateSet.add(d);
  }
  const cutoff = now - days * DAY_MS;

  const sums = new Map<string, number>();
  for (const p of posts) {
    if (p.createdAt < cutoff) continue;
    const date = jstDateString(p.createdAt);
    if (!dateSet.has(date)) continue;
    const bucket = Math.floor(jstHour(p.createdAt) / 2);
    const key = `${date}|${bucket}`;
    sums.set(key, (sums.get(key) ?? 0) + (p.text?.length ?? 0));
  }

  const cells: HeatmapCell[] = [];
  for (const date of dates) {
    for (let bucket = 0; bucket < 12; bucket++) {
      cells.push({ date, bucket, charCount: sums.get(`${date}|${bucket}`) ?? 0 });
    }
  }
  return cells;
}

// WORDS バブルマップ用。実データは形態素解析（TinySegmenter）が要るため、
// スクショの見た目を優先してモック投稿の主題に沿った語をそのまま用意する。
export const MOCK_WORDS: WordFreq[] = [
  { word: "本物", count: 6 },
  { word: "仕事", count: 5 },
  { word: "朝", count: 5 },
  { word: "友達", count: 4 },
  { word: "コーヒー", count: 4 },
  { word: "ミス", count: 3 },
  { word: "青空", count: 3 },
  { word: "眠れない", count: 3 },
  { word: "散歩", count: 2 },
  { word: "笑う", count: 2 },
  { word: "雨", count: 2 },
  { word: "電車", count: 1 },
];

// yuzu-app の lib/themes.ts MOCK_THEMES をそのまま移植（mockPosts.ts の内容に対応した例）。
export const MOCK_THEMES: Theme[] = [
  { theme: "他人の評価", description: "怒られたこと、ミスのことを何度も書き残している。気にしすぎだ。", count: 6 },
  { theme: "本物への執着", description: "「本物でいろ」と自分に何度も言い聞かせている。", count: 4 },
  { theme: "夜の反芻", description: "眠れない夜に過去の失敗を再生してしまう癖がある。", count: 3 },
  { theme: "小さな救い", description: "コーヒー、青空、笑い、走った瞬間—断片に救われている。", count: 5 },
];

type ReportSample = {
  headline: string;
  topics: string[];
  fact: string;
  proof: string;
  shadow: string;
  advice: string;
  adviceDetail: string;
};

// yuzu-app の lib/mockReports.ts SAMPLES をそのまま移植。
const REPORT_SAMPLES: ReportSample[] = [
  {
    headline: "怒りを置きにいった一週間。",
    topics: ["仕事のミーティング", "家族", "寝不足", "通勤"],
    fact:
      "疲労と苛立ちの語彙が中心の一週間だった。「だるい」「もう無理」「うるさい」といった短く強い言葉が、平日の朝と夜に集中して出ている。火曜のミーティング後と木曜の深夜に最も強い言葉が現れていた。\n\n一方で土曜の散歩や日曜の家族との時間では、声のトーンが落ち着き、文末が長くなる場面もあった。怒りが場面ではなく時間帯に強く紐づいていた一週間と言える。",
    proof: "火曜、ミーティングの追加依頼を一度保留にした。土曜は散歩に出た。日曜は家族と過ごす時間を確保した。",
    shadow:
      "怒りの言葉の裏に「もう判断したくない」という疲弊感がうっすら通っている可能性がある。仕事での要求に「断る」選択肢を最初から外していて、抱えること自体が前提になっているように読める。\n\nまた、家族や同僚への苛立ちも、相手そのものより「自分が休めていないこと」への怒りが投影されているように見える。本人が言葉にしていない核は「休ませてほしい」という願いかもしれない。",
    advice: "来週、一度だけ「断れ」。",
    adviceDetail:
      "全部断れ、ではない。優先度の低い1件だけでいい。判断を放棄せず、自分の側から「やらない」を選ぶ感覚を取り戻すための練習だ。\n\n断った後で罪悪感が出ても、それは健全な反応として記録に残しておくこと。怒りより先に「断れる」を増やす方が、根本の疲弊には早く効く。",
  },
  {
    headline: "凪。たまに笑った。",
    topics: ["散歩", "本", "同僚"],
    fact:
      "感情の振れ幅が小さい一週間だった。「悪くない」「まあまあ」「特に何もない」という、判断を保留する語彙が多い。前週に比べてネガティブの言葉は減ったが、明確な喜びの記述も少ない。\n\n例外は水曜の同僚との会話と、土曜に読み終えた本についての投稿で、ここでは語数も増え、文末も柔らかくなっていた。日常の中に小さな波が確かに立っていた。",
    proof: "水曜、同僚と会話した。土曜、本を読み終えた。",
    shadow:
      "穏やかさを評価していない可能性がある。「これでいい」と書いてはいるが、その裏に「これだけでいいのか」という物足りなさが薄く混じっているように読める。\n\n安定を退屈と取り違えると、わざわざ波を起こしにいって自分を消耗させる動きが出やすい。今は意識的に「凪を凪のまま味わう」フェーズかもしれない。",
    advice: "退屈を埋めにいくな。",
    adviceDetail:
      "刺激を探しに行くより、今ある凪を観察に回したほうがいい週だ。散歩や読書のように、自分が落ち着く対象に時間を寄せる方向で十分。\n\n何かを始めるなら、消費ではなく、長く続けられる小さな習慣を一つだけ。派手な変化は今週に必要ない。",
  },
  {
    headline: "出だしから走った。疲れも残った。",
    topics: ["新プロジェクト", "通勤", "睡眠"],
    fact:
      "前向きな宣言と疲労の訴えが交互に並んだ一週間だった。月曜・火曜は「やってやる」「楽しい」といった攻めの言葉が出ていたが、水曜以降は「眠い」「重い」「朝がきつい」が増えていく。\n\n金曜の夜には満足感のある投稿もあるが、その前後に体調についての言及が挟まる。やる気と消耗が同じ時間軸の上で並走している状態と言える。",
    proof: "月曜・火曜、新プロジェクトの作業を進めた。金曜の夜、作業を切り上げて休んだ。",
    shadow:
      "やる気の裏に、燃え尽きへの予感がうっすらある。新しいプロジェクトを評価される機会と捉え、結果を急ぎたい気持ちが強く出ているように読める。\n\n同時に「ペース配分すべき」という認識自体は持っているのに、それを口にした瞬間に怠けたと感じてしまう自己評価の癖が見える。本当はもう少し休んでいい、と自分に許可が出せていない。",
    advice: "週末、何もしない時間を1つ確保しろ。",
    adviceDetail:
      "30分でも1時間でもいい。スケジュールに「何もしない」と書いて、その時間を約束として守ること。生産性ではなく、回復のための予定だ。\n\nそれを罪悪感なくやれた週は、翌週の集中の質が上がる。走り続ける戦略より、止まれる戦略のほうがこのプロジェクトには効く。",
  },
  {
    headline: "出すより、抱えた月。",
    topics: ["引っ越し", "別れ", "沈黙", "本", "夜"],
    fact:
      "投稿の総数は維持されているが、一つひとつの語数が短くなった月だった。事実を書いて止まる投稿が増え、感情を名指す言葉は明確に減っている。\n\n中盤の引っ越しと別れに関する投稿では、起きた出来事だけが淡々と並べられ、感想が省かれている。夜の時間帯に書かれた投稿が増えており、言葉になる前の何かを抱えながら一日を閉じていた様子がうかがえる。",
    proof: "引っ越しの手続きを終えた。投稿は毎日続けた。",
    shadow:
      "言葉にしないことを選んでいる可能性がある。整理がついていないというより、整理する前にひとまず置いておく、というモードに入っているように読める。\n\nただし「置いている」という自覚自体が薄い場合、未処理感が漠然とした疲れや焦りとして表に出やすい。何を抱えているのか、輪郭だけでも引いてみると軽くなる余地がある。",
    advice: "整理を急ぐな。並べるだけでいい。",
    adviceDetail:
      "意味づけや結論を出そうとしなくていい。あったこと、感じたかもしれないこと、まだ分からないこと、を順に並べるだけで十分だ。\n\n並べてみて初めて、自分が何にこだわっていたかが見える。今月はその「並べる」だけを来月に渡す準備期間と捉えていい。",
  },
];

function fakeSentimentSeries(start: number, end: number): { date: string; score: number }[] {
  const days = Math.max(1, Math.round((end - start) / DAY_MS));
  const out: { date: string; score: number }[] = [];
  for (let i = 0; i < days; i++) {
    const ts = start + i * DAY_MS;
    out.push({ date: jstDateString(ts), score: Math.sin(i * 1.1 + start) * 0.55 });
  }
  return out;
}

// yuzu-app の lib/mockReports.ts buildMockReportMetas/buildMockReport を移植。
export function buildMockReportMetas(now: number = Date.now()): ReportMeta[] {
  const periods = recentClosedPeriods(now, 4);
  return periods.map((p, i) => {
    const s = REPORT_SAMPLES[i % REPORT_SAMPLES.length];
    return {
      periodKey: p.key,
      kind: p.kind,
      rangeStart: p.start,
      rangeEnd: p.end,
      label: p.label,
      generated: true,
      headline: s.headline,
      topics: s.topics,
      postCount: p.kind === "week" ? 6 : 22,
      payload: { ...s, sentimentSeries: fakeSentimentSeries(p.start, p.end) },
    };
  });
}

export function buildMockReportPayload(periodKey: string, now: number = Date.now()): ReportPayload | null {
  const metas = buildMockReportMetas(now);
  const idx = metas.findIndex((m) => m.periodKey === periodKey);
  if (idx < 0) return null;
  const s = REPORT_SAMPLES[idx % REPORT_SAMPLES.length];
  const meta = metas[idx];
  return {
    headline: s.headline,
    topics: s.topics,
    fact: s.fact,
    proof: s.proof,
    shadow: s.shadow,
    advice: s.advice,
    adviceDetail: s.adviceDetail,
    sentimentSeries: fakeSentimentSeries(meta.rangeStart, meta.rangeEnd),
  };
}
