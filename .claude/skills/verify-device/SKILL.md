---
name: verify-device
description: 画面コンポーネント・録音・Haptics・AppState・SecureStore などネイティブ挙動に触る変更を完了と判断する前に使う。実機検証の要否を判定し、完了条件を決める。
---

## ゴール

「この変更は何が green なら完了と言えるか」を判定し、その検証を実施する。実機が無く実施不能な場合は代替措置まで済ませる。

## 判定基準

- **typecheck/lint/test だけで完了にできる**: `lib/` の純ロジック、型、定数、文言のみの変更
- **実機（または最低限 Expo Go）が必要**: 録音・`expo-audio`／Haptics（iOS Simulator では鳴らない、物理 iPhone 必須）／AppState 割り込み／`expo-secure-store` によるセッション永続化／レイアウト・タッチ領域

## 実機が無い環境での完了条件

検証項目を `README.md` の「実機検証待ち（#64 チェックリスト）」に追記する。コードレベルの検証（typecheck/lint/test + 該当ロジックのユニットテスト）が green であることをもって「実機検証待ち」として完了扱いにする。

検証していないことを検証済みと報告しない。

## 手順の参照先

Expo Go / 本格ビルドの起動手順は `README.md`「実機で動かす」を参照する（ここには複製しない）。
