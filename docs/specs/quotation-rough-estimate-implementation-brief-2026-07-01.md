# 概算量産見積（QE-1R）実装ブリーフ (2026-07-01)

- 種別: 実装ブリーフ（Claude Code 実装用。P1/P2/P3 停止点つき）
- 上位: quotation-rough-estimate-spec-confirmation-v0_1-2026-07-01.md（QE-1R v0.1・框確定）
- 現物確認: Claude Code read-only（2026-07-01）。QuotationCostBreakdown 全列／CostSource・UsageSource enum／採番5関数の作法／Brand.defaultMarginRate(nullable) を確認済み。
- 重要: 本ブリーフは **初の本番スキーマ変更（migration）** を伴う。triple-gate（dev 確認 → 本番 dry-run ROLLBACK＋件数 → 本番 commit）対象。

---

## 0. スコープ（v0.1 框の再掲・逸脱禁止）

- QE-1R＝量産軸の概算レーン。確定計算 QE-1 とは別系統・時間軸でのみ接続。客に見せるのは提示価格（利益込み）。
- 本ブリーフで作る: 新設2モデル（RoughEstimate／RoughEstimateItem）＋ source enum ＋ 採番 ＋ 集計/引き当てロジック ＋ 保存/表示 UI。
- 作らない（スコープ外・逸脱禁止）: サンプル概算／候補提案(B-038)／粗BOM／マージン4階層・費目別率・厳密売価(QE-3+)／初期費用の1枚単価インクルーズ切替(将来)／確定見積(QE-1/QE-2)への引き継ぎ動線／QE-1 の取り切り計算。

## 1. 新設モデルの列定義（確定）

### 1-1. RoughEstimate（概算ヘッダ・発行1件）
- id: String @id @default(uuid())
- companyId: String（既存 house style・@map("company_id")）
- estimateNumber: String（採番 RE-{year}-NNNN。§3。@@unique([companyId, estimateNumber])）
- productId: String（品番・scalar FK・@map("product_id")。@@index([companyId, productId])）
- 発行メタ:
  - issuedAt: DateTime @default(now())（「いつ出したか」）
  - title: String?（任意）
  - notes: String? @db.Text（前提メモ＝素材グレード仮定・色数・納期前提等の自由記述。v0.1 §8 論点2 の「条件(c)」）
- 提示条件:
  - presentedMoq: Int?（提示 MOQ 単一値。階段は持たない＝QE-3+。v0.1 §8 論点4）
  - expectedQuantityBand: String?（想定数量帯・自由入力。v0.1 §8 論点2 の「条件(b)」）
  - currency: Currency @default(JPY)（通貨前提。v0.1 §8 論点2 の「条件(a)」。行別通貨は明細側）
  - validUntil: DateTime?（有効期限＝任意参考列。v0.1 §8 論点2。必須にしない）
- 利益率（ヘッダ1件1率・v0.1 §5-1）:
  - marginRate: Decimal? @db.Decimal(5,2)（適用利益率。Brand.defaultMarginRate 由来のデフォルトを初期表示、変更可）
  - marginRateSource: MarginRateSource（デフォルト由来か手動上書きか。§1-3 enum）
- 金額の2層保存（v0.1 §5-3・自動値と手打ち最終値を別列で両方）:
  - autoCostTotalJpy: Decimal? @db.Decimal(15,2)（自動集計原価・JPY 換算後合計）
  - autoPriceTotalJpy: Decimal? @db.Decimal(15,2)（自動提示価格合計＝原価×(1+利益率)。初期費用も価格化・別枠内訳は明細で保持）
  - finalPriceManualJpy: Decimal? @db.Decimal(15,2)（手打ち最終値＝実際に客へ出した数字。初期値は autoPriceTotalJpy をデフォルト表示、人が上書き。発行履歴の「いくら」はこれが正）
- 監査:
  - createdByUserId: String?
  - createdAt / updatedAt / deletedAt?（既存 house style。ソフトデリート踏襲）
- @@map("rough_estimates")

### 1-2. RoughEstimateItem（概算明細・1行）
- id / roughEstimateId: String（@map("rough_estimate_id")・onDelete: Cascade）
- itemOrder: Int（表示順）
- 費目区分（単層・v0.1 §8 論点3 / 論点2 兼用）:
  - itemCategory: RoughEstimateCategory（MATERIAL / LABOR / INITIAL_COST。§1-3 enum。INITIAL_COST＝初期費用の別枠識別を自前で持つ＝billingClassification 非依存）
- 品目:
  - itemName: String @db.VarChar(255) / itemNameEn: String?（日英・QuotationCostBreakdown 踏襲）
  - materialId: String?（材料費行の source 根拠 FK）
  - costCategoryId: String?（工賃行の費目・語彙統一のため確定側と同名）
- source（v0.1 §8 論点3）:
  - source: RoughEstimateItemSource（MANUAL / PAST_PO / PAST_WO。§1-3 enum）
  - sourcePoItemId: String?（PAST_PO 引き当て元・スナップショットの出所記録。@relation なし scalar・BomItem.purchaseOrderId と同方式）
  - sourceWoItemId: String?（PAST_WO 引き当て元・同上）
  - ※ v0.1 §4: 引き当ては参照でなくスナップショットコピー。sourceXxxId は「どこから焼いたか」の記録のみで、金額は下の unitPrice/currency に焼き込む（後で元が変わっても不変）
- 数量・単価・通貨（行別通貨・v0.1 §7）:
  - quantity: Decimal? @db.Decimal(15,4) / unit: String? @db.VarChar(20)
  - unitPrice: Decimal? @db.Decimal(15,4)（スナップショット値）
  - currency: Currency @default(JPY)（行別 JPY/USD）
  - subtotal: Decimal? @db.Decimal(15,2) / subtotalJpy: Decimal? @db.Decimal(15,2)（JPY 換算・入力レート方式は QE-1 に揃える）
- notes: String? @db.Text
- createdAt / updatedAt
- @@index([roughEstimateId, itemOrder]) / @@index([materialId])
- @@map("rough_estimate_items")

### 1-3. 新設 enum（house style＝大文字・コメント併記）

    enum RoughEstimateCategory {
      MATERIAL      // 材料費（製品単価インクルード）
      LABOR         // 工賃（製品単価インクルード）
      INITIAL_COST  // 初期費用（別枠・1枚原価に混ぜない）
    }

    enum RoughEstimateItemSource {
      MANUAL   // 直接入力
      PAST_PO  // 過去 PoItem から引き当て（スナップショット）
      PAST_WO  // 過去 WoItem から引き当て（スナップショット）
    }

    enum MarginRateSource {
      BRAND_DEFAULT   // Brand.defaultMarginRate 由来
      MANUAL_OVERRIDE // 手動上書き
    }

- enum 追加時は co-located Record<enum,string> ラベル定義を同 PR に必ず含める（TS コンパイル要件・house rule）。

## 2. 計算・集計ロジック（クライアント純関数・追加クエリなし）

- 原価集計: itemCategory ∈ {MATERIAL, LABOR} の subtotalJpy を合算 → autoCostTotalJpy。INITIAL_COST は分子に入れない（v0.1 §6 絶対防衛線）。
- 提示価格（自動）: 全費目（MATERIAL/LABOR/INITIAL_COST すべて）に marginRate を適用 = subtotalJpy ×(1+marginRate/100) を合算 → autoPriceTotalJpy。※初期費用も価格化する（v0.1 §5-1）が、集計は別枠内訳として保持し1枚原価には混ぜない。
- 1枚原価表示（参考）: autoCostTotalJpy ÷ 想定枚数（初期費用は分子外）。
- 手打ち最終値: finalPriceManualJpy の入力初期値に autoPriceTotalJpy をデフォルト表示。人が上書き。保存時は両方を別列で保持（自動値を潰さない）。
- ★赤字警告（確定・後者採用）: 適用 marginRate が 0（未設定由来・明示入力を問わず一律）のとき、提示価格＝原価となる旨を赤字で警告表示。区別ロジックは持たない。
- 通貨: JPY/USD のみ。行 currency が USD の行は入力レートで subtotalJpy を算出（QE-1 v1.0 の入力レート方式に揃える）。CNY/VND/EUR は入力段でブロック（silent fallback 禁止・v0.1 §7）。

## 3. 採番（既存作法踏襲）

- prefix: RE-{year}-（poNumberPrefix と同型・年内リセット）。
- computeNextRoughEstimateNumber: 既存 computeNextPoNumber と同作法（findFirst orderBy desc → 正規表現で末尾連番抽出 → parseInt+1 → padStart(4,"0")）。
- 並行採番: 作成 action を tx で包み、P2002（@@unique 衝突）で retry（createPurchaseOrder の retry パターン踏襲）。B-048 の横断リトライ宿題と同構造だが、本ブリーフでは QE-1R 単体に retry を実装（B-048 本体は別）。

## 4. デフォルト利益率の供給（確定）

- productId → Product.brandId → Brand.defaultMarginRate を明示クエリで取得（scalar FK ゆえ relation 経由でなくクエリ）。
- 取得値をヘッダ marginRate の初期値に、marginRateSource=BRAND_DEFAULT で設定。人が変更したら MANUAL_OVERRIDE。
- null フォールバック: Brand.defaultMarginRate が null なら marginRate=0 で開始（v0.1 論点1=(a)）。→ 0 は §2 の赤字警告対象。全社既定列の新設はしない（MarginSetting 休眠基盤に依存しない）。

## 5. UI（設置場所は着手時に1回 recon）

- ★設置場所未確定: products/[id] 配下の現行構成（#93 material-requirement-section.tsx 近辺のタブ/セクション構成）を実装着手時に read-only で1回 recon してから確定する。記憶で決めない。
- 要素（確定）: 明細テーブル（費目区分・source・品目・数量・単価・通貨・小計）／過去実額引き当てのピッカー（materialId で過去 PoItem 検索・costCategoryId で過去 WoItem 検索→行に焼き込み）／ヘッダ（品番・発行日・提示MOQ・想定数量帯・通貨・利益率〔デフォルト入り変更可〕・有効期限任意）／初期費用別枠セクション／自動提示価格の表示＋手打ち最終値入力欄（自動値をデフォルト表示）／marginRate=0 の赤字警告。
- 日英併記ラベルは itemNameEn を持つ（QuotationCostBreakdown 踏襲）。

## 6. migration / triple-gate（★本番スキーマ変更）

- 変更内容: 新設テーブル rough_estimates / rough_estimate_items ＋ 新設 enum 3種。既存テーブルへの列追加・変更・削除は無し（純増）。
- dev（hopper:12921・postgres-7492）: prisma db push で反映 → CRUD smoke（1件作成・明細追加・引き当て・手打ち上書き・保存・再表示）。
- 本番（shuttle:16099・postgres-ab6d）: Railway migrate deploy。手書き SQL＋migrate diff で empty-diff 検証（migrate dev は使わない・本 repo 作法）。
- triple-gate: (1)接続先ホスト目視確認（shuttle=本番） (2)dry-run（BEGIN → 作成 → 件数確認 → ROLLBACK） (3)別トランザクションで COMMIT。
- 純増テーブルゆえ既存データ影響なし。ただし migration 履歴は dev=db push（履歴なし）/ 本番=migrate deploy の二系統作法を厳守。

## 7. 実装順序と停止点（P1/P2/P3）

- **P1（スキーマ＋migration・dev まで）**: schema.prisma に2モデル＋3enum 追加 → co-located Record ラベル → prisma db push（dev）→ prisma generate → tsc/lint/build クリーン。ここで停止・慎太郎さんが dev 反映を確認。
- **P2（サーバ側ロジック）**: 採番（computeNextRoughEstimateNumber＋retry）／作成・更新 action（Zod v4 スキーマ・"use server" 型は neutral module に抽出）／過去実額引き当てクエリ（PoItem materialId・WoItem costCategoryId）／集計純関数（原価・提示価格・赤字警告条件）／デフォルト利益率供給。tsc/lint/build クリーン。ここで停止。
- **P3（UI＋結線）**: 設置場所 recon → フォーム（react-hook-form）／明細テーブル／引き当てピッカー／別枠セクション／自動値デフォルト＋手打ち上書き／赤字警告 UI。localhost:3000（dev）で CRUD 動作確認。ここで停止・慎太郎さんが(1)ローカル目視(2)PR マージ判断。
- **本番反映**: マージ後 Railway 自動デプロイ＋migrate deploy。triple-gate で本番 migration 確認。

## 8. 実装時の design-reread チェック（着手前）

- Step 0: 対象＝QE-1R（量産軸概算レーン）。サンプル・確定計算 QE-1 と混ぜない。
- 親仕様読み直し: 本ブリーフ＋ quotation-rough-estimate-spec-confirmation-v0_1 ＋ QE-1 v1.0 §5(通貨)・§7(日英) ＋ product-sample §6-2(初期費用)。
- 実スキーマ再確認: PoItem/WoItem/BomItem の currency・unitPrice、Brand.defaultMarginRate を live grep（project .prisma は 2026-05-16 で古い）。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-01 | v1.0 | QE-1R v0.1 框を実装可能な粒度へ。新設2モデル＋3enum の列定義・集計/引き当てロジック・採番(RE-{year}-NNNN)・デフォルト利益率供給(Brand.defaultMarginRate・null時0%)・marginRate=0 一律赤字警告・migration/triple-gate・P1/P2/P3 停止点。UI 設置場所は着手時 recon で確定（1点のみ遅延）。列定義は recon 済み確定 |
