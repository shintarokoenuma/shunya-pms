# B-065 設計確認書 — 発注→BOM 取り込みのカラーウェイ指定（C/# 自動反映）v1.0

- 日付: 2026-06-23（セッション12）
- 起票: SESSION_HANDOVER ⑧ B-065（発注引き当て時 C/# 自動反映）。B-067 D4(ア)=PR #93 で C/# 未反映が可視化されたことが契機。
- 位置づけ: PO→BOM 取り込み時に「取り込み先」を指定できるようにする。現状の C/# 別行方式は選択肢の一つ（モード①）として残し、新たに「各カラーへ張る」モード②を追加。
- 根拠 spec: Part3 §5.1（発注3タイプ）、QE-0d（PO→BOM コスト引き当て）。
- 現物確認: 2026-06-23 read-only recon（boms.ts importPoItemsToBom / listPoItemsForBomImport、bom-section.tsx PoImportDialog、bom-item-colorways.ts upsertBomItemColorway）。

## 0. 棚卸し結論（recon・事実）
- 既存 importPoItemsToBom は QE-0d コスト引き当て専用。PoItem ごとに新規 BomItem を1行作成し、color/colorCode は文字列転記のみ。BomItemColorway（C/# カラーウェイ別調達色）は張らない。
- 画面でマスダ C/#100・C/#200 が別 BomItem 2行・C/# 列空欄だったのはこのため（バグではなく動線が無い）。
- C/# を張る部品 upsertBomItemColorway（単発 upsert・supplierColorName は任意 nullable）は完成済み。
- PoItem は colorCode/color（文字列）は持つが productColorwayId を持たない → 色の対応付けは自動確定不可・人が指定する必要がある。

## 1. 目的
PO→BOM 取り込み時、取り込み先を「品目として（新規 BomItem 行）」か「各カラーへ（既存 BomItem のカラーウェイ別調達色＝BomItemColorway）」かを候補行ごとに指定可能にする。

## 2. 2モード
### モード①「品目として」（＝現挙動・維持）
- PoItem → 新規 BomItem を1行作成（現 importPoItemsToBom のまま）。色非依存の副資材や独立行向け。

### モード②「各カラーへ」（＝新規・C/# 自動反映の本体）
- PoItem を既存 BomItem の特定カラーウェイの調達色として張る。
- (取り込み先 BomItem) × (カラーウェイ) を指定し、PoItem.supplierItemCode を supplierColorCode として upsertBomItemColorway で張る。
- 新しい BomItem 行は作らない（E3＝あ確定）。対象 BomItem は事前に BOM に1行ある前提。

## 3. 確定論点（E1〜E6）
### E1. 指定 UI = PoImportDialog の候補行に「取り込み先」追加（確定）
- 各候補行に取り込み先選択: 「品目として（新規行）」 or 「既存 BomItem＋カラーウェイ」。
- 後者選択時: 当該品番の既存 BomItem の select ＋ カラーウェイ（ACTIVE ProductColorway・A/B/C）の select を出す。

### E2. モード②で張る値 = supplierItemCode（確定）
- supplierColorCode ← PoItem.supplierItemCode（仕入先ナンバー・100/200 等）。取り込み時に自動。
- supplierColorName は取り込み時は触らない（空）。

### E3. モード②で BomItem を増やすか = 増やさない（確定・あ）
- 既存 BomItem のカラーウェイ調達色を埋めるだけ。資材行（例: マスダ2001 表地）は事前に1行ある前提。
- 無い場合は「先にモード①で品目として1行取り込む → その行にモード②で C/# を張る」の2段運用。v1.0 はこの2段を許容（モード②が新規作成を兼ねることはしない）。

## E4. 既存マスダ2行（dev）の扱い = データ移行しない（確定）
- 現 dev にモード①相当で入っている C/#100・C/#200 の別 BomItem 2行は、本実装でデータ移行しない。
- 整理は慎太郎さんが画面で手直し or 別途。v1.0 は新規取り込みからモード②を使えるようにするだけ。

### E5. コスト軸（QE-0d）との関係 = モード②ではコスト引き当てなし（確定）
- モード②は BomItem を作らない → costSource/purchaseOrderId のコスト引き当ては起きない（C/# のみ）。
- コストは別途モード①取り込み or 手入力で引き当て。コスト軸とカラーウェイ軸の1操作両立は後段（非スコープ）。

### E6. カラー名の入れ方 = (P) 取り込みは C/# のみ・カラー名は後から BOM 表セルで任意（確定）
- 取り込みダイアログでカラー名は入力しない。
- カラー名（supplierColorName）は取り込み後、既存の BOM 表 C/# セル編集（upsertBomItemColorway の supplierColorName 経路・bom-section.tsx 既存 UI）で入れたい行だけ任意に追加。
- 理由: 全行にカラー名を入れる工数膨張を構造的に回避。カラー名は配色イレギュラー等の注意喚起用の例外注記に限定。

### E6-2. 複数指定 = 候補行ごとの先指定で自然対応（確定）
- C/#100→A・C/#200→B のような複数割り当ては、候補行ごとに先を指定できる UI なので一度の取り込み操作で複数指定可能。
- 一括 upsert action の新設はしない。既存 upsertBomItemColorway をループ呼び出し。

## 4. 非スコープ（明記）
- 色名文字列 → ProductColorway の自動対応付け（人が指定する前提）。
- 既存マスダ2行のデータ移行（E4）。
- コスト軸（QE-0d）とカラーウェイ軸の1操作両立（E5）。
- 柄版（patternId 側の同様反映）。

## 5. 実スキーマ参照（recon・2026-06-23）
- importPoItemsToBom({ bomId, poItemIds }): PoItem ごとに tx.bomItem.create（新規行）。usagePerUnit=null/usageSource=MANUAL/materialId=null/lossRate=0、costSource=PURCHASE_ORDER/purchaseOrderId=poId。color/colorCode は文字列転記のみ。
- listPoItemsForBomImport(productId) → PoImportGroup[]（PoItemImportRow: supplierItemCode/colorCode/color/unit/unitPrice 等。productColorwayId は持たない）。
- upsertBomItemColorway({ bomItemId, productColorwayId, supplierColorCode, supplierColorName? }): 値あり=upsert/空=delete。@@unique[bomItemId, productColorwayId]。supplierColorName は nullable。
- PoImportDialog（bom-section.tsx）: listPoItemsForBomImport→複数選択→importPoItemsToBom。C/# 列編集（upsertBomItemColorway）とは現状未連結。

## 6. 次段（v1.0 確定後）
1. 実装ブリーフ: PoImportDialog の候補行に取り込み先（モード①/②）選択を追加。モード②選択時は既存 BomItem select ＋ カラーウェイ select。実行アクションを分岐（①=既存 importPoItemsToBom／②=upsertBomItemColorway ループ）。
   - 実装方式（importPoItemsToBom を拡張するか別 action を足すか、UI 状態の持ち方）は実装ブリーフ作成時に bom-section.tsx PoImportDialog の現構造を再確認してから確定（記憶で組まない）。
2. 後段: コスト軸×カラーウェイ軸の両立、柄版。

## 改訂履歴
| 日付 | 版 | 変更 | 担当 |
| --- | --- | --- | --- |
| 2026-06-23 | v0.1 | recon を踏まえ2モード＋論点 E1〜E6 提示 | 慎太郎さん + Claude |
| 2026-06-23 | v1.0 | E1〜E6 確定（モード②=既存行へ張る/C#=supplierItemCode/カラー名は後からセルで任意/移行なし/コスト引き当てなし） | 慎太郎さん + Claude |
