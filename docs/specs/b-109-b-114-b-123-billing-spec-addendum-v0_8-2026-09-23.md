# B-109 / B-114 / B-123 請求の仕様確認書 addendum v0.8（2026-09-23）

- 種別: 仕様確認書 v1.0 への追補（v0.7 の D-23 の既定値を改訂）
- 対象: addendum v0.7 の **D-23**（端数処理はクライアントごと・既定＝切り捨て）
- 作成: 2026-09-23 11:50 JST（claude.ai 側）
- 前版: `b-109-b-114-b-123-billing-spec-addendum-v0_7-2026-09-22.md`
- ★v0.7 は 2026-09-22 時点の確定記録なので**書き換えない**。本書が既定値だけを置き換える
- ★本書は実装ブリーフ `b-109-pr2-implementation-brief-2026-09-23.md`（v1.1）の **§3-1 の Client 列・§3-2 の SQL・§4-2 のラベル**を置き換える。ブリーフ本体は v1.1 のまま据え置く

---

## 1. 確定事項

| D | 内容 | 原文・根拠 |
|---|---|---|
| D-36 | **消費税の端数処理の既定を「切り捨て（TRUNCATE）」から「四捨五入（ROUND_HALF_UP）」に変更する。** クライアントごとに持つ（D-23）ことは変えない | 慎太郎さん 2026-09-23「初期値は切り捨て（既定）で出てました。初期値を四捨五入にしたいです。」（PR #158 の dev 確認中） |

### ★根拠の性質（次のセッションが戻さないための注記）

- **D-36 は実測ではなく業務判断である。**
- 2026-09-22 に KKAP+ の実物の請求書から判定した分布は **切り捨て3社**（ERA・プレステージ・SHIN DESIGN WORKS）／**1円上げ1社**（ベイクルーズ ACME 財務管理課）で、**実測の多数派は切り捨て**だった（v0.7 §1 の表）。
- それでも既定を四捨五入にしたのは、**判定に使えた4社より広い実務の分布を知る慎太郎さんの判断**による。
- ★**v0.7 の D-23「既定＝切り捨て」だけを読んで元に戻さないこと。** 本 D-36 が後勝ちで正。

### ★この既定が効く範囲（v0.7 の記述より広い）

`tax_rounding_mode` は **NOT NULL DEFAULT** の列であり、PR-2a の時点で本番にはまだ存在しない。したがって既定は「新しく作るクライアントの初期値」だけではない。

- **PR-2a をマージした瞬間、本番の既存クライアント全社が `ROUND_HALF_UP` で埋まる**（`ADD COLUMN ... NOT NULL DEFAULT` の挙動）
- 切り捨ての取引先（ERA・プレステージ・SHIN DESIGN WORKS）は、**請求書を作る前にクライアントごとに切り捨てへ直す必要がある**
- この確認は移行の作業項目として **B-215** に記載済み（「移行時に各クライアントの端数処理の初期値を人が入れる」）

---

## 2. 実装への反映（PR #158・commit 02a2b68・2026-09-23）

★PR-2a は未マージで migration はまだどこでも実行されていないため、**新しい migration は作らず既存の migration.sql を直接書き換えた**。

| # | ファイル | 変更 |
|---|---|---|
| 1 | `prisma/schema.prisma` | `@default(TRUNCATE)` → `@default(ROUND_HALF_UP)` |
| 2 | `prisma/migrations/20260923000000_b109_pr2a_client_tax_rounding/migration.sql` | `DEFAULT 'TRUNCATE'` → `DEFAULT 'ROUND_HALF_UP'`（＋冒頭コメントに D-36 を追記） |
| 3 | `src/lib/validators/client.ts` | `.default("TRUNCATE")` → `.default("ROUND_HALF_UP")` |
| 4 | `src/app/(app)/clients/_components/client-form.tsx` | `defaultValues` の `TaxRoundingMode.TRUNCATE` → `ROUND_HALF_UP` |
| 5 | `src/app/(app)/clients/_components/labels.ts` | 「切り捨て（既定）」→「切り捨て」／「四捨五入」→「四捨五入（既定）」 |

計 5ファイル・8行。`tsc` エラーなし、触ったファイルの `eslint` エラーなし、repo 全体の lint error 合計 11 → 11（同数）。

### dev の実測（2026-09-23 11:47 JST・hopper:12921）

- `information_schema.columns.column_default` = `'ROUND_HALF_UP'::"TaxRoundingMode"`
- `migrate diff` の再実行は空（schema と dev DB が一致）
- **dev の既存行は更新していない**。内訳は `TRUNCATE` 1件 / `ROUND_HALF_UP` 1件
  - ★理由: 既定を変えても既存行が変わらないのは正しい挙動であり、かつ **PR-2c で「切り捨てのクライアント」と「四捨五入のクライアント」を並べて税額の1円差を確かめる**のに両方が dev にある状態が要る（ブリーフ §5 #8）

---

## 3. 置き換わる記述

| 文書 | 箇所 | 旧 | 新 |
|---|---|---|---|
| addendum v0.7 | §1 D-23 | 既定＝切り捨て | **既定＝四捨五入**（D-36） |
| addendum v0.7 | §2 | 「既定は切り捨て・NOT NULL DEFAULT」 | 既定は四捨五入。NOT NULL DEFAULT であることは変わらない |
| addendum v0.7 | §2-4 | 「Client: 端数処理の列1本（NOT NULL DEFAULT 切り捨て）」 | NOT NULL DEFAULT 四捨五入 |
| 実装ブリーフ v1.1 | §3-1 の Client 行 | `@default(TRUNCATE)` | `@default(ROUND_HALF_UP)` |
| 実装ブリーフ v1.1 | §3-2 の SQL | `DEFAULT 'TRUNCATE'` | `DEFAULT 'ROUND_HALF_UP'` |
| 実装ブリーフ v1.1 | §4-2 の選択肢の語 | 「切り捨て（既定）/ 四捨五入 / 切り上げ」 | 「切り捨て / **四捨五入（既定）** / 切り上げ」 |

★**変わらないもの**: D-22（消費税は請求書1枚につき税率ごとに1回）／D-23 の「クライアントごとに持つ」という構造／D-31（端数処理は絶対値に適用して符号を戻す）／enum の3値（TRUNCATE / ROUND_HALF_UP / CEILING）。

---

## 4. 記録の運用について

本 D-36 の回答は、v0.1 の申し合わせ（Q の回答は addendum の D 番号に原文で記録する）に従い**本書に原文で記録した**。メモ受信箱（`claude/MEMO_INBOX.md`）への二重記録はしない。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-09-23 | v0.8 | D-36（端数処理の既定を切り捨て → 四捨五入）を確定。根拠が実測ではなく業務判断であること、NOT NULL DEFAULT がマージ時に本番の既存クライアント全社に効くこと、PR #158 commit 02a2b68 での反映内容、dev の既存行を更新しない理由を収載 |

END-OF-ADDENDUM-B109-V0_8
