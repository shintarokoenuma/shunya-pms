# ID体系・番号・紐付け 棚卸し v0.1（2026-06-25）

## §0 メタ
- 対象: shunya-pms 生産フロー全体（15モデル ＋ 主要動線）。B-065/B-069・見積もり(QE-1)の上流土台。
- 読取基準: main 先頭 `2bdfdee`（#93=082f5fd の上の docs-only commit。`git diff 082f5fd..2bdfdee` は docs のみ＝prisma/src は 082f5fd と完全同一）。
- 抽出: Claude Code read-only（2026-06-25）。DB 非接続・静的読取・書込なし。
- 凡例: **@relation** = Prisma リレーション（DB FK 制約あり）／**scalar** = id 文字列列のみ（@relation なし・FK 制約なし）。
- 位置づけ: 「事実」＝Claude Code 抽出。「〔Qn〕」＝Claude.ai 付箋（問いの形・結論は出さない）。**確定事項は §5 に明記**。

## §1 採番マップ
| モデル | 番号列 | prefix | 連番 | 通し単位 |
|---|---|---|---|---|
| Product | productCode | `{BRAND}-{SEASON}-{CATEGORY}-` | 3桁 | season×category 内 |
| ModelCode | modelCode | `M-{BRAND}-` | 4桁 | brand 通し |
| SampleProduction | sampleNumber | `SP-{year}-` | 4桁 | 年内 |
| PurchaseOrder | poNumber | `PO-{year}-` | 4桁 | 年内 |
| WorkOrder | woNumber | `WO-{year}-` | 4桁 | 年内 |
| Sku | skuCode | `{productCode}-{colorwayCode}-{size}`（合成） | — | — |
| ProductColorway / Material / Bom | colorwayCode / materialCode / version | — | 採番関数なし（手入力/サジェスト） | — |

**方式（5関数共通・現物確認済）**: `findFirst({ orderBy: { 番号列: "desc" } })` で既存最大番号を取得 → 末尾 `match(/-(\d+)$/)` を `parseInt + 1`。`count`/`max` 不使用。**where に `deletedAt: null` 無し**。
→ 「最大番号 +1」方式のため soft-delete 行を含めても**番号重複は起きない（欠番は許容）**＝当初の「件数+1」懸念は否定。残る論点は3つ:
- 〔Q1a〕並行レース（同時2リクエストが同じ最大番号を読む）。B-048（PO の retry）は既出だが Product/ModelCode/SP/WO も**同一構造を共有**。retry は横断適用候補。
- 〔Q1b〕`orderBy` は**文字列降順**。padStart 桁（PO/WO/SP/ModelCode=4桁・Product=3桁）超過で `"10000" < "9999"` となり最大番号を誤検出し重複し得る。実害リスクは **Product 3桁=999/(シーズン×カテゴリ)**。年内リセットの PO/WO/SP は実質余裕。
- 〔Q1c〕最大番号行の**物理削除**で番号巻き戻り。soft-delete 運用なら安全。hard-delete 経路の有無は §7 宿題。
- 〔Q2〕通し単位が非対称（ModelCode=brand 通し / Product=season×category 内 / PO・WO・SP=年内リセット）。意図確認。
- 〔Q3〕`skuCode` は productCode・colorwayCode の合成固定値。後から元コード変更時に追従するか乖離するか。

## §2 ID マップ（15モデル・1モデル1ブロック）
凡例は §0。被参照は「親として持つ子（@relation []）」＋「scalar で指されている箇所」。

### Product（schema 1943 / products）
- PK `id` uuid / 番号列 `productCode`。
- 親参照: `modelCodeId`(@relation required) / `inquiryId?`(@relation) / `clientId`(scalar req) / `brandId`(scalar req) / `categoryId?`(scalar) / `designerId? patternMakerId? assignedToUserId?`(scalar)。
- 子: `skus[] / statusHistory[] / collectionLinks[] / colorways[]`（@relation）。
- **scalar 被参照（FK なし）**: PurchaseOrder.primaryProductId / WorkOrder.productId / SampleProduction.productId / ProgressTask.productId / Bom.productId。
- 〔付箋〕品番は背骨だが、これを指す5本がすべて scalar＝DB は品番の存在を保証しない。

### ModelCode（1871 / model_codes）
- PK `id` uuid / 番号列 `modelCode`。
- 親参照: `brandId`(scalar req) / `categoryId?`(scalar) / `latestProductId?`(scalar)。
- 子: `products[]`（@relation）。

### SampleProduction（4695 / sample_productions）
- PK `id` uuid / 番号列 `sampleNumber`。
- 親参照: `productId`(scalar **req**) / `parentSampleId?`(scalar＝1ST/2ND 世代) / `specificationId? patternVersionId? designVersionId? patternWoId? sewingWoId?`(scalar)。
- 子: `revisions[]`（@relation）。scalar 被参照: ProgressTask / PurchaseOrder / WorkOrder の sampleProductionId。
- 〔付箋〕productId は必須だが scalar。Product 削除時の孤児サンプルを DB は防がない。

### ProgressTask（1352 / progress_tasks）
- PK `id` uuid / 番号列なし・採番なし。
- 親参照: `productId`(scalar **req**「背骨」) / `sampleProductionId?`(scalar・コメント「A-2 では実質必須」) / `processingTypeId?`(scalar)。
- 子 [] なし。scalar 被参照: PurchaseOrder.progressTaskId / WorkOrder.progressTaskId。
- 〔付箋〕「背骨(必須)」も「実質必須」も scalar/optional でスキーマ未担保。validator で締めるか。

### PurchaseOrder（3888 / purchase_orders）
- PK `id` uuid / 番号列 `poNumber`。
- **品番への解決経路が3本・すべて scalar・すべて optional**: `primaryProductId?`（DIRECT 時）/ `progressTaskId?` / `sampleProductionId?`。`supplierId`(scalar req)。
- 子: `items PoItem[] / allocations PoAllocation[]`（@relation）。→ §3・§5 へ。

### WorkOrder（4159 / work_orders）
- PK `id` uuid / 番号列 `woNumber`。
- 親参照: `factoryId? contractorId? productId? modelCodeId? progressTaskId? processingTypeId? patternVersionId? samplProductionId?` ＝**全て scalar・全て optional**（required な親なし）。
- 子: `items WoItem[]`（@relation）。
- 〔付箋〕品番にも工場にも紐づかない WO が作れる。許容か。

### PoItem（4051 / po_items）
- PK `id` uuid / 番号列なし（`itemOrder` Int）。
- 親参照: `poId`(@relation req・Cascade) / `materialId?`(scalar) / `costCategoryId?`(scalar)。
- **色は `colorCode`/`colorName` 文字列のみ。品番列・productColorwayId 列なし。** → §4・§5 へ。
- 補足: `PoItem.id` は不安定（updatePurchaseOrder が delete+recreate）。安定参照は `purchaseOrderId`。

### WoItem（4345 / wo_items）
- PK `id` uuid。親参照: `woId`(@relation req・Cascade) / `skuId?`(scalar・@relation なし) / `costCategoryId?`(scalar)。
- 〔付箋〕skuId が緩い。Sku 側も WoItem を子に持たない。

### Bom（2646 / bom）
- PK `id` uuid / `version` 手入力。親参照: `specificationId? @unique`(@relation・Cascade) / `productId?`(scalar・コメント「validator で必須担保」)。
- 子: `items BomItem[]`（@relation）。
- 〔付箋〕品番接続を DB で締めず validator 頼み。

### BomItem（2692 / bom_items）
- PK `id` uuid（`itemOrder` Int）。親参照: `bomId`(@relation req・Cascade) / `materialId?`(scalar) / `supplierId?`(scalar) / `markingRecordId?`(scalar・FK なし明記) / `purchaseOrderId?`(scalar・FK なし明記＝コスト引当元)。
- 子: `colorways BomItemColorway[]`（@relation）。

### Sku（2109 / skus）
- PK `id` uuid / 番号列 `skuCode`（`{productCode}-{colorwayCode}-{size}` 合成）。
- 親参照: `productId`(@relation req・Cascade) / `colorwayId`(@relation req・Cascade)。scalar 被参照: WoItem.skuId。

### ProductColorway（2768 / product_colorways）
- PK `id` uuid / `colorwayCode` 手入力。親参照: `productId`(@relation req・Cascade) / `colorId?`(scalar・FK なし) / `patternId?`(scalar・FK なし)。
- 子: `bomItemColors BomItemColorway[] / skus Sku[]`（@relation）。

### Material（1105 / materials）
- PK `id` uuid / `materialCode`（`@@unique([companyId, primarySupplierId, materialCode])`）。
- 親参照: `categoryId?`(@relation) / `primarySupplierId`(@relation req・Restrict)。scalar 被参照: BomItem.materialId / PoItem.materialId。

### Collection（2183 / collections）・CollectionProduct（2250）・BomItemColorway（2797）
- Collection: 親 `clientId? brandId? assignedToUserId?`(scalar) / 子 `productLinks[]`。
- CollectionProduct: `collectionId`(@relation req) / `productId`(@relation req)・ともに Cascade。
- BomItemColorway: `bomItemId`(@relation req) / `productColorwayId`(@relation req)・Cascade。`supplierColorCode`(C/# 文字列)。

## §3 横断論点：発注 ↔ 品番の解決経路（北極星の核）
事実: PO→品番は3経路（primaryProductId / progressTaskId / sampleProductionId）すべて **scalar・optional**。productId のサーバ導出は `createPurchaseOrder` で `sampleProductionId → SampleProduction.productId → primaryProductId` の一本のみ。**progressTaskId 単独だと primaryProductId=null のまま**。
- 〔Q4〕「PO は必ず1品番に解決」が DB でも validator でも未担保。3経路とも null の PO が作れる。作成時に品番解決を強制すべきか。
- 〔Q5〕progressTaskId 単独 PO（品番未解決）は仕様か穴か。
- 〔Q6〕primaryProductId は scalar。存在しない/削除済み productId を DB が弾かない。@relation 化か validator 止まりか。
- 〔Q7〕**品番カルテから「発注を作る」直接導線が無い**（§4）。品番起点で発注を起こす導線（B-069 前提）を新設すべきでは。
→ この一本化が **B-069 本体の核**。棚卸しでは結論を出さず問いに残す。

## §4 動線マップ（主要導線の ID 受け渡し）
- **PO 新規の唯一導線** = `samples/_components/progress-checklist.tsx:295` → `/purchase-orders/new?progressTaskId=…&sampleProductionId=…`。productId は渡らない。`new/page.tsx` は両 ID を context にし、フォームに品番選択 UI なし。productId はサーバ導出のみ。
- WO も同型（:305）。発注は「サンプルの進行チェックリストのタスク」起点で sampleProductionId 経由でのみ品番に接続。
- **品番カルテ（products/[id]/page.tsx）の遷移は `/samples/new?productId=` のみ**。発注/WO への直接リンクなし。品番→（サンプル→進行タスク→PO）の順でしか発注に至らない。
- 〔Q8〕BOM→PO 取り込み: `listPoItemsForBomImport(productId)` の絞り込みは `progressTaskId in (品番の ProgressTask 群) OR primaryProductId = 品番` の2系統。sampleProductionId 経由（primaryProductId 導出済）と progressTaskId 単独（primaryProductId=null）が同一品番で混在時の漏れ/重複検証は未確認。`importPoItemsToBom` は PO 明細色を BomItem の `colorCode`/`colorName` 文字列へ写すのみ・productColorwayId 不介在＝要件A の障害点。

## §5 確定事項：要件A・要件B（本日協議で確定）

### 要件A — productCode 起点で「1STサンプルに使った素材」を辿る
- **粒度を品番(productId)で確定。色(カラーウェイ)粒度は不要。**
- 根拠: 1枚単価は「製品単価インクルード費目の合計 ÷ 枚数」で算出可（`product-sample-spec §6-2` の売り立て区分＝個別売り立て/製品単価インクルード）。色別按分を要しない。素材は品番に1 BOM・色共通ベース・C/# のみ色別（SKU=ProductColorway×サイズ／付属マトリクス設計）。色で素材が本質的に変わるものは**別品番運用**（構造的含意。「色が変われば別品番」の明文は spec に無く、明文化は小 B 起票候補）。
- 解決の鎖と現状の切れ目: `Product → 1ST SampleProduction(parentSampleId=null) → ProgressTask → PO → PoItem(materialId)`。切れ目=①PoItem に品番列なし（間接ルート依存）②progressTaskId 単独 PO は漏れる③「1ST」絞り込みが世代判定に依存。

### 要件B — 按分（productCode を跨ぐ発注）
- 業務前提: 1反の生地を複数型で按分／裏地など共通資材を複数品番で共用＝**1つの素材手配が複数 productCode にまたがる**。
- 土台: `PoAllocation`（po_allocations）は **設計済みだが src 参照0件＝休眠**。`poItemId?`（特定明細配分）/ `productId`（配分先品番・scalar）/ `allocatedQuantity`(req) / `allocatedAmount?` / `allocationPercent?` / `status`。慎太郎さんの2例（数量按分・比率/共通）に構造対応。粒度は**品番まで**（色なし）＝要件A の粒度と一致。
- **採用＝案α'（色なし版）**: 通常は `PoItem.productId` を1列持たせ要件A を直接解決（`where:{productId}`）。按分は休眠 `PoAllocation` を起こす。通常手配に配分テーブル不要。
- 実装フェーズ: **按分本体（UI/配分ロジック）は Phase 2 または 3 でベース構築**。今は「ベースを壊さない」のみ。
- 残論点: 〔Q10a〕按分時 `PoItem.productId` は null か代表品番か。〔Q10b〕`PoItem.productId` と既存3経路（§3）の一本化＝B-069 本体で確定。

## §6 触らないガード（確定済み・轍ガード）
- ProductColorway.colorId（B-063・Color マスター緩い参照）／patternId（B-066-③・TextilePattern 緩い参照・色×パターン組合せ爆発回避で意図的に @relation なし）。
- BomItem.purchaseOrderId / markingRecordId が scalar・FK なし（コスト引当の house style。安定参照は PoItem.id でなく PO 本体 id）。
- Bom.productId が scalar（QE-0a house style・validator 必須担保）。
- WorkOrder.`samplProductionId` の綴り（B-035・意図的温存・後で直す既知 backlog）。

## §7 次段の宿題（事実未確定・要 read-only 追確 or 別起票）
- hard-delete 経路の有無（Q1c の重複リスク判定）。
- Product 3桁=999/(シーズン×カテゴリ) 上限の扱い（Q1b）。
- 「色が変われば別品番」の明文化（品番設計 spec へ1行・小 B 起票候補）。
- 採番 retry の横断適用（B-048 を Product/ModelCode/SP/WO へ拡張するか）。

## §8 改訂履歴
- v0.1（2026-06-25）: 初版。Claude Code read-only 抽出（採番5関数・15モデル ID マップ・主要動線・PoAllocation）に基づき、Q1〜Q10 を整理。要件A（品番粒度確定・色不要）／要件B（案α'・PoAllocation 起こす・Phase2/3）を §5 に確定。慎太郎さん + Claude.ai。
