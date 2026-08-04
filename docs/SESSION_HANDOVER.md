# SESSION_HANDOVER.md（2026-08-04 締め / B-101 完走・triple-gate 訂正・B-108/109 recon）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（github.com/shintarokoenuma/shunya-pms / ~/shunya-production-system /
本番 shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。
★localhost:3000 は saagara-rebuild 使用中。shunya-pms の dev は **PORT=3001**。
★ローカル確認の第一手順は `git branch --show-current`。

## ⓪-b PR 提示時の確認コマンド一式（毎回添える）

    cd ~/shunya-production-system
    git checkout <branch>
    git pull
    git branch --show-current   # ★対象ブランチであること
    PORT=3001 npm run dev

→ shunya-pr-url-checklist スキルへの恒久追加は**今回も未実施**（宿題）。

---

# 【最重要】migration は本番デプロイ時に自動適用される（2026-08-04 確定）

## 事実（実測）

`package.json`:

    "start": "prisma migrate deploy && next start"

`railway.json` / `railway.toml` / `nixpacks.toml` / `Dockerfile` / `Procfile` は
**すべて未設定** → Railway は nixpacks 既定で `npm start` を使う。
リポジトリ内で `prisma migrate deploy` の記述は**この1箇所のみ**（全体 grep 済み）。

→ **PR のマージ = Railway 自動デプロイ = migration 自動適用。マージボタンが本番適用ボタン。**

## 旧 triple-gate は順序が誤っていた

旧記述「dev 適用 → マージ → 本番 dry-run → 本番 `migrate deploy`」は**手遅れ**。
実証（B-101 PR1 / migration 45）:
- PR #119 マージ後、本番 `_prisma_migrations.finished_at` = 2026-08-03 22:57:25 UTC
- マージ後に dry-run → `ERROR: enum label "CUTTING" already exists`
- enum は既に 17値、`distinct_names` 44 → 45

今回は enum 追加（非破壊）で実害ゼロ。**破壊的 migration なら検証前に本番へ入っていた。**
B-094（migration 44）の「3ゲート完走」記述も、3つ目は no-op だった可能性が高い。

## 正しい 4 ゲート（以後これに従う）

- **ゲート1: dev 適用**
  dev は `_prisma_migrations` を**持たない**（db push 由来）ため `migrate dev` は使えない
  （drift 検知で reset を要求される）。静的 diff → 手書き migration → psql 適用:

      git show HEAD:prisma/schema.prisma > /tmp/schema_before.prisma
      npx prisma migrate diff --from-schema-datamodel /tmp/schema_before.prisma \
        --to-schema-datamodel prisma/schema.prisma --script

- **ゲート2: 本番 dry-run【★マージ前★】**
  Railway psql Console で `BEGIN` → 対象 SQL → `ROLLBACK`。COMMIT しない。
- **ゲート3: マージ**（= 自動デプロイ = 自動適用）
- **ゲート4: 適用結果の確認**
  `_prisma_migrations` の `finished_at` / `applied_steps_count` / `rolled_back_at`
  ＋ 対象オブジェクトの実測。

## 是正方針（慎太郎さん確定）
`start` から `migrate deploy` は**外さない**（外すとコードとスキーマが乖離して危険）。
**ゲート順序の入れ替えで対処する。**

## enum migration の実測値（PG 18.4）
- `BEGIN → ALTER TYPE ADD VALUE ×3 → ROLLBACK` は**成功**（dry-run 有効）
- 同一 tx 内で新値を使うと `ERROR: unsafe use of new value` →
  **migration は enum 値追加のみに限定し、DML を混ぜない**

---

## ① 現在フェーズと完了状態
- **B-101（量産進行）完走**。PR1→PR2→PR3 の3本すべて本番反映済み。
- main HEAD: **1b06745**
- 本セッションのマージ:
  - **PR #119（d81c8de）** B-101 PR1: 生成基盤。migration 45本目
    `20260804000000_production_progress_task_types`（enum 3値追加）
  - **PR #120（0e066b6）** B-101 PR2: 進行セクション UI
  - **PR #121（1b06745）** B-101 PR3: 自動算出（案C 導出照合）
- docs 直 push: 1adfd15（B-101/B-096 spec v1.0）→ 5baef45（triple-gate 訂正）

## ② 未マージ PR
なし。

## ③ DB の状態
- dev = hopper.proxy.rlwy.net:12921 / 本番 = shuttle.proxy.rlwy.net:16099
- **`ProgressTaskType` は 17値**（dev・本番とも）。CUTTING/FINISHING/PACKING を追加済み。
- 本番 migration: **distinct 45 / unfinished 0 / rolled_back 0**
- 本番 `progress_tasks`: SAMPLE 25 のみ（PRODUCTION 未生成＝本番で量産発注生成をしていないため正常）
- dev `progress_tasks`: SAMPLE 58 / PRODUCTION 11（+加工行）
- **dev DB には `_prisma_migrations` テーブルが存在しない**（db push 由来）。B-097 と同根。

## ④ ナレッジ登録状況（鉄則4）
本セッション確定 spec:
- `b-101-b-096-production-progress-spec-confirmation-v1_0-2026-08-03.md`（1adfd15・**登録済み**）

## ⑤ 次セッションで最初にやること（優先順）

1. **B-108（サンプル納品書）の仕様確認書 v0.1**。recon 3回分の結論は §⑧ にある。
   着手方針（未確定・次で決める）: SO 非依存で起票 / PDF は B-086 方式に合わせるか
2. **B-086 の PDF プレビュー基盤の recon**。既存 PDF は直 DL（attachment）で
   B-086 方針と衝突している。B-108 の PDF 導線がこれに依存する。
3. **B-096（進行表ボード）**。spec v1.0 §4 で設計済み・実装未着手。
   B-101 が完走したので同じ ProgressTask を参照するだけ。
4. **スキルの棚卸し**（下記 §⑥ の事故）。
5. 本番での量産発注生成の立ち会い（実データが揃ってから）。

## ⑥ 本セッションの事故・学び

### スキルが消えていた（要棚卸し）
`shunya-pr-url-checklist` を更新しようとしたところ、**`~/.claude/skills/` ディレクトリ
自体が存在しなかった**。`~/shunya-backups/archives/shunya-pr-url-checklist.zip` から
復元し、4ゲート節を追記（113→147行）。
→ **他のスキルも消えている可能性が高い。全スキルの存在確認と復元が必要（未実施）。**

### チャットの長文が先頭から切れる
仕様確認書 v1.0 の保存指示を2回送ったが、2回とも同じ位置（§3-2 の途中）から始まり
先頭が欠落した。**長い本文は 1/2・2/2 に分割して送る**ことで解決。
Claude Code 側は fabricate せず停止して報告した（file-write-verification が機能）。

### migration 検証は環境固有事項が多い
- dev に `_prisma_migrations` が無い → `migrate dev` が使えない（reset を要求される）
- `prisma db execute` は `prisma.config.ts` の都合で `--url` 必須
- `SHADOW_DATABASE_URL` 未設定（B-097）
→ migration は毎回「静的 diff → 手書き → psql 適用」が確定手順。

## ⑦ B-101 の実装内容（完了）

### PR1（d81c8de）生成基盤
- `ProgressTaskType` に CUTTING / FINISHING / PACKING（migration 45）
- `PRODUCTION_TASK_TEMPLATE`（11行）＋ `buildProductionTaskRows(companyId, productId)`
- `PRODUCTION_PROCESSING_SORT_ORDER_BASE = 55`（SAMPLE の 65 とは別定数）
- `generateProductionOrders` の return 直前に冪等生成フック（既存0件時のみ）

### PR2（0e066b6）進行セクション UI
- `listProductionTasks(productId)` / `addProductionProcessingTasks(productId, ids[])`
- `production-progress-checklist.tsx`（PRODUCTION 専用・写経）
- 品番カルテの「ステータス履歴」Card → 「進行」Card（上=進行 / 下=履歴の1枚統合）
- 「入荷済み」→ **「工場入荷」**＋注記「自社出荷時に代理チェック可」
- 納品書・請求書の2行は「（経理）」表示で視覚区別

### PR3（1b06745）自動算出
- **案C 導出照合**: `progressTaskId` を使わず
  `productId` + `workCategory=PRODUCTION` + `workType` で WO を引く
- `PRODUCTION_WO_TYPE_MAP`（GRADING/CUTTING/SEWING/FINISHING）。
  PROCESSING は `ProcessingType.workType` を実行時解決
- **自動は `NOT_STARTED → IN_PROGRESS` の一段のみ。DONE は人が押す**（P16）
- FABRIC / TRIM は対象外（PO は仕入先単位で束ねられ生地/付属を区別できない）。
  この2種は既存 `recomputeTaskStatus` が `isReceived` 経由で DONE 化
- 発火点2箇所: `generateProductionOrders` / `updateWorkOrderStatus`
- revalidate 分岐4箇所に `/products/{id}` 追加（既存 `/samples` は保持）

### 実機確認済み
WO の workType を CUTTING に変更 → ステータス変更で裁断が「進行中」に昇格。
COMPLETED にしても「進行中」のまま（P16 準拠）。SAMPLE 側の回帰なし。

## ⑧ B-108/109/110 の recon 結果（3回分・次セッションの起点）

### 最重要: 納品・請求・貿易のモデルは15個すべて schema 実装済み・全休眠
`DeliveryNote` / `DeliveryNoteItem` / `Shipment` / `Invoice` / `InvoiceItem` /
`Payment` / `InvoicePayment` / `InternationalRemittance` / `TradeTransaction` /
`CommercialInvoice` / `CommercialInvoiceItem` / `PackingList` / `PackingListItem` /
`CustomsDeclaration` / `TradeDocumentFile`
→ **src 参照ゼロ**（`DeliveryDestination` のみ稼働・18参照）。
→ B-108/109/110 は「モデル設計」ではなく **休眠テーブルの起動**（actions + UI + PDF）。

### 慎太郎さんの要件は schema 上ほぼ満たされている
| 要件 | 対応フィールド |
|---|---|
| 納品書の金額を載せる/載せない | **`DeliveryNote.showAmounts`**（既存） |
| 適格請求書 | `Invoice.issuerTaxId`（必須）/ `taxableAmount10` / `taxAmount10` /
  `taxableAmount8` / `taxAmount8` / `exemptAmount` / `InvoiceItem.taxClassification` |
| 月次締め・COD | `Client.paymentTermType`（MONTHLY_CLOSING / DEPOSIT_COD 等6値）
  ＋ `closingDay` / `paymentMonthOffset` / `paymentDay` |
| 合計請求書 | `Invoice.relatedDeliveryNoteIds`(Json) が複数納品書をまとめる受け皿 |
| 振込先 | `Invoice.bankInfo`(Json) / `swiftCode` / `iban` / `bankFeeBurden` |
| 輸出インボイス | `InvoiceType.COMMERCIAL` ＋ `CommercialInvoice` モデル |

### ただし前提整備が2つ必要（B-109）
1. **自社の適格請求書番号と振込先の出所が無い**。
   PDF の発行者情報は `src/lib/constants/company-profile.ts` の **ハードコード定数**
   （name / postalCode / address / tel / fax / email のみ）。
   `Invoice.issuerTaxId` は **NOT NULL** なので、番号を用意しないと請求書を1枚も作れない。
   選択肢: (a) 定数に追記（最軽量・migration なし）/ (b) Company に列追加（migration・4ゲート）
   / (c) 設定画面を作る（`/settings` は現在 `enabled: false`）
2. **既存 PDF は直 DL（attachment）**。`/api/purchase-orders/[id]/pdf/route.ts` は
   `getOrderPdfData` → `renderOrderPdfBuffer` → GCS 控え保存 → `Content-Disposition: attachment`。
   → **B-086（全ページプレビュー → 承認後 DL）と真っ向から異なる。**
   B-108/109 の PDF 導線は B-086 の新方式に合わせるべき。

### SalesOrder も休眠（フル実装済み・4417行）
`DeliveryNote.primarySoId` / `Invoice.primarySoId` は **nullable** なので
**SO 非依存で起票可能**。サンプル納品書は受注を伴わないので v1 は SO 非依存が妥当。

### 写経元
- 採番: `computeNextPoNumber`（purchase-orders.ts:183）。共通ヘルパは無く各 action が自前。
  `DLV-{年}-{4桁}` / `INV-{年}-{4桁}` を同型で写経
- PDF: `src/lib/pdf/order-document.tsx`(188) + `order-data.ts`(227)。
  `@react-pdf/renderer`。ライブラリ追加不要

## ⑨ バックログ（本セッション更新分）

### 新規起票
- **B-104**: サンプル側の DONE 判定を工程完了基準に揃える（P16 を SAMPLE にも適用）。別 PR
- **B-105**: 量産見積の加工費目 → 加工行の自動生成。費目と ProcessingType の対応表設計を含む
- **B-106**: 進行チェックリストの伝票リンク列（案C 導出照合ベース。
  同じ WO が複数タスクに重複表示される問題の UI 設計が要る）
- **B-107**: 一覧のソート機能（WO 一覧で発覚。PO・見積など横断で対応）
- **B-108**: サンプル納品書（`showAmounts` で金額の有無を選択）
- **B-109**: 合計請求書（月次締め基本・COD 等の都度締め例外・適格請求書要件）
- **B-110**: 輸出インボイス（Commercial Invoice / Packing List）。
  reference の実物（ベトナム・香港インボイス）と
  `20260713_輸出入書類と縫製仕様書_構造メモ.md` を読んでから設計

### 再定義
- **B-086**: PDF は全て「**全ページプレビュー確認 → 承認後 DL**」に変更（慎太郎さん指示）。
  対象は見積 PDF・発注 PDF・PE 見積 PDF など全 PDF 導線。B-108/109 の前提でもある

### 既存
- B-096（進行表ボード・spec v1.0 §4 で設計済み）/ B-097（SHADOW_DATABASE_URL）/
  B-102（リピート系譜）/ B-103（受け渡し記録）/ B-054 段1 / B-090 / B-091 / B-092 /
  B-093 / B-089 / B-087 / B-072〜B-077 / B-082a/b / B-084 / B-023 / B-024 / B-020 /
  B-065 redesign
- **B-098 は欠番**

### 未調査の質問（慎太郎さんから）
- **同一品番の生地が PO 生成時に合算されるか**（2026-08-04・未調査）

## ⑩ 本日のコミット
- 1adfd15 docs: B-101/B-096 仕様確認書 v1.0
- d81c8de PR #119 マージ（B-101 PR1・migration 45）
- 5baef45 docs: triple-gate 訂正
- 0e066b6 PR #120 マージ（B-101 PR2）
- 1b06745 PR #121 マージ（B-101 PR3）
