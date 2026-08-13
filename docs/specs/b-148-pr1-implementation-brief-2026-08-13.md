# B-148 PR-1 実装ブリーフ (2026-08-13)

- 種別: 実装ブリーフ（実装は Claude Code・マージ判断は慎太郎さん）
- 対象: 受注（SO）本実装 PR-1「受注の成立」
- 設計根拠: docs/specs/sales-order-spec-confirmation-v1_0-2026-08-13.md（R-5〜R-11）
  ／ docs/specs/sales-order-quotation-flow-spec-confirmation-v0_1-2026-08-13.md（R-1〜R-4）
- 追加確定: 本書 §1 の D-2〜D-8（2026-08-13・慎太郎さん承認）
- ライフサイクル: 7「受注確定・SO発番」／原マイルストーン M4
  ★M4 の完了基準は「受注登録・量産発注連動が動く」。完了は PR-2 まで。PR-1 単独では M4 は完了しない

---

## 0. 前提（読み飛ばさないこと）

shunya-pms は OEM 生産管理会社のシステムであり、展示会で受注を積み上げる概念は無い
（spec v1.0 §0）。受注はクライアントから確定数量として渡ってくる。
仮受注を積み上げて締め切る動線は作らない。

---

## 1. 本ブリーフで追加確定した事項（D-2〜D-8）

| # | 論点 | 確定内容 |
|---|---|---|
| D-2 | SoItem.unitPrice（必須列）の入力方法 | 品番単位で1つ手入力し、その品番の全 SKU に同額を配る。SKU ごとの個別単価は初版で持たない |
| D-3 | SalesOrder.productId | nullable 化したうえで常に null を書く。品番は SoItem → Sku.productId で辿る一本化。列と既存 index は非破壊で残す |
| D-4 | Sku.orderedQuantity の集計対象 | status が CONFIRMED / IN_PRODUCTION / PARTIAL_DELIVERED / DELIVERED / COMPLETED のもの。TENTATIVE・CANCELLED・ON_HOLD は除外。加えて deletedAt IS NULL かつ isLatest = true |
| D-5 | SoItem.productionQuantity / yieldRate | PR-1 では書かない（null のまま）。PR-2 で埋める |
| D-6 | SalesOrder ヘッダの金額列 | totalQuantity / subtotal / totalAmount を SoItem から集計して埋める。unitPrice と appliedMoqTierId は使わない（複数品番 SO では意味を持たない） |
| D-7 | version / isLatest / baseVersionId | version=1・isLatest=true・baseVersionId=null で固定。版を切る動線は作らない |
| D-8 | createSkusForProduct の受注数上書き | upsert の update から orderedQuantity を外す。SKU 再生成で受注集計が 0 に潰れる穴の是正 |

### 1-1. 税の扱い（★勝手に実装しないこと）

qe1r-tax-addendum v0.1 §3 の既存方針「税率は表示層の定数 TAX_RATE = 0.10・
スキーマに保存しない」に従う。したがって本 PR では:

- SalesOrder.taxAmount には書き込まない（null のまま）
- SalesOrder.subtotal / totalAmount にはいずれも税抜合計を入れる
- 受注側の税表示（税抜/消費税/税込の3段）は B-165 として別途

---

## 2. migration（1本・非破壊）

対象: sales_orders.product_id を必須 → nullable

- schema.prisma: productId String @map("product_id") を productId String? @map("product_id") に変更
- @@index([companyId, productId]) / @@index([isLatest, productId]) は触らない（nullable でも有効）
- 既存データへの DML は一切書かない
- 前例（雛形）: prisma/migrations/20260806000000_delivery_note_nullable_product_sku/migration.sql（B-108）

migration ファイル: prisma/migrations/20260813000000_b148_sales_order_product_nullable/migration.sql

  -- B-148 PR-1: SO は複数品番を含むため代表 productId を必須にしない（受注 spec v1.0 R-5）
  -- 非破壊: DROP NOT NULL のみ。列・既存データには触れない（DML なし）。
  ALTER TABLE "sales_orders" ALTER COLUMN "product_id" DROP NOT NULL;

適用手順（この順を変えない）:

1. dev: schema.prisma 変更 → npx prisma db push → npx prisma generate
   ★generate 後は dev の Next.js サーバーを必ず再起動する（stale .next チャンク対策）
2. 本番 dry-run: BEGIN → 上記 SQL → ROLLBACK で適用可能性を実証（マージ前・慎太郎さんが実施）
3. マージ（= Railway auto-deploy = 本番反映・不可逆）

---

## 3. SO 発番

house style は全モデル共通で ${prefix}${String(nextNum).padStart(4, "0")}。
src/lib/actions/production-estimates.ts の estimateNumberPrefix / computeNextEstimateNumber
（83-110行）をそのまま複製する。

- prefix: SO-{year}-
- 一意制約: @@unique([companyId, soNumber])
- P2002（unique 衝突）時のリトライも PE の実装に合わせる。PE と異なる方式を発明しない

---

## 4. src/lib/actions/sales-orders.ts（新設）

雛形は src/lib/actions/production-estimates.ts（ヘッダ＋明細＋採番＋監査＋DTO を持つ最も近い先行例）。

### 4-1. 関数

- listSalesOrders（一覧・companyId スコープ・deletedAt IS NULL）
- getSalesOrder（詳細・items 同梱）
- createSalesOrder
- updateSalesOrder
- cancelSalesOrder（status = CANCELLED にする。物理削除も soft delete もしない）

### 4-2. 入力型

SalesOrderInput
  clientId          必須
  buyerId           任意
  sourceType        必須（OrderSourceType 11値。フォーム既定は EMAIL）
  buyerOrderNumber  任意（先方の発注番号。発注書1通を後から辿るため）
  orderDate         必須
  desiredDeliveryDate 任意
  currency          必須（既定 JPY）
  title / internalNotes / buyerSpecialRequests 任意
  status            必須（既定 TENTATIVE）
  originalFiles     任意（§6 参照）
  products[]        1件以上
    productId       ★フォーム上のグルーピングにのみ使う。DB には保存しない（D-3）
    unitPrice       必須（この品番の全 SKU に配る・税抜）
    skus[]          1件以上
      skuId             必須
      orderedQuantity   必須（1以上）
      moqStatus         必須（既定 NOT_DETERMINED）
      moqDecisionReason 任意

★バリデーション: products[].skus[].skuId が、その productId 配下の Sku であることを
サーバ側で検証する（Sku.productId と突き合わせる）。クライアント任せにしない。

### 4-3. 書き込み規則

SalesOrder:
- productId = null 固定（D-3）
- version = 1 / isLatest = true / baseVersionId = null（D-7）
- unitPrice / appliedMoqTierId には書かない（D-6）
- quotationId / quotationVersion には書かない（B-143 の領分）
- totalQuantity = Σ SoItem.orderedQuantity
- subtotal = Σ SoItem.subtotal（税抜）
- totalAmount = subtotal（§1-1）
- taxAmount には書かない
- isConvertedToProduction / convertedAt は触らない（PR-2 の領分）

SoItem:
- unitPrice = 所属する品番の入力単価（D-2）
- subtotal = unitPrice × orderedQuantity
- currency = ヘッダの currency をコピー
- productionQuantity / yieldRate には書かない（D-5）
- deliveredQuantity / remainingQuantity は既定値 0 のまま触らない（納品は PR-1 の対象外）

監査ログ: PE と同作法（action / entityType="SalesOrder" / entityId / afterData）。

---

## 5. Sku.orderedQuantity の再集計（★PR-1 の中核）

現状 orderedQuantity を受注から集計する処理は存在しない（recon で確認済み・14ヒットは
すべて読み取りか 0 固定）。本 PR で新設する。

関数: recomputeSkuOrderedQuantities(tx, companyId, skuIds)

定義（D-4）: 各 skuId について
  Sku.orderedQuantity = Σ SoItem.orderedQuantity
    WHERE SoItem.skuId = 対象
      AND SalesOrder.companyId = companyId
      AND SalesOrder.deletedAt IS NULL
      AND SalesOrder.isLatest = true
      AND SalesOrder.status IN (CONFIRMED, IN_PRODUCTION, PARTIAL_DELIVERED, DELIVERED, COMPLETED)

★該当する SoItem が1件も無い場合は 0 を書く（放置しない）。

呼び出しタイミング（いずれも同一 tx 内）:
- createSalesOrder の直後
- updateSalesOrder の直後 ★対象 skuIds は「変更前の skuId 群 ∪ 変更後の skuId 群」の和集合。
  SKU を明細から外した場合も再集計しないと古い値が残る
- cancelSalesOrder の直後
- ★status を TENTATIVE → CONFIRMED に変える操作の直後（D-4 により値がここで初めて入る。
  status 変更を updateSalesOrder と別関数にする場合は、そちらにも必ず入れる）

---

## 6. 原本ファイル（originalFiles）

spec v1.0 R-10 により初版から保持する。メール添付・PDF・Excel を SalesOrder.originalFiles
（Json・[{fileName, fileUrl, fileType}]）に持つ。

★実装前に、既存の GCS アップロード実装（品番スケッチ B-027 / マーキング原本）の
ヘルパー名・保存パス規約・削除時の扱いを確認し、同一の作法に揃えること。
本ブリーフの想定と異なる場合は、書き始める前に報告して止まる。新しい方式を発明しない。

---

## 7. UI

### 7-1. 新ルート src/app/(app)/sales-orders/

- page.tsx（一覧: SO番号 / クライアント / 先方発注番号 / 品番数 / 総数量 / ステータス / 受注日）
- new/page.tsx（作成フォーム）
- [id]/page.tsx（詳細: ヘッダ ＋ 品番ごとにグルーピングした SKU 別数量）
- [id]/edit/page.tsx（編集）
- _components/: sales-orders-table.tsx / sales-order-form.tsx / sales-order-status-badge.tsx / labels.ts

作成フォームの構造（R-11「入力は受注一覧に一本化」）:
  クライアント選択 → 品番を1つ以上追加 → 品番ごとに単価を1つ入力
  → その品番の SKU（カラーウェイ × サイズ）ごとに受注数を入力
  → MOQ 判定は人が選ぶだけ（自動判定なし・R-8）

ステータスバッジの色は master-patterns §4「ステータスバッジの統一色」に従う。

### 7-2. 品番カルテへの受注セクション

src/app/(app)/products/_components/sales-order-section.tsx を新設し、[id]/page.tsx に差し込む。
雛形は同ディレクトリの production-estimate-section.tsx（品番配下の一覧＋アクション）。

表示内容（R-11・集約表示。入力はしない）:
- この品番に紐づく SoItem の SKU 別受注数の合計
- MOQ 判定状況
- 元 SO へのリンク（複数 SO に跨る）

★quantity-matrix-section.tsx は既に orderedQuantity を読み取り専用で表示している。
　変更しない。再集計が入れば自動的に値が映る。

### 7-3. サイドバー

nav に「受注」を追加し enabled: true にする。配置は「見積もり」と「発注」の間。

---

## 8. D-8 の是正（src/lib/actions/skus.ts）

createSkusForProduct の tx.sku.upsert について:

- update から orderedQuantity: ordered を削除する（既存 SKU の受注集計を再生成で潰さないため）
- create 側は orderedQuantity: 0 とする
- 引数 quantities は呼び出し元を全数確認し、渡している箇所が無ければ引数ごと削除する
  ★渡している箇所が1つでもあれば、削除せず報告して止まる
- 217行のコメント「受注数は受注側の値なのでここでは触らない」を、生成系にも当てはまる文言に直す

---

## 9. スコープ外（★B番号を振ること）

| 要件 | B番号 |
|---|---|
| 量産発注生成の skuQuantities 手入力を SoItem 由来に置換 | PR-2（B-148 の後半） |
| Σ入力数量0でも発注生成できる | B-156（PR-2 で同時判断） |
| 確定見積 QE-2 との連携（quotationId / quotationVersion） | B-143 |
| メール・Excel・PDF からの自動読み取り／専用ページ | B-149 |
| 受注変更履歴（SalesOrderChangeHistory）・SO の版切り | B-162 |
| SKU 別 MOQ の自動判定 | B-163 |
| SalesOrderStatus の TENTATIVE コメント修正 | B-164 |
| 減産率の記録 | B-150 |
| 受注の税表示（税抜/消費税/税込の3段） | B-165（本ブリーフで新規起票） |

---

## 10. 動作確認（dev・localhost:3001）

1. 複数品番（2品番以上）を含む SO を新規作成でき、SO-2026-0001 形式で発番される
2. 作成直後は status=TENTATIVE のため、カルテの受注数が 0 のままである（D-4 の意図どおり）
3. status を CONFIRMED に変えると、カルテの受注数と quantity-matrix の上段に値が入る
4. 同じ SKU を含む SO を2件 CONFIRMED にすると、カルテの受注数が合算される
5. 片方を CANCELLED にすると、合算から差し引かれる
6. 明細から SKU を1つ外して更新すると、外した SKU の受注数が 0 に戻る
7. SKU を再生成しても、CONFIRMED 済みの受注数が 0 に潰れない（D-8 の是正確認）
8. 1品番だけの SO も同じ画面で作れる（複数品番 SO の特殊ケースであり別の型ではない）

---

## 11. 実装上の禁止事項

- SalesOrderChangeHistory テーブルには一切書き込まない（R-9）
- SalesOrderStatus に値を足さない（R-6・失注は SO に持たせない）
- MOQ の自動判定ロジックを書かない（R-8・人が選ぶのみ）
- SalesOrder.productId に値を書かない（D-3）
- 単価の自動計算・MOQ 階段を実装しない（R-1・単価は手打ち）
- git add は明示的なファイルパスのみ（-A / . / --all は使わない）
- コードを含む変更のため feature ブランチ + PR 必須。main 直 push は禁止

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-13 | v1.0 | 初版。spec v1.0（R-5〜R-11）に D-2〜D-8 を追加確定して実装手順に落とした |
