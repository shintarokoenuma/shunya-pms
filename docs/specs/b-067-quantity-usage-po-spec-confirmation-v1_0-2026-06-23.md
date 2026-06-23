# B-067 設計確認書 — 数量→用尺→PO 連動（生産発注の前方向）v1.0

- 日付: 2026-06-23（セッション12）
- 起票: SESSION_HANDOVER セッション11 ③（B-067）
- 位置づけ: 数量マトリクス（SKU別 productionQuantity）と BOM 用尺から資材所要量を自動計算し、生産発注（WO／副資材 PO）へ流す導線の第一段。v0.1 → 全論点 D1〜D6 を推奨で確定し v1.0。
- 根拠 spec: Part3 §5.1（発注3タイプ）/§154（量産発注 自動連動）/§526（仕様書 素材情報=BOM連動）、PO addendum v1.1 §76（製品サイズ展開は Product/SKU 側が正・明細に持たせない）、quotation_engine（用尺計算式）。
- 現物確認: 2026-06-23 read-only recon（live schema grep + src 配線棚卸し）。

## 0. 棚卸し結論（recon・事実）
- 入力 Sku.productionQuantity／計算材料 BomItem.usagePerUnit・lossRate／出力 PoItem.quantity・WoItem は schema・action として実在。
- 前方向（量産数 × 用尺 → 資材所要量 → 発注）の計算・転記は未実装。
- totalUsagePerUnit 列は存在するが src から一切読み書きされず死蔵。withLoss() は bom-section.tsx の UI 表示用「1枚あたり」止まり。数量を掛ける処理はゼロ。
- 既存 BOM↔PO 連結は逆向きのみ（boms.ts listPoItemsForBomImport＝PO→BOM コスト取り込み・QE-0d、BomItem.purchaseOrderId＝コスト引き当て元、purchase-orders.ts 削除ガード）。前方向との衝突なし。

## 1. 目的
品番（Product）の SKU 別 productionQuantity と BOM 用尺（usagePerUnit・lossRate）から資材ごとの所要量を自動計算し、生産発注（工場発注 WO の数量明細／仕様書発注=副資材 PO）の参照値とする。

## 2. 計算モデル（quotation_engine と同一の式）
- ロス込み用尺: totalUsage = usagePerUnit × (1 + lossRate/100)
- 資材所要量: 所要量 = Σ(対象 SKU の productionQuantity) × totalUsage
- 単位は BomItem.unit（m/個/kg）のまま。

## 3. 確定論点（D1〜D6）
### D1. 集計軸 = カラーウェイ別（確定）
- BomItemColorway を持つ資材: ProductColorway ごとに1行。所要量 = Σ(該当カラーウェイに属する SKU の productionQuantity) × totalUsage。調達色は BomItemColorway.supplierColorCode。
- BomItemColorway を持たない資材（色非依存の共通副資材等）: 全 SKU 合計で1行。
- サイズ（S/M/L）は合算で消える。根拠: Sku は colorway×size 軸、PoItem はサイズを持たない（PO addendum §76＝サイズは Product/SKU 側が正）。発注の意味的分割軸はカラーウェイ（BomItemColorway＝B-062 資材×カラーウェイ調達色）。

### D2. ロス込み用尺の出所 = 都度計算（確定）
- usagePerUnit × (1+lossRate/100) を単一の真実として都度計算。totalUsagePerUnit 列は引き続き使わない（保存するとロス率変更時にドリフト＝派生値を持たない方針）。列の用途は QE-1 で別途判断。

### D3. 単位と丸め = 連続量まで（確定）
- v1.0 は必要量（連続量・BomItem.unit のまま）まで。反・巻への丸め（生地幅・反メーター数＝規格）は B-039 未着手のため非スコープ。

### D4. v1.0 スコープ = (ア) 計算ビューのみ（確定）
- 品番詳細に「資材所要量」セクションを read-only 追加。BomItem×カラーウェイ別の所要量を表示。発注を手入力で作る際の参照値。
- 書き込み（PoItem/WoItem の draft 自動生成）は本書スコープ外＝次増分（B-057 BOM→PO draft と統合）。
- 理由: 数量×用尺の計算と集計軸を画面で目視確定できる安全な最小増分にし、書き込みは計算が固まってから。

### D5. 配分タイプ = DIRECT のみ（確定）
- v1.0 は DIRECT（1品番完結）のみ。SHARED（1反を複数品番按分）/STOCK（在庫プール）は非スコープ。

### D6. 端数・欠損（確定）
- usagePerUnit=null（用尺未入力）の資材: 所要量を出さず「用尺未入力」で除外表示。
- productionQuantity=0: 0。
- BomItemColorway 持ちで該当 SKU が無いカラーウェイ: 0。

## 4. 非スコープ（明記）
- 歩留まり率5%（受注→量産＝フェーズ2 SalesOrder 連携時）。v1.0 は productionQuantity を量産数として受ける（フェーズ1 手入力）。
- 反・巻丸め（B-039 規格構造化）。
- SHARED・STOCK 按分。
- PoItem/WoItem 自動生成（D4(イ)＝後段・B-057）。
- 原価計算（QE-1）。

## 5. 実スキーマ参照（recon・2026-06-23）
- Sku: productionQuantity Int@default(0)/orderedQuantity/colorwayId(ProductColorway Cascade)/size/sizeOrder。
- BomItem: usagePerUnit Decimal?(10,4)/lossRate Decimal@default(0)(5,2)/totalUsagePerUnit Decimal?(死蔵)/unit/usageSource/colorways BomItemColorway[]。
- BomItemColorway: bomItemId × productColorwayId × supplierColorCode。
- ProductColorway: colorwayCode/colorId?(純scalar)/patternId?(純scalar)/skus Sku[]。
- PoItem: quantity Decimal(15,4)/unit/materialId?。skuId は持たない。
- PurchaseOrder: poType/allocationType(DIRECT/SHARED/STOCK)/primaryProductId?。

## 6. 次段（v1.0 確定後）
1. 実装ブリーフ（D4(ア) 計算ビュー）: 品番詳細に資材所要量セクション（read-only・サーバ集計 or クライアント集計の判断は実装ブリーフで）。
2. 後段 B-057（PoItem/WoItem draft 生成）= D4(イ)。本書の計算ロジックを土台に。

## 改訂履歴
| 日付 | 版 | 変更 | 担当 |
| --- | --- | --- | --- |
| 2026-06-23 | v0.1 | recon を踏まえ論点 D1〜D6 提示 | 慎太郎さん + Claude |
| 2026-06-23 | v1.0 | D1〜D6 を推奨で全確定（集計軸=カラーウェイ別・用尺都度計算・連続量まで・スコープ=計算ビューのみ・DIRECT のみ） | 慎太郎さん + Claude |
