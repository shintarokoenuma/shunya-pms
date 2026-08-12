# (B) 量産発注生成 仕様確認書 addendum v0.1 (2026-08-12)

- 種別: addendum（確定・実装ブリーフ着手可）
- 対象: B-140 行ごと相手先の永続化
- 上位: production-order-generation-spec-confirmation-v0_1-2026-07-26.md
- ★本書は上位 §2（R-a 確定）を **改訂** する。R-a を読む者は必ず本書も読むこと。
- 現物確認: 2026-08-12 recon（read-only・main HEAD ca1cace・dev DB 非書き込み）

---

## 0. R-a の改訂点

R-a 原文:
> PE Item に相手先列は追加しない。生成時に導出する。

改訂後:
> **PE Item に相手先3列を追加する。生成画面で人が選んだ値をそこへ保存し、
> 次回以降の既定値にする。** 導出順は保存値を先頭に1段足すのみで、
> R-a の導出順2〜4（元伝票 → primarySupplier → 人指定）は不変。

改訂の理由は相見積もりでも「見積段階で相手先を決めたい」でもない。
**人が生成画面で既に全行の相手先を選んでいるのに、その選択を捨てている**
という一点である（§1）。

---

## 1. 背景（recon で判明した事実）

- (B) は実装済み。`generateProductionOrders`（381行）が
  `data.targets: [{peItemId, targetType, targetId}]` を受け取り、
  仕入先別 PO・相手先別 WO を生成している
- 生成は **全行の相手先が指定済みでないと実行できない**
  （`missing.length > 0` → エラー）
- しかしその選択は生成フォームの `useState` にしか存在せず、
  送信後に破棄される。PE には残らない
- ★(B) は文書間が非アトミック（途中失敗時は生成済み DRAFT を報告して停止）。
  再実行は想定内の経路であり、そのたびに全行を選び直している

---

## 2. 確定事項

### 2-1. 列（migration・ADD COLUMN のみ）

`ProductionEstimateItem` に3列を追加する。

    supplierId   String? @map("supplier_id")
    factoryId    String? @map("factory_id")
    contractorId String? @map("contractor_id")

- すべて nullable。`@relation` アノテーションなし（scalar FK・house style）
- index は `@@index([supplierId])` / `@@index([factoryId])` /
  `@@index([contractorId])`
  ★`ProductionEstimateItem` に `companyId` 列は無いため、
  `WorkOrder` の `@@index([companyId, factoryId])` 形は取れない
- MATERIAL 行は `supplierId`、LABOR 行は `factoryId` または `contractorId` を使う。
  **DB 制約は掛けない**（`WorkOrder` が両方 nullable で制約なしの house style に合わせる）
- B-083 の `procurementRoute` とは直交軸。混同しないこと
  （調達区分＝自社手配/客先支給/在庫引当、本件＝誰に発注するか）

### 2-2. 保存タイミング

`generateProductionOrders` の**冒頭**、PO/WO 生成の**前**に独立ステップとして
`data.targets` を PE 明細へ書き込む。

★生成成功後に書き戻す設計は採らない。(B) は非アトミックで途中失敗が起こりうるため、
成功後に書くと失敗時に人の選択が消え、再実行で選び直しになる。

`updateProductionEstimate` は経由しない（相手先だけを更新する直接書き込み）。

### 2-3. 導出順（`GenLineTarget`）

1. **PE 行の保存値**（本書で追加）
2. `sourcePoItemId` → 元 PO の仕入先 ／ `sourceWoItemId` → 元 WO の相手先
3. `Material.primarySupplierId`（MATERIAL のみ）
4. null（人が選ぶまで生成不可・現行 `missingCount` の挙動を維持）

`supplierSource` / `targetSource` の型に保存値を表す値を追加する
（命名は実装ブリーフ段）。

### 2-4. AuditLog

**出さない**（確定）。

- 相手先は客に出た数字ではなく社内の調達メモである。
  客向け PDF に載るのは1枚単価・数量・初期費用提示額のみで、
  相手先は PDF のデータ型にすら存在しない
  （quotation-pdf v0.2 §4）
- PE の AuditLog は現状ヘッダ単位で3箇所（create/update/softDelete）。
  行単位の記録を1つだけ足すと作法が割れる
- 必要になれば後から足せる（非破壊）

### 2-5. 見積の途中保存は不変

相手先未選択でも見積は保存できる。Zod に required refine を追加しない。

★根拠: PE 明細の必須は `itemName` のみ。`unitPrice` も `quantity` も
nullable であり、単価すら未入力で保存できる構造になっている。
ヘッダ必須は `productId` のみ、`estimateQuantity` は 0 許容、`items` は 0 行以上。
相関チェックは「USD 行があれば `exchangeRateUsdJpy` 必須」の1つだけ。

**見積は緩く保存でき、締めるのは発注生成の側**という既存の二段構えを維持する。

---

## 3. 却下・スコープ外

### 3-1. 却下: `counterpartyConfirmed` フラグ

2026-08-12 の会話で一度は確定していたが撤回した。

フラグの目的は「機械が焼き込んだ値か、人が選んだ値か」の区別だった。
本書は**サンプルからの焼き込みを行わない**ため、列に値が入っている
＝人が生成画面で選んだ、しかない。区別する必要が消えるのでフラグ自体が不要。

「素の焼き込みだとサンプル工場のまま気づかず出す」という懸念も、
焼き込まないので発生しない。

### 3-2. 却下: 見積編集フォームへの相手先入力欄

`production-estimate-form.tsx` は**触らない**。

相手先を選ぶ場所は生成画面のまま変えない。人がその判断をする場所は現状と同じで、
変わるのは「2回目以降は選び直さなくてよい」「見積詳細で前回の相手先が見える」の2点。

★犠牲: 一度も生成していない見積では相手先は空欄のまま。
「見積段階で誰に頼むか見えない」は初回のみ解けない。
必要になれば列は既にあるので、UI は後から非破壊で足せる。

### 3-3. 却下: 相手先未選択の警告表示

入力欄を作らないため、警告を出す場所が無い。
そもそも単価未入力でも保存できる見積で、相手先だけ警告するのは不整合。

### 3-4. スコープ外: 単価未入力の警告（B-141 として分離起票）

`COMPANY_ARRANGED` 行の単価未入力は警告すべき、という要件が
2026-08-12 に確定した。ただし本書には含めない。

- 触る層が違う（本書＝生成 action と導出ロジック / B-141＝編集フォームの表示層）
- `procurementRoute` による出し分けが必要
  （`CLIENT_SUPPLIED` / `STOCK_ALLOCATED` は単価空が正常）
- ★既存の `AMOUNT_UNDECIDED` バッジ「計上外（単価未入力）」は中立表現であり、
  自社手配行の異常を表せていない。この出し分けが B-141 の中身

### 3-5. スコープ外: 再生成時の重複 DRAFT

(B) に再生成ガードは無い（recon 済み）。生成のたびに DRAFT PO/WO が新規作成される。

これは本書が作るリスクではなく**既存の穴**だが、相手先が保存されることで
再生成の敷居が下がり踏みやすくはなる。別バックログとして起票する。

### 3-6. スコープ外: B-135（ヘッダの相見積もり相手先）

`ProductionEstimate` ヘッダに `factoryId`/`contractorId` を追加する案件。
本書とは**別モデル・別レイヤー**であり列レベルで完全に独立している。

★B-135（ヘッダ＝相見積もり・1見積1社）と本書（行＝誰に何を頼むか）は
別の要件である。過去2回この2つを混同して設計を逆転させた事故がある。
片方を根拠にもう片方を撤回しないこと。

生成に絡まないため実装順は本書を先行させる。

---

## 4. 変更ファイル（★`satisfies Record` の網羅ガードが無いため手動で漏れなく）

1. `prisma/schema.prisma` — `ProductionEstimateItem` に3列＋index
2. migration SQL（手書き＋`migrate diff` の empty-diff 検証）
3. `src/lib/actions/production-order-generation.ts` — 生成前の保存ステップ追加
4. `src/lib/actions/production-estimates.ts` — `GenLineTarget` 導出順に保存値を1段追加

★`ProductionEstimateItemDTO`・`toFormValues`・編集フォームは**変更不要**
（編集フォームに露出させないため）。

---

## 5. migration（triple-gate 対象）

1. dev で `migrate diff` → 手書き SQL → 適用 → 動作確認
2. 本番 dry-run（`BEGIN` / `ROLLBACK`・`DATABASE_PUBLIC_URL`・
   ホストが `shuttle.proxy.rlwy.net:16099` であることを目視）
3. マージ（＝`prisma migrate deploy` が走る＝本番適用）
4. 本番検証

★ADD COLUMN のみ・DROP なし（非破壊マイグレーション原則）。
既存行は3列とも NULL で入り、導出順2〜4により挙動は不変。

---

## 6. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| a | 列の持ち方 | `ProductionEstimateItem` に3列（supplier/factory/contractor）・nullable・scalar FK |
| b | 保存タイミング | 生成 action の冒頭・PO/WO 生成の前・独立ステップ |
| c | 導出順 | 保存値を先頭に1段追加。R-a の2〜4は不変 |
| d | AuditLog | 出さない |
| e | 途中保存 | 不変。required refine を追加しない |
| f | 確認フラグ | 不採用（焼き込みをしないため不要） |
| g | 編集フォーム | 触らない |
| h | 単価未入力警告 | スコープ外・B-141 として分離 |
| i | B-135 | 別レイヤー・本書の後 |

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-12 | v0.1 | 初版確定。R-a を改訂し PE 明細に相手先3列を追加。counterpartyConfirmed・編集フォーム改修・警告表示を却下して案を最小化。単価未入力警告を B-141 に分離 |
