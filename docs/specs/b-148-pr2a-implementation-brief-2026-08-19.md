# B-148 PR-2a 実装ブリーフ — 受注側で量産数量を確定させる

作成日: 2026-08-19
対象: B-148 PR-2a / B-167 / B-168
根拠 spec: docs/specs/b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md（D-1〜D-9）
　　　　　 docs/specs/sales-order-spec-confirmation-v1_0-2026-08-13.md（R-5〜R-11）
　　　　　 docs/specs/sales-order-spec-addendum-v0_1-2026-08-19.md

---

## 0. 着手前に必ず読むこと

本ブリーフは 2026-08-19 の recon 時点のコードを前提に書かれている。
着手時に以下を grep で確認し、記述と食い違ったら **実装せず停止して報告する**。

- src/lib/actions/sales-orders.ts の recomputeSkuOrderedQuantities が 128 行目付近にあり、
  引数が (soItemDelegate, skuDelegate, companyId, skuIds) であること
- src/app/(app)/sales-orders/_components/sales-order-form.tsx に
  qty: Record<skuId, string> 相当の構造があること
- src/app/(app)/products/_components/quantity-matrix-section.tsx が
  updateSkuQuantity を import していること

食い違いを自分で吸収して先に進まない。止めて報告する。

---

## 1. スコープ

PR-2 は 2 本に分割する。本ブリーフは **PR-2a のみ**。

| | PR-2a（本書） | PR-2b（別ブリーフ） |
|---|---|---|
| migration | あり（1本） | なし |
| SoItem.productionQuantity の算出・保存 | 対象 | — |
| Sku.productionQuantity への書き戻し | 対象 | — |
| 受注フォームの歩留まり入力 UI | 対象 | — |
| 数量マトリクス下段の手入力の非表示 | 対象 | — |
| SO → 量産発注の生成接続 | — | 対象 |
| isConvertedToProduction / convertedAt の稼働 | — | 対象 |
| B-156（Σ入力数量 0 のブロック可否） | — | 対象 |

PR-2a 完了時点で、SO を確定すると量産数量が SO 由来で決まり、
既存の発注生成画面（production-order-generate-form.tsx:50）が
Sku.productionQuantity を既定値として拾う。これで実務は回り始める。

### スコープ外（★勝手に実装しないこと）

- SO → 量産発注の変換・消し込み（PR-2b）
- QE-2 との単価突合警告（B-143 待ち・B-167 の残り）
- 受注の税表示 3 段（B-165）
- 受注変更履歴（B-162）
- SKU 別 MOQ の自動判定（B-163）
- 受注前カルテの試算数量の供給（B-177）
- Sku.productionQuantity 列の廃止（B-178）

---

## 2. 本ブリーフで追加確定した事項（E-1 〜 E-6）

| # | 論点 | 確定内容 |
|---|---|---|
| E-1 | SoItem.subtotal | unitPrice の nullable 化に伴い subtotal も nullable にする。単価未定と金額ゼロを区別するため。慎太郎さん判断 2026-08-19 |
| E-2 | SalesOrder ヘッダの金額集計 | subtotal が null の SoItem は合計から除外する。SalesOrder.subtotal / totalAmount は NOT NULL のまま維持し、非 null 行の合計を書く。全行が null なら 0 を書く |
| E-3 | recompute 関数の扱い | recomputeSkuOrderedQuantities を新設せず **既存関数を拡張**する。同一 aggregate で orderedQuantity と productionQuantity の 2 列を集計し、Sku の 2 列を同時に更新する。関数名は変更しない（呼び出し元の差分を出さないため）。JSDoc のみ実態に合わせて更新する |
| E-4 | productionQuantity の集計対象 | orderedQuantity と同一条件（COUNTED_STATUSES / deletedAt IS NULL / isLatest = true）。_sum が null なら 0 を書く。既存の D-4 と揃える |
| E-5 | 歩留まりの入力単位 | 品番ブロック単位で「適用粒度（一律 / 色別 / サイズ別 / SKU 個別）」を選び、値を入力して各 SKU に配る。保存は常に SoItem（SKU 行）単位。既定は一律・RATE・5% |
| E-6 | TENTATIVE の enum コメント | 本 PR で修正する。Prisma の // コメントは DB に反映されず migration は発生しない。B-180 として起票済み |

---

## 3. schema 変更

### 3-1. enum 新設

    enum YieldMode {
      RATE      // 率（%）指定
      QUANTITY  // 加算枚数（+N 枚）指定
    }

### 3-2. SoItem の変更

| 列 | 変更 |
|---|---|
| unitPrice | Decimal @db.Decimal(15, 2) → Decimal? @db.Decimal(15, 2)（B-167） |
| subtotal | Decimal @db.Decimal(15, 2) → Decimal? @db.Decimal(15, 2)（E-1） |
| yieldMode | 新設 YieldMode? @map("yield_mode") |
| yieldQuantity | 新設 Int? @map("yield_quantity") |
| productionQuantity | 既存 Int?（変更なし・PR-2a で書き込みを開始する） |
| yieldRate | 既存 Decimal? @db.Decimal(5, 2)（変更なし・PR-2a で書き込みを開始する） |

### 3-3. SalesOrderStatus の comment（E-6）

    TENTATIVE // 仮受注（受注募集中・展示会中）

を

    TENTATIVE // 入力途中（社内の代打ち中・内容未確認）

に変更する。受注 spec v1.0 R-6 の再定義に合わせる。値は変更しない。

---

## 4. migration（1本・非破壊）

新規ディレクトリを 20260819000000_b167_b168_so_item_yield として作る。
直前は 20260813000000_b148_sales_order_product_nullable。

SQL は以下 5 文。ADD ONLY と DROP NOT NULL のみで、DROP COLUMN / DROP TABLE は書かない。

    CREATE TYPE "YieldMode" AS ENUM ('RATE', 'QUANTITY');
    ALTER TABLE "so_items" ALTER COLUMN "unit_price" DROP NOT NULL;
    ALTER TABLE "so_items" ALTER COLUMN "subtotal" DROP NOT NULL;
    ALTER TABLE "so_items" ADD COLUMN "yield_mode" "YieldMode";
    ALTER TABLE "so_items" ADD COLUMN "yield_quantity" INTEGER;

★dev DB は db push 起源で _prisma_migrations が無いため migrate dev は使えない。
　dev への反映は db push で行う。migration ファイルは本番向けに手で作成する。
　★SampleProduction に部分 unique index があるため db push の対象範囲に注意し、
　　差分プレビューに so_items 以外のテーブルが出たら停止して報告する。

---

## 5. 計算ロジック（D-6）

新規ファイル src/lib/calc/sales-order-quantity.ts に純関数を置く。
既存の src/lib/calc/material-requirement.ts と同じ house style（純関数・副作用なし）。

関数: computeProductionQuantity

入力: orderedQuantity（Int・0 以上）
　　　mode（YieldMode）
　　　yieldRate（number | null・RATE 時に使用）
　　　yieldQuantity（number | null・QUANTITY 時に使用）

規則:
- mode = RATE のとき productionQuantity = Math.ceil(orderedQuantity × (1 + yieldRate / 100))
- mode = QUANTITY のとき productionQuantity = orderedQuantity + yieldQuantity
- yieldRate / yieldQuantity が null のとき、その項を 0 として扱う（＝ orderedQuantity をそのまま返す）
- orderedQuantity = 0 のとき常に 0 を返す
- 戻り値は必ず 0 以上の整数

★端数は RATE のときのみ発生し、SKU 単位で切り上げる（D-6）。
　加算方式が別に用意されているため、率は「最低限の余裕」の意味に寄せている。

テストファイル src/lib/calc/sales-order-quantity.test.ts を同時に作る。
既存 src/lib/calc/material-requirement.test.ts と同じ形式。最低限のケース:

- RATE 5% / ordered=100 → 105
- RATE 5% / ordered=2 → 3（切り上げの確認）
- RATE 0% / ordered=50 → 50
- QUANTITY +10 / ordered=100 → 110
- ordered=0 → 0（両モード）
- yieldRate=null / RATE → ordered と同値

---

## 6. actions の変更（src/lib/actions/sales-orders.ts）

### 6-1. recomputeSkuOrderedQuantities の拡張（E-3）

現状 128-154 行の関数は _sum: { orderedQuantity: true } のみを集計し
Sku.orderedQuantity だけを更新している。これを次のように拡張する。

- aggregate の _sum に productionQuantity: true を追加する
- update の data に productionQuantity: agg._sum.productionQuantity ?? 0 を追加する
- 型 SoItemAggregator / SkuUpdater が集計列・更新列を型で縛っている場合は同時に拡張する
- JSDoc を「受注数量と量産数量の両方を Sku へ書き戻す」旨に更新する

★関数名は変更しない。呼び出し元（createSalesOrder / updateSalesOrder /
　updateSalesOrderStatus / cancelSalesOrder）には一切手を入れない。
　もし呼び出し元が 4 箇所でなかった場合は停止して報告する。

### 6-2. createSalesOrder / updateSalesOrder

SoItem の書き込み時に以下を追加する。

- yieldMode: 入力値（既定 RATE）
- yieldRate: RATE のとき入力値、QUANTITY のとき null
- yieldQuantity: QUANTITY のとき入力値、RATE のとき null
- productionQuantity: computeProductionQuantity(...) の戻り値

unitPrice / subtotal は E-1 に従い null を許容する。
subtotal は unitPrice が null なら null、そうでなければ unitPrice × orderedQuantity。

SalesOrder ヘッダは E-2 に従う。

- subtotal = 非 null の SoItem.subtotal の合計（全て null なら 0）
- totalAmount = subtotal と同値（税は qe1r-tax-addendum v0.1 の方針どおり書かない）
- totalQuantity は既存どおり Σ orderedQuantity（★productionQuantity ではない）

### 6-3. DTO 型

SalesOrderItemDTO の unitPrice / subtotal を number | null に変更する。
yieldMode / yieldRate / yieldQuantity を追加する。
getSalesOrder / listSalesOrders / getSalesOrderSectionForProduct の
読み出し側も同時に対応する。

---

## 7. validator（src/lib/validators/sales-order.ts）

SKU 行のスキーマに以下を追加する。Zod v4。

- yieldMode: z.enum(["RATE", "QUANTITY"])（既定 "RATE"）
- yieldRate: 0 以上 100 以下の数値・任意（RATE のとき必須）
- yieldQuantity: 0 以上の整数・任意（QUANTITY のとき必須）
- unitPrice を必須から任意に変更する（B-167）

superRefine 等で「mode に対応する値が入っていること」を検証する。

---

## 8. UI

### 8-1. 受注フォーム（sales-order-form.tsx）— D-7 / E-5

現状 Block に qty: Record<skuId, string> と moq 相当の Record がある。
これと並ぶ第 3 の構造として歩留まり入力を追加する。

品番ブロックのヘッダ部に以下を置く。

- 適用粒度セレクト: 一律 / 色別 / サイズ別 / SKU 個別（既定: 一律）
- 方式セレクト: 率(%) / 加算枚数(+枚)（既定: 率）
- 値の入力欄
- 「適用」ボタン

「適用」を押すと、選んだ粒度に従って各 SKU の値を埋める。

- 一律: ブロック内の全 SKU に同じ値
- 色別: カラーウェイごとに入力欄が出て、同一カラーウェイの SKU に配る
- サイズ別: サイズごとに入力欄が出て、同一サイズの SKU に配る
- SKU 個別: 各 SKU 行の入力欄を直接編集する

初期表示は「一律・率・5」で全 SKU に 5% が入った状態にする。

各 SKU 行に、算出された量産数量をプレビュー表示する
（computeProductionQuantity をクライアント側でも呼ぶ。純関数なので共用できる）。

★単価入力欄を任意にする（B-167）。未入力なら小計は「—」と表示する。

### 8-2. 数量マトリクス（quantity-matrix-section.tsx）— D-2

下段 productionQuantity のインライン編集を **非表示**にする。

- EditableCell の呼び出しをやめ、上段と同じ読み取り専用の表示にする
- updateSkuQuantity の import を削除する
- 144 行付近の凡例テキストを「上段=受注数（orderedQuantity）／
  下段=量産発注数（productionQuantity）。いずれも受注（SO）由来のため
  この画面では編集できない。」に変更する

★src/lib/actions/skus.ts の updateSkuQuantity 関数そのものは削除しない。
　将来の再開のため export のまま残す（B-178 で最終処分を判断する）。

### 8-3. 受注詳細・一覧

unitPrice / subtotal が null のとき「—」を表示する。
量産数量（productionQuantity）と歩留まりの表示列を受注詳細に追加する。

---

## 9. 禁止事項

- git add に -A / . / --all を使わない。明示パスのみ
- force push しない
- DROP COLUMN / DROP TABLE / DROP TYPE を書かない
- 本番 DB（shuttle:16099）に接続しない。dev（hopper:12921）のみ
- prisma migrate dev を使わない（dev は db push 起源）
- スコープ外（§1）の実装に手を出さない
- 「完了」報告を build 成功だけで出さない

---

## 10. 停止条件

以下に該当したら実装を止めて報告する。

- §0 の確認で記述と実態が食い違った
- recomputeSkuOrderedQuantities の呼び出し元が 4 箇所でなかった
- db push の差分プレビューに so_items 以外のテーブルが現れた
- 型エラー・lint エラーが 3 回の修正で解消しない
- SoItem.subtotal / unitPrice の nullable 化により、想定外の箇所で
  型エラーが 10 箇所を超えて発生した（設計の見直しが必要な兆候）

---

## 11. 検証（dev・localhost:3001 / hopper:12921）

Claude Code は以下をすべて実施し、raw output を報告する。

1. tsc / lint / build がクリーン
2. sales-order-quantity.test.ts が全ケース通過
3. dev DB に db push で反映し、so_items の列を psql 相当で確認
   （unit_price / subtotal が nullable、yield_mode / yield_quantity が存在）
4. 受注を新規作成し、一律 RATE 5% で SKU 別の量産数量が切り上げで入ること
5. 方式を QUANTITY に変えて +10 枚が加算されること
6. 色別・サイズ別の一括適用が該当 SKU だけに効くこと
7. 単価を空欄にして保存でき、小計とヘッダ合計が E-1 / E-2 どおりになること
8. SO を CONFIRMED にすると Sku.productionQuantity に Σ が書き戻ること
9. SO をキャンセルすると Sku.productionQuantity が減ること
10. 品番カルテの数量マトリクス下段が編集できなくなっていること
11. 既存の dev 残置データ（SO-2026-0001 キャンセル / SO-2026-0002 確定受注
    BLACK/S=2）が壊れていないこと

★4 と 5 は画面の目視で確認する。build 成功だけで完了としない。

---

## 12. git ワークフロー

- feature ブランチ: feat/b-148-pr2a-so-yield
- tsc / lint / build がクリーンで、staging が対象ファイルのみなら
  commit → push → PR open まで Claude Code が自走してよい
- ★PR を open したら停止する。ローカル目視確認とマージは慎太郎さんが行う
- ★マージ = Railway の main 自動デプロイ = 本番 migration 適用（不可逆）

## 13. triple-gate

1. dev 確認（§11・Claude Code）
2. 本番 dry-run（BEGIN / ROLLBACK・shuttle:16099・慎太郎さん）
   ★接続は DATABASE_PUBLIC_URL。末尾の DB 名まで tail -c で検証する
3. マージ（慎太郎さん）
4. 本番確認（慎太郎さん）

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-19 | v0.1 | 初版。B-168 v0.1 の D-1〜D-9 と recon を根拠に E-1〜E-6 を追加確定 |
