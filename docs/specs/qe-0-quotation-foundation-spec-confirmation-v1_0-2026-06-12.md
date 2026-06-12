# QE-0 見積もりエンジン データ基盤 仕様確認書 v1.0 (2026-06-12)

## 0. 位置づけ
Phase 1B 見積もりエンジンの入口。エンジン本体の前に、入力データ基盤
(用尺・ロス率・原反) を確定する。元設計 (20260516 quotation_engine v1.0) の
計算ロジックは生きており、本書はその入力受け皿を現行実装に接続する。

## 1. 段階分割
- QE-0: データ基盤 (本書)。Material 拡張 + 簡易BOM + マーキング実測
- QE-1: 量産見積計算 (原反取り切り・数量別単価表) = B-052 本体
- QE-2: 見積書化 (Quotation モデル・バージョン管理・PDF・有効期限)
- QE-3+: マージン4階層フル・MOQ階段カスタム・多通貨/為替・多言語

## 2. 確定論点

### Q1. BOM の持ち方
Product (品番カルテ) 直結で Bom/BomItem を新設。仕様書 (Specification) は
未実装のため、実装後に紐付けを後付けできる構造とする (specificationId nullable 等)。
見積も実績 (SP) も品番に集約され、突合の軸が揃う。

### Q2. 用尺の持ち方 (B-039)
v1 は代表サイズの用尺1本: BomItem.usagePerUnit Decimal(10,4) + unit。
サイズ別用尺はサイズ展開 (B-041/B-030) と合わせて後付け。
保存単位は m に正規化 (マーキング図は cm 表記のため入力時換算)。

### Q3. ロス率
BomItem.lossRate (行ごと・上書き可)。デフォルトは Material.standardLossRate
(新設) から引く。

### Q4. Material 拡張 (原反の数値化)
- rollLength: 原反長 (m, Decimal, nullable)
- fabricWidth: 生地幅 (cm, Decimal, nullable) ※用尺は幅に従属するため必須級
- rollPrice: 反単価 (nullable)。基本は メーター単価×原反長 で導出し、
  反売り価格が別建ての取引のみ実値を持つ
- standardLossRate: 標準ロス率 (%, nullable)

## Q5. 原反取り切り計算 (QE-1 で実装する式の確定)
必要量 = 用尺 × 数量 × (1 + ロス率)
反数 = 切り上げ (必要量 ÷ 原反長)
生地コスト = 反数 × 反単価
- (a) 販売モードは行ごとに区分: ROLL (反売り・取り切り) / METER (メーター売り・
  必要量×単価)。サンプル発注が実際にメーター運用のため両モード必須
- (b) 取り切りの余り生地は当面コストに含めるのみ。在庫戻しは Phase 1C 在庫管理

### Q6. 見積 vs 実績の突合 (B-044 オーナー指標)
見積は Product 単位。実績は Product 配下の SP 実績合計 (S-4c-1 集計) と突合。

## 3. 用尺の入力2系統 (慎太郎さん要望 2026-06-12)

### パターンA: 直接入力
BomItem.usagePerUnit を手入力。

### パターンB: マーキング図からの転記 (MarkingRecord 新設)
実物マーキング図 (例: SY16-16SY-082 esgrey) の構造に基づく:
- fabricWidth: 生地幅 (例 100.0cm)
- totalUnits: 総着数 (例 2)
- totalLength: 総用尺 (例 483.9cm)
- yieldRate: 収率 (例 72.9%)
- partsCount: パーツ数 (例 26)
- patternPitch: 柄ピッチ (例 0.0)
- 原本ファイル添付 (PDF。GCS 保存基盤 B-053 を流用)
- 1着用尺 = totalLength ÷ totalUnits を自動導出 (例 241.95cm = 2.4195m)
  → BomItem.usagePerUnit へ反映 (出所 source=MARKING_SHEET を記録)
- 用尺は生地幅に従属するため、MarkingRecord.fabricWidth と
  Material.fabricWidth の不一致は警告表示

### サンプル時の扱い
サンプルは用尺不要・ざっくりメーター数の発注 (現行 PO で対応済み・変更なし)。
用尺・取り切りは量産見積 (QE-1) 専用。

## 4. 将来 (構造だけ用意・機能は後)
- B-047 (既存): CAD 連携の用尺見込み計算。東レ CAD 等からマーキング取得まで
  を目標に追記。MarkingRecord.source に CAD を予約
- B-056 (新規): マーキング図 PDF / パターンデータの AI 自動読み取り
  (アップロード → 項目抽出 → 確認画面 → MarkingRecord 化)。Phase 1E の AI 機能。
  v1 から原本 PDF を添付保存するため教師データが自然に蓄積される

## 5. 次ステップ
QE-0 実装 (Material 拡張 migration + Bom/BomItem + MarkingRecord + UI) の
実装ブリーフへ。

## 正誤 (2026-06-12)
QE-0a 実装着手時に現行 schema を精査した結果、以下を訂正する。

- **Q1 補足**: `Specification` / `Bom` / `BomItem`（+ enum `BomStatus` / `BomItemCategory`）は
  schema 上は**既に存在**する（元設計 20260516 quotation_engine 由来・機能未実装の休眠・dev/本番とも
  データ0件）。よって「新設」ではなく、**既存 `Bom` を Product 直結に拡張する案(A)で確定**:
  - `Bom.specificationId` を必須 unique → **nullable @unique に緩和**（Postgres は NULL 複数可。リレーションも optional 化）
  - `Bom.productId`（nullable・scalar FK）を追加。新規 QE-0系 BOM では validator で必須担保
  - `BomItem.usagePerUnit` / `BomItem.unitPrice` を**必須→nullable に緩和**（入力途中・金額未定を許容）
  - `BomItem` に `procurementMode` / `usageSource` / `markingRecordId` を追加
  - `BomItem` には既存どおり `deletedAt` を持たない（Bom への cascade で管理）。`itemCategory` は既存必須を維持
  - データ0件のため上記の制約緩和は実害なし（非破壊）
- **Q4 補足**: `fabricWidth`（既存 Decimal(8,2)）/ `standardLossRate`（既存 Decimal(5,2)）/ `standardUsage`
  は Material に**既存**。新規追加は **`rollLength` / `rollPrice` のみ**（既存の fabricWidth 等は流用・精度変更なし）。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-06-12 | v1.0 | QE-0 データ基盤確定 (Q1-Q6 + 用尺入力2系統 + B-056 起票) |
| 2026-06-12 | v1.0 正誤 | QE-0a 実装時の現行 schema 精査を反映: 既存 Bom/BomItem を Product 直結へ拡張する案(A)確定・Material 新規は rollLength/rollPrice のみ |
