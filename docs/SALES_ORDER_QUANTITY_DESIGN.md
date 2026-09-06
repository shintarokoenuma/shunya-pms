# 受注 → 量産数量の設計（実装準拠）

- 対象: B-148 PR-2a / B-167 / B-168（PR #136・main `c622467`）
- 起こした日: 2026-08-28（main の実コードから file:line を採取。推測で埋めていない）
- ★v1.2（2026-09-06）で B-193（PR #140・squash `20ede40`）を反映し、file:line を main HEAD `3a885fa` 時点の実測値へ一括補正した
- 根拠 spec: docs/specs/b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md（D-1〜D-9）
  ／ docs/specs/b-168-production-quantity-spec-addendum-v0_1-2026-08-22.md（D-4 改訂）
- ★指示では `src/lib/production-order-generation.ts` / `src/lib/material-requirement.ts` と
  記載されていたが、実パスは `src/lib/actions/production-order-generation.ts` /
  `src/lib/calc/material-requirement.ts`。以下は実パスで記す。

---

## 1. 決定アルゴリズム

### 1-1. 1 SKU 分の量産数量 — `computeProductionQuantity`

純関数。`src/lib/calc/sales-order-quantity.ts:25-42`。@prisma/client 非依存（client/server 共用）。

- 前処理: `ordered = Math.trunc(orderedQuantity)`。`!Number.isFinite(ordered) || ordered <= 0` なら `0` を返す（`:31-32`）。
- **QUANTITY**: `ordered + Math.trunc(yieldQuantity ?? 0)`、下限 0（`:34-37`）。
- **RATE**: `Math.ceil(ordered * (1 + (yieldRate ?? 0) / 100))`、下限 0（`:39-41`）。
  - ★切り上げの単位は **SKU 単位**（各 SKU 行で ceil。合計してから丸めない）。根拠コメント `:19`。
- **null の扱い**: `yieldRate` / `yieldQuantity` が `null` のときはその項を `0` とみなす（`?? 0`）。
  結果として量産数量 = 受注数（`:35` / `:40`）。

呼び出し（受注確定時の算出）: `src/lib/actions/sales-orders.ts:234-239`
（`buildAndValidateItems` 内で `s.orderedQuantity, s.yieldMode, s.yieldRate, s.yieldQuantity` を渡す）。

### 1-2. Σ SoItem → Sku への集計 — `recomputeSkuOrderedQuantities`

`src/lib/actions/sales-orders.ts:134-163`。skuId ごとに SoItem を集計し Sku の2列に書き戻す。

- 集計: `_sum: { orderedQuantity, productionQuantity }`（`:142-143`）。
- 集計条件（`:144-152`）: `skuId` 一致 かつ 親 `so` が
  - `companyId` 一致
  - `deletedAt: null`
  - `isLatest: true`
  - `status ∈ COUNTED_STATUSES`
- **COUNTED_STATUSES**（`src/lib/actions/sales-orders.ts:62-67`）:
  `CONFIRMED / IN_PRODUCTION / PARTIAL_DELIVERED / DELIVERED / COMPLETED`。
  → `TENTATIVE / CANCELLED / ON_HOLD` は**集計対象外**（受注実績としてカウントしない・D-4）。
- 該当 SoItem が 0 件なら `_sum` は `null` → **0 を書く**（更新対象から外さない・`:154-160`）。
- 書き戻しは `set`（加算ではなく上書き・`:157-160`）。

---

## 2. データスキーマ

### 2-1. `SoItem`（`prisma/schema.prisma:4550`）— 明細の真実

| 列 | 定義(line) | null の意味 |
|---|---|---|
| `orderedQuantity` | `Int`（NOT NULL）`:4559` | — 受注数（確定した注文数量。固定・減産では触らない） |
| `unitPrice` | `Decimal?(15,2)` `:4560` | **null = 単価未定**（B-167。「0」＝単価0円 とは区別する） |
| `subtotal` | `Decimal?(15,2)` `:4561` | **null = 単価未定に伴い小計も未定**（`unitPrice=null` のとき null・下記書込規則） |
| `productionQuantity` | `Int?` `:4572` | **null = 未算出**（PR-1 由来の旧行。PR-2a 以降は受注確定時に必ず数値が入る） |
| `yieldRate` | `Decimal?(5,2)` `:4573` | RATE 指定時の率。**null = RATE 以外 or 未設定** |
| `yieldMode` | `YieldMode?` `:4574` | RATE / QUANTITY。**null = 未設定（旧行）** → フォーム復元で既定にフォールバック（§4） |
| `yieldQuantity` | `Int?` `:4575` | QUANTITY 指定時の加算枚数。**null = QUANTITY 以外 or 未設定** |
| `deliveredQuantity` / `remainingQuantity` | `Int @default(0)` `:4578-4579` | 完納系（本設計の対象外） |

`enum YieldMode { RATE, QUANTITY }`（`prisma/schema.prisma:4545`）。

書き込み規則（`src/lib/actions/sales-orders.ts:229-255`）:
- `unitPrice = null` なら `subtotal = null`、そうでなければ `unitPrice.mul(orderedQuantity)`（`:231-232`）。
- `yieldRate`: `mode===RATE && s.yieldRate!==null` のときのみ Decimal、他は `null`（`:249-252`）。
- `yieldQuantity`: `mode===QUANTITY` のときのみ値、他は `null`（`:253-254`）。
- `productionQuantity`: §1-1 の戻り値（`:234-239, 255`）。

### 2-2. `Sku`（`prisma/schema.prisma:2120`）— キャッシュ

| 列 | 定義(line) | 意味 |
|---|---|---|
| `orderedQuantity` | `Int @default(0)` `:2144` | 受注合計（Σ SoItem.orderedQuantity・COUNTED のみ） |
| `productionQuantity` | `Int @default(0)` `:2145` | 量産発注数（Σ SoItem.productionQuantity・COUNTED のみ） |

★SoItem 側は nullable だが **Sku 側は NOT NULL / default 0**（集計で常に数値が入るため）。

---

## 3. 状態ストア

`Sku.orderedQuantity` / `Sku.productionQuantity` は **SO 由来（SoItem）を正とするキャッシュ列**（B-168 D-1）。
唯一の書き戻し関数は `recomputeSkuOrderedQuantities`（`src/lib/actions/sales-orders.ts:134`・§1-2）。

### 書き戻すのは誰か・いつか

4 つのアクションが、いずれも **`$transaction` の内側**で、その tx の delegate（`tx.soItem` / `tx.sku`）を渡して呼ぶ:

| アクション | 定義(line) | recompute 呼出(line) | 何の後に呼ぶか |
|---|---|---|---|
| `createSalesOrder` | `:464` | `:550` | `tx.soItem.createMany`（`:534`）の後 |
| `updateSalesOrder` | `:613` | `:709` | `upsert`（`:675`）＋ `deleteMany`（`:706`）の後 |
| `updateSalesOrderStatus` | `:747` | `:774` | `salesOrder.update`(status) の後 |
| `cancelSalesOrder` | `:809` | `:830` | `status=CANCELLED` の後 |

- **トランザクション内/外**: 書き戻しは SoItem の書き込み・status 変更と**同一 tx 内**（`timeout: 15000`・`:558/716/781/837`）。
  → SoItem とキャッシュ Sku は原子的に整合する。
- **成功の前/後**: `auditLog.create` は tx の**外**・後（`:583/719/784/840`）。`revalidateForSkus` も tx 外・後（`:600/734/796/852`）。

### SO のステータス変更・削除で何が起きるか

- **status 変更**（`updateSalesOrderStatus`）: status を書き換え、同 tx で recompute。
  COUNTED_STATUSES を跨ぐ（例 TENTATIVE→CONFIRMED、CONFIRMED→ON_HOLD）と、その SO の数量が Sku キャッシュに**加減算**される。
- **キャンセル**（`cancelSalesOrder`）: `status=CANCELLED`（物理削除も soft delete もしない）。
  CANCELLED は COUNTED 外のため、同 tx の recompute で当該分が Sku から**差し引かれる**。
- **物理削除 / soft delete**: SO を削除するアクションは**現状存在しない**（キャンセルは status のみ）。
  集計条件に `so.deletedAt: null` はあるが、`deletedAt` を立てる経路は未実装。

### ★status を書ける経路は2つだけ（B-193・2026-09-06 追記）

SalesOrder.status に書き込む action は次の2つに限られる。

- updateSalesOrderStatus … ステータス変更の正規経路。UI は sales-order-status-control.tsx
- cancelSalesOrder … CANCELLED を書く

★updateSalesOrder（受注の編集保存）は status を書かない。PR #140（squash 20ede40）で
update の data から除去した。理由コメントは src/lib/actions/sales-orders.ts:663 にある。

除去前に何が起きていたか（B-193 の経路）:

    編集フォーム sales-order-form.tsx の payload は9項目で status を含まない
      → salesOrderInputSchema（src/lib/validators/sales-order.ts:151）が status に
        .default(TENTATIVE) を敷いており、zod が undefined を「値」に変換する
      → Prisma の「update data の undefined はスキップ」が効かなくなり、
        updateSalesOrder が CONFIRMED を TENTATIVE で上書きする
      → COUNTED_STATUSES から外れる
      → 同一 tx 内の recomputeSkuOrderedQuantities が Sku.productionQuantity を 0 にする
      → 品番カルテ一覧の量産数が「—」になる

★一般化: zod の .default() は「送られてこない値を作り出す」機構であり、Prisma の
undefined スキップを無効化する。フォームが送らない列に .default() が付いていると、
編集保存のたびに既存値が既定値で上書きされる。UI に入力欄が無いことは、この上書きが
起きない理由にはならない（むしろ default が効く条件そのものである）。

★同じ構造は buyerId / buyerSpecialRequests / originalFiles にも残っている。ただしこの3列は
spec 上フォームが持つべき任意項目で、UI が未実装なだけである。将来フォームが送るようになるため
update からは外していない（外すと逆に保存できなくなる）。追跡は B-194。
現状は値を入れる経路自体が無いため実害はゼロ。

監査ログ: updateSalesOrder の afterData.status には、編集後の実際の値を載せる。
既存レコード取得の select に status を含め、その値を使う（src/lib/actions/sales-orders.ts:727）。

---

## 4. 命名規則・既定値

定数（`src/app/(app)/sales-orders/_components/sales-order-form.tsx`）:
- `DEFAULT_YIELD_MODE = YieldMode.QUANTITY`（`:85`）
- `DEFAULT_YIELD_VALUE = "0"`（`:86`）
- （B-168 addendum v0.1 §1 で「率5%」→「加算枚数0」に改訂）

### 「新規入力の既定」に効く箇所

- `newBlock()`（`:99-100`）: 一括適用 UI の初期値 `yBulkMode=DEFAULT_YIELD_MODE` / `yBulkUniform=DEFAULT_YIELD_VALUE`。
- `loadSkus`（`:236-237`）: **各 SKU の実効既定** `ymode[id]=DEFAULT_YIELD_MODE` / `yval[id]=DEFAULT_YIELD_VALUE`
  （未設定の SKU にだけ敷く。編集復元済みの値は保持）。
  → 無操作時に各 SKU が `QUANTITY / 0` になる中核。

### 「既存行（yieldMode が null）の復元フォールバック」に効く箇所

編集画面で既存 SO を開いたとき、`yieldMode` が `null` の行に既定を当てる:
- edit 復元・mode map（`:172`）: `s.yieldMode ?? DEFAULT_YIELD_MODE`
- edit 復元・値の三項式（`:177`）: `(s.yieldMode ?? DEFAULT_YIELD_MODE) === YieldMode.QUANTITY` で分岐
- プレビュー（`:277`）/ 送信（`:341`）/ 行の方式 Select value（`:750`）: `b.ymode[id] ?? DEFAULT_YIELD_MODE`

★新規と復元の**両方**を QUANTITY/0 に倒しているため、旧データ（yieldMode=null）を開いても 5% は復活しない。

### validator 側

`src/lib/validators/sales-order.ts:104`: `yieldMode: z.nativeEnum(YieldMode).default(YieldMode.QUANTITY)`。
フォームは各 SKU に mode/値を必ず載せて送るため実質は使われないが、方針一致のため QUANTITY に揃えてある。
`superRefine`（`:108-124`）で「RATE のとき yieldRate 必須 / QUANTITY のとき yieldQuantity 必須」を検証。

---

## 5. 失敗時の挙動・冪等性

- **途中で落ちたら**: 書き戻しは SoItem 書き込みと**同一 `$transaction` 内**（`:558/716/781/837`）。
  tx 途中で例外が出れば SoItem 書き込みも Sku 書き戻しも**両方ロールバック**。
  → Sku は古い値のまま整合（部分適用は起きない）。
- **create の採番衝突**: P2002 のみリトライ（`:565`・`CREATE_MAX_RETRIES`）。
- **冪等性**: `recomputeSkuOrderedQuantities` は Sku 値を「その時点の集計値」で **set** する（加算しない・`:157-160`）。
  同じ再計算を二重に走らせても同じ集計を書くだけで**ずれない**。
- **★並行実行の窓（未保護）**: 別々の tx が同一 `skuId` に対し同時に「集計→書き込み」する場合、
  各 tx の集計スナップショットのタイミング次第で最後の write が勝つ。
  `Sku.update` の行ロックは `where id` に対してのみで、**同一 SKU への並行 SO 操作を直列化するロックは未実装**。
  実務上、同一 SKU に対する SO 操作の同時多発は稀という前提。保護が要るなら別途。
- **★tx 外の副作用**: `auditLog.create` と `revalidateForSkus` は tx コミット後（`:583+` 等）。
  コミット成功後に auditLog が失敗すると、DB は反映済みのまま監査ログだけ欠ける可能性がある（catch で error を返すが数量はコミット済み）。

---

## 6. 下流への伝播

`Sku.productionQuantity` を読む箇所（歩留まり込みの数量がここまで届く）:

| 用途 | 箇所 | 使い方 |
|---|---|---|
| 資材所要量 | `src/lib/calc/material-requirement.ts:79, 90` | `Σ(該当色 or 全 SKU の productionQuantity) × totalUsage` |
| 1枚原価の分母 | `src/lib/calc/production-cost.ts:150-151, 394` | `sumProductionQuantity(skus)` = `Σ productionQuantity` |
| 量産見積の見積数量 | `src/lib/actions/production-estimates.ts:463-469` | 見積数量 = `Σ Sku.productionQuantity` |
| 発注生成フォームの既定 | `src/lib/actions/production-estimates.ts:1304` | 既定数量 = `Sku.productionQuantity` |
| 発注生成の数量分配 | `src/lib/actions/production-order-generation.ts:176→179-184→225-232` | `data.skuQuantities`（既定=Sku.productionQuantity）→ `qtyByColorway`（色別合算）→ 色別 PoItem |

★§6 の file:line は v1.0（2026-08-28）時点の値で、v1.2 では実測していない（実測していない行は動かさない方針）。
参照する前に grep で確認すること。

- 発注生成は Sku.productionQuantity を**既定値**として拾い、生成画面で人が編集できる（D-8。生成時に入力値を焼き込む）。
- 品番カルテの数量マトリクス下段は **読み取り専用**（SO 由来・D-2）。
  `src/app/(app)/products/_components/quantity-matrix-section.tsx:120`（表示）・凡例 `:140`。
  旧インライン編集アクション `updateSkuQuantity`（`src/lib/actions/skus.ts:219`）は**定義は残るが src からの呼び出しは 0 件**（休眠。最終処分は B-178）。

### ★サイズ軸は合算で消える（B-181）

- 資材所要量は「色別 or 全体」の2分岐まで（`material-requirement.ts:79`=色別 / `:90`=全体）。サイズ次元なし。
- 発注生成は色別まで（`production-order-generation.ts:183` の `cw.sizes` を**合算**して `qtyByColorway` を作る）。
- ＝ サイズ別の資材数量（例: サイズラベル S×10 / M×20、カラーで混率が変わる品質表示）は現行では表現できない。
  BOM/所要量/生成のどこにもサイズ方向の器がない（B-181 として起票済み・先送り確定）。

---

## 7. 環境変数 / dry-run

- **環境変数**: 該当なし。歩留まり算出・書き戻し・下流伝播は env var に依存しない。
- **migration**: `prisma/migrations/20260819000000_b167_b168_so_item_yield/migration.sql` は DDL のみ
  （`CREATE TYPE "YieldMode"` / `so_items` の `unit_price`・`subtotal` を `DROP NOT NULL` / `yield_mode`・`yield_quantity` を `ADD COLUMN`）。非破壊（DROP COLUMN/TABLE/TYPE なし）。
- **dry-run**: 本番反映は triple-gate（dev は `prisma db push` → 本番 `BEGIN`/`ROLLBACK` の dry-run → merge deploy → 本番確認）。
  これは運用手順であり、コード内に dry-run 用の env/フラグは無い。

---

## 8. 受注 → 量産発注の接続（PR-2b）

PR-2b（PR #137・`fb129d5`）で、量産発注の生成が成功したとき、その品番に紐づく受注（SO）へ
「量産へ反映済み」の印を付ける経路が加わった。仕様は spec v0.2（案A・migration なし）。

### 8-1. 書き込む列と型

`SalesOrder.isConvertedToProduction`（Boolean・schema 既存の休眠列）と `SalesOrder.convertedAt`
（DateTime?）に書く。DTO 側は `SalesOrderDTO.isConvertedToProduction: boolean`
（`sales-orders.ts:306`）／`convertedAt: string | null`（同 `:307`・YYYY-MM-DD）で、
`getSalesOrder` が `:431` で載せる。★schema 変更なし・DDL ゼロ。

### 8-2. 対象 SO の決定アルゴリズム

`markSalesOrdersConvertedForProduct(productId)`（`sales-orders.ts:971`）:

1. `Sku.findMany({ where: { productId } })` で品番配下の skuId を得る（Sku は TENANT・`:979`）
2. `salesOrder.findMany` の where（`:987-995`）:
   - `companyId`（SalesOrder は TENANT 非対象のため明示）
   - `deletedAt: null` / `isLatest: true`
   - `status: { in: COUNTED_STATUSES }`（`:992`・§3 の condition を再定義せず `:62` の定数を再利用）
   - `isConvertedToProduction: false`（未反映のみ）
   - `items: { some: { skuId: { in: skuIds } } }`（`:994`・SoItem に sku リレーションが無いため skuId で辿る）
3. `salesOrder.updateMany`（`:1000-1007`）で `isConvertedToProduction: true, convertedAt: new Date()` を書く

★対象集合は `recomputeSkuOrderedQuantities`（§3・`:134`）の where と同一＝
`Sku.productionQuantity` の Σ に寄与した SO 集合と一致する。

### 8-3. 更新タイミング（成功「後」・tx 外・独立ステップ）

生成 action `production-order-generation.ts` が **PO/WO の生成が成功した後**に呼ぶ。
呼び出しは3箇所（`:346` PO 失敗時 / `:377` WO 失敗時 / `:428` 成功時）で、いずれも
`createdPos.length + createdWos.length > 0` のときだけ実行する。
★生成 tx とは**別**（独立ステップ）。生成が非アトミックである以上フラグだけ厳密にしても
意味がないため、tx に入れない（spec v0.2 §4）。

### 8-4. 冪等性・失敗時の挙動

- `updateMany` は `isConvertedToProduction: false` の行だけを true にする＝**冪等**。
  再生成で二度呼ばれても `convertedAt` は最初の一度だけ入り、値はぶれない。
- ヘルパー全体が try/catch で、失敗は**握りつぶす**（`:1008-1010`）。フラグ書き込みが失敗しても
  生成済みの DRAFT PO/WO は残す（B-101 のタスク生成と同方針）。
- **部分生成**（PO だけ・WO だけ成功）でもフラグは立つ（`:346`/`:377` の失敗 return でも
  created が1本でもあれば呼ぶため）。

### 8-5. ★降ろす経路は無い

`isConvertedToProduction` を false に戻す経路は実装していない。**SO をキャンセルしても
フラグは降りない**（CANCELLED は COUNTED から外れて Sku 集計からは差し引かれるが、
既に生成された DRAFT は残り、「量産に使われた」事実は消えないため）。

### 8-6. ★既知の粗さ（仕様・バグではない）

**複数品番を含む SO で1品番だけ生成しても、SO 全体にフラグが立つ。** SoItem 側に変換状態を
持つ列が無く migration なしのため、これ以上細かくできない。ゆえに表示は「量産へ反映済み」
（＝1回でも量産生成に使われた）であり「全品番の発注が済んだ」ではない（spec v0.2 §3）。
厳密な受注↔発注の対応追跡は **B-185** に分離。

### 8-7. 表示（下流 UI）

- 再生成時の警告: `listConvertedSalesOrdersForProduct`（`sales-orders.ts:1014`）を
  generate ページが fetch し、生成フォームが「量産へ反映済みの受注があります」を表示
  （`production-order-generate-form.tsx:178`・**生成はブロックしない**・B-142 は警告のみ）。
- 受注詳細: ヘッダに「量産へ反映」（`sales-orders/[id]/page.tsx:132`）＋品番見出しを
  品番カルテへのリンク化（同 `:150`・B-182 の受注分を消化）。

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-28 | v1.0 | PR #136（`c622467`）の実装から起こした初版。file:line は main 実コードから採取 |
| 2026-09-05 | v1.1 | PR-2b（PR #137・`fb129d5`）の受注→量産発注の接続を §8 として追記 |
| 2026-09-06 | v1.2 | B-193（PR #140・squash 20ede40）を反映。§3 に「status を書ける経路は2つだけ」を追加し、v1.1 以降にずれていた sales-orders.ts 系の file:line を実測値へ一括補正 |
