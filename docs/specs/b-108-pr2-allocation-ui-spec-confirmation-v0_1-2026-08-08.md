# B-108 PR2 引き当て UI 仕様確認書 v0.1（2026-08-08）

- 種別: 仕様確認書 v0.1（**⑫ の1点のみ要確認**。それ以外は確定）
- 対象: B-108 PR2 = 引き当て UI（3タブ・一括追加）＋ 品番カルテ内セクション
  ＋ `SAMPLE_TASK_TEMPLATE` への納品行追加
- 上位仕様: `b-108-sample-delivery-note-spec-confirmation-v1_0-2026-08-05.md`
  （§5 起票フロー / §3-2 マッピング / §10 進行タスク / §12 画面構成 / §14 実装分割）
  ＋ 同追補 v1.1（2026-08-08・PR #125 実装時の確定）
- 前提: PR1 完了（PR #125・`629da41`・本番稼働確認済み）
- 現物確認: 2026-08-08 recon（本書 §2 に raw 記載）

---

## 1. 本書が上位仕様を変更する点

### 1-1. 写経元の訂正（§5 の訂正）

§5 は「一覧＋チェックボックス → 一括追加。写経元は `generateProductionOrders`
（`production-order-generation.ts:119`）」とするが、**実装を読むと型が違う**。

`production-order-generate-form.tsx`（338行）は「明細ごとに相手先 Select を割り当てて
1つの生成ボタンを押す」型であり、チェックボックスによる多選択→一括追加ではない。

**実態に合う写経元は `AddProcessingDialog`**（`samples/_components/progress-checklist.tsx`）。
ProcessingType のチェックボックス一覧 → `addProcessingTasks` で一括追加、という
まさに本件と同型の実装が既にある。**本書はこちらを写経元とする。**

### 1-2. B-121 の取り下げ

参考サンプルの売り立てなど品番を登録しない納品について、**実在ブランドに紐づけて
通常どおり品番を起こす**方針が確定した（慎太郎さん確定 2026-08-08）。

根拠: `product-sample-spec §4-1(d)`「品名だけで動かず、必ず案件（Product）として
立ち上げてから動く。品番未確定の宙ぶらりんな下書き状態は持たない。社内品番は
社内採番なので先方品番が無くても案件立ち上げ時に必ず振れる」。

よって `delivery_note_items.product_id` の DROP NOT NULL は不要。
**B-121 は B-112 と同じく「取り下げ」とする。**

---

## 2. recon で確定した現物（2026-08-08・dev = hopper:12921）

### 2-1. 引き当て元のスキーマ

`SampleProduction`: `productId`(NOT NULL) / `sampleNumber` / `sampleRound` /
`sampleQuantity` Int @default(1) / `status`。

`WoItem`: `woId` / `workDescription` VarChar(500) / `quantity` Int /
`unit` @default("枚") / `unitPrice` Decimal? / `billingClassification`? /
`skuId`? / `colorCode`?。**`productId` 列は持たない。**

`PoItem`: `poId` / `customItemName`? / `description`? Text /
`quantity` **Decimal(15,4)** / `unit` / `unitPrice` Decimal? /
`billingClassification`? / `isPhysicalAsset`。**`productId` 列は持たない。**

### 2-2. 品番の解決経路と、その穴（★重要）

WO/PO 明細は品番を持たないため、親から解決する:
- `WoItem` → `WorkOrder.productId` = **`String?`（nullable）**
- `PoItem` → `PurchaseOrder.primaryProductId` = **`String?`（nullable）**

validator は PO/WO とも `.refine(d => !!d.productId || !!d.sampleProductionId)` で
「品番 or サンプル製作」いずれか必須とし（野良伝票防止・§4-1(d)）、
action は `SampleProduction.productId ?? data.productId` で導出している。
**ただし DB 制約ではなくアプリ層のみの担保。**

**dev 実データに品番 null が実在する**:
- `purchase_orders`: 9件中 1件が `primary_product_id` null
- `work_orders`: 12件中 2件が `product_id` null

B-078 以前の残骸と推測される。`DeliveryNoteItem.productId` は NOT NULL のため、
これらは引き当て時に必ずハンドリングが要る（→ ⑤）。

**本番にも同種の行があるかは未確認。実装ブリーフ着手前に read-only の count で確認する。**

### 2-3. `DeliveryNoteItem` の引き当て元記録列

存在するのは `soId`? / `soItemId`? / `woId`? / `finishedGoodsMovementId`? のみ
（いずれも休眠の SO/WO 連携列）。**サンプル由来・PoItem 由来を記録する列は無い。**
→ ⑫ の論点。

### 2-4. `SAMPLE_TASK_TEMPLATE` の現行

`src/lib/progress-task-template.ts` に8行:
QUOTE(10) / SPEC_LOCK(20) / PATTERN(30) / FABRIC(40) / TRIM(50) / SEWING(60) /
INSPECTION(70) / CLIENT_REVIEW(80)。PROCESSING は 65 起点で後から追加。
**DELIVERY 行は無い。** `ProgressTaskType.DELIVERY` は enum に既存（schema 1412行）
のため **enum 追加＝不要**。

### 2-5. 品番カルテのセクション順

①進行 / ②サンプル製作ラウンド / ③④基本情報・品番分類 / …（絵型・カラー×数量・BOM・
マーキング・縫製指示・概算量産見積・量産見積・量産実績原価）… /
**⑭発注（`ProductOrdersSection`・`#orders` アンカー・616-617行）** / メタ情報（622行）。

### 2-6. dev の検証データ

- `sample_productions`（active）= **6** → タブ1 は検証可能
- `wo_items` で `billing_classification = 'INDIVIDUAL_BILLING'` = **0**
- `po_items` で `INDIVIDUAL_BILLING` または `is_physical_asset = true` = **0**

→ **タブ2 が検証できない。** 実装ブリーフに dev 検証データの投入を工程として含める。

---

## 3. 確定事項

### ④ 二重引き当て防止 — DB では防がない（✓ 確定）

**同じサンプル・同じ明細を複数の納品書に載せることを禁止しない。**

理由:
- **分納が常態**。サンプル3枚のうち2枚を先に送り、残り1枚を後で送ることは普通にある。
  DB で「一度引き当てたら二度と出さない」にすると、この運用が塞がる。
- 正しく防ぐには数量ベースの消化管理（何枚のうち何枚納品済みか）が要り、
  それは受注(SO)・出荷の領分。**SO モデルは未実装。**

代わりに引き当て一覧に「DLV-2026-0002 で納品済み」の**情報バッジ**を出す。
人が見て判断できれば実務上は足りる。

### ⑤ 親の品番が null の WO/PO 明細 — 除外し、警告として表示（✓ 確定）

`DeliveryNoteItem.productId` は NOT NULL のため、親品番が null の明細は引き当てできない。
**候補から除外するが、折りたたまず警告として明示する。**

    ⚠ 品番が紐づいていないため引き当てできません（2件）
        刺繍パンチ代  WO-2026-0001
        → 発注側で品番を設定してください

理由:
- 引き当てタブの中に品番ピッカーを置いて人に埋めさせると、B-122 と同じものを
  二重に作ることになる。
- 品番 null は**発注側のデータ不備**であり、直すべき場所は納品書ではなく発注。
- **黙って除外してはならない。** ⑥ の趣旨（漏れ検知）に真っ向から反する。
  むしろ「引き当てられない発注がある」ことこそ気付かせるべき情報である。

### ⑥ 候補スコープと漏れ検知（✓ 確定・本 PR の主目的）

慎太郎さん確定（2026-08-08）:
「同じサンプルを二度送ることよりも、**仕入があるのに納品していない**ことの方が
起こりやすく、そちらがまずい」。

**本 PR の引き当て UI は『選択の道具』であると同時に『漏れ検知の道具』として設計する。**

- **候補スコープ = 選択中クライアント配下の全品番・全ブランド。**
  品番カルテの納品セクションから起票した場合も、その品番だけに絞らない。
  1枚に複数品番を載せられる（§1）以上、候補も品番横断が正しい。
- **既定フィルタ = 未納品のみ。** 納品済みはトグルで表示。
- クライアントをまたぐ候補は出さない（納品書1枚は1クライアント宛。
  他社の未納品が混ざると検知したい情報が埋もれる）。

想定 UI:

    ▸ 未納品（既定表示）
        ☐ パターン代   WO-2026-0003  AOI-26SS-M-TS-001  ¥30,000
        ☐ 版代         PO-2026-0007  AOI-26AW-M-TP-001  ¥45,000

    ⚠ 品番が紐づいていないため引き当てできません（2件）
        刺繍パンチ代  WO-2026-0001

    ▸ 納品済みも表示する                      ← トグル（既定 OFF）
        ☑ サンプル代  WO-2026-0002  DLV-2026-0002 で納品済み

### ⑦ 品番なし納品は持たない（✓ 確定）

§1-2 のとおり。B-121 取り下げ。

### ⑧ 写経元 = `AddProcessingDialog`（✓ 確定）

§1-1 のとおり。

### ⑨ 数量の型差（✓ 確定・上位仕様 §3-2 のまま）

`PoItem.quantity` は Decimal(15,4)、`DeliveryNoteItem.quantity` は Int。
**小数を含む場合は引き当て時に警告を出し、人が整数を入れる。自動丸めはしない。**

### ⑩ `SAMPLE_TASK_TEMPLATE` に DELIVERY 行を追加（✓ 確定）

`{ taskType: ProgressTaskType.DELIVERY, sortOrder: 90, isReceived: null }` を末尾に追加。
enum は既存のため **migration 不要**（上位仕様 §10 と一致）。
`AUTO_FROM_DOC_TASK_TYPES` には**含めない**（§10「自動算出は v1 では行わない」）。
納品書の存在と紐付ける自動算出は B-106 の領分。

### ⑪ 品番カルテ内セクション（✓ 確定）

`src/app/(app)/products/_components/delivery-note-section.tsx` を新設し、
**⑭発注（`ProductOrdersSection`・`#orders`）の直後**に置く。納品は発注の下流のため。
写経モデルは `production-progress-checklist.tsx`（上位仕様 §12 の指定どおり）。

---

## 4. ⑫ 未確認論点 — 引き当て元の記録列（★次セッション冒頭で判断）

### 問題

⑥ で「未納品のみ」を**既定フィルタ**にすると決めた結果、
**「納品済みか否か」の判定精度が、漏れ検知の信頼性を直接左右する**ようになった。

しかし §2-3 のとおり `DeliveryNoteItem` にはサンプル由来・PoItem 由来を
記録する列が無い。判定を「productId + 品名 + 数量の一致」のような推測で行うと、
誤って「納品済み」と判定された行が**既定で非表示になる**。
これは ⑥ が防ごうとしている漏れを、システム自身が作り出すことになる。

- バッジだけなら誤判定は「表示の間違い」で済む。
- **フィルタで隠すと事故になる。**

### 案A（推奨）: 引き当て元3列を追加する

`DeliveryNoteItem` に additive-only で追加:

    sourceSampleProductionId  String?  @map("source_sample_production_id")
    sourceWoItemId            String?  @map("source_wo_item_id")
    sourcePoItemId            String?  @map("source_po_item_id")

いずれも nullable・index 付与。

根拠:
- **命名は既存規約に沿う。** `ProductionEstimateItem` に `sourcePoItemId` /
  `sourceWoItemId` が既に実在する（2026-07-22 recon で確認済み）。
- **additive-only。** PR1a の `DROP NOT NULL`（片道切符）とは性質が違い、
  非破壊で戻せる。ただし migration である以上 **triple-gate は厳守**。
- 判定が確実になり、⑥ の漏れ検知が信頼できるものになる。
- 将来の数量ベース消化管理（SO 実装時）の土台にもなる。

既存の `woId` は SO/WO 連携用の休眠列であり、意味が異なるため流用しない。

### 案B: 列を追加せず、既定フィルタを外す

migration を避ける代わりに、**既定は全件表示・納品済みバッジのみ**とする。
判定は推測ベースになるが、誤判定しても行が隠れないため事故にならない。
⑥ の「未納品のみ」フィルタは提供するが既定 OFF。

### 判断

**案A を推奨。** ⑥ が本 PR の主目的である以上、その判定基盤を推測に委ねるべきではない。
案A を採る場合、本書は v1.0 に更新し、migration を triple-gate 対象として明記する。

案B を採る場合も本書は成立する（④⑤⑥⑦〜⑪ は変更不要。⑥ の「既定 未納品のみ」を
「既定 全件・フィルタは任意」に読み替える）。

---

## 5. 実装分割（⑫ の判断後に確定）

案A の場合:
- **PR2a**: migration（引き当て元3列・triple-gate）
- **PR2b**: 引き当て UI（3タブ・一括追加）＋ 漏れ検知フィルタ
- **PR2c**: カルテ内セクション ＋ `SAMPLE_TASK_TEMPLATE` の DELIVERY 行

案B の場合:
- **PR2a**: 引き当て UI（3タブ・一括追加）＋ バッジ
- **PR2b**: カルテ内セクション ＋ DELIVERY 行

---

## 6. 実装前に必ず行うこと

1. **本番の品番 null 行の確認**（read-only の count のみ・§2-2）。
   dev に PO 1件・WO 2件あった。本番にもあれば ⑤ の警告表示が実際に効く。
2. **dev 検証データの投入**（§2-6）。`INDIVIDUAL_BILLING` の WoItem / PoItem が
   dev に0件でタブ2 が検証できない。投入しないまま実装しても動作確認ができない。
3. **dev サーバの再起動**（migration を伴う場合）。2026-08-08 の教訓:
   `@prisma/client` はプロセス起動時に一度ロードされ、ホットリロードでは
   差し替わらない。再生成後は必ず再起動し、それ以前の目視確認はやり直す。

---

## 7. スコープ外

- **PDF**（B-108 PR3・★B-086 完了後。上位仕様 §11 / §15）
- **納品書の存在による進行タスク自動算出**（B-106）
- **数量ベースの消化管理**（受注(SO)・出荷の領分・SO モデル未実装）
- **品番ピッカーの改善**（B-122・本 PR 完了後に再評価）
- **量産納品書**（B-114・SKU×サイズ）
- **請求書**（B-109）/ **輸出書類**（B-110）

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-08 | v0.1 | 初版。④〜⑪ を確定。写経元を `AddProcessingDialog` に訂正・B-121 取り下げ・⑥ 漏れ検知を本 PR の主目的として定義。⑫（引き当て元列の追加可否）のみ未確認 |
