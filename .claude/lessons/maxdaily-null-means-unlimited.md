# サーバの maxDaily は「null = 無制限（admin）」。`?? 0` で潰すと admin が録音できなくなる

yuzu-app の `/api/records`（GET / POST）は `maxDaily` に **`null` = 無制限**を返す。
これは admin（`profiles.role = 'admin'`）のときの値で、`lib/entitlements.ts` の
`resolveEntitlements` が `maxDailySessions: null` を返すのが源流。

`null` を数値へ潰すと壊れる：

```ts
maxDaily: data.maxDaily ?? 0,                          // null → 0
const limitReached = stats.todayCount >= stats.maxDaily; // 0 >= 0 → 常に true
```

admin は無制限どころか**録音を全面ブロック**される。`prev?.maxDaily ?? FALLBACK` のような
merge も同じ罠（`null` が既定値に化けて admin が降格する）。**`??` は null を拾ってしまうので、
maxDaily には使わない。** 「フィールドが無い（undefined）」と「null（無制限）」を区別すること。

純ロジックは `lib/dailyLimit.ts` に集約済み（`parseMaxDaily` / `mergeStats` /
`isDailyLimitReached` / `remainingToday`）。上限まわりを触るときはここを使い、テストを足す。

## 発現の経緯（2026-07-16）

`profiles.role` migration を本番適用するまでは、role 列が無く `getEntitlements` が失敗して
user 扱い（`maxDaily: 1`）にフォールバックしていたため、admin でも「普通に動いて」いた。
migration 適用と同時に `maxDaily: null` が返るようになり、クライアントの `?? 0` が露出して
録音不能になった。**サーバの契約が変わらなくても、DB の状態変化で初めて露出する分岐がある。**

## todayCount はクライアントキャッシュで日を跨がせない

`lib/logsCache.ts` は `todayCount` を永続化する。JST 日付の刻印（`statsDate`）が無いと、
起動時に前日のカウントで上限到達と判定し「今日はまだ録音していないのに 1/1」になる。
`loadLogsCache` は `statsDate !== jstDateString(Date.now())` なら `todayCount` を 0 に戻す。

## 切り分けの型

「上限表示がおかしい」ときは推測せず本番 DB を見るのが速い（`role` と当日 JST のレコード数を
直接数える）。今回もそれでバックエンドが正しいと即断でき、クライアントに絞り込めた。
