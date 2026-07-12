# QE-1 量産見積計算 仕様追補（addendum）v0.1 (2026-07-12)

- 種別: spec addendum v0.1（qe-1-spec-confirmation-v1_0-2026-06-30 への追補）
- ステータス: 確定（2026-07-12 チャットで4点承認済み・実装ブリーフ着手可）
- 上位: qe-1 v1.0（§0 自己定義・§2 v1スコープ・§3 2源集計・§4 取り切り・§5 通貨）
  ／ qe-0 v1.2（§Q5・QE-1 設計論点「計算モード2本立て」）
  ／ product-sample v1.0 §6-2（売り立て区分）
- 現物確認: Claude Code read-only（2026-07-12・DB 非接続・schema/コード静的読取）
- 本追補の性格: qe-1 v1.0 の確定内容は一切変更しない。誤記訂正2点＋設計欠落の補充2点。
  v1 スコープ（計算ビューのみ・スキーマ変更なし・migration なし・原価まで）は不変。

## 1. 正誤（enum 名・実パス）

qe-1 v1.0 および周辺メモの名称を live schema/コードの実在名に訂正する。

- 販売モード enum: ProcurementMode（非実在）→ **FabricProcurementMode**（ROLL/METER の2値・
  BomItem.procurementMode・生地行のみ）
- WO 区分 enum: WorkCategory（非実在）→ **WorkOrderCategory**（PRODUCTION/SAMPLE/PATTERN/
  GRADING/REWORK/ADDITIONAL の6値）。§3-2 の「workCategory = PRODUCTION」は
  WorkOrder.workCategory（WorkOrderCategory 型）を指す。
- #93 増設先の実パス: src/components/products/（非実在）→
  **src/app/(app)/products/_components/material-requirement-section.tsx**（表示）／
  **src/lib/calc/material-requirement.ts**（computeMaterialRequirements・純関数）／
  同 .test.ts。現状は所要量表示のみで金額未計算＝ここに原価積み上げを増設する。
- 「裁断」を表す既存語彙の整理（誤用防止）: WorkOrderType.CUTTING は WO の作業種別
  （工場の裁断工賃の行に付く）。費目 CMT_FEE は裁断縫製仕上げ一括。いずれも §2 の
  「カット代」とは**別物**（§2 冒頭で定義）。

## 2. カット代（METER モード・qe-1 §4 の欠落補充）★読みX確定

### 2-1. 定義（確定）
カット代 ＝ **生地仕入先が「指定メーター数に切って納める」ことに対して課す費用**。
材料費側の費用であり、工場の裁断工賃（WorkOrderType.CUTTING の WoItem・工賃Σ側）とは別物。

### 2-2. 発生条件（確定・qe-0 v1.2 論点1と接続)
- **ROLL（反売り・取り切り）: カット代なし**（反単価に内包・追加項目を設けない）。
- **METER（メーター売り・指定数）: カット代あり**。qe-1 v1.0 §4 の METER 式を次に補正:
  生地コスト ＝ 必要量 × BomItem.unitPrice **＋ カット代**。

### 2-3. 入力と計算（確定）
- METER 行ごとに**カット代（総額・任意・画面手入力）**を置く。未入力は 0 扱い。
- 保存しない（v1 は計算ビューのみ・§5 の手入力レートと同じ扱い）。永続化は QE-2 以降。
- カット代は材料費Σに加算され、分母 Σ(productionQuantity) で1枚原価に按分される（§3-3 不変）。
- 通貨: **行（BomItem）の currency と同一通貨で入力**し、§5 の換算合算に乗せる。
  ※チャット承認時は「円手入力」と表現したが、カット代の請求元は当該生地仕入先であり
  USD 建て請求が普通に起こる（混在通貨が常態・qe-1 §5 の確定思想）ため、行通貨追従を正とする。
  JPY 固定にしない。

## 3. 工賃Σの除外条件（絶対防衛線の貫通・qe-1 §3-2 への補充）

### 3-1. 補充内容（確定）
§3-2 の工賃Σ（PRODUCTION WoItem の合算）に次の除外条件を追加する:

- **billingClassification = INDIVIDUAL_BILLING の WoItem は工賃Σ（＝1枚原価の分子）に入れない。**
  別枠「別途請求項目（1枚原価外）」として参考表示する（項目名・金額・通貨換算値）。
- UNIT_PRICE_INCLUDED および billingClassification = null の行は従来どおり合算する
  （null 行の費目区分は qe-1 v1.0 Q-c どおり OTHER 可視化）。

### 3-2. 根拠
- BillingClassification の enum 定義そのもの（INDIVIDUAL_BILLING＝パターン代・版代・型代・
  刺繍パンチ代・グレーディング代＝初期費用群／UNIT_PRICE_INCLUDED＝製品単価に溶かす加工工賃）。
- QE-1R の isSeparateBilling と同じ防衛線を、QE-1 では**既存キーのみ**で張る（新設なし・
  スキーマ変更なし）。
- 例: 量産 WO に「縫製 ¥800×500枚」「プリント版代 ¥30,000（INDIVIDUAL_BILLING）」が並ぶ場合、
  1枚原価の分子は縫製のみ。版代は別枠に「版代（別途）」表示。¥60/枚 の混入を構造で防ぐ。

## 4. 変更なしの確認（本追補で改めて確定）

- 通貨ガード: qe-1 v1.0 §5 のまま（JPY/USD のみ・手入力レート・CNY/VND/EUR は集計除外＋
  「対象外通貨」表示・enum 5値は不変更）。validator 追加は不要（永続化が無いため）。
- 材料費引き当てキー: QE-1R 側で supplierId 化済み（listPastPoItemsBySupplier・rough-estimates.ts
  実測確認 2026-07-12）。QE-1 は BOM 起点の計算であり引き当てを使わない＝影響なし・再設計不要。
- 初期費用の絶対防衛線そのもの（1枚原価に混ぜない・別枠計上）: 不変。§3 はその貫通手段。

## 5. スコープ外（非引き込み）

- カット代の永続化・BomItem への列追加 → QE-2 以降（v1 はスキーマ変更なしを維持）。
- カット代の仕入先マスター既定値化（Material/Supplier への標準カット代列）→ 将来検討。
- 工場の裁断工賃の扱い変更 → なし（従来どおり WoItem 行として工賃Σ経路・本追補の対象外）。
- サンプル軸・概算レーン（QE-1R）への波及 → なし（独立レーン・quotation-rough-estimate v0.1 §1）。

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-12 | v0.1 | 4点確定: ①enum/実パス正誤（FabricProcurementMode・WorkOrderCategory・#93 実パス）②カット代＝読みX（生地仕入先の指定数カット費用・METER のみ・行通貨・総額手入力・材料費Σ加算・ROLL はなし）③工賃Σから INDIVIDUAL_BILLING 除外（別枠参考表示・既存キーのみ）④通貨ガード/引き当てキーは変更なし |
