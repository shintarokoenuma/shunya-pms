# QE-1 量産見積計算 仕様確認書 v1.0 (2026-06-30)

- 作成: 2026-06-30 / Claude.ai + 慎太郎さん
- ステータス: **v1.0 確定（main 直 push 可・実装ブリーフ着手可）**
- 上位: QE-0 v1.2（段階分割§1・取り切り式 Q5・用尺2系統）/ QE-0d v1.1（コスト軸・costSource/purchaseOrderId）/ id-map-audit v0.1（要件A 品番粒度§5）
- 元設計: 20260516 quotation_engine v1.0（フル野心版＝過剰スコープ。本書は計算層のみ切り出し）
- 現物確認: Claude Code read-only（2026-06-30・DB 非接続・静的読取）

## 0. 位置づけ
QE-1 ＝ 量産見積の「計算」（原反取り切り・数量別単価表）＝ B-052 本体。
見積書化（Quotation モデル・PDF・有効期限）は QE-2、マージン・MOQ カスタムは QE-3+。
本書は原価（材料費＋工賃）の算出までを対象とし、売価・マージンは含めない。
- ※ 本書は**量産見積**（原反取り切り・productId 起点）。**サンプル見積**（指定数・メーター発注・概算/納品金額の2段階）は別物・別系統＝`sample-quotation-concept-v0_1-2026-06-30.md` を参照。

## 1. 段階分割と staging 見直し（★owner 上書き）
qe-0 §1 の当初 staging では「多通貨/為替・多言語」は QE-3+ 送りだった。
慎太郎さん指示により、以下2点を QE-1 v1 に前倒しする（staging 改訂）:
- **為替（ドル円）**: 混在通貨の JPY 換算合算を v1 に含める（§5）。
- **日英**: 原価ラベルの日英併記を v1 に含める（§7）。
前倒しは「計算・表示」に限る。永続化（QuotationMultilingual・ExchangeRate 連携）は
QE-2 以降に据え置き（§5-B / §7）。

## 2. v1 スコープ（確定）
- **計算ビューのみ**。永続化なし・**スキーマ変更なし・migration なし**。
- 設置場所: #93 `material-requirement-section.tsx` の隣接（同 products/[id] 配下に
  原価ビューを増設、または同セクション拡張）。集計はクライアント純関数（追加クエリなし）。
- 範囲: **原価まで**（材料費＋工賃）。売価・マージン・数量別単価表の「価格」面は QE-3+。
  v1 の「数量別」は productionQuantity を分母にした1枚原価の提示まで。

## 3. 2源集計（確定）
原価 = 材料費 + 工賃。

### 3-1. 材料費（BomItem 起点・#93 を拡張）
- #93 が既に算出: 所要量 = Σ(productionQuantity) × ロス込み用尺
  （usagePerUnit × (1 + lossRate/100)）。
- QE-1 増分 = **× 単価 ＋ 取り切り丸め**（§4）。
- 行ごとに currency を保持し §5 で換算合算。

### 3-2. 工賃（WoItem 起点）
- 源 = `workCategory = PRODUCTION` の WorkOrder / WoItem。
- 工賃Σ = Σ(WoItem.unitPrice × quantity)（行ごと currency・§5 換算）。
- **dev に PRODUCTION WO は 0 件**。よって「WO 未登録なら工賃 0・材料費のみ」を正常系とする。
- WoItem.unitPrice は nullable（金額未定可）＝未定行は除外し「未確定」表示（§8）。

### 3-3. 1枚原価（Q-a 確定）
- 1枚原価 = (材料費Σ + 工賃Σ) ÷ Σ(productionQuantity)。
- **割戻し分母 = Σ(productionQuantity) で確定**。理由: #93 が同分母で所要量を算出済み。
  原価ビューを隣接させる以上、分母が割れると所要量と原価で母数が食い違い破綻する。整合一択。

## 4. 取り切り計算（qe-0 §Q5・確定）
販売モードは BomItem 行ごとに `procurementMode`（実在）で分岐:
- **ROLL（反売り・取り切り）**: 必要量 = 用尺 × 数量 × (1 + ロス率)。
  反数 = ceil(必要量 ÷ Material.rollLength)。生地コスト = 反数 × Material.rollPrice。
- **METER（メーター売り）**: 生地コスト = 必要量 × BomItem.unitPrice。
- 余り生地は当面コストに含めるのみ（在庫戻しは Phase 1C・qe-0 §Q5-b）。
- 注: #93 コメントの「反・巻丸め未対応(B-039)」は用尺のサイズ別展開の話。
  取り切り丸め自体は qe-0 §Q5 どおり **QE-1 で実装**。

### 4-1. 取り切り出力の見せ方（Q-b 確定）
- **金額を主・反数を従**で表示（例: 「生地コスト ¥XX,XXX（3反）」）。
- 理由: 原価ビューの主役は1枚原価。金額を前面に出し、取り切りの実態（端数で1反増える等）は
  括弧の反数で補足する。発注実務で反数主体が要る場面は QE-2 以降の発注下書き（B-057）で扱う。

## 5. 混在通貨（確定・§Q2 由来）
- 行ごとに currency を保持（BomItem/WoItem/PoItem すべて currency 列実在）。
- USD 行は **入力 USD/JPY レート**で JPY 換算し JPY 基準で合算。USD 換算表示トグルも提供。
- **対応通貨 = JPY / USD のみ**。CNY / VND / EUR は集計から除外し「対象外通貨」表示。
  - ★Currency enum は5値（JPY/USD/CNY/VND/EUR）。enum は触らず**集計層で JPY/USD 以外を弾く**。
  - 旧メモの「GBP ブロック」は誤記（GBP は enum に非存在）。
- **§5-B. ExchangeRate 基盤の扱い（★recon 新発見）**: `ExchangeRate` モデルは schema 実在
  （baseCurrency/targetCurrency/rate/rateDate/source）だが、**v1 では使用しない**。
  レートは画面の手入力1本（v1 は保存しない）。ExchangeRate テーブル連携・レート履歴・
  送付用レート固定は **QE-2 以降**。
- recon 時に Claude Code が「dev 全 JPY ゆえ JPY 限定で実害ゼロ」と提案した件は、
  要件（ベトナム例の混在）に反するため**不採用**。混在換算で確定（spec > データ現況）。

## 6. 費目写像（確定）
### 6-1. 工賃（Q-c 確定）
WoItem.costCategoryId → CostCategory.externalCategory → ExternalCostCategory
（SEWING / PROCESSING / OVERHEAD）。CostCategory.externalCategory は ExternalCostCategory 型と live 確認済み。
- **costCategoryId が null の WoItem は `OTHER`（区分なし）として表示で確定**。
  理由: SEWING 既定は、実体が加工費/諸経費の行を縫製費に誤集計する害がある。
  CostCategory.externalCategory は必須＝区分が付くべき行であり、null は欠落シグナル。
  誤った場所に黙って足さず、未分類として可視化し人が後で正す。

### 6-2. 材料費（Q-d 確定）
- 材料費は表示器の **material セクションに集約**し、BomItem.itemCategory は
  **行ラベル**として使う。**InternalCostCategory への写像はしない**。
- 根拠（recon 2026-06-30）: `BomItem.itemCategory` の型は `BomItemCategory`（21値）で、
  `InternalCostCategory`（35値）とは**別 enum・機械写像が存在しない**。名前が一部重なるが、
  BomItemCategory 側の `ELASTIC / TAPE / RIVET` 等は InternalCostCategory に対応値が無い。
  写像を作ると恣意的なマッピング表を抱えることになるため、QE-1 では束ねない方が安全。
- BomItemCategory 21値（実 enum・recon 確認済）:
  - 生地: MAIN_FABRIC / LINING_FABRIC / INTERLINING
  - 副資材: ZIPPER / BUTTON / THREAD / ELASTIC / TAPE / RIVET
  - ラベル類: BRAND_LABEL / SIZE_LABEL / CARE_LABEL / HANG_TAG
  - パッケージ: POLYBAG / OPP_BAG / BOX / TISSUE
  - その他: ACCESSORY / OTHER

## 7. 日英併記（確定）
- 原価ラベル（材料費 / 縫製費 / 加工費 / 諸経費 等）を日英併記まで。
- QuotationMultilingual への永続化はしない（＝QE-2）。ExternalCostCategory の4値
  （MATERIAL/SEWING/PROCESSING/OVERHEAD）に対訳が付くので静的辞書で対応。

## 8. 表示器の再利用（条件付き・★recon C）
- 型 `CostBreakdownRow` / `CostBreakdownSection`（src/lib/actions/sample-production-costs.ts）と
  表示 `cost-breakdown.tsx` は QE-1 で **再利用可**。section key = material/pattern/sewing/revision/other。
- ただし既存集計は excludeReason に **NON_JPY**（JPY 以外を除外）を持つ。QE-1 は「除外」ではなく
  「換算」方針のため、**既存の集計ロジックは流用せず QE-1 専用の集計関数を新設**し、
  NON_JPY は除外せず §5 で換算する。型と描画器のみ共有する。
- AMOUNT_UNDECIDED（金額未定除外）は QE-1 でも流用（unitPrice=null 行は「未確定」）。

## 9. 確定一覧
| # | 論点 | 確定内容 |
|---|---|---|
| 1 | v1 範囲 | 計算ビュー・スキーマ変更なし・原価まで |
| 2 | 2源集計 | 材料費 BomItem ＋ 工賃 PRODUCTION WoItem |
| 3 | 取り切り | ROLL/METER 分岐（qe-0 §Q5） |
| 4 | 混在通貨 | JPY/USD のみ・手入力レート換算・CNY/VND/EUR 除外 |
| 5 | ExchangeRate | v1 不使用（QE-2 送り） |
| 6 | 日英 | ラベル併記・永続化なし |
| 7 | 表示器 | 型/描画のみ再利用・集計は新設（NON_JPY は換算） |
| Q-a | 割戻し分母 | Σ(productionQuantity)（#93 と分母一致） |
| Q-b | 取り切り出力 | 金額主・反数従 |
| Q-c | null 工賃区分 | OTHER（区分なし）表示 |
| Q-d | 材料費の束ね | material 集約・itemCategory は行ラベル・InternalCostCategory 写像なし |

## 10. 次ステップ
QE-1 実装ブリーフ（Claude Code 向け）。計算純関数の新設（材料費 ×単価＋取り切り・
工賃集計・混在通貨換算）＋ 原価ビュー（CostBreakdown 型再利用・集計は QE-1 専用）。
スキーマ変更なし＝feature ブランチ + PR（コード含むため）。型/lint クリアで PR open まで自走。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-06-30 | v0.1 | 初版ドラフト（要確認 Q-a〜Q-d）。doc/live 突き合わせで起票。新発見4点反映 |
| 2026-06-30 | v1.0 | Q-a（分母=Σ productionQuantity）/ Q-b（金額主・反数従）/ Q-c（null→OTHER）/ Q-d（material 集約・BomItemCategory 21値で写像不要を確定）を確定。実装ブリーフ着手可 |
