# QE-1R 初期費用再設計（別枠フラグ方式）仕様確認書 v0.1 (2026-07-07)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

- 種別: 仕様確認書 v0.1（框・構造転換の確定版。列定義の細部・UI 配置は実装ブリーフ段へ）
- 上位/関連: quotation-rough-estimate-spec-confirmation-v0_1-2026-07-01.md §6（絶対防衛線・不変）
  ／同 addendum v0.2／quotation-pdf-and-list-spec-confirmation-v0_2-2026-07-06.md §3
  （本書が「INITIAL_COST 明細行」の判定基準を置換）／qe1r-tax-addendum-v0_1-2026-07-07.md（不変）
- 現物確認: 2026-07-07 read-only 調査済み（引き当て検索の where 条件・INITIAL_COST 依存
  23箇所/6ファイル・BillingClassification enum の PoItem/WoItem 実在・isPhysicalAsset の
  PO 実装・CostCategory 39件・dev 実データ＝INITIAL_COST 行1件のみ）。

## 0. 対象の確定と経緯（design-reread Step 0）
- 設計対象＝概算見積（RoughEstimate）の初期費用の計上構造・費目選択・過去実額引き当て。
- 経緯: 道A本番反映後の実運用確認（2026-07-07）で2つの問題が判明。
  (1) INITIAL_COST 行は source=MANUAL 固定で過去実額を引き当てられない。
  (2) 引き当てたい場合に費目区分を「工賃」にする回避操作が可能で、その場合パターン代等が
      1枚原価の分子に混入する＝絶対防衛線を UI 操作で破れる。
- 慎太郎さん確定（2026-07-07）: 現行 INITIAL_COST 方式は実用しない。チェックボックス
  （別枠フラグ）方式へ再設計する。あわせて初期費用の費目選択（グレーディング・ラベル・
  プリント版等）を可能にする。

## 1. 構造転換の核心：第3の費目区分 → 二軸（費目×別枠フラグ）
**行の性格（材料/工賃）と、計上先（1枚原価 or 別枠）を独立させる。**

- 現行: itemCategory ∈ { MATERIAL, LABOR, INITIAL_COST }。INITIAL_COST が費目と計上先を
  兼ねるため、引き当てキー（materialId/costCategoryId）を持てず、引き当て不可。
- 新: itemCategory ∈ { MATERIAL, LABOR }（2値運用）＋ RoughEstimateItem.isSeparateBilling
  Boolean（既定 false）。フラグ ON ＝別枠計上（初期費用）。
- 根拠＝既存 house style への回帰: PoItem/WoItem は既に
  billingClassification（INDIVIDUAL_BILLING＝個別売り立て「パターン代・版代・型代・
  刺繍パンチ代・グレーディング代」／UNIT_PRICE_INCLUDED）を持ち、「行の性格＋売り立て区分」
  の二軸構造。RE だけが第3区分方式で不整合だった。
- フラグの持ち方は boolean とする（PoItem.isPhysicalAsset と同作法）。
  BillingClassification enum の再利用は、UNIT_PRICE_INCLUDED がヘッダの
  initialCostBillingMode と意味衝突するため不採用。

## 2. 引き当て（これで初期費用も引ける）
- **初期費用専用の引き当てキーは新設しない。** フラグ方式により既存2系統がそのまま使える:
  - 版代・パターン代・グレーディング代等（外注作業）→ 工賃行（costCategoryId キー・
    PAST_WO 引き当て）＋フラグ ON。
  - 型・資材的な初期費用（PO 発注のもの）→ 材料行（PAST_PO 引き当て）＋フラグ ON。
- allowedSourcesFor は費目区分のみで決まる: MATERIAL→[MANUAL, PAST_PO]／
  LABOR→[MANUAL, PAST_WO]。INITIAL_COST 分岐（MANUAL 固定）は消滅。
- **自動連動（スナップショットコピーの拡張）**: 引き当て元の WoItem/PoItem の
  billingClassification=INDIVIDUAL_BILLING または PoItem.isPhysicalAsset=true のとき、
  RE 行の isSeparateBilling を自動 ON（デフォルト値・上書き可）。発注側の区分を
  概算側で二度打ちさせない。
- 検索条件は現行維持（unitPrice not null・status フィルタなし・take 上限）。
  ※運用注意: 引き当て元の WO/PO に単価が未入力だと検索に出ない（2026-07-07 の
  「パターン代が出ない」の直接原因は WO-2026-0003 の単価未定）。

## 3. 計上・表示の読み替え（防衛線は不変・判定基準のみ変更）
- 「初期費用」の判定を itemCategory===INITIAL_COST から isSeparateBilling===true に
  全面置換（依存 23箇所/6ファイル: rough-estimate-section 11・calc 4・quotation-data 3・
  actions 3・constants 1・validators 1）。
- 原価集計: 1枚原価の分子＝フラグ OFF 行のみ（防衛線の実装がフラグ判定に変わるだけ）。
- ヘッダ initialCostBillingMode（SEPARATE/INCLUDED）は不変。INCLUDED の配賦対象＝
  フラグ ON 行の合計。
- PDF（spec v0.2 §3 の読み替え）: 初期費用セクションの行＝SEPARATE の RE の
  フラグ ON 行。INCLUDED の非表示・脚注・税3段表示は不変。
- 手打ち提示額 presentedPriceManualJpy の Zod ガード: 「INITIAL_COST 以外は null 落とし」
  →「フラグ OFF は null 落とし」。
- UI: 行ごとにチェックボックス「別枠計上（初期費用）」。ON 行は現行 INITIAL_COST 行の
  視覚スタイル（amber）と手打ち提示額欄を引き継ぐ。

## 4. 費目選択（慎太郎さん要望 2026-07-07）
- フラグ ON 行でも費目（CostCategory）を通常どおり選べる（工賃行の既存 UI のまま）。
  グレーディング（GRADING_FEE）・プリント（PRINTING）・刺繍（EMBROIDERY）等は既存費目を使用。
- 費目マスターに不足分を追加（マスターデータ追加のみ・migration 不要・原価費目画面から）:
  版代（PLATE_FEE）・型代（MOLD_FEE）・刺繍パンチ代（EMBROIDERY_PUNCH_FEE）
  ＝いずれも OVERHEAD・Lv2。ラベルは既存 LABEL（MATERIAL）で材料行として扱う。
  ※コード名・親分類は実装ブリーフ段で最終確定。

## 5. スキーマ・移行（migration 1本・準非破壊）
- 追加: RoughEstimateItem.isSeparateBilling Boolean @default(false)（列純増）。
- enum 値 INITIAL_COST は削除しない（PostgreSQL の enum 値削除は破壊的）。
  Zod で新規書き込みを拒否し、コード上は 2値運用。値の物理削除は将来のクリーンアップ。
- 既存データ変換（migration SQL 内の UPDATE・決定的・冪等）:
  UPDATE rough_estimate_items
  SET item_category='LABOR', is_separate_billing=true
  WHERE item_category='INITIAL_COST';
  （dev は該当1行＝RE-2026-0001 版代。手打ち提示額 16,000・unitPrice 12,000 は不変。
   版代は外注作業のため LABOR へ寄せる。costCategoryId は null のままで可＝MANUAL 行）。
- ★本番 RE 件数は未確認のまま（2026-07-07 時点）。マージ前 A方式チェックで
  INITIAL_COST 行の件数を記録してからマージ（UPDATE は件数に依らず安全だが記録は残す）。
- 総額・手打ち列（道A）・税表示は本書の影響を受けない（判定基準の置換のみ）。

## 6. スコープ外
- 引き当て検索の status フィルタ・単価未定行の扱いの変更（現行維持）。
- PoAllocation（按分）・初期費用の在庫管理（B-023）。
- enum 値 INITIAL_COST の物理削除。
- 確定見積側（Quotation/QE-2）への波及。

## 7. 次ステップ
- 本書確定 → 実装ブリーフ（migration 手順・23箇所の置換一覧・チェックボックス UI・
  自動連動・費目マスター追加手順・検証項目・A方式チェック）→ 実装 → PR 1本。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-07 | v0.1 | INITIAL_COST 区分を廃止（2値運用＋isSeparateBilling フラグ）。引き当ては既存2系統を流用し初期費用も引き当て可能に。引き当て元の INDIVIDUAL_BILLING/isPhysicalAsset からフラグ自動連動。費目選択可・費目マスターに版代/型代/刺繍パンチ代を追加。migration 1本（列純増＋既存行の決定的 UPDATE）。防衛線・道A・税表示は不変 |
