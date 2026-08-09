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

---

# 追補（2026-08-08・本追補をもって本書を v1.0 確定とする）

**本追補は本書 §4 の ⑫ を確定させる。** 本書冒頭の「⑫ の1点のみ要確認」および
§4 の「未確認論点」という表記は、本追補が上書きする。以後 §4 は
「案A で確定した論点の検討記録」として読むこと。

## B-1. ⑫ の確定 — 案A（引き当て元3列を追加する）を採用

慎太郎さん確定（2026-08-08）。`DeliveryNoteItem` に additive-only で3列を追加する。

    sourceSampleProductionId  String?  @map("source_sample_production_id")
    sourceWoItemId            String?  @map("source_wo_item_id")
    sourcePoItemId            String?  @map("source_po_item_id")

いずれも nullable・index 付与・backfill 不要（既存行は null ＝「不明」で意味的に正しい）。

### 案B を退けた理由（§4 の記載より強い根拠）

**推測ベースの納品済み判定は原理的に成立しない。** §4 は「誤判定が起こりうる」と
書いていたが、実際には引き当て直後から一致しないことが確定している:

1. 引き当て後、明細の品名・数量は人が上書きできる。とくに ⑨ により
   `PoItem.quantity` が小数の場合は**必ず**人が整数に直す。数量一致は成立しない。
2. ④ で分納を許容した以上、数量一致はそもそも判定材料にならない。
3. 手入力行（タブ3）と引き当て行を区別する手段が無い。

したがって「productId + 品名 + 数量の一致」はたまたま当たる場合があるだけで、
⑥（漏れ検知）の判定基盤には使えない。

### 今が最も安いタイミングである根拠

`delivery_notes` は本番でまだ実データを作成していない（PR #125 の本番 smoke test は
表示確認のみ）。後から列を足すと、それまでに作成された納品書行がすべて null になり、
漏れ検知の履歴に穴が空く。上位仕様 §3-1 で `DROP NOT NULL` を承認したときと
同じ「テーブルが空の今が最も安全」という論理がそのまま当てはまる。

## B-2. 案A に付す不変条件（3点・実装時に必ず守ること）

### (a) 判定不能は必ず「未納品」側に倒す

引き当て元 id が現存しない場合、**納品済みとして扱わず、候補に表示する。**
誤って候補に出るのはノイズで済むが、誤って隠すのは ⑥ が防ごうとしている事故そのもの。
「隠す方向の誤判定を作らない」を本 PR の不変条件とする。

### (b) FK（`@relation`）は張らず、scalar + index のみとする

house style に従う。`RoughEstimateItem.sourcePoItemId` は
「@relation なし scalar・`BomItem.purchaseOrderId` と同方式」と明記されている
（quotation-rough-estimate-implementation-brief §1-2）。

加えて本件固有の理由がある。**`PoItem.id` は不安定である。**
`updatePurchaseOrder` は編集のたびに PoItem を物理削除して作り直すため
（QE-1 で原価参照に `poItemId` ではなく `purchaseOrderId` を使うと確定した理由と同じ）、
FK を張ると納品書側が巻き添えになる。

### (c) 列構成は recon 結果で最終確定する（案A′ の可能性）

`ProductionEstimateItem.sourcePoItemId` が同じ穴を持ちながら問題化していないのは、
あちらが「どこから焼いたかの記録」専用で、id が死んでも金額は行に焼き込み済みだから。
**納品書は id を判定に使う**ため用途が異なる。

`updateWorkOrder` も明細を作り直しているなら、親伝票 id（安定）を併せ持つ
**案A′**（`sourcePurchaseOrderId` / `sourceWoId` を追加）を検討する。
親レベルでバッジを担保し、行レベルは best-effort とする切り分け。

## B-3. 実装ブリーフ着手前 recon に追加する項目

本書 §6 の3項目に加え、以下を read-only で確認する。

4. **`updatePurchaseOrder` / `updateWorkOrder` の明細更新方式**
   （deleteMany → create か、id を維持する upsert か）を現物 grep で確認する。
   結果により B-2(c) の案A / 案A′ を確定する。
5. **`DeliveryNote` の計上日（納品日・出荷日）列の有無と入力経路**を確認する。
   → 理由は B-4。

## B-4. 締め処理（期間ロック）を前提とした受け皿の確認

慎太郎さん指摘（2026-08-08）:
「発注もそうだけど、納品書も月末で締め処理をした後は修正不可にしないとダメ」。

**締め処理そのものは本 PR のスコープ外とし、B-123 として起票する**
（→ `docs/b-123-period-close-lock-design-note-2026-08-08.md`）。
理由は3点:

1. 締めは納品書だけの機能ではなく PO/WO/請求を横断する期間ロック機構であり、
   納品書だけに実装すると請求（B-109）で作り直しになる。
2. 締め単位はクライアント別の締日（末締め・20日締め等）に依存し、
   `Client` の締日マスターが前提になる。現状未確認。
3. 本 PR の主眼は引き当て UI と漏れ検知であり、締めを混ぜると PR が肥大化する。

ただし**受け皿の確認だけは本 PR の recon で行う**（B-3 の項目5）。
締めは計上日で期間を切るため、`createdAt` で切ると月をまたいで入力した伝票が
別の月に落ちる。人が入力する計上日相当の列が無ければ、締めを入れる段で
migration が必要になることが今の段階で判明する。

### ⑫ と締めの関係

締めを前提に置くと **案A はより強く支持される**。締め後の訂正は
「編集」ではなく「取消（赤伝）＋再発行（黒伝）」になるため、
訂正伝票が元伝票のどの行を打ち消しているかを辿る必要がある。
引き当て元の記録はその土台になる。推測ベースでは訂正の連鎖を追えない。

## B-5. 実装分割の確定（§5 の案A を採用）

- **PR2a**: migration（引き当て元3列・**triple-gate 厳守**）
  ゲート1 dev 適用 → ゲート2 ★マージ前★ 本番 dry-run（BEGIN/ROLLBACK・行数実測）
  → ゲート3 マージ（= 自動デプロイ = 自動適用）→ ゲート4 実測。
  dev 適用後は **dev サーバを必ず再起動**する（§6-3 の教訓）。
- **PR2b**: 引き当て UI（3タブ・一括追加）＋ 漏れ検知フィルタ
- **PR2c**: カルテ内セクション ＋ `SAMPLE_TASK_TEMPLATE` の DELIVERY 行

## B-6. 改訂履歴（追記）

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-08 | v1.0 | 追補により確定。⑫ を案A（引き当て元3列追加）で確定。不変条件3点（判定不能は未納品側／FK 非付与／案A′ の可能性）を明記。recon 項目を2件追加（明細更新方式・計上日列）。締め処理を B-123 として分離。実装分割を PR2a/2b/2c で確定 |

---

# 追補 v1.1（2026-08-08・recon 結果による ⑫ の再確定）

本追補は v1.0 追補（§B-1〜B-6）の **B-1 と B-2(c) を改訂する**。
根拠は同日実施の read-only recon（§C-1 に raw 記載）。

## C-1. recon で確定した現物

### 明細の更新方式（全て deleteMany → createMany）

| action | 該当箇所 | 明細 id の安定性 |
|---|---|---|
| `updatePurchaseOrder` | `purchase-orders.ts:732-733` | `PoItem.id` は編集のたびに再生成＝**不安定** |
| `updateWorkOrder` | `work-orders.ts:940-941` | `WoItem.id` は編集のたびに再生成＝**不安定** |
| `updateDeliveryNote` | `delivery-notes.ts:709-710` | 同型（自分自身も作り直す）→ §C-3 |

親（`PurchaseOrder` / `WorkOrder`）は soft-delete のみで **id 不変**。

### 命名先例（house style の live 確認）

`schema.prisma` に既存:
- 9608-9609行 `ProductionEstimateItem.sourcePoItemId` / `sourceWoItemId`
- 9668行 `sourceSampleProductionId`（`@@index` 付き・9703行）
- 9727-9728行（別モデル）

いずれも **scalar `@map` ＋ `@@index`・`@relation` なし**。
→ v1.0 追補 B-2(b)（FK 非付与）は house style と完全一致。**変更なし。**

### 計上日の受け皿（B-123 向け確認）

`DeliveryNote.deliveryDate DateTime @db.Date`（**NOT NULL**）が実在。
`@@index([companyId, deliveryDate])` あり。入力経路も実在:
`delivery-note-form.tsx:220`（date 入力）→ `validators/delivery-note.ts:76`（必須）
→ `delivery-notes.ts:510 / 697`（保存）。
→ **納品書は締め導入時の migration 不要。** 詳細は B-123 ノートへ。

## C-2. ⑫ の再確定 — 案A（3列）→ **案A′（5列）** に改訂

v1.0 追補 B-2(c) が「`updateWorkOrder` も明細を作り直しているなら案A′を検討する」
としていた条件が、recon により **成立した**。よって案A′を採用する。

    sourceSampleProductionId  String?  @map("source_sample_production_id")
    sourceWoItemId            String?  @map("source_wo_item_id")
    sourceWorkOrderId         String?  @map("source_work_order_id")
    sourcePoItemId            String?  @map("source_po_item_id")
    sourcePurchaseOrderId     String?  @map("source_purchase_order_id")

すべて nullable・index 付与・`@relation` なし・backfill 不要。

### ★列ごとの役割を厳密に分ける（実装時の必須要件）

役割を曖昧にすると、不安定な行 id でフィルタしてしまい
**v1.0 追補 B-2(a)（隠す誤判定を作らない）を破る。**

| 列 | 安定性 | 用途 |
|---|---|---|
| `sourceSampleProductionId` | **安定**（レコード自体を参照） | **フィルタ可**（タブ1の未納品判定） |
| `sourceWoItemId` / `sourcePoItemId` | 不安定（親編集で dead） | 行レベル特定・**best-effort** |
| `sourceWorkOrderId` / `sourcePurchaseOrderId` | **安定**（soft-delete のみ） | **バッジのみ。フィルタ根拠にしない** |

### 親 id を持つ理由（④ の担保）

④ は「二重引き当てを DB で防がない代わりに情報バッジを出す」で決着している。
行 id だけだと、**発注を1回編集した時点でバッジが消え、④ の代替策が空手形になる。**
親 id があれば「この発注に納品実績あり」まで劣化しても表示は残る。

親 id 単独では「どの行が納品済みか」を特定できないため、
**フィルタの根拠にはならない**（表示のみ）。ここを混同しないこと。

### 命名の変更（recon 案からの修正）

recon の暫定案 `sourceWoId` は**採らない**。
`DeliveryNoteItem` には既に休眠列 `woId` が存在し（v1.0 §2-3・「意味が異なるため流用しない」
と明記済み）、`woId` と `sourceWoId` が並ぶと読み手が必ず混乱する。
親は正式名で対称に揃え、**`sourceWorkOrderId` / `sourcePurchaseOrderId`** とする。

## C-3. ★`updateDeliveryNote` の round-trip 要件（PR2b の必須要件）

`updateDeliveryNote` は明細を全削除→再作成する（v1.1 追補 A-1 で確定した仕様どおり）。
**引き当て元列を追加した後は、この経路が新たな穴になる。**

DRAFT の納品書を編集して保存した時、フォームが `sourceXxxId` を持ち回っていなければ
**引き当て元の記録が静かに消える。** 列を追加した目的そのものが編集1回で無効化され、
しかも消えたことは画面に現れない。

### 必須要件

1. 編集フォームは明細行ごとに5列すべてを hidden で保持する。
2. `updateDeliveryNote` は再作成時に5列を書き戻す。
3. **検証項目に明記する**:
   「引き当て → 保存 → 編集画面を開く → 変更せず保存 → 引き当て元が残っているか」
   このラウンドトリップ検証を PR2b の受け入れ条件とする。

## C-4. ⑤ の位置づけを格下げ（保険扱い）

慎太郎さん確認（2026-08-08）: **本番の発注はすべて品番カルテから起票されており、
品番が紐づいていない発注は存在しない。** dev の3件（PO 1・WO 2）は開発中の古いデータ。

加えて B-078 の validator（`!!productId || !!sampleProductionId`）により
野良発注は現在塞がっている。

→ ⑤ の警告表示は**実務で使われる機能ではなく、万一のための保険**とする。
   実装内容は v1.0 §3 の ⑤ から変更しない（警告として明示・折りたたまない）。

### §6-1 の消し込み

v1.0 §6 の「実装前に必ず行うこと」1番
（本番の品番 null 行の read-only count）は **不要として取り消す。**
確認するまでもなく存在しないため。これにより **PR2a で本番に触れるのは migration のみ**
となる。本番接続の回数を増やさないことを優先する。

§6 の 2（dev 検証データ投入）と 3（dev サーバ再起動）は**そのまま有効**。

## C-5. B-124 の起票

明細 id の不安定性は QE-1（原価参照を `poItemId` → `purchaseOrderId` に退避）・
本件の引き当て記録・`updateDeliveryNote` 自身で **3例目**。
個別の回避ではなく構造的課題として **B-124** に記録する
（→ `docs/b-124-order-item-id-instability-note-2026-08-08.md`）。
是正の可否は別途判断。本 PR では回避策（親 id 併記）で進む。

## C-6. 改訂履歴（追記）

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-08 | v1.1 | recon 結果により ⑫ を案A→**案A′（5列）**に改訂。列ごとの役割（フィルタ可／バッジのみ）を厳密化。命名を `sourceWorkOrderId` / `sourcePurchaseOrderId` に確定。`updateDeliveryNote` の round-trip 要件を PR2b 必須要件として追加。⑤ を保険扱いに格下げし §6-1 を取り消し。B-124 起票 |

---

# 追補 v1.2（2026-08-09・§C-4 の表現訂正）

本追補は v1.1 追補 §C-4「§6-1 の消し込み」の**表現のみ**を訂正する。
設計内容・列構成・実装分割に変更はない。

## D-1. 訂正

誤解を招く表現:

> これにより PR2a で本番に触れるのは migration のみとなる。

この一文は **§6-1（本番の品番 null 行の read-only count）を取り消した**という
意味であり、triple-gate の免除ではない。正しくは以下。

**PR2a における本番接続は 2 回。いずれも省略不可。**

| ゲート | 対象 | 内容 |
|---|---|---|
| ゲート1 | dev | 手書き SQL 適用 → `migrate diff` で empty-diff 検証 → **dev サーバ再起動** |
| ゲート2 | **本番（★マージ前★）** | dry-run: BEGIN → DDL → 行数実測 → **ROLLBACK** |
| ゲート3 | 本番 | マージ（= Railway 自動デプロイ = `prisma migrate deploy` 自動適用） |
| ゲート4 | **本番** | 実測: 5列の存在確認・行数確認 |

取り消されたのは v1.0 §6 の 1 番のみ。2（dev 検証データ投入）・3（dev サーバ再起動）
および triple-gate 全体は**そのまま有効**。

## D-2. なぜ訂正が必要か

§C-4 の趣旨は「本番接続の回数を無用に増やさない」であって「本番に接続しない」ではない。
しかしこの一文だけが引き継ぎメモを経由して伝わると、
**ゲート2 のマージ前 dry-run を飛ばす判断**につながりうる。

「dry-run はマージ**前**に行う（マージ＝本番適用そのものであるため、マージ後の
dry-run は意味を持たない）」は過去の事故から確定した原則であり、
表現の曖昧さで無効化させない。

## D-3. 改訂履歴（追記）

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-09 | v1.2 | §C-4 の「本番に触れるのは migration のみ」を訂正。PR2a の本番接続はゲート2 dry-run とゲート4 実測の 2 回であり、triple-gate は全ゲート必須であることを明記 |
