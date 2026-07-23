<!--
  YAML frontmatter: design tokens のソースオブトゥルース。
  CI が `scripts/check-design-drift.mjs` で `app/globals.css` の :root と突合する。
  値を変えるときは CSS と frontmatter の両方を更新すること。

  NOTE: デザインシステムの実体プレビューは public/design-preview.html。
        プレビューを編集したら DESIGN.md / app/globals.css / components の3点に同期する。
-->
---
name: YUZU
tagline: BE TRUE
tagline_ja: 本物でいろ
typography:
  display: Unbounded
  body: LINE Seed JP
cssVars:
  # YUZU Primary
  --yuzu-yellow:      "#F5D84A"
  --yuzu-zest:        "#E8A020"
  --yuzu-white:       "#FAFAF5"
  # Text
  --ink:              "#1A1A2E"
  --ink-secondary:    "#4A4A6A"
  --ink-muted:        "#9A9ABA"
  # Surface
  --surface-card:     "#fff"
  --surface-border:   "#E8E0C8"
  --surface-hover:    "#FFF5CC"
  --divider:          "#EDEAE0"
  --icon-bg:          "rgba(26, 26, 46, 0.06)"
  --mood-low:         "#2E3A66"
  # Easing
  --ease-organic: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  --ease-soft:    "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
  --ease-snap:    "cubic-bezier(0.68, -0.55, 0.27, 1.55)"
  # Type scale
  --text-xs:   "11px"
  --text-sm:   "13px"
  --text-base: "15px"
  --text-lg:   "18px"
  --text-xl:   "24px"
  --text-2xl:  "32px"
  --text-3xl:  "48px"
  # Radius（角丸は最小限。0 / 2px / 9999px のみ。ボタン類の 4px は個別指定）
  --radius-0:     "0px"
  --radius-sharp: "2px"
  --radius-pill:  "9999px"
  # Font stacks
  --font-body: 'LINE Seed JP', "Hiragino Kaku Gothic ProN", Meiryo, sans-serif
---

> **ネイティブ版での位置づけ（yuzu-native 固有の注記。この節は yuzu-app 側には無い）**
>
> このファイルは `studiocon/yuzu-app` の `DESIGN.md`（source commit `3cd9395`, 2026-07-12）を
> そのまま移植したもの。**正典は引き続き yuzu-app 側**。以下の点に注意して読むこと。
>
> - CSS 変数・`app/globals.css`・`.tsx` パス（例: `components/EmotionChart.tsx`）は yuzu-app（Next.js/Web）のもの。
>   yuzu-native では同名の `components/*.tsx`（React Native）が対応実装を持つ場合が多いが、
>   CSS ではなく `StyleSheet` + `react-native-svg` で実装される。トークンの値（色・角丸・easing）は共通、
>   実装手段（CSS custom property / SVG gradient 等）は native 側で変わりうる。
> - §12「メンテナンス（自動チェック）」の `npm run design:check` / CI は yuzu-app 専用。yuzu-native にはこの
>   自動チェックは無い（`.claude/skills/design-review/` で手動レビューする。後述）。
> - **ネイティブ側の意図的な差分**（正典から意図的に外れている箇所。取り込み漏れではない）:
>   - §6「感情分析チャート」: ポジティブ側端点色 `SENTIMENT_POS` が正典の `--yuzu-zest` (#E8A020)
>     ではなく `--yuzu-yellow` (#F5D84A)（`lib/sentimentColor.ts`）。SIGNAL ウィジェット・ヒートマップと
>     色言語を揃えるための乖離で、共有スケールなので LOG 投稿カード左端バー・REPORTS エッジバーにも波及する。
>     グラデーション構造（`<linearGradient>` 縦・ゼロラインに向かって減衰）は正典どおりだが、イエローは
>     薄いと背景に溶けるため pos 側の不透明度を正典の 0.62→0.18 から 0.85→0.22 に変更している
>     （`EmotionChart.tsx` / `ReportCard.tsx`。一時期は単色 solid fill だったが 2026-07-20 にグラデへ復帰）。
>   - §6「時間帯ヒートマップ」（683行目付近）: yuzu-native の SIGNAL セクションは日×2時間バケットの
>     `TimeHeatmap` ではなく、GitHub 風の日次カレンダー `DailyHeatmap`（`components/DailyHeatmap.tsx` /
>     `lib/dailyHeatmap.ts`）。表示範囲は「今日を含む週から遡って16週」固定、セル上限 20px。
>     セル色（投稿あり `--yuzu-yellow` opacity 0.2〜1.0 / なし `--divider`）は正典の思想を踏襲。
>   - 録音完了画面（[components/RecordModal.tsx](components/RecordModal.tsx) の `CompleteView`）: 正典は
>     `RecordModal.tsx` 側の常時表示 top-left X（`record-modal-close`）と `CompleteView.tsx` 自身の
>     bottom「閉じる」ボタン（`complete-back-btn`）を**両方同時に表示**するが、yuzu-native は bottom
>     ボタンを廃止し top-left X 一本化（実機フィードバックで bottom ボタンの領域が広すぎると指摘され
>     2026-07-21 に変更）。閉じる操作の到達手段は正典・native とも X アイコン + accessibilityLabel「閉じる」
>     で共通。
>   - サインイン画面ブランドヘッダー（[components/AuthScreen.tsx](components/AuthScreen.tsx)）: §3 フォント
>     適用ルール（140行目付近、「ロゴ『YUZU』| Unbounded | 900」）はテキスト表現を規定するが、yuzu-native は
>     `components/YuzuLogo.tsx`（`public/logo.svg` のベクターパスを react-native-svg で移植、ゆず黄バッジ+
>     墨色ワードマーク）によるグラフィック表現に変更（2026-07-21）。正典 yuzu-app にはこの画面に直接対応する
>     全画面ログインが無く（対応する `LoginModal.tsx` は既存ページ上のモーダルでブランド表現を持たない）比較
>     対象が無いため、これは既存ルールからの新規逸脱として記録する。§3 のロゴテキスト規定はスタッツ数値・
>     タブラベル等の他の Unbounded 用途には引き続き適用される。

# YUZU - Design Document

> BE TRUE / 本物でいろ

---

## 1. デザインコンセプト

### 世界観

**「整っていない。それが本物だ。」**

加工しない。整えない。ナマのまま。
装飾を削ぎ落とすこと自体が `Raw` の表現になる。
YUZU の世界観は **THE RECORD**。
比喩を持たず、声が信号として記録される装置そのものをデザインする。

### プロダクトの態度

YUZU は **ミラー（突きつける）** であって、サポーター（隣で励ます）ではない。
muute が "肩を抱く" のに対し、YUZU は "胸ぐらを掴む"。
答えを返さない・介在しない潔さが、デザイン全体を貫く原則。

### キーワード

```
Raw          → 加工なし・生っぽさ・ナマ
Cool         → かっこいい習慣・ライフスタイル
Swiss Grid   → グリッド・余白・タイポ駆動
Provocative  → 挑発的・断定的・命令形（NIKE 寄り）
```


---

## 2. カラーパレット

CSS変数として [app/globals.css](app/globals.css) の `:root` に定義。
新世界観では **ゆず黄を信号色** として極端に絞って配置し、それ以外は無彩色で構成する。

```css
/* YUZU Primary */
--yuzu-yellow: #F5D84A;   /* ゆず黄：信号色・アクセント */
--yuzu-zest:   #E8A020;   /* 完熟オレンジ：録音中・強調 */
--yuzu-white:  #FAFAF5;   /* オフホワイト：背景単色 */

/* Text */
--ink:           #1A1A2E;
--ink-secondary: #4A4A6A;
--ink-muted:     #9A9ABA;

/* Surface / Divider */
--surface-card:   #fff;
--surface-border: #E8E0C8;
--surface-hover:  #FFF5CC;
--divider:        #EDEAE0;  /* リスト・カード区切りの最弱罫線。--ink-muted より十分薄い */
```

### 罫線の使い分け

リスト要素や軽い区切りは `--divider` を使う。`--ink-muted` をボーダーに使うとリストが並んだとき視覚的にうるさくなるため、テキスト用に留める。

### 背景

**オフホワイト単色 `#FAFAF5`** のみ。ゆず黄が信号として浮く構造。

```css
body { background: var(--yuzu-white); }
```

---

## 3. タイポグラフィ

- 英字・ロゴ・タブラベル・スタッツ数値・状態ラベル: **Unbounded**（`--font-display`、`font-weight: 700` 基本、ロゴは `900`、極端に大きく画面端まで攻める）
- 日本語本文・コピー・タイムスタンプ: **LINE Seed JP**（`--font-body`、`font-weight: 400 / 700`）

LINE Seed JP のジオメトリックで角丸な骨格はミニマル・スイス美学と親和性が高く、日本語の表情を保ちつつ無装飾を支える。

フォント読み込みは [app/layout.tsx](app/layout.tsx) で以下の二系統：

- **Unbounded** — `next/font/google` 経由で CSS 変数 `--font-display` を `<html>` に注入。
- **LINE Seed JP** — Google Fonts CDN を `<link rel="stylesheet">` で読み込む（Next 14.2 の `next/font/google` 内蔵リストに LINE Seed JP が未収録のため CDN 直読み）。`--font-body` は [app/globals.css](app/globals.css) の `:root` で `'LINE Seed JP', system-fallback…` を定義。

グローバル CSS と個別クラスは必ず `var(--font-display)` / `var(--font-body)` 経由で参照し、ハードコードされた `'LINE Seed JP'` 等は使わない。

### フォント適用ルール

| 対象 | フォント | ウェイト |
|---|---|---|
| ロゴ「YUZU」 | Unbounded | 900 |
| タグライン「BE TRUE」 | Unbounded | 700 |
| タグライン（日）「本物でいろ」 | LINE Seed JP | 700 |
| タブラベル・状態ラベル（英語） | Unbounded | 700 |
| スタッツ数値 | Unbounded | 700 |
| 日本語UI・投稿テキスト・プロンプト | LINE Seed JP | 400 / 700 |
| タイムスタンプ | Unbounded | 400 |

### 段組ルール

- **デフォルトは左揃え**（見出し・本文・空状態テキストを含む）
- **中央揃えは例外的に許容**：以下のケースのみ。それ以外は左揃え。
  - スタッツカード（DAY / RECORDS / STREAK）— 数字とラベルの縦組み
  - マイクボタン（FAB／モーダル内ヒーロー）の正円タップターゲット
  - アイコンボタン内のグリフ
- 段落間は余白で区切る（罫線・装飾は使わない）

サイズスケール: `--text-xs` (11) / `sm` (13) / `base` (15) / `lg` (18) / `xl` (24) / `2xl` (32) / `3xl` (48)。

---

## 4. Voice & Tone

### ブランドトーン

```
短く・力強く・断定的
命令形を恐れない（NIKE 寄り）
詩的にならない・スピリチュアルにならない
フラットでわかりやすい
英語と日本語を意図的に使い分ける
```

### 英日使い分け

- **英語＝Unbounded＝挑発・状態**：`RECORDING` / `CARVING` / `CARVED` / `DAY` / `RECORDS` / `STREAK`（状態 pill は UI なので**句点なし**）
- **日本語＝LINE Seed JP＝事実・本文・プロンプト**：プロンプト（過去/現在/未来 各10）・エラー・タグライン・本文UI

### 状態英語の語幹と時制

YUZU では **語幹** が「何の行為か」、**時制** が「進行か完了か」を意味する。両者は意図的に区別する（**いずれも状態 pill ＝ UI なので句点なし**）：

| 語幹 | -ING（進行中） | -ED（完了） | 意味 |
|---|---|---|---|
| **RECORD** | RECORDING | — | 録音（音声キャプチャ）。完了は CARVE 側で刻印する |
| **CARVE** | CARVING | CARVED | 声→テキスト変換 / 刻印完了（投稿が成立した状態） |
| **SAVE** | SAVING | — | 画像・データの書き出し |
| **SILENCE** | — | SILENCE | 沈黙の刻印（無投稿日） |
| **MARK** | — | MARKED | カードのピン留め完了 |
| **COPY** | — | COPIED | クリップボードへコピー完了 |

**メタルール**：
- 状態ナラティブは **`RECORDING`（録音中）→ `CARVING`（変換中）→ `CARVED`（刻まれた・完了）** で統一。世界観は一貫して「刻む」。
- `RECORD` / `RECORDS` は LOG 一覧・アーカイブ・通し番号 `#NNN` を指す**名詞**として残す（状態語 `RECORDED` は引退）。
- 完了スタンプはオンボーディング（未ログイン）もログイン後も共通で `CARVED`。
- 進行中状態は英語のみで日本語化しない（pill / バッジ）

### muute との対比

| 軸 | muute | YUZU |
|---|---|---|
| 動詞 | 寄り添う・気づく | 話せ・出せ |
| 主語 | あなた | YOU（記号化） |
| 文末 | 〜ですね、〜しよう | 〜だ。〜しろ。 |
| 装飾 | やわらかい絵文字 | 句点（.）は説明文のみ（UI は句点なし） |
| 比喩 | 自然・植物・育つ | 信号・記録・刻印 |

ビジュアル軸でも同様。muute（パステル・水彩・キャラクター）／ Awarefy（ブルー・医療的・グラフ）に対し、YUZU は **単色オフホワイト + 信号黄 + 黒・グリッド・タイポ駆動**。参照群はジャーナリングアプリではなく、Swiss / NIKE / Patta / A-COLD-WALL\* / Off-White / Acne Studios。

### 句点ルール

**句点（. / 。）が付くのは「状況を説明する本文」だけ。** ＝複数文で状況・結果を述べる説明 / トースト / 丁寧語のエラー / 叙述的な本文（例：「今日はここまで。明日また話せ。」「削除できなかった。もう一度。」「記録も、番号も、戻らない。」ContactModal の問い合わせエラー）。

**それ以外の UI はすべて句点なし。** 見出し・ページ名・セクション見出し・モーダルタイトル / サブタイトル（単文命令）・ボタン・フィルタ・**英語の状態 pill / バッジ**（`RECORDING` / `CARVING` / `CARVED` / `SILENCE` / `SAVING` / `LOADING` / `PREVIEW` / `{N} LEFT` 等）・短い命令や空状態の単文（`話せ` / `無音、話せ` / `MARK されたものは無い`）・カード見出し・操作直後フラッシュ（`MARKED` / `COPIED`）。

判定テスト：
1. 状態・命令・ラベル・見出し（英語 pill 含む、**単文**）→ 句点なし
2. 空状態テキスト → 句点なし
3. 状況・結果を述べる叙述（特に**複数文**や丁寧語の説明・エラー）→ 句点あり

### NGワード

```
「癒し」「寄り添う」「頑張ろう」     → muute っぽい
「育つ」「林」「種」「香り」「果実」 → YUZU の世界観に反する
「やさしく」「ふんわり」「あなたらしく」→ ミニマルに反する
「入力」「テキスト」「記録する」      → ツールっぽい（「話す」に統一）
「気づき」「自分を知ろう」           → 意識高い系
```

### UIコピー

**コードを正とする**（実装と乖離したらコードに合わせて更新する）。

**録音フロー（RecordModal / CompleteView）**

| 場所 | コピー |
|---|---|
| 待機（マイクボタン下） | 長押し。話せ |
| 録音中 | RECORDING |
| 変換中（声→テキスト） | CARVING |
| 投稿完了 | CARVED |
| マイク不許可 | マイクを許可しろ |
| 音声なし | 無音、話せ |
| 短すぎ | 短い、話せ |
| 完了画面 STATS | MINUTES / STREAK |
| 完了画面 閉じる | 閉じる |
| 1日上限到達（3/3） | 今日はここまで。明日また話せ。 |
| 残り回数（<3 のとき） | `{N} LEFT` |

**オンボーディング（未ログイン）**

| 場所 | コピー |
|---|---|
| 見出し（hero） | 声を刻め |
| サブ | 長押しで話せ |
| 変換完了（未保存） | CARVED |
| 保存ボタン | 刻む |
| 再録音ボタン | もう一度 |

**LOG タブ（IndexView / RecordCard）**

| 場所 | コピー |
|---|---|
| STATS ラベル | RECORDS / MINUTES / STREAK |
| INDEX 通し番号（identity 兼） | `#NNN`（ゼロ埋め3桁） |
| RECORDS フィルタ | ALL / MARKED |
| タイムライン日付区切り | TODAY / YESTERDAY / `M.D DOW`（例 `6.18 THU`） |
| タイムライン空（ALL） | 話せ |
| MARKED 空表示 | MARK されたものは無い |
| 追加読み込み中 | LOADING |
| MARK 操作直後 | MARKED |
| COPY 操作直後 | COPIED |
| 沈黙の刻印（録音なし日） | SILENCE |
| INDEX 詳細 STATS | LENGTH（録音時間 ○:○○）/ DAY（○ 日目） |

**INSIGHT タブ（InsightView ほか）**

| 場所 | コピー |
|---|---|
| セクションラベル | EMOTION / SIGNAL / WORDS / PATTERN / REPORTS（句点なし・Unbounded） |
| 全セクション ロード中 | 読み取り中 |
| 全セクション エラー | 失敗、話せ |
| EMOTION プレビュー（データ不足） | PREVIEW |
| WORDS / SIGNAL 空表示 | まだ声がない |
| SIGNAL Tooltip | `MM/DD HH:00 / N CHARS`（HH はバケット先頭時刻 00/04/08/12/16/20） |
| PATTERN 投稿不足（< 10件） | もっと話せ、パターンが見えてくる |
| PATTERN テーマなし | まだパターンがない |
| PATTERN 順位 / シェア率 | `#N`（--ink-muted）/ `NN%`（--ink） |
| REPORTS 空（見出し / 説明） | NOTHING TO READ YET / 沈黙は記録されない、話せ |
| REPORTS 種別バッジ | WEEK（ゴースト）/ MONTH（塗り） |
| REPORTS 期間スパン | `M/D–M/D`（WEEK）/ `M月`（MONTH） |
| レポート生成中 | 読み取り中 |
| レポート生成失敗 | 失敗、話せ |

**レポート詳細（ReportDetail）**

| 場所 | コピー |
|---|---|
| セクション見出し | EMOTION / TOPICS / FACT / PROOF / SHADOW / ADVICE |
| 投稿なしの期間 | この期間は何も無い |
| 進行中の期間 | まだ進行中の期間だ |
| 再試行ボタン | RETRY |

**ログイン（LoginModal）**

| 場所 | コピー |
|---|---|
| 大見出し（ステップ別） | SIGN IN → MAIL → SENT |
| OAuth ボタン | Apple で続ける / Google で続ける |
| Magic Link 導線 | メールで続ける |
| メール送信ボタン | 送れ（送信中 …） |
| 入力に戻る | 戻る |
| 送信エラー | 送れなかった。もう一度。 |

**マイルストーン共有（SignalCardModal）**

| 場所 | コピー |
|---|---|
| カード見出し | `DAY {N}` / `VOICE {N}` |
| 画像保存ボタン | 画像を保存（保存中 SAVING） |

**設定・アカウント削除（settings / DeleteAccountModal）**

| 場所 | コピー |
|---|---|
| 削除導線（行） | アカウントを削除 |
| 確認モーダル見出し | 全部消す |
| 確認モーダル本文 | 記録も、番号も、戻らない。 |
| 入力プロンプト | YUZU と打て |
| 実行 / 取消ボタン | 消す（削除中 削除中…）/ やめる |
| 削除失敗 | 削除できなかった。もう一度。 |

**グローバルエラー（app/global-error.tsx / app/error.tsx）**

| 場所 | コピー |
|---|---|
| 見出し | BROKEN |
| 本文 | 壊れた。読み込み直せ。 |
| ボタン | RELOAD |

### 投稿促進プロンプト

マイクボタン上にランダム表示。毎セッションで変わる。実体は [lib/prompts.ts](lib/prompts.ts)。
**過去 / 現在 / 未来 の 3 系統 × 各 10 = 30 件**。命令形・断定形で「整える前の声」を引き出す。代表例：

```javascript
// lib/prompts.ts（抜粋。全 30 件はファイルを参照）
過去: '言ってないことは？', '引きずっていることはあるか？', '後悔してることはあるか？'
現在: '今、一番気になってることは？', '黙ってる場合か？', '10秒でいい。出せ。'
未来: '本当にやりたいことはなんだ？', '明日、一つだけ変えるとしたら？', '理想の自分はなんだ？'
```

---

## 5. フォームとシェイプ

新世界観では **直線・矩形・グリッド**。角丸は最小限。

```css
--radius-0:     0px;   /* グリッド要素・カード */
--radius-sharp: 2px;   /* ボタン・入力等 */
--radius-pill:  9999px; /* マイクボタン（正円） */
```

シグネチャーシェイプ「歪んだ楕円（blob）」は使わない。`--blob-*` / `--blob-soft-*` トークンおよび `blob-pulse` アニメは実装から除外している。

### シャドウ

**`box-shadow` は使わない。** 浮き出し・ふんわりした立体感はミニマル／スイス美学に反する。階層は罫線（`--divider` / `--surface-border`）と余白だけで作る。`filter: drop-shadow` も同様に避ける。

**例外は「録音アフォーダンス」の Liquid Glass 質感のみ**。背景から物理的に浮く必要がある録音ボタン系に限り、`box-shadow: 0 10px 30px rgba(26,26,48,0.10), 0 2px 8px rgba(26,26,48,0.06), inset 0 1px 0 rgba(255,255,255,0.5)` + `border: 1px solid rgba(255,255,255,0.6)` を許容する。許可セレクタは次の 3 つだけ：

1. `.tab-bar`（下部ドックのタブ pill）
2. `.fab-record`（下部ドックの録音 FAB・64px）
3. `.onboarding-mic`（オンボーディングの録音ボタン・96px。`.fab-record` と同じ録音アフォーダンス家族）

これ以外（カード・ボタン・モーダルなど通常コンポーネント）には絶対適用しない。`filter: drop-shadow` も使わない。

---

## 6. コンポーネント

### マイクボタン (`.mic-button` in [globals.css](app/globals.css))

| 状態 | 外観 |
|---|---|
| デフォルト | **正円** + `--yuzu-yellow` 背景 + 🎤 |
| ホバー | わずかに拡大（scale 1.04） |
| 録音中 (recording) | `--yuzu-zest` + 同心円リング |
| 変換中 (busy) | スピナー |

形状は固定の正円。「blob モーフィング」「blob-pulse」は使わない。

### 投稿カード (`.post-card`) — v2.3 Raw 矩形 + 感情カラー

```
┃┌──────────────────────────────────────┐
┃│ #020                           1:24  │ ← 1行ヘッダー（index 左 / 長さ 右）
┃│ 最高、とは言わないけど、悪くない。     │ ← 本文（~5 行で省略）
┃│ ▂▄▆▃▅▇▂▄▆▃▅▇▂▄                       │ ← 声紋バー（録音長に比例）
┃└──────────────────────────────────────┘
↑ 感情カラー左端バー（3px・無発光）
```

- アイコン・名前は **持たない**（identity は `#NNN` のみ）
- 1行ヘッダーは **`#NNN`（左）+ 録音長 `m:ss`（右）の2点配置**（`justify-content: space-between`）。`#NNN` は Unbounded 700 / `--ink-muted`、録音長は Unbounded 500 / `--ink-muted`（index より弱く、識別子を主役に保つ）。`durationMs <= 0` の旧データは録音長を出さず左揃えのまま崩れないこと（graceful）。**絶対日付・タイムスタンプはカードに持たない**（§8「タイムライン」のセクション区切りに集約。重複表示を避ける）。**MARK / COPY ボタンはカードに置かない**（詳細モーダル側へ集約）。
- **左端に感情カラーバー**（`.post-card-edge`、幅3px・`background` のみで `box-shadow` は使わない）。その投稿の感情スコア（-1.0〜1.0）を [lib/sentimentColor.ts](lib/sentimentColor.ts) の共通スケール（紺→中立グレー→オレンジ）で着色。スコア未解析（INSIGHT 未訪問など）は色を出さず中立のまま。
- 本文下に **声紋バー**（`.post-voiceprint`、`durationMs` に比例した本数の極細バー、id 由来の決定的擬似乱数で形を固定）。`durationMs <= 0` は非表示。
- 本文は LINE Seed JP（`--ink`）。**一覧では `-webkit-line-clamp: 5` で ~5 行に省略**（全文は詳細モーダルで読む）。
- **カード全体がタップ範囲**（`.post-card--tappable`）。タップ／Enter／Space で INDEX 詳細モーダルを開く。`role="button"` + `tabIndex={0}`、`:hover` は `--surface-hover`、`:focus-visible` は `--yuzu-yellow` アウトライン。
- 角丸は `--radius-sharp`（2px）。`border-top: 1px solid var(--divider)`。MARK 済みは `border-top-color: var(--yuzu-zest)`（左端の感情カラーバーとは別軸で共存）。
- blob 形状・ホバー時モーフィング・box-shadow は使わない。

### INDEX 詳細 (`.index-detail-modal` in [components/IndexDetailModal.tsx](components/IndexDetailModal.tsx)) — v2.4

投稿カード（カード全体）をタップすると開く全画面モーダル（`--ink` 背景・白文字）。

```
┌──────────────────────────────────────┐
│                                  [×] │
│┃#042                                 │ ← identity（縮小・--yuzu-yellow）。左端 3px バーが感情色
│┃▁▃▅▂▆▃▇▄▂▅▃▆ 声紋ヒーロー（感情色）   │ ← 録音長に比例・感情スコアで着色
│┃2026.05.29 (木) 23:11                │ ← スタンプ（曜日入り）
│  ┌────────┐ ┌────────┐ ┌────────┐    │ ← 事実 STATS（3枚）
│  │ LENGTH │ │ DAY    │ │ CHARS  │    │
│  │ 1:24   │ │ 14     │ │ 87     │    │
│  └────────┘ └────────┘ └────────┘    │
│  今日はずっと[機嫌]が良かった。       │ ← 本文（WORDS 自動ハイライト）
│                                      │
│  明日も同じならいい。                 │
│  ┌────────┐ ┌────────┐               │
│  │📌 MARK │ │⧉ COPY  │               │ ← 操作行（MARK / COPY）
│  └────────┘ └────────┘               │
└──────────────────────────────────────┘
```

- **役割は「その1件の RECORD をじっくり読む場」**（一覧＝眺める／詳細＝読む、の役割分離）。一覧カードの視覚語彙（感情カラー・声紋）を**主役級に拡大**して「開く価値」を視覚で作る。
- **見出し帯**（`.index-detail-band`）が `#NNN`・声紋ヒーロー・スタンプをまとめる。色の付け方は**一覧カードの `.post-card-edge` と同じ左端 3px バー**（`.index-detail-band-edge`）で統一する。score 未解析なら無色（graceful）。**背景グラデは使わない**（試した結果、上部に意味のない塗り面ができて視覚的に浮くため v2.4 で撤回）。`box-shadow` も使わない。
- `#NNN` は identity の核として残すが、過剰にならないようサイズを抑える（`clamp(64px, 18vw, 120px)`）。
- **感情カラー声紋ヒーロー**（`.index-detail-voiceprint`）：一覧カードの `.post-voiceprint` を高さ 80px に拡大したもの。バー高さは id シードで決定的（[lib/voiceprint.ts](lib/voiceprint.ts) を一覧カードと共有）、色は `sentimentColor(score)`（紺↔オレンジ。未解析は白の低 alpha）。開いた瞬間に下から立ち上がる（`prefers-reduced-motion` で無効）。
- 事実 STATS は最大 3 枚：`LENGTH`（録音時間 `m:ss`）/ `DAY`（登録から何日目か）/ `CHARS`（文字数・`useCountUp` で 0→値）。`CompleteView` の `.complete-stat-*` と同じダーク表現（白文字・`rgba(255,255,255,.18)` 罫線・角丸 `--radius-sharp`）。値は 36px（完了画面の 44px より控えめ）。算出不能な項目はカードごと出さない。
- 本文は **読みやすく整形**：「。」直後で段落（`.index-detail-para`）に分割、段落間 `gap: 14px`、`--text-lg`（一覧 `--text-base` より一回り大きく）、`line-height: 1.85`、色は `rgba(255,255,255,.92)`（読める濃さ）。開いた瞬間に**段落が上から順にリビール**（`--reveal-delay` の stagger・`prefers-reduced-motion` で無効）。
- **WORDS 自動ハイライト**（`.record-mark`）：**INSIGHT の WORDS（全 RECORD 横断の頻出語トップ20。[lib/wordAnalysis.ts](lib/wordAnalysis.ts) の `extractWordFrequencies`）に入っている語のうち、その RECORD の本文に実際に出現する語だけ**を `--yuzu-yellow` ＋細い下線で強調する（[lib/highlightWords.ts](lib/highlightWords.ts) の `recordWords(text, topWords)`）。記録単体の内容語を総ざらいするのではなく全コーパスの頻出語に絞るので、密度は低く保たれる（漢字・カタカナを含む 2 文字以上のみ＝単漢字/機能語ノイズは除外）。`topWords` 未配線時のみ記録単体の内容語抽出にフォールバック。**文言は一切変えない**（声をそのまま強調するだけ。「気づき」等の説明は足さない）。AI は使わない（コスト 0・オフライン/mock 動作可）。
- 本文下に **操作行**（`.index-detail-actions`）：`MARK`（PushPin トグル・ON で `--yuzu-zest`）と `COPY`（⚠️ Notion 移行期間限定の一時機能）。ダーク背景に馴染む低主張ボタン（`rgba(255,255,255,.18)` 罫線・角丸 `--radius-sharp`・タッチターゲット 44px 以上）。押下後 `MARKED` / `COPIED`（ピリオドなし）をラベルにフラッシュ。
- **シェア導線は持たない**。SNS シェアは最新 STREAK の SIGNAL カード（[components/SignalCardModal.tsx](components/SignalCardModal.tsx)）に委ねる（過去 1 件の本文シェアは思想に反する）。
- box-shadow は使わない。階層は罫線と余白だけで作る。

### ユーザー identity

YUZU は SNS 機能を持たない（フォロー・他人からの閲覧なし）。よって自己を他人に示すアイコン・名前は不要。**identity は通し番号 `#NNN` のみ**。「名前は無い。お前は #020 だ」。ニックネーム登録／果物絵文字／アバター UI は v2 で全廃止。


### スタッツカード

縦に積み、**ラベルを上・数値を下**にして中央揃え。罫線は `--divider`。

```css
.stat-card {
  background: transparent;
  border: none;
  text-align: center;
  padding: 20px 6px;
  border-top: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.stat-label {                          /* ラベルが先 */
  font-family: var(--font-display);    /* Unbounded */
  font-weight: 700;
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--ink-muted);
  text-transform: uppercase;
}
.stat-value {                          /* 数値は下に大きく */
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-3xl);
  line-height: 1;
  color: var(--ink);
}
```

表示例（LOG 画面ヘッダー直下・横3列）：

```
 RECORDS    |   MINUTES   |   STREAK
   20       |     128      |    14
```

ラベルは画面ごとに異なる組（同じ `.stat-card` パターンの使い回し）。
- **LOG 画面（[components/IndexView.tsx](components/IndexView.tsx)）**：`RECORDS` / `MINUTES`（総録音分数） / `STREAK` の3つ。「DAYS. NO SKIP.」は冗長なため `STREAK` に統一した。
- **完了画面（[components/CompleteView.tsx](components/CompleteView.tsx)）**：`MINUTES` / `STREAK` の2つ（ダーク背景バリアント）。
- **INDEX 詳細（事実 STATS）**：`LENGTH` / `DAY` の2つ。下記「INDEX 詳細」参照。

**アクセス時にカウントアップ**（[lib/useCountUp.ts](lib/useCountUp.ts)）：0 → 値を ease-out cubic で約1秒。`prefers-reduced-motion: reduce` は即値表示（アニメなし）。

### セクション内フィルタ (`.section-filter`)

セクション見出し右肩に置くトグル。罫線最小・余白で階層を作る YUZU 原則（§5）に従い、**黄色下線**で active を表現する Unbounded タブスタイル。

```
非アクティブ:  color --ink-muted、border-bottom 2px transparent
アクティブ:    color --ink、border-bottom 2px --yuzu-zest
hover:         color --ink
タイポ:        Unbounded 700 / --text-xs / letter-spacing 0.12em / uppercase
padding:      6px 10px
```

**使用箇所**
- LOG > RECORDS の `ALL` / `MARKED`（[components/IndexView.tsx](components/IndexView.tsx)）
- INSIGHT > EMOTION の `MONTH` / `ALL`（[components/EmotionChart.tsx](components/EmotionChart.tsx)）。**MVP 期間は ALL を `is-locked`（aria-disabled）化し、タップで `COMING SOON` ツールチップを 1.8s 表示する**。課金導入 (#65) で plan 分岐により解禁

**他のセクション内トグルを追加する時もこの 1 クラスを使う**（pill 型・セグメントコントロール型は採用しない）。

### MARK / COPY 操作 (`.index-detail-actionbtn`) — v2.2

**INDEX 詳細モーダル内**の本文下に置く操作行（`.index-detail-actions`）。一覧カードからは撤去し、ここに集約した。ダーク背景に馴染む低主張ボタン（ラベル付き）。

**MARK**（PushPin トグル）：
- アイコンは PushPin（ON 塗り）/ PushPinSlash（OFF 線・18px）。タッチターゲット 44px 以上
- 色の差分：OFF=`rgba(255,255,255,.7)` / ON=`--yuzu-zest`（罫線も `--yuzu-zest`）
- `is-marked` 状態のカード（一覧）は `border-top` を `--yuzu-zest` で強調
- 操作直後にラベルが `MARKED`（ピリオドなし・Unbounded 700・`--text-xs`）にフラッシュ（0.9s）
- クリック即トグル。モーダルは `detailPost` スナップショットを持つため `marked` はモーダルローカル state で管理
- 編集・削除とは別概念。アイコンは決してゴミ箱・鉛筆を使わない

**COPY** — ⚠️ 一時機能：
- **Notion 移行期間限定**。YUZU 運用が完全移行したら削除する**恒久 UI ではない**。コード上にも `// TEMPORARY: ...` コメント必須
- アイコンは Copy（線・18px）
- クリックで本文（+ `#NNN` + 日時）をクリップボードへコピー
- 操作直後にラベルが `COPIED`（ピリオドなし・Unbounded 700・`--text-xs`）にフラッシュ（0.9s）
- MARK と同等の低主張に揃え、恒久 UI として馴染ませすぎない

### ボタン (`.btn`)

すべてのインタラクションは `.btn` をベースに variant で切り分ける。**角丸 4px**、Unbounded 700、`:active` でわずかに縮んで押下感を出す。

| Variant | 用途 | 配色 |
|---|---|---|
| `.btn--primary` | 主要 CTA | `--ink` bg / 白文字 |
| `.btn--secondary` | 副次・キャンセル等 | 透明 bg / `--ink` 枠線・文字、hover で反転 |
| `.btn--accent` | 信号色を使うときだけ（STREAK / 続行系） | `--yuzu-yellow` bg / `--ink` 文字 |
| `.btn--ghost` | パディングのみのテキストボタン | 透明・hover で `--surface-hover` |
| `.btn--danger` | 削除等 | 透明 bg / `#b94343` 枠線 |

サイズ修飾子 `.btn--sm` / `.btn--lg`。

```css
.btn {
  border-radius: 4px;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: transform 0.12s var(--ease-soft);
}
.btn:hover  { transform: translateY(-1px); }
.btn:active { transform: scale(0.97); transition-duration: 60ms; }  /* 押下感 */
```

Primary は必ず `--ink`（墨）。Accent のみ `--yuzu-yellow` を信号として点灯させる原則を守る。

### アイコンボタン (`.iconbtn`)

44×44px・**常時正円**（border-radius 9999px）・`var(--icon-bg)` の薄ディスクを常時敷く（iOS 26 Liquid Glass 風）。`.iconbtn--lg` で 56px。タッチターゲット 44px を必ず確保。

`.iconbtn--round` は base が常時 round になったため no-op。既存コードの後方互換のため残置。

**インタラクション原則（全 Variant 共通）**
- 通常 — `var(--icon-bg)` の薄ディスク（中立色・墨 6%）を常時表示
- `:hover` — `var(--surface-hover)` の薄黄に切替（浮かせる translateY は使わない）
- `:active` — `scale(0.94)` で押下感。transition-duration は 60ms に短縮

**Variant**（`.btn` と同じ命名）

| クラス | 通常 | ホバー |
|--------|------|--------|
| `--primary` | 墨背景・白アイコン | さらに暗く |
| `--secondary` | 墨枠・墨アイコン | 墨塗りつぶし |
| `--accent` | yuzu-yellow 背景 | zest に変化 |
| `--ghost` | アイコン + `--icon-bg` の薄ディスク | surface-hover 薄黄 |

**用途別ガイド**
- ヘッダー内アイコン（🔔 など）→ `iconbtn iconbtn--ghost`
- ページ戻るリンク → `page-header-back iconbtn iconbtn--ghost`（`<Link>` に付与）
- モーダル内クローズ（黄背景上）→ `.record-modal-close`（半透明白円・`rgba(255,255,255,0.22)` + backdrop-blur 20px + `rgba(255,255,255,0.4)` の細い縁、hover で `rgba(255,255,255,0.36)`）。Liquid Glass で背景の黄色に馴染ませる
- 投稿の MARK / COPY → INDEX 詳細モーダル内の `.index-detail-actionbtn`（ダーク背景の低主張ボタン。§6 参照）

**廃止クラス**
- `.settings-fab` — 削除済み。`iconbtn iconbtn--ghost` を使うこと。
- `.settings-back` — 削除済み。`page-header-back iconbtn iconbtn--ghost` を使うこと。

### 確認ダイアログ (`.confirm-modal` in [components/DeleteAccountModal.tsx](components/DeleteAccountModal.tsx))

破壊的操作（現状アカウント削除のみ）の確認モーダル。AnimState（`opening→open→closing`）+ `useBodyScrollLock`。

- 構造：`.confirm-modal-scrim`（半透明墨 0.55 の背面。クリックで閉じる）+ `.confirm-modal-panel`（`--surface-card`・`--surface-border` 罫線・`--radius-sharp`・**box-shadow なし**）。中央寄せ。
- **type-to-confirm**：`.confirm-modal-input` に確認語を入力させ、一致するまで実行ボタンを `disabled`。アカウント削除は **`YUZU`**（大文字小文字不問）。1 タップで進めない誤操作防止。
- 実行中（`削除中…`）は scrim クリック・入力・両ボタンを無効化。失敗時はモーダル内 `.confirm-modal-error` に表示（silent fail しない）。
- コピーは Mirror 原則（§4「設定・アカウント削除」参照）。やさしい注意文にしない。

### 感情分析チャート

```
ポジティブ塗り: var(--yuzu-zest)   #E8A020
ネガティブ塗り: var(--mood-low)    #2E3A66  (紺、Mirror 原則で「悪」を担わせない)
ライン:        var(--ink) opacity 0.3
ゼロライン:    点線・var(--ink-muted)
背景:          transparent
```

塗りは `<linearGradient gradientUnits="userSpaceOnUse">` で y軸方向に定義し、Area の `fill` に `url(#...)` を指定する（`objectBoundingBox` は path の bbox 中央で色が割れるため使わない）。

**この2色（オレンジ↔紺）は LOG・REPORTS と共有する1本の「感情スケール」**。正準実装は [lib/sentimentColor.ts](lib/sentimentColor.ts)（`sentimentColor(score)` が -1.0(紺)→0(中立グレー)→+1.0(オレンジ) を線形補間）で、以下が同じ端点色を参照する：
- LOG: 投稿カードの左端バー（`.post-card-edge`、§6「投稿カード」参照）
- INSIGHT: この EMOTION チャート（[components/SentimentChart.tsx](components/SentimentChart.tsx)）
- INSIGHT: REPORTS カードの左端バー＋ミニ sparkline（§6「レポートカード」参照）

### ワードバブルマップ (`.word-bubble-map` in [components/WordBubbleMap.tsx](components/WordBubbleMap.tsx))

INSIGHT の `WORDS` セクション。全投稿から頻出語 20 語を抽出して頻度に応じたバブルで描画。

```
塗り:           var(--yuzu-yellow)       #F5D84A
ラベル文字:     var(--ink)               #1A1A2E
opacity:        0.3〜1.0（頻度線形マッピング）
配置:           d3-hierarchy.pack（重なりなし）
viewBox:        0 0 320 320（aspect-ratio 1:1）
ラベル最小半径: 18px（それ未満は省略）
```

**インタラクション**

- マウント時：i × 50ms の staggered で `bubbleIn` 480ms（scale 0 → 1）。**初回のみ**。pop/ripple class が外れた時に再発火させない（[components/WordBubbleMap.tsx](components/WordBubbleMap.tsx) の `hasEntered` で制御）
- タップ：自バブルに `bubblePop` 640ms（`1 → 1.20 → 0.95 → 1.06 → 0.99 → 1`、linear ＋ 多段キーフレーム）
- 隣接バブル（距離が `源半径 + 自半径 + 24px` 以内）：`bubbleRipple` 540ms（`1 → 0.96 → 1.04 → 0.99 → 1`）を距離に応じた delay で連動
- `prefers-reduced-motion: reduce` 時は全アニメ無効、opacity のみ維持

### 繰り返しテーマ ランキング (`.theme-card` in [components/RecurringThemes.tsx](components/RecurringThemes.tsx))

INSIGHT の `PATTERN` セクション。Claude が全投稿から抽出した 5 件以下のテーマを **マインドシェア型ランキング** で表示。Spotify Wrapped 風に、各テーマが「あなたの声のうち何%を占めるか」を黄色の横バーで可視化する。

```
レイアウト:        count 降順、share = count / sum(counts) で %算出
順位ラベル:        #1〜#5（11px / --ink-muted / Unbounded）
テーマ名:          15px / 700 / --ink（Unbounded）
                  ※ #1 のみ 18px に拡大
シェア表記:        13px / --ink（Unbounded、"NN%" 右寄せ）
                  ※ #1 のみ 16px
シェアバー:        高さ 4px（#1 のみ 6px）
                  背景 --divider、塗り --yuzu-yellow、border-radius 2px
                  scaleX(0 → 1) で 520ms アニメ
説明文:           14px / line-height 1.6 / --ink-secondary（LINE Seed JP）
カード間隔:        gap 16px（カードボーダーは持たない、罫線はバーが代理）
```

**インタラクション**

- マウント時：`themeIn` 360ms（opacity 0 → 1、translateY 8px → 0）を i × 80ms staggered で発火
- シェアバー：`themeBarIn` 520ms で scaleX 0 → 1（左端から伸びる）
- `prefers-reduced-motion: reduce` 時はアニメ無効

### 時間帯ヒートマップ (`.time-heatmap` in [components/TimeHeatmap.tsx](components/TimeHeatmap.tsx))

INSIGHT の `SIGNAL` セクション。過去 28 日 × 12 バケット（2 時間刻み）= 336 セルの CSS Grid。mobile (~360px) で高さ ~145px を確保し、SIGNAL セクションが INSIGHT の主役の一つになる厚みを持たせる。

```
セル（投稿あり）: var(--yuzu-yellow)  #F5D84A、opacity 0.2〜1.0
セル（投稿なし）: var(--divider)      #EDEAE0
セル形状:        aspect-ratio: 1/1（正方形）、container 幅で flex 等分、gap 2px、border-radius 2px
時間軸ラベル:    なし（ミニマル維持。バケットは tooltip に表示）
日付軸ラベル:    7日おき MM/DD（下、9px、--ink-muted）
Tooltip:        黒地・--yuzu-white 文字・10px・Unbounded
                内容: "MM/DD HH:00 / N CHARS"（HH はバケット先頭時刻 00/02/04/.../22）
集計境界:        JST 固定（lib/period.ts の jstHour を 2 時間バケットへ丸め / jstDateString）
```

**インタラクション**

- ホバー/フォーカス：セルが scale(1.4) 拡大 + `--ink` の 1px outline + tooltip 表示

### レポートカード (`.report-card` in [components/ReportCard.tsx](components/ReportCard.tsx)) — v2.3

INSIGHT の `REPORTS` セクション。LOG の投稿カードと対になる構造（左端の感情カラーバー・感情カラースケールの共有）を持たせ、**WEEK / MONTH をバッジと期間スパンで一目で判別できる**ようにする。

```
┃┌──────────────────────────────┐
┃│ [ WEEK ]  6/14–6/20           │ ← 種別バッジ（ゴースト）+ 期間スパン
┃│ 怒りを置きにいった一週間。       │ ← headline（hero・bold）
┃│ (仕事のミーティング)(家族)(寝不足) │ ← topic chips
┃│ ︵︶︵︶                        │ ← 感情ミニ sparkline
┃└──────────────────────────────┘
↑ 感情カラー左端バー（期間平均スコア）

 ┌──────────────────────────────┐
 │ [■MONTH]  5月                 │ ← 種別バッジ（塗り）+ 月名
 │ 出すより、抱えた月。             │
 │ ...                           │
 └──────────────────────────────┘
```

- **種別バッジ**：新しい色は足さず `--ink` の濃淡だけで区別する。`WEEK` はゴースト（`border: 1px solid var(--ink)`、背景なし）、`MONTH` は塗り（`background: var(--ink)`、`color: var(--yuzu-white)`）。
- **期間スパン**（`.report-card-span`）：冗長だった「6月2週 週次レポート」のような接尾辞は廃止。`WEEK` は日付レンジ `M/D–M/D`、`MONTH` は月名 `M月`（[lib/period.ts](lib/period.ts) の `formatPeriodRange`、JST 固定）。
- **headline を hero に昇格**：`--text-base` / `font-weight: 700` / `--ink`（旧 secondary 表示から強調）。
- **感情カラー左端バー**：期間の `sentimentSeries` 平均スコアを [lib/sentimentColor.ts](lib/sentimentColor.ts) の共有スケールで着色。未生成（`generated: false`）は色を出さない。
- **感情ミニ sparkline**（`.report-card-spark`）：`payload.sentimentSeries` をインライン SVG（`viewBox 0 0 100 28`、`userSpaceOnUse` の縦グラデ）で描画。recharts は使わない（カード毎に重い）。`WEEK` は7点・`MONTH` は約30点で密度が変わり、バッジ・スパンと並んで判別の補助になる。
- topic chips・pending 状態（`{postCount} RECORDS · TAP TO READ`）は既存のまま。
- box-shadow は使わない。階層は罫線・余白・バッジの濃淡だけで作る。

---

## 7. アニメーション原則

| 用途 | 関数 |
|---|---|
| 少しバウンスさせたい | `--ease-organic` |
| なめらかに | `--ease-soft` |
| パッと反応 | `--ease-snap` |

### 維持するアニメーション

- **`float-dot`**（浮遊ドット・待機中）→ 主役モーションとして活かす
- **波形アニメーション**（[components/Waveform.tsx](components/Waveform.tsx)、録音中・音量に反応）→ 主役モーションとして活かす。48 本のバーを画面いっぱい（高さ 280px・最大バー高 260px）に配置、`flex: 1` で幅を均等分配。バーは `rgba(255,255,255,0.45)` の半透明白（RECORDING 文字より控えめ）。idle は cascading delay 0.06s で波が左→右に流れる。録音中は AnalyserNode の周波数ビンを対数スケールで取得して低域偏りを補正し、信号を `Math.sqrt` で持ち上げて弱声も反応させる
- **`recording-ring`**（録音中の同心円リング）→ 維持
- **`dot-converge` / `dot-collapse`**（録音／変換時の収束）→ 維持
- **`post-appear`**（投稿出現）→ 維持
- **`fadeIn`** → 維持

### 除外アニメーション

- **`blob-pulse`** → 削除済
- **`ripple`** → 当面維持。将来再評価

### 新規追加（v2.3・LOG 画面強化）

- **LOG カード入場 stagger**：既存 `post-appear` keyframe を再利用し、`.post-card--reveal` に `animation-delay` を連番で段階化（6件周期でリセット、過剰にしないため上限あり）。観測ベース（IntersectionObserver）ではなく **マウント時に必ず実行**する CSS アニメーションとして実装（observer 不発火でカードが見えなくなる事故を避けるため）。
- **STATS カウントアップ**：[lib/useCountUp.ts](lib/useCountUp.ts) を LOG 画面の `RECORDS` / `MINUTES` / `STREAK` に配線（CompleteView と共有）。0 → 値を `ease-out cubic` で約1秒。
- いずれも `prefers-reduced-motion: reduce` で無効化（即値表示）。

### はなす画面の状態アニメーション

| Phase | アニメーション |
|---|---|
| idle | 浮遊ドット（`float-dot`、3〜7s ランダム） |
| recording | ドットがマイクへ収束（`dot-converge`）+ 同心円リング3重（`recording-ring`）+ 波形 |
| busy | ドットが中心に集まり消える（`dot-collapse`） |
| done | `post-appear` |

`@media (prefers-reduced-motion: reduce)` で全アニメーションを抑制。

---

### セクション見出し (`.mypage-section-title`)

画面内の EMOTION / RECORDS / REPORTS 等のセクション見出し。Unbounded 700・`--text-lg` (18px)・letter-spacing 0.08em・上余白 44px（`padding-top`）。上罫線 `--divider` で区切る。色は `--ink`（墨）。

**ヒエラルキー前提**：ページ名（`.app-header-title`、Unbounded 700・`--text-3xl` 48px）が常に最大。セクション見出しはそれより一段小さく抑え、ページ階層を視覚的に確立する。スタッツラベル（RECORDS / MINUTES / STREAK）は別クラス `.mypage-stat-label` でさらに小さく保つ。

### タブバー (`.tab-bar`) + 録音 FAB (`.fab-record`)

iOS 26 Liquid Glass を参考にした**フローティングピル型**ナビゲーションと、その**右隣に並ぶ録音 FAB**。タブとアクション（録音）を物理的に分離し、タブ pill は遷移、FAB はアクションという責務分離を視覚化する。

```
[ tab-bar 220px ]──12px gap──[ fab-record 64px ]   ＝ 合計 296px をビューポート中央寄せ
       ↑                            ↑
  left: calc(50% - 148px)     left: calc(50% + 84px)
       ↓                            ↓
      LOG / INSIGHT                Microphone（録音）
位置: fixed・bottom: env(safe-area-inset-bottom) + 12px
高さ: 64px（両方同じ）
形状: border-radius: 9999px（完全な楕円・正円）
背景: pill = rgba(250,250,245,0.72) + backdrop-filter blur(40px)、FAB = var(--yuzu-yellow)
縁:   border: 1px solid rgba(255,255,255,0.6)（共通）
影:   box-shadow 0/10/30 rgba(26,26,48,0.10) + inset highlight（共通の Liquid Glass 質感）
```

**タブ構成（2タブ + FAB・順序固定）**

| 順 | 要素 | アイコン | ラベル | 役割 | 情報の出どころ | デフォルト |
|---|------|---------|--------|------|----|----|
| 1 | LOG | Waveform | "LOG" | 自分が出した記録（STATS・RECORDS） | ユーザー自身 | ✅ |
| 2 | INSIGHT | Pulse | "INSIGHT" | AI 解釈と集計（EMOTION / SIGNAL / WORDS / PATTERN / REPORTS） | AI と集計（他者視点）| |
| — | RECORD FAB | Microphone | （ラベルなし） | 録音アクション。タップで RecordModal を開く | ユーザーの行為 | — |

- 録音 FAB は**タブ state を持たないアクション**（[components/RecordFab.tsx](components/RecordFab.tsx)）。押すと `RecordModal` の fly アニメで開く → CompleteView → 閉じる。
- 内部タブ ID は互換のため `index` / `read` を維持（URL `?tab=read` で INSIGHT へ）。表示ラベルだけ `LOG` / `INSIGHT`。
- アプリ起動時のデフォルト表示は **LOG**。
- 性質分離：LOG = ユーザー自身、INSIGHT = AI 解釈。録音は別 surface（FAB）。旧「HOME」「ME」「PROFILE」「TALK タブ（旧 3 タブ中央）」は廃止。

**アクティブ表現（iOS 26 ライクのスライド pill）**
- 黄色 pill は `.tab-bar::before` で **1 つだけ**描画し、`data-active="index" | "read"` で `translateX` を切り替えてタブ間を滑らせる
- pill 幅 84px・左 13px から開始（pill = 38% / 1 セル 50%、左右 12% インセット相当）
- INSIGHT 時は `translateX(110px)`（1 セル幅ぶん）
- `transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)`（iOS の標準スプリング寄り）
- アイコン・ラベル色も同じカーブで `var(--ink-muted)` ↔ `var(--ink)` に補間
- 旧実装：`.tab-item[aria-selected="true"]::before` で個別描画していたが瞬間切替になるため撤去

**インタラクション**
- `:active` → `scale(0.94)`（タブ・FAB 共通）
- `:hover` → FAB のみ `scale(1.04)`
- `backdrop-filter` 非対応環境では `background: rgba(250,250,245,0.96)` にフォールバック
- `prefers-reduced-motion: reduce` で pill のスライドを無効化（`transition: none`）

**オンボーディング中・モーダル開放中は非表示**（`data-hidden="true"` で opacity 0・translateY 8px・pointer-events none）。タブと FAB は同じ `hidden` プロパティで連動して隠れる。

## 8. レイアウト

レイアウトは **左揃え・グリッド・大胆な余白の不均衡** を基本とし、センター寄せの和的余白は廃止する。スタッツ等の例外は「3. タイポグラフィ／段組ルール」を参照。

### ヘッダー (`.app-header`)

ロゴは置かない。**ページ名 (`.app-header-title`、Unbounded 700・`--text-3xl` 48px・大文字・句点なし)** を左、設定アイコンを右に置くだけのシンプル構成。タブ切替に応じて `LOG` / `INSIGHT` を出し分ける（`app/page.tsx` から `tab` を読んで描画）。これにより、ページ階層がヘッダーの大きな文字で一目で分かる。

```
┌──────────────────────────────┐
│  LOG                     ⚙  │  ← LOG タブ
│  INSIGHT                 ⚙  │  ← INSIGHT タブ
└──────────────────────────────┘
```

オンボーディング（未ログイン）時はページ名・設定アイコン共に非表示。

### 録音 surface（RecordModal）

スタンドアロンの「はなす画面」は持たない。録音は常に **下部ドックの FAB** → **RecordModal の fly アニメ** で開く。タブ間遷移と録音アクションを完全に分離している。

```
[ FAB ] →  fly  →  ┌─────────────────────────────┐
                    │ [✕]                          │  ← record-modal-close（半透明白）
                    │ RECORDING / CARVING          │  ← speak-top（Unbounded 32px・bold・状態 hero）
                    │   00:30 / 03:00              │  ← speak-timer（24px）
                    │                              │
                    │  ┃┃ ┃ ┃┃ ┃ ┃┃ Waveform 48本 │  ← recording 中
                    │  • • 浮遊するドット • •       │  ← idle（FloatingDots）
                    │                              │
                    └─────────────────────────────┘
```

### タイムライン（LOG タブ内 RECORDS セクション）— v2.3

矩形カードが縦に並ぶ（旧 歪んだ楕円カードは廃止）。v2.3 でカード一覧に**背骨（縦罫線）+ 日付区切り**を追加し、絶対日付はカード単体からは撤去してこの区切りに一本化した（重複表示の解消）。

```
┃ ● TODAY
┃ ┌──────────────────────────┐
┃ │ #020              1:24   │
┃ │ ...                      │
┃ └──────────────────────────┘
┃ ┌──────────────────────────┐
┃ │ #019              0:48   │
┃ └──────────────────────────┘
┃ ● YESTERDAY
┃ ┌──────────────────────────┐
┃ │ #018              2:01   │
┃ └──────────────────────────┘
```

- **背骨**：`.post-timeline::before` の 1px 縦線（`--divider`）。カードのインデント分だけ左に余白を作り、リストが「途切れず続く記録」に見えるようにする。
- **日付区切り**（`.timeline-divider`）：投稿を JST 日付（[lib/period.ts](lib/period.ts) の `jstDateString`）でグルーピングし、日付が変わる位置にドット + ラベルを挿入。今日/昨日は `TODAY` / `YESTERDAY`（英語状態ラベル）、それ以外は `M.D DOW`（例 `6.18 THU`）。句点なし。
- 新規投稿は FAB から飛ばされて先頭に出現する（`post-appear`）。一覧の入場 stagger も同じ keyframe を再利用（§7「新規追加」参照）。

### ナビゲーション構造（2 タブ + FAB）

```
┌──────────────────────────────┐
│  LOG                     ⚙  │  ← ヘッダー（ページ名 + 設定）
├──────────────────────────────┤
│  LOG:     STATS / RECORDS    │
│  INSIGHT: EMOTION / SIGNAL   │
│  / WORDS / PATTERN / REPORTS │
└──────────────────────────────┘
           ↑ タブコンテンツ
┌──[ LOG ]──[ INSIGHT ]──┐  ┌🎤┐  ← pill タブ + 独立 FAB（横並び）
└────────────────────────┘  └──┘
```

### LOG 画面（自分が出した記録）

ヘッダー左の **`LOG`** が画面見出しを兼ねる。上から下へ「抽象 → 具体」で縦に積む。全セクション左揃え。**PROFILE・INSIGHT は含まない**。

```
┌─────────────────────────────┐
│ LOG                      ⚙ │  ← ヘッダー（ページ名 = 見出し兼任）
├─────────────────────────────┤
│ RECORDS  MINUTES  STREAK     │  ← ① STATS（横3列）
│ 20       128      14         │
├─────────────────────────────┤
│ RECORDS         [ ALL|MARKED ]│  ← ② RECORDS 一覧 + フィルタ
│ ┌─────────────────────────┐ │
│ │ post-card (Raw 矩形)     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘ ← ここで完結
```

- スタッツは **RECORDS / MINUTES / STREAK** の3つ（MINUTES = 総録音分数、声の積み上げ量）。アクセス時にカウントアップする（§6「スタッツカード」参照）。
- `#NNN` は各 RECORD カード上に配置（ヘッダーには出さない）。**ユーザー identity は `#NNN` のみ**。名前・アイコンは持たない。
- RECORDS フィルタは `ALL` / `MARKED` の1組のみ。narrow viewport（<400px）では下段に **折り返す**ことを許容（`flex-wrap: wrap`）。
- RECORDS 一覧は背骨 + 日付区切りのタイムライン（上記「タイムライン」参照）。各カードは感情カラー左端バー・声紋バーを持つ（§6「投稿カード」参照）。
- 設定アイコンはヘッダー右上に据え置く。

### INSIGHT 画面（AI 解釈）

ヘッダー左の **`INSIGHT`** が画面見出しを兼ねる。「短期 → 長期」「定量 → 解釈」で上から積む。

```
┌──────────────────────────────────┐
│ INSIGHT                       ⚙ │
├──────────────────────────────────┤
│ EMOTION           [ MONTH|ALL ] │  ← ① 感情チャート（折れ線）
│ ╱╲___╱╲                          │
├──────────────────────────────────┤
│ SIGNAL                           │  ← ② 時間帯ヒートマップ
│ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│
│ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│
│ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│
│ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│
│ ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│
│ 04/30  05/07  05/14  05/21       │
├──────────────────────────────────┤
│ WORDS                            │  ← ③ 頻出語バブルマップ
│        ◯ ◯                       │
│       ◯ 何 ◯                    │
│        ◯ ◯                       │
├──────────────────────────────────┤
│ PATTERN                          │  ← ④ Claude 抽出テーマ
│ #1 他人の評価            33%   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░  │
│ 怒られたことを何度も書き残し...   │
│ #2 小さな救い            28%   │
│ ███████░░░░░░░░░░░░░░░░░░░░░░░  │
├──────────────────────────────────┤
│ REPORTS                          │  ← ⑤ 週次/月次レポートカード
│ ┌─[WEEK]6/14–6/20─┐┌─[■MONTH]5月┐│
│ └──────────────────┘└────────────┘│
└──────────────────────────────────┘
```

- EMOTION: [components/EmotionChart.tsx](components/EmotionChart.tsx)
- WORDS: [components/WordBubbleMap.tsx](components/WordBubbleMap.tsx)（§6 ワードバブルマップ仕様参照）
- SIGNAL: [components/TimeHeatmap.tsx](components/TimeHeatmap.tsx)（§6 時間帯ヒートマップ仕様参照）
- PATTERN: [components/RecurringThemes.tsx](components/RecurringThemes.tsx)（§6 繰り返しテーマカード仕様参照）
- REPORTS: [components/InsightView.tsx](components/InsightView.tsx) の `mypage-section` 内ブロック（[components/ReportCard.tsx](components/ReportCard.tsx)、§6「レポートカード」仕様参照）。種別バッジ + 期間スパンで WEEK/MONTH を判別。詳細遷移は `/reports/{periodKey}`。

---

## 9. コピーライティング原則

- **キーボードっぽい言葉を使わない**（「入力」→「話す」、「テキスト」→「声」）
- **自然・果物・育つメタファーは禁止**
- **圧力をかける**（NIKE 寄り。「投稿する」→「話せ」「出せ」）
- **詩的にならない**
- **英日混在を許容**（英＝挑発・状態、日＝事実・本文）

---

## 10. アクセシビリティ

- タッチターゲット最小 44px × 44px（録音 FAB は 64px、RecordModal 内ヒーローのマイクボタンは 140px）
- テキストコントラスト比 4.5:1 以上
- マイクボタンに `aria-label` / `aria-pressed`
- `prefers-reduced-motion` で全アニメ抑制（[globals.css](app/globals.css)）
- iOS Safari 対応（`-webkit-backdrop-filter` 必須）
- `safe-area-inset-bottom` 対応必須

---

## 11. 参照・インスピレーション

- **タイポ**：Swiss International Typographic Style、Helvetica の余白設計
- **トーン**：NIKE のキャンペーン広告、Patta、A-COLD-WALL\*
- **配色**：Off-White の信号色使い、Acne Studios の極端な無彩色＋1色
- **UX**：Twitter の投稿気軽さ × 番号体系のグラフィック（Supreme の連番、Off-White の引用符）

---

## 12. メンテナンス（自動チェック）

このドキュメントは **デザインに変更があれば必ず追従更新する**。色・シェイプ・コンポーネント・コピー・アニメーションのいずれかを変えたら、コードと同じコミット（または直後）で該当セクションを更新すること。

### 自動チェック

`npm run design:check` で以下を検証する（CI: [.github/workflows/design-check.yml](.github/workflows/design-check.yml)）:

1. **`design:lint`** — Google Labs [design.md](https://github.com/google-labs-code/design.md) CLI でフロントマターの構造・参照・WCAGコントラストを検証
2. **`design:drift`** — このファイル冒頭 `cssVars:` と [app/globals.css](app/globals.css) の `:root` を双方向突合。値の不一致・未実装・未文書化トークンを検出（[scripts/check-design-drift.mjs](scripts/check-design-drift.mjs)）

### トークン更新の手順

1. [app/globals.css](app/globals.css) の `:root` で CSS 変数を変更
2. このファイル冒頭 `cssVars:` の同名キーも同じ値に更新
3. 必要なら本文セクション（カラーパレット・シェイプなど）の説明・サンプルも更新
4. `npm run design:check` がパスすることを確認

### デザインプレビュー（実体）

実物プレビューは [public/design-preview.html](public/design-preview.html)。`http://localhost:3000/design-preview.html` で確認できる。**プレビュー HTML を編集したら、この DESIGN.md と `app/globals.css` / `components/*.tsx` を必ず同期する** こと（プレビューが source-of-truth）。


---

## 13. 用語集（Glossary）

YUZU の世界観・UI で用いる用語の定義表。新規コピーや UI を書くときは必ずここに揃える。NGワード（§4）と矛盾しないこと。

| 用語 | 読み/表記 | 定義 | UI上の扱い・NG言い換え |
|---|---|---|---|
| LOG | ログ | **ユーザー自身が出した**記録の集約面（STATS・RECORDS）。デフォルトタブ。 | INSIGHT・PROFILE は含まない。旧称「INDEX」 |
| INSIGHT | インサイト | **AI と集計** がユーザーの声を解釈して返す面（EMOTION / SIGNAL / WORDS / PATTERN / REPORTS）。 | LOG とは情報の出どころが違うため分離。旧称「READ」「REPORT」 |
| RECORD FAB | レコード FAB | 録音アクション。タブバー右に常時並ぶ正円ボタン。タブ state を持たない。 | 旧「TALK タブ」は廃止 |
| `#NNN` | ナンバー | ユーザーの **identity 兼通し番号**。名前・アイコンの代替。 | 「名前は無い。お前は #020 だ」。ゼロ埋め3桁。LOG の各 RECORD カード上に表示 |
| RECORD | レコード | 1件の声の記録（単数）。声が変換され刻まれたもの。 | 「投稿」「日記」「テキスト」と呼ばない |
| RECORDS | レコーズ | RECORD の一覧（複数）。INDEX 内のセクション名でもある。 | スタッツラベルにも使用 |
| SIGNAL | シグナル | 声を出した瞬間に生じる信号（世界観語）。INSIGHT では時間帯ヒートマップのセクション名。 | PRD §2 THE RECORD 由来 |
| WORDS | ワーズ | INSIGHT サブセクション。全投稿の頻出語バブルマップ。 | 「キーワード」「タグ」と呼ばない |
| PATTERN | パターン | INSIGHT サブセクション。Claude が抽出した繰り返しテーマのマインドシェア型ランキング。 | 「テーマ」「トピック」と呼ばない |
| MARK | マーク | 自分の RECORD に刻印を打つ唯一の能動操作。常時トグルボタン（v2）。 | 「お気に入り」「いいね」「ブックマーク」と呼ばない |
| MARKED（フィルタ） | マークド | MARK 済み RECORD のみを抽出するフィルタ。`ALL` と対になる。 | RECORDS のフィルタとして実装。独立タブにしない |
| COPY | コピー | 本文（+ `#NNN` + 日時）をクリップボードへコピーする **一時機能**。Notion 保存用。 | ⚠️ 将来削除予定。コード上に `// TEMPORARY:` コメント必須 |
| STATS | スタッツ | LOG 上部の数値群 **RECORDS / MINUTES / STREAK**。 | §6 スタッツカード準拠。DAY は INDEX 詳細モーダル側 |
| MINUTES | ミニッツ | 総録音分数。声の積み上げ量を示す。 | STATS の中央。旧「SINCE（登録日数）」を置換 |
| DAY | デイ | 登録からの日数。`DAY ○`。INDEX 詳細モーダルの STATS。 | |
| STREAK | ストリーク | 連続投稿日数。 | 「DAYS. NO SKIP.」は冗長のため不使用 |
| SILENCE | サイレンス | 録音がなかった日に刻まれる印（`SILENCE`）。 | 沈黙も記録の一部として扱う |
| EMOTION | エモーション | 声の感情推移を示す折れ線チャート（INSIGHT 先頭）。 | 「気づき」「自分を知ろう」と書かない。旧称「SENTIMENT」 |
| CARVING / CARVED | カービング | 声をテキストに変換中（`CARVING`）/ 刻印完了・投稿成立（`CARVED`、オンボ／ログイン共通の完了スタンプ）。 | 旧称「DECODING」「DECODED」。完了状態は旧 `RECORDED.` を引退して `CARVED` に統一。状態 pill は句点なし。「変換中」「処理中」と書かない |
| LOG/INSIGHT 2タブ + RECORD FAB | — | 最終ナビ構成。性質分離（LOG=ユーザー / INSIGHT=AI / FAB=アクション）の結果。 | ホーム・ME・PROFILE・TALK タブは廃止済み |

**v2 で廃止された用語/概念**: `PROFILE`（INDEX セクション廃止）、ニックネーム / 果物絵文字アイコン / `AvatarMark`（identity は `#NNN` のみに統一）。

> NGワード（§4 再掲）：「癒し」「寄り添う」「頑張ろう」「育つ」「林」「種」「香り」「果実」「やさしく」「ふんわり」「あなたらしく」「入力」「テキスト」「記録する（→話す に統一）」「気づき」「自分を知ろう」。用語集・UIコピーにこれらが混入していないことを確認すること。
