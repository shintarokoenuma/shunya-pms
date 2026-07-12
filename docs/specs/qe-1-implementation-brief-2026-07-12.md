# QE-1 実装ブリーフ（量産原価ビュー）v1.0 (2026-07-12)

- 種別: 実装ブリーフ（Claude Code 向け）
- 設計ソース（実装前に必読・これ以外を根拠にしない）:
  - qe-1-spec-confirmation-v1_0-2026-06-30.md（§2 スコープ・§3 2源集計・§4 取り切り・§5 通貨・§6 費目写像・§8 表示器再利用・§9 確定一覧）
  - qe-1-spec-addendum-v0_1-2026-07-12.md（§1 正名・§2 カット代・§3 INDIVIDUAL_BILLING 除外）
- 追加確定（2026-07-12 チャット）: 除外理由=(a) 共有型に1値追加／多通貨表示=(あ) JPY 換算値のみ

## 0. 不変条件（違反したら実装を止めて報告）
- スキーマ変更なし・migration なし・DB 書き込みなし（計算ビューのみ）。
- 初期費用の絶対防衛線: billingClassification = INDIVIDUAL_BILLING の WoItem は
  1枚原価の分子に入れない（addendum §3）。
- 集計は純関数（テスト可能・副作用なし）。既存 #93 の計算・表示を壊さない。

## 1. 成果物
1. `src/lib/calc/production-cost.ts` — QE-1 集計純関数（新設）
2. `src/lib/calc/production-cost.test.ts` — ユニットテスト（新設）
3. `src/app/(app)/products/_components/production-cost-section.tsx` — 原価ビュー UI（新設・#93 隣接）
4. products/[id] ページ — セクション設置＋データ供給の最小改修
5. `src/lib/actions/sample-production-costs.ts` — CostBreakdownExcludeReason に
   `"INDIVIDUAL_BILLING"` を1値追加（既存3値は不変更）
6. 除外理由バッジのラベル定義箇所に INDIVIDUAL_BILLING の表示文言を同一 PR で追加
   （house rule: 値追加とラベル追加は同一 PR。表示文言「別途請求（1枚原価外）」）

## 2. 計算規則（production-cost.ts）
入力: BOM 行（material の rollLength/rollPrice 含む）・Σ(productionQuantity)（#93 と同一分母）・
PRODUCTION WO の WoItem 群・手入力 USD/JPY レート・METER 行ごとのカット代入力（行通貨・default 0）。

### 2-1. 材料費（行ごと）
- 必要量 = Σqty × usagePerUnit × (1 + lossRate/100)（#93 computeMaterialRequirements と同式・可能なら流用）
- ROLL: 反数 = ceil(必要量 ÷ Material.rollLength)、生地コスト = 反数 × Material.rollPrice。
  rollLength か rollPrice が null → AMOUNT_UNDECIDED 除外（注記「原反情報未登録」）。
  表示は金額主・反数従（「¥XX,XXX（3反）」qe-1 §4-1）。
- METER: 生地コスト = 必要量 × BomItem.unitPrice ＋ カット代（addendum §2）。
  unitPrice null → AMOUNT_UNDECIDED。カット代 > 0 の行はラベルに「（カット代含む）」付記。
- usagePerUnit null → AMOUNT_UNDECIDED。

### 2-2. 工賃（WoItem ごと）
- 対象 = WorkOrder.workCategory = PRODUCTION（deletedAt null）の WoItem。
- 行額 = unitPrice × quantity。unitPrice null → AMOUNT_UNDECIDED（「未確定」）。
- billingClassification = INDIVIDUAL_BILLING → 工賃Σから除外し「別途請求項目（1枚原価外）」
  セクションへ（項目名・金額・JPY 換算値を参考表示）。excludeReason = "INDIVIDUAL_BILLING"。
- 区分 = costCategoryId → CostCategory.externalCategory。null → OTHER（qe-1 Q-c）。

### 2-3. 通貨（全行共通）
- JPY: そのまま。USD: 手入力レートで JPY 換算。CNY/VND/EUR: 集計から除外・
  excludeReason = "NON_JPY"・表示文言「対象外通貨」（qe-1 §5）。
- カット代は行通貨で入力し同規則で換算。
- 内部計算は丸めない。表示のみ整数円（既存 cost-breakdown の toLocaleString 慣行に従う）。

### 2-4. 合計
- 1枚原価 = (材料費Σ + 工賃Σ) ÷ Σ(productionQuantity)（qe-1 Q-a・分母は #93 と同一）。
- Σqty = 0 のときは 1枚原価非表示・案内文（ゼロ除算ガード）。

## 3. UI（production-cost-section.tsx）
- #93 material-requirement-section の直下に設置。
- 入力: USD/JPY レート（1欄・保存しない）・METER 行ごとのカット代（保存しない）。
- 表示: CostBreakdown 描画器を sections で再利用（props = sections のみ・実測済み）。
  小計/合計は JPY 換算値のみ（描画器の ¥ 固定と整合・確定(あ)）。行内に原通貨表記
  （例「$120.00 → ¥18,000」）。USD 換算表示トグル（qe-1 §5）。
- セクション: material（材料費・カット代含む）→ 工賃（externalCategory 別: SEWING/PROCESSING/
  OVERHEAD/OTHER）→ 別途請求項目（1枚原価外・小計を1枚原価に入れない）→ 1枚原価（強調）。
- ラベル日英併記は ExternalCostCategory 4値の静的辞書（qe-1 §7・永続化なし）。
- PRODUCTION WO が 0 件 → 工賃 0・材料費のみで正常表示（qe-1 §3-2）。

## 4. テスト要件（production-cost.test.ts・最低限）
① ROLL 取り切り（端数で反数+1）② METER＋カット代 ③ ROLL の rollLength null 除外
④ 工賃 unitPrice null 除外 ⑤ INDIVIDUAL_BILLING が分子から除外され別枠に出る
⑥ USD 換算合算 ⑦ CNY 行の対象外除外 ⑧ Σqty=0 ガード ⑨ 1枚原価の分母一致（#93 と同値）

## 5. Git・検証・停止点
- feature ブランチ `feat/qe1-production-cost-view` ＋ PR（コード含むため直 push 禁止）。
- git add は明示パスのみ。tsc/lint/test クリーンで commit→push→PR open まで自走可。マージは慎太郎さん。
- 完了報告には Playwright スクリーンショット必須（ROLL/METER 混在＋INDIVIDUAL_BILLING 行＋
  USD 行を含む dev データでの表示証跡）。ビルド成功だけの完了報告は不可。
- PR 3点セット: ①マージ前確認 = localhost:3000（dev DB hopper:12921）②マージ操作 = GitHub PR URL
  ③マージ後確認 = 本番 products/[id]。マージ＝Railway 本番反映＝不可逆。
