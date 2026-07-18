モックモードは yuzu-app バックエンドを一切経由しない。ネイティブ側だけで完結する表示専用機構。

`lib/mockMode.ts` / `lib/apiFetch.ts` の元々のコメントは「`X-Yuzu-Mock: 1` ヘッダーを付けると
バックエンドが role=admin のリクエストにモックデータを返す」という前提だったが、これは誤り。
yuzu-app（`/Users/konno/git/yuzu-app`）の API route（`app/api/records`, `app/api/insights/*`,
`app/api/reports`）を全部 grep しても `X-Yuzu-Mock` を読む箇所はゼロ。yuzu-app 自身の
モックモードは `yuzu-mock-mode` cookie/sessionStorage で管理する **Web クライアント側だけ**の
機構（`lib/mockReports.ts`, `lib/useInsightData.ts` の `isMockMode()`）で、API 呼び出し自体を
スキップしてブラウザ内でモックデータに差し替えているだけだった。

そのため、ネイティブがどんなヘッダーを付けて叩いても本物のデータが返る。LOG/INSIGHT を
モック化するには `lib/mockData.ts`（yuzu-app の `mockPosts.ts`/`mockReports.ts`/`themes.ts` を
移植）を使い、モックON時は `apiFetch` を呼ばずローカル生成データをそのまま state にセットする
実装にした（`components/RecordScreen.tsx` の `fetchLogs`、`InsightScreen.tsx` の
heatmap/themes/words/reports、`ReportDetailModal.tsx`）。

**Why**: この前提のまま「ヘッダーがちゃんと送られているか」だけを追っても永久に直らない
（バックエンド側に対応する気が無いので）。次にモック関連の不具合報告が来たら、まず
「ネイティブ側は `isMockModeEnabled()` を正しく見ているか」ではなく「そのデータソースは
`lib/mockData.ts` 由来かどうか」を疑うこと。新しい INSIGHT セクションやレポート項目を追加する
際は、モック対応も `lib/mockData.ts` に追記しないとそこだけモックが効かなくなる。

**How to apply**: LOG/INSIGHT に新しいデータフェッチを追加するときは、必ず
`isMockModeEnabled()`（または呼び出し元で解決済みの `mockOn` フラグ）で分岐し、ON なら
`lib/mockData.ts` にビルダー関数を追加してそこから取る。バックエンド側の対応は期待しない。

副次的な発見: `components/RecordScreen.tsx` は元々「起動直後の `fetchLogs()`」と
「`loadMockMode()`（AsyncStorage 読み込み、非同期）」が別々の `useEffect` で fire-and-forget
になっており、`getSession()` の解決の方が速いケースが多いためコールドスタート直後は
モックフラグが間に合わずヘッダーが付かないレースがあった。今は `fetchLogs` 自体が毎回
`await loadMockMode()` してから分岐するよう直したので、この種のレースはもう起きない
（同じパターンで新しい起動直後フェッチを足すときは、モック判定を effect 起動順に依存させず
フェッチ関数の先頭で `await loadMockMode()` するのが安全）。
