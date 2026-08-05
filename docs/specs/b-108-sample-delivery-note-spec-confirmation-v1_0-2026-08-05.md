# B-108 サンプル納品書 仕様確認書 v1.0（2026-08-05・確定）

## 0. 本書の前提
- 設計根拠は記憶ではなく以下の原文再読による（2026-08-05）:
  - `product-sample-spec-confirmation-v1_0-2026-06-06.md` §4 / §5 / §6-2 / §6-3
  - `qe1r-initial-cost-redesign-spec-confirmation-v0_1-2026-07-07.md` §1 / §2
  - `s-3-progress-task-implementation-brief-2026-06-07.md`（DELIVERY/INVOICE の phase 規定）
- live schema を全文取得して確認済み（DeliveryNote / DeliveryNoteItem / Invoice /
  InvoiceItem / WoItem / PoItem / Client / Buyer / ClientContact /
  DeliveryDestination / Sku / SampleProduction）。
- **v0.1 からの訂正2件（重要）**
  1. v0.1 は「Client は住所を1組しか持たない」と記述したが誤り。根拠にした
     2026-05-16 スナップショットが古かった。**live の Client は3系統の住所を持つ**
     （基本 / billing* / shipping*）。§4 を全面差し替え。
  2. v0.1 は「DeliveryDestination が Buyer 必須のため手入力が主経路」としたが、
     `Client.shipping*` で直納先を引けるため障害にならない。**B-112 は取り下げ**。
- **前セッション recon の「showAmounts が金額有無の要件に対応する」はフィールド名
  からの推測であり spec 化されていなかった。** 本書 §6 で意味論を新規に確定する。

## 1. 目的とスコープ
サンプル・見本類を先方へ送る際の納品書を発行できる状態にする。

### 対象に含む
- 縫製サンプル（1st/2nd/3rd）
- ビーカー（染め見本）・プリント見本・加工見本などの試作見本類
- 上記を1枚の納品書に混在させること（複数品番の混在を含む）

### 対象外
- 量産納品（SKU×サイズで納める形態）
- 請求書発行 → B-109
- 輸出書類 → B-110
- 品番が決まる前に発生する見本の受け皿
  （慎太郎さん確定: **まれ・後から品番に紐づければ足りる** → v1 は品番必須）
- 複数品番で共用する見本の按分 → B-111

## 2. 設計の起点（既存確定設計・変更しない）
1. **品番が案件の背骨**（サンプル spec §5-a）。ビーカー・プリント見本等は独立カルテを
   起こさず、品番配下の WO/PO 明細行として持つ。慎太郎さん確定（2026-08-05）。
2. **売り立て区分は既に稼働**（同 §6-2 / QE1R §1）。`WoItem.billingClassification` /
   `PoItem.billingClassification` に `INDIVIDUAL_BILLING`（個別売り立て）が
   入力・表示・集計まで実装済み。サンプル代の請求経路は既に敷かれている。
   `PoItem.isPhysicalAsset` は版・型の資産計上フラグ。
3. **納品書は SKU 前提ではない**。休眠 `DeliveryNoteItem.skuId` NOT NULL は
   量産納品（サンプル spec §4「量産時の追加」・§6.3「量産納品時は先方の量産品番が
   メイン」）の設計であり、サンプル納品には適用しない。

## 3. データモデル

### 3-1. migration（新規列ゼロ・制約緩和2件のみ）
| 対象 | 変更 | 理由 |
|---|---|---|
| `delivery_notes.product_id` | `DROP NOT NULL` | 1枚に複数品番を載せる |
| `delivery_note_items.sku_id` | `DROP NOT NULL` | ビーカー等に SKU は存在しない |

- **v1 では `DeliveryNote.productId` に値を入れない。** 明細側 `productId` の既存 index で
  引く。代表品番を入れると参照経路が二重化し嘘の情報が残るため。
- **★この判断は片道切符である（次に読む人へ）**
  - `DROP NOT NULL` は列も既存データも変えない緩和方向であり、`DROP COLUMN` /
    `DROP TABLE` とは別物。データ損失は発生しない。
  - ただし**戻すのは実質不可能**。空欄の行が入った後で `NOT NULL` に戻すには
    全行を埋めるか削除する必要があるため。
  - 代償: **将来の量産納品で「SKU 必須」を DB で強制できなくなる**。
    → **アプリ側（Zod validator / actions）で担保する**。量産納品を実装する際は
    `skuId` 必須のバリデーションを必ず置くこと。
  - 慎太郎さん承認済み（2026-08-05）。テーブルが空・アプリ参照ゼロの今が最も安全。
- 「additive columns only」の原則からは外れるため、**4ゲートを厳守**:
  ゲート1 dev 適用 → **ゲート2 ★マージ前★ 本番 dry-run（BEGIN/ROLLBACK）** →
  ゲート3 マージ（= 自動デプロイ = 自動適用） → ゲート4 実測。
- **ゲート2 で `delivery_notes` / `delivery_note_items` の実件数を必ず確認する。**
  0 件と推定しているが未実測。想定と違えばそこで停止。
- migration に DML を混ぜない。

### 3-2. 明細のマッピング（引き当て元 → DeliveryNoteItem）
| 引き当て元 | productName | itemCode | quantity | unit | 参照列 |
|---|---|---|---|---|---|
| `SampleProduction` | `Product.productName` ＋ ラウンド（1st 等） | `Product.clientProductCode` | `sampleQuantity` | 枚 | `productId` |
| `WoItem`（個別売り立て） | `workDescription`(500) | 同上 | `quantity`(Int) | `unit` | `productId` / `woId` |
| `PoItem`（個別売り立て・資産） | `description`(Text) | 同上 | `quantity`(★Decimal) | `unit` | `productId` |
| 手入力 | 自由入力 | 自由入力 | 手入力 | 手入力 | `productId` 必須 |

- `skuId` は全経路で null（v1 は SKU 分解しない）。
- `colorName` / `size` は任意。ビーカーは `colorName` に色名を入れられる。
- ★`PoItem.quantity` は Decimal、`DeliveryNoteItem.quantity` は Int。
  **小数を含む場合は引き当て時に警告を出し、人が整数を入れる**（自動丸めはしない）。
- 品名の出所が WO と PO で列名が異なる（`workDescription` / `description`）。上表に従う。

## 4. 宛先解決（v0.1 から全面差し替え）

### 4-1. live 確認済みの住所構造
- `Client` は**3系統**を持つ:
  基本（postalCode/country/prefecture/city/address/addressLine2/phone/fax/email）/
  `billing*`（請求書発送先・マスター住所と異なる場合のみ入力）/
  `shipping*`（商品配送先・同上）。**`client-form.tsx` に入力欄が配線済み**。
- 階層: `Client` →（buyers）→ `Buyer` →（deliveryDestinations）→ `DeliveryDestination`。
- `DeliveryNote` は `clientId` 必須、`buyerId` / `deliveryDestinationId` は任意。

### 4-2. フォールバック連鎖
- **納品先**: `DeliveryDestination`（選択時）→ `Buyer` → `Client.shipping*` → `Client` 基本
- **請求先**（B-109）: `Client.billing*` → `Client` 基本
- **担当者**: `ClientContact`（`isPrimary`）→ `Client.primaryContactId`

### 4-3. snapshot コピー
解決結果を `shipToAddress`(NOT NULL) / `shipToContact` / `shipToPhone` へ**値としてコピー**する。
発行後にマスターを修正しても、発行済み伝票の宛先は変わらない。

## 5. 起票フロー
1. 品番カルテの「納品」セクション、または納品書一覧の新規作成から起票。
2. クライアントを選択（`clientId` 必須）。
3. 送り先を決める（§4-2 の連鎖で自動補完 → 人が上書き可）。
4. **明細を引き当てる**。一覧＋チェックボックス → 一括追加。
   写経元は `generateProductionOrders`（`production-order-generation.ts:119`）。
   - タブ1: サンプル（`SampleProduction`）
   - タブ2: 個別売り立ての WO/PO 明細行
     （`billingClassification = INDIVIDUAL_BILLING` または `isPhysicalAsset = true`）
   - タブ3: 手入力行の追加
5. 金額の要否を選ぶ（§6）。
6. 保存 → 番号確定（§7）。

## 6. 金額・消費税（本書で新規確定）
- `showAmounts = false`（既定）: **単価・小計・合計をすべて非表示**。純粋な送り状。
- `showAmounts = true`: 明細に単価・小計、フッタに**小計 / 消費税 / 合計**を表示。
- 単価の出所: 引き当て元の `unitPrice`（null 可）を初期値とし、人が上書きできる。
- 未入力の単価がある状態で `showAmounts = true` にした場合は保存時に**警告**（ブロックしない）。
- **消費税は v1 では 10% 固定＋手入力上書き可**。軽減税率(8%)・輸出免税の自動判定と
  税区分（`TaxClassification`）は B-109 の領分。
- 既存列で足りる（`subtotalAmount` / `taxAmount` / `totalAmount` / `currency`）。列追加なし。

## 7. 採番
- `DLV-{年}-{4桁}`。`computeNextPoNumber`（`purchase-orders.ts:183`）を同型で写経。
- 保存時確定方式（PO/WO と統一）。プレビュー用関数も同型で用意。
- `@@unique([companyId, deliveryNumber])` は既存。
- **★採番の `findFirst` は `deletedAt` で絞らないこと。** 論理削除したレコードも
  番号の最大値判定に含める。除外すると論理削除でも番号が再利用され、§9 の対策が無効化する。

## 8. ステータス（enum 変更なし・UI で絞る）
`DeliveryNoteStatus` は9値あるが、**v1 が使うのは DRAFT / SHIPPED / DELIVERED / CANCELLED の4値**。
承認フロー（PENDING_APPROVAL / APPROVED）・受領確認（RECEIVED）・返品（RETURNED）・
配送中（IN_TRANSIT）は v1 では出さない。enum は変更しない。

## 9. 削除の扱い（✓ 確定・論理削除のみ）
**物理削除は UI に置かない。** 理由は3点、決め手は①。

1. **採番が再利用される（決定的）**。`DLV-{年}-{4桁}` は「prefix 一致の最大値 +1」方式のため、
   最新レコードを物理削除すると同じ番号が再発番される。送付済みの納品書と別内容の伝票が
   同一番号で存在する事故になる（WO/PO 番号で確認済みの既知の穴と同型）。
2. **証憑性**。納品書は取引の証憑であり控えの保存義務がかかる。
3. **明細の Cascade**。`DeliveryNoteItem` は `onDelete: Cascade` のため明細ごと消える。

### `deletedAt` と `CANCELLED` の使い分け
- **`deletedAt`** = 誤って作った DRAFT の取り消し。一覧から消える。
- **`CANCELLED`** = 発行後に取り消した事実。**一覧に残す**（相手に届いた伝票が存在するため）。
- 一覧は既定で `deletedAt IS NULL`。**DRAFT 以外の論理削除は UI で不可**とする。

## 10. 進行チェックリストへの納品行追加（✓ 確定・S-3 の明示的変更）
- **S-3 ブリーフでは `DELIVERY` / `INVOICE` は PRODUCTION phase 専用・自動生成しないと
  確定していた。本書はこれを明示的に変更する**（慎太郎さん確定 2026-08-05）。
- **v1 で `SAMPLE_TASK_TEMPLATE` に追加するのは「納品」1行のみ**（`taskType = DELIVERY`）。
  - `INVOICE` 行は **B-109 と同時に追加**する。B-109 未着手の段階で置くと、
    押しても何も起きない行が残り、B-101 で確立した
    「自動は IN_PROGRESS 昇格まで・DONE は人が押す」の信頼を損なうため。
- コード定数の変更のため **migration 不要**。`sortOrder` は既存 SAMPLE 行の末尾に置く。
- 自動算出は v1 では行わない（納品書の存在と紐付ける導線は B-106 の領分）。

## 11. PDF（B-086 依存・本書では導線のみ定義）
- 既存 PDF 4本（quotations / production-estimates / purchase-orders / work-orders）は
  すべて `Content-Disposition: attachment` の直 DL。
- 一方 `src/components/pdf/pdf-preview-dialog.tsx` が既に存在し、
  `usePdfPreview().open(endpoint, ids, fallbackName)` で POST → blob → objectURL の
  プレビュー機構を持つ。**B-086 は完全新規ではなくこの適用範囲拡大**である可能性が高い。
- **B-108 の PDF は直 DL 方式を写経しない。** B-086 の新方式（全ページプレビュー →
  承認後 DL）に従う。**実装順は B-086 → B-108 PR3**。
- 本書では帳票レイアウト（発行者ブロック・明細列・金額欄の出し分け）のみ定義し、
  配信方式は B-086 に委ねる。
- 発行者情報は `src/lib/constants/company-profile.ts`（ハードコード定数）。
  納品書は適格番号を要さないため v1 は現状のままでよい。
  **`Invoice.issuerTaxId`（NOT NULL）の出所整備は B-109 の必須前提**。

## 12. 画面構成（✓ 確定）
- **一覧画面を作る**。サイドバー「納品（DLV）」は `sidebar-ui-design-2026-05-27` で設計済み。
- **品番カルテ内にも「納品」セクションを置く**。配置は `products/_components/` の
  フラット構成に新設（`delivery-note-section.tsx`）。直近の写経モデルは
  `production-progress-checklist.tsx`（B-101 PR2）。
- 一覧のソート機能は B-107 の領分（横断対応）。

## 13. B 起票 / 取り下げ
- **B-111**: 複数品番で共用する見本（生地ビーカー等）の按分。`PoAllocation` 系と同根。
- **B-112 は取り下げ**（`DeliveryDestination` の Buyer 必須緩和）。
  `Client.shipping*` で直納先を引けるため不要。
- **B-113**: 納品書の受領確認（`RECEIVED` / 受領サイン）。
- **B-114**: 量産納品書（SKU×サイズ）。§3-1 の代償によりアプリ側で `skuId` 必須を担保すること。

## 14. 実装分割
- **PR1**: migration（`DROP NOT NULL` ×2・4ゲート）＋ actions（CRUD・採番）＋ 一覧画面
- **PR2**: 引き当て UI（3タブ・チェックボックス一括追加）＋ カルテ内セクション
  ＋ `SAMPLE_TASK_TEMPLATE` への納品行追加
- **PR3**: PDF（★B-086 完了後）

## 15. 未確定・次セッションへの申し送り
- `delivery_notes` / `delivery_note_items` の実件数は**未実測**。ゲート2 で確認する。
- B-086 の実装方式（`pdf-preview-dialog.tsx` の適用範囲拡大で足りるか）は未 recon。
  B-108 PR3 の前に B-086 の recon が必要。
