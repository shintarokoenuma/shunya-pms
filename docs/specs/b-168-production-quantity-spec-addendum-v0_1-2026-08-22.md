# B-168 addendum v0.1 — 歩留まりの既定値の改訂と資材の集計軸

作成日: 2026-08-22
親: docs/specs/b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md
　　★親ファイルの日付は 2026-08-19 だが、実際の作成日は 2026-08-22。
　　　前回の引き継ぎメモの日付を誤って使用した。リネームはせず記録に留める。
関連: b-067-quantity-usage-po-spec-confirmation-v1_0-2026-06-23.md（D1 集計軸）

---

## 1. D-4 の改訂（既定値）

改訂前: 指定方式は率（%）と加算枚数（+N 枚）の2種。既定は率 5%。
改訂後: 指定方式は率（%）と加算枚数（+N 枚）の2種。既定は加算枚数 0 枚。

### 根拠

慎太郎さんの実務情報（2026-08-22）: 「オーダーの8割程度は指定数」。
クライアントから確定数量で渡ってくる OEM の受注では、歩留まりを上乗せせず
受注数のまま量産するケースが多数派である。

原設計 §2.6 は「量産発注は受注合計 + 歩留まり率（標準5%）」とするが、これは
展示会積み上げ型の受注を前提とした記述であり、受注 spec v1.0 §0 の訂正
（OEM には展示会積み上げの概念がない）と同じ構図で実態と合わない。

### 影響

- 既定が QUANTITY / 0 のため、無操作なら productionQuantity = orderedQuantity
- D-6 の端数切り上げは RATE のときのみ発生するため、既定では端数が出ない
- 率 5% を使う場合は方式を切り替えて明示的に入力する
- ★B-148 PR-2a（PR #136）は既定 5% で実装済み。マージ前に変更が必要

---

## 2. 歩留まりと資材発注の連動（確認結果・2026-08-22 recon）

### 2-1. 連動は設計として成立している

    production-order-generation.ts:176      SKU 別数量を取得（既定 = Sku.productionQuantity）
    production-order-generation.ts:181-184  カラーウェイ別に合算（qtyByColorway）
    production-order-generation.ts:224-232  色別数量で PoItem を生成

B-168 D-1 により SO 由来の歩留まり込み数量が Sku.productionQuantity へ
書き戻されるため、生地・ボタンの発注数量に歩留まりが反映される。
★PR #136 はマージ前であり、実際に流れることの実証は本番反映後。

### 2-2. 資材所要量の集計軸（現行・b-067 v1.0 D1）

    colorways あり: ProductColorway ごとに Σ(該当カラーウェイの SKU productionQuantity) × totalUsage
    colorways なし: 全 SKU 合計 × totalUsage

サイズは合算で消える。根拠は b-067 v1.0 D1「PoItem はサイズを持たない」。

---

## 3. ★現行設計で表現できないケース（B-181 として分離）

慎太郎さんの指摘（2026-08-22）:

- 品質表示にはサイズの概念があるが、カラーの概念はない
- ただし同一の生地品番でもカラーによって混率が変わることがあり、
  その場合は品質表示の内容がカラーごとに異なる

これは「サイズ別」および「サイズ × カラー別」の集計軸を要求するが、
現行にはサイズ方向の器が存在しない（recon 済み）。

    BomItem         数量系は usagePerUnit / lossRate / totalUsagePerUnit のみ。サイズ次元なし
    BomItemColorway bomItemId × productColorwayId の一意。サイズを持たない
    material-requirement.ts         色別 or 全体の2分岐のみ
    production-order-generation.ts  色別まで。サイズは合算

★BomItem.sizeValue / sizeUnit は資材自体の寸法（cm/mm/m/inch）であり、
　製品のサイズ展開ではない。流用不可。

★ただし production-order-generation.ts:183 の cw.sizes が示すとおり、
　コンテキスト側はサイズを保持している。合算しているのは生成ロジックであり
　データ構造ではない。実装難度は想定より低い可能性がある。

### 影響を受ける資材カテゴリ

    CARE_LABEL   品質表示     サイズ別（混率がカラーで変わる場合はサイズ × カラー別）
    SIZE_LABEL   サイズラベル  ★サイズ別。同じ問題を抱える

### 設計の方向（未確定・B-181 で詰める）

BomItem に集計軸を持たせる案。

    NONE               全 SKU 合計（現行の colorways なし相当）
    COLORWAY           カラー別（現行の colorways あり相当。生地・ボタン）
    SIZE               サイズ別（サイズラベル・通常の品質表示）
    COLORWAY_AND_SIZE  カラー × サイズ別（混率がカラーで変わる品質表示）

既存の2パターンは新しい軸の値に読み替えるだけのため、移行は非破壊で済む見込み。

### 未解決の論点

- PoItem はサイズ列を持たない。サイズ別発注の表現方法が未定
- BomItem.colorCode / colorName / pantone（資材行自体の色指定）と
  BomItemColorway（カラーウェイ別の調達色）の役割分担が未整理
- b-067 v1.0 D1 の改訂 addendum が別途必要

---

## 4. 適用範囲

- §1（D-4 の改訂）は B-148 PR-2a に含める。★PR #136 に未反映
- §2 は確認結果の記録のみ。実装変更なし
- §3 は B-181 として分離。案A（起票のみ・先送り）で確定

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-22 | v0.1 | D-4 を「既定は加算枚数 0」に改訂。資材のサイズ軸の欠落を B-181 として分離 |
