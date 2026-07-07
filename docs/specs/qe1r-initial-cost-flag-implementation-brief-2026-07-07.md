# QE-1R 初期費用再設計 実装ブリーフ — 別枠フラグ方式 (2026-07-07)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

土台 spec: `docs/specs/qe1r-initial-cost-redesign-spec-confirmation-v0_1-2026-07-07.md`
（@main・18f25f6）。**spec と食い違う指示があれば spec を正とし、その場で止めて確認すること。**

---

## 0. 前提・ブランチ・実装順

### 0-1. ブランチ
- **新ブランチ `feat/qe1r-initial-cost-flag` を origin/main（18f25f6 以降）から作成**。
  旧 feat/qe1r-quotation-pdf はマージ済み（PR #97・d944e99）＝役割終了・触らない。

### 0-2. migration（1本・列純増＋決定的 UPDATE）
- `prisma/migrations/20260707000000_initial_cost_separate_billing_flag/migration.sql` を手書き:
  1. ALTER TABLE "rough_estimate_items"
     ADD COLUMN "is_separate_billing" BOOLEAN NOT NULL DEFAULT false;
  2. UPDATE "rough_estimate_items"
     SET "item_category"='LABOR', "is_separate_billing"=true
     WHERE "item_category"='INITIAL_COST';
- schema.prisma: RoughEstimateItem に
  isSeparateBilling Boolean @default(false) @map("is_separate_billing")
  （itemCategory の直後・コメント「別枠計上（初期費用）。防衛線の判定基準」）。
- enum RoughEstimateCategory の INITIAL_COST 値は**削除しない**（spec §5・Zod で新規拒否）。
- 空 diff 確認: UPDATE は datamodel 差分に現れないため、正準差分（HEAD→現行 schema）と
  手書き SQL の**ADD COLUMN 部分の一致**を確認し、UPDATE 部分は目視レビュー対象と報告する。
- dev へ db push（hopper:12921 目視確認）。★db push は UPDATE を実行しないため、
  dev の既存 INITIAL_COST 行1件（RE-2026-0001 版代）には**同等の UPDATE を手動適用**
  （migration.sql と同文・実行前に対象1件を SELECT で確認・実行後に再 SELECT）。
- 本番へは何もしない（マージ時 migrate deploy＝ADD COLUMN と UPDATE が順に走る）。

### 0-3. 実装順（Part A→E・段階コミット・型 lint build 0 で自走）
- **Part A**: スキーマ＋migration＋dev 適用
- **Part B**: 判定基準の置換（calc / actions / validators / constants / quotation-data）
- **Part C**: フォーム UI（チェックボックス・費目区分2値化・引き当て解禁）
- **Part D**: 引き当ての自動連動（検索 action の select 拡張＋UI 側フラグ既定値）
- **Part E**: 費目マスター追加（dev）＋検証
- PR open は全 Part 完了後に1本。マージは慎太郎さんが握る。git add は明示パスのみ。

---

## 1. Part B — 判定基準の置換（23箇所/6ファイルの指定）

置換原則: 「初期費用か？」の判定を `itemCategory === INITIAL_COST` から
`isSeparateBilling === true` へ。**費目区分としての INITIAL_COST 参照は全廃**。

- `src/lib/rough-estimate/calc.ts`（4箇所）: 原価集計の除外条件・初期費用合計の抽出条件を
  フラグ判定に置換。関数シグネチャで itemCategory を受けている箇所は
  isSeparateBilling を受ける形に変更（中立モジュール規約維持）。
- `src/lib/actions/rough-estimates.ts`（3箇所）: autoCostTotalJpy／autoPriceTotalJpy の
  集計（保存時）をフラグ判定に。INITIAL_COST 以外の presented null 落としガード→
  「フラグ OFF は null 落とし」に。
- `src/lib/validators/rough-estimate.ts`（1箇所）: itemCategory の受理値を
  MATERIAL/LABOR のみに（INITIAL_COST が来たら Zod エラー）。
  items スキーマに isSeparateBilling: z.boolean().default(false) を追加。
- `src/lib/constants/rough-estimate-types.ts`（1箇所）: ラベル Record は
  INITIAL_COST キーを残す（enum が残るため・TypeScript コンパイル都合）。
  選択肢配列（フォームの費目区分 select 用）からは INITIAL_COST を除外。
- `src/lib/pdf/quotation-data.ts`（3箇所）: 初期費用行の抽出
  「SEPARATE の RE の INITIAL_COST 行」→「SEPARATE の RE のフラグ ON 行」。
- `src/app/(app)/products/_components/rough-estimate-section.tsx`（11箇所）: §2 Part C で一括。

## 2. Part C — フォーム UI

- 費目区分 select: MATERIAL/LABOR の2択に（既存 INITIAL_COST 行の表示互換は
  migration 済みのため考慮不要）。
- 「＋初期費用（別枠）」ボタン → 「＋明細」等に統合するか、
  「LABOR＋フラグON の行を追加するショートカット」として残すかは既存 UI の座りで判断
  （残す場合の挙動＝emptyItem(LABOR)＋isSeparateBilling:true）。
- 各行にチェックボックス「別枠計上（初期費用）」（PoItem「現物資産」チェックと同作法）。
  ON 行: amber スタイル・手打ち提示額欄（presentedPriceManualJpy）を表示（従来の
  INITIAL_COST 行の見た目を継承）。OFF 行: 手打ち提示額欄は出さない（値も null 落ち）。
- allowedSourcesFor（124-135行）: INITIAL_COST 分岐を削除し
  MATERIAL→[MANUAL, PAST_PO]／LABOR→[MANUAL, PAST_WO] の2分岐に。
  → フラグ ON 行でも費目区分に応じて引き当てボタン（PastPoSearch/PastWoSearch）が出る。
- フォーム内集計（687-718行）: 原価小計＝フラグ OFF 行／初期費用提示合計＝フラグ ON 行に置換。
  「INITIAL_COST の数量未入力は1を補う」ガードは「フラグ ON 行」に読み替えて維持。
- 複製（duplicateRoughEstimate）: isSeparateBilling を**コピーする**（構造属性のため）。
  リセット対象は道Aの手打ち2列のみで不変。
- getRoughEstimateForEdit・list 行型に isSeparateBilling を追加。
- DialogContent を触る場合 sm:max-w-* 必須（過去バグ・grep 網羅）。

## 3. Part D — 引き当ての自動連動

- 検索 action の select 拡張:
  - listPastWoItemsByCostCategory: WoItem.billingClassification を select に追加。
  - listPastPoItemsBySupplier: PoItem.billingClassification・isPhysicalAsset を追加。
- UI（PastPoSearch/PastWoSearch の選択ハンドラ）: 引き当て確定時、引き当て元が
  billingClassification===INDIVIDUAL_BILLING（WO/PO）または isPhysicalAsset===true（PO）
  なら、当該行の isSeparateBilling を true にセット（form.setValue・上書き可＝
  チェックボックスは操作可能なまま）。
- 検索の where 条件は変更しない（spec §6・unitPrice not null・status フィルタなし維持）。

## 4. Part E — 費目マスター追加（dev）＋検証

### E-1. 費目マスター（マスターデータのみ・migration に混ぜない）
- dev の原価費目に3件追加（画面操作 or 既存 create action を使う一時 script。
  script の場合は companyId を実テナントで確認してから）:
  PLATE_FEE 版代／MOLD_FEE 型代／EMBROIDERY_PUNCH_FEE 刺繍パンチ代
  （いずれも OVERHEAD・Lv2・親=OVERHEAD Lv1）。
- ★本番への追加はマージ後に慎太郎さんが原価費目画面から行う（ブリーフ §6 に明記）。

### E-2. 検証（Playwright 実機＋実PDF目視・dev hopper のみ）
1. **移行回帰（最重要）**: RE-2026-0001 の PDF が migration 前と完全一致
   （¥5,500×100=¥550,000／版代 ¥16,000／小計税抜 ¥566,000／消費税 ¥56,600／
   税込 ¥622,600）。フォームでは版代行が LABOR＋フラグON・amber・手打ち16,000 表示。
   原価小計 403,000 不変。
2. 新規行: LABOR＋費目 PATTERN_FEE を選び PAST_WO 引き当て。引き当て元 WoItem
   （一時 WO・unitPrice 入り・billingClassification=INDIVIDUAL_BILLING）を dev に作成し、
   選択→単価スナップショット＋**フラグ自動 ON** を確認。
3. フラグ手動トグル: OFF→原価小計に入る／ON→初期費用提示合計に移る（フォーム集計が追随）。
4. Zod: itemCategory=INITIAL_COST の投稿が拒否される／フラグ OFF 行の
   presentedPriceManualJpy が null 落ちする（action 直叩き or フォーム経由で確認）。
5. INCLUDED モード: フラグ ON 行合計が単価配賦に乗る・PDF 初期費用セクション非表示・脚注。
6. PDF: 初期費用セクション＝フラグ ON 行のみ（SEPARATE）。材料/工賃明細・原価・利益率
   非表示の絶対線維持。
7. 複製: フラグがコピーされ、手打ち2列はリセット。
8. tsc/lint/build 0。検証一時データ（WO 含む）は一意タイトル＋保護ガード
   （RE-2026-0001 絶対除外）で削除・件数復帰を確認。

## 5. マージ前後の A方式チェック（migration 適用のため必須）
- マージ前（read-only・本番接続は慎太郎さんが人手渡し・パスワード会話に残さない）:
  1. host=shuttle:16099 目視確認。
  2. SELECT COUNT(*) FROM rough_estimates;（★前回未確認の本番 RE 件数をここで記録）
  3. SELECT COUNT(*) FROM rough_estimate_items WHERE item_category='INITIAL_COST';
     （UPDATE 対象件数の事前記録）
  4. migration 40本目まで・is_separate_billing 列未存在の確認。
- マージ → 自動 migrate deploy（41本目適用・ADD COLUMN→UPDATE）。
- マージ後: デプロイログ確認 → 3 と同じ SELECT が 0 件（全行変換済み）→
  本番 smoke（フォームのチェックボックス表示・PDF 出力）→
  ★慎太郎さんが原価費目画面から版代/型代/刺繍パンチ代を本番に追加。

## 6. スコープ外
- 引き当て検索の status/単価未定の扱い変更／enum 値 INITIAL_COST の物理削除／
  PoAllocation／B-023／確定見積側への波及（spec §6 どおり）。
