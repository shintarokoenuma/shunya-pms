# B-168 仕様確認書 — 量産数量（productionQuantity）の正の定義 v0.1

作成日: 2026-08-19
関連: B-148 PR-2 の前提 / B-167（同一 migration） / B-156

---

## 1. 背景

原設計 §2.6 は「量産発注は受注合計 + 歩留まり率（標準5%）で自動計算。担当者調整可能」
と定めている。しかし受注（SalesOrder）が長く未実装だったため、量産数は
Sku.productionQuantity への手入力が代用となっていた。

この代用は暫定であることが spec に明記されている。b-067 v1.0 §4（非スコープ）:

> 歩留まり率5%（受注→量産＝フェーズ2 SalesOrder 連携時）。
> v1.0 は productionQuantity を量産数として受ける（フェーズ1 手入力）。

sku-design v1.1 §2-2 の柱書も「出口を SalesOrder に一本化。入力経路はすべて
SalesOrder を作る手段として後付け」としている。

B-148 PR-1（2026-08-19 本番反映・PR #135）で SalesOrder が成立したため、
本書でフェーズ2 への移行を確定する。

---

## 2. recon（2026-08-19 実測）

### 2-1. 数量列は2箇所ある

    Sku.productionQuantity    Int  @default(0)   量産発注数     稼働中
    SoItem.productionQuantity Int?               歩留まり率込み  休眠（書き込みなし）
    SoItem.yieldRate          Decimal?(5,2)      歩留まり率      休眠（src 参照ゼロ）

### 2-2. Sku.productionQuantity の読み口は4つ

| # | 読み口 | 使うライフサイクル段階 | SO の有無 |
|---|---|---|---|
| 1 | material-requirement.ts:79,90（資材所要量） | 5. 見積もり | 無い |
| 2 | production-cost.ts:151（1枚原価の分母） | 5. 見積もり | 無い |
| 3 | production-estimates.ts:463（量産見積の見積数量） | 5. 見積もり | 無い |
| 4 | production-order-generate-form.tsx:50（発注生成の既定値） | 8. 量産発注 | 有る |

### 2-3. 計算エンジンは改修不要

production-estimate/calc.ts:118-131 の syntheticSku(estimateQuantity) が、
Sku 実レコードを使わず productionQuantity = estimateQuantity の1行を合成して
computeProductionCost に渡している。

つまり computeProductionCost / computeMaterialRequirements は
productionQuantity を引数として受けるだけで、Sku 自身の値に固定されていない。
正の出どころを差し替えるだけでよく、エンジン改修は発生しない。

### 2-4. ロス率と歩留まり率は別レイヤー（★二重計上ではない）

| | BomItem.lossRate | SoItem.yieldRate |
|---|---|---|
| 適用先 | 用尺（1枚あたりの生地量） | 枚数（受注数 → 量産発注数） |
| 式 | usagePerUnit × (1 + lossRate/100) | orderedQuantity × (1 + yieldRate/100) |
| 適用箇所 | material-requirement.ts:55 / production-cost.ts:179 | 未実装 |
| 状態 | 稼働 | 休眠 |

歩留まりで5%増えた枚数それぞれに用尺ロスが乗るのは正しい（増産分の生地も要る）。
二重計上ではない。本書で lossRate には一切触れない。

### 2-5. SO → 量産発注の消し込み列は既に存在（休眠）

    SalesOrder.isConvertedToProduction  Boolean @default(false)
    SalesOrder.convertedAt              DateTime?

src 参照ゼロ。この2列の稼働は B-148 PR-2 の本体であり、本書のスコープ外。

---

## 3. 確定事項（D-1 〜 D-9）

| # | 論点 | 確定内容 |
|---|---|---|
| D-1 | 量産数量の正 | SO 由来を正とする。Sku.productionQuantity は SO 確定時に Σ SoItem.productionQuantity を書き戻すキャッシュ列とする。列は非破壊で残す（DROP しない） |
| D-2 | Sku 側の手入力 | 数量マトリクス下段の手入力 UI を非表示にする。将来の再開を migration なしで可能にするため列とデータは残す |
| D-3 | 歩留まりの保持粒度 | SoItem（＝SKU 行）単位で保持する。SoItem は既に SKU 行単位のレコードのため、保存側の追加設計は不要 |
| D-4 | 指定方式 | 率（%）と加算枚数（+N 枚）の2種を切り替え可能とする。既定は率 5% |
| D-5 | 列追加 | yieldMode（RATE / QUANTITY）と yieldQuantity（Int?）を追加。B-167（SoItem.unitPrice の nullable 化）と同一 migration に載せる |
| D-6 | 計算式と端数 | RATE: productionQuantity = ceil(orderedQuantity × (1 + yieldRate/100))。QUANTITY: productionQuantity = orderedQuantity + yieldQuantity。★率指定の端数は SKU 単位で切り上げる。加算方式が別に用意されているため、率は「最低限の余裕」の意味に寄せる。切り捨てると 1〜2枚の SKU で歩留まりが 0 になる |
| D-7 | 入力 UI | SO 入力フォームで、品番一律／色別／サイズ別／SKU 個別の一括適用を提供する。既定は品番一律 5%。初版（PR-2）に含める |
| D-8 | 発注生成での上書き | production-order-generation v0.1 §4（R-d）の確定をそのまま維持する。生成画面は既定値を提示し、人が編集でき、生成時に入力値を焼き込む。★新規実装は不要（production-order-generate-form.tsx:50 で稼働中） |
| D-9 | 減産・ロス率 | 減産は SoItem.productionQuantity を動かす（sales-order v1.0 §5 を踏襲）。同列は「歩留込みの計画量産数」と「減産後の数」を兼ねる。BomItem.lossRate には触らない |

### D-6 の注記

D-6 の端数処理のみ、慎太郎さんの明示的な判断ではなく Claude の推奨で確定した。
実データ（小ロット多 SKU の受注）で膨張が問題になる場合は再検証する。

---

## 4. migration（B-167 と同一本）

対象: so_items

    ALTER TABLE so_items ALTER COLUMN unit_price DROP NOT NULL;   （B-167）
    ALTER TABLE so_items ADD COLUMN yield_mode ...;               （B-168 D-5）
    ALTER TABLE so_items ADD COLUMN yield_quantity INTEGER;       （B-168 D-5）

非破壊原則に従い ADD ONLY。DROP は行わない。
enum 追加につき、対応する Record<enum, string> のラベル定義を同一 PR で追加する（鉄則）。

triple-gate（dev 確認 → 本番 dry-run BEGIN/ROLLBACK → マージ → 本番確認）の対象。

---

## 5. 受け入れる副作用（★意図的）

品番カルテ（products/[id]/page.tsx:578）は MaterialRequirementSection を
無条件に描画する。品番カルテは案件段階（受注のはるか手前）で作られるため、
D-2 で手入力を非表示にすると、SO が成立していない品番では
Sku.productionQuantity が 0 のままとなり、以下が 0 表示になる。

- 品番カルテの「資材所要量」セクション
- 品番カルテの「1枚原価」セクション

影響範囲は上記2セクションに限定される。量産見積側は syntheticSku により
自前の分母（estimateQuantity）を持つため、見積の原価計算は 0 にならない。

慎太郎さんの判断（2026-08-19）: 受注前の試算は現状あまり使う機会が少ないため、
将来の修正余地を残したうえで非表示とする。解消は B-177 として起票済み。

---

## 6. 実装の段階分け

- 本書のスキーマ変更（D-5）と計算ロジック（D-6）は B-148 PR-2 に含める
- D-2（Sku 側手入力の非表示）も PR-2 に含める。正の切り替えと同時に行わないと、
  SO 由来の値と手入力値が同時に存在する期間が生まれる
- D-8 は既存実装のため作業なし

---

## 7. スコープ外（★B番号を振済み）

| 内容 | B番号 |
|---|---|
| 受注前カルテの試算数量の供給（§5 の 0 表示の解消） | B-177 |
| Sku.productionQuantity 列の完全廃止 | B-178 |
| 歩留まり率の既定値の運用高度化（品番別・実績からの提案） | B-179 |
| SO → 量産発注の消し込み（isConvertedToProduction / convertedAt の稼働） | B-148 PR-2 |
| SoItem.unitPrice の nullable 化 | B-167 |

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-19 | v0.1 | 初版確定。recon（Sku/SoItem 実スキーマ・読み口4箇所・合成 SKU の前例・ロス率と歩留まり率の分離）を根拠に D-1〜D-9 を確定 |
