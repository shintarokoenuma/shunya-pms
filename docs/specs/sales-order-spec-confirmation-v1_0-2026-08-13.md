# 受注（SO）仕様確認書 v1.0 (2026-08-13)

- 種別: 仕様確認書 v1.0（実務ヒアリングと live recon による確定・実装は B-148）
- 対象: SalesOrder / SoItem の本実装。ライフサイクル 7「受注確定・SO発番」
- 上位/関連: sales-order-quotation-flow-spec-confirmation-v0_1-2026-08-13.md（R-1〜R-4）/
  roadmap-audit-2026-08-12.md §1-1 / phase-strategy-confirmation-2026-05-23.md（Phase 1D）/
  20260516_05_MVP実装計画書 §7.1・§2.2（原マイルストーン M4）
- 出典: 2026-08-13 セッションでの慎太郎さんへのヒアリング ＋ live schema recon
- ★本書は R-5〜R-11 を確定する。R-1〜R-4 は上位 spec が正

---

## 0. ★前提の訂正（本書の最重要事項）

原設計 §2.5「受注期間（展示会等、1〜2ヶ月）→ オーダーページ + 外部受注取込」は、
**shunya 自身が展示会で受注を積み上げる話ではない。**

慎太郎さん原文（2026-08-13）:

> まず入り口から違うのは、自社ブランドの受注は saagara で行なっているので、
> 展示会という概念はない。現時点では OEM 会社の生産システムなので、
> 考え方を改めてほしい。その為、積み上げ式ではない。

### 0-1. 帰結

- 展示会受注の集計は自社ブランド＝saagara の業務。shunya-pms の対象外
- shunya-pms は OEM 生産管理会社のシステムであり、
  **受注はクライアント（ブランド）から確定数量として渡ってくる**
- したがって「仮受注を積み上げて締め切る」動線は作らない
- ライフサイクル 6「受注期間・オーダーページ」は
  「クライアントが自社の受注を終えた後、shunya に数量を渡す入口」と読み替える

★この訂正は B-148 だけでなく、監査 §1 のステップ6 の解釈にも及ぶ。

---

## 1. SO の単位（R-5）

**SO = 先方から来た1通の発注。複数品番を含みうる。**

根拠（慎太郎さん原文・2026-08-13）:

> クライアントによっては1シーズンで20型程度になるクライアントもいるので、
> 1品番づつの受注は現実的ではない。

| 項目 | 確定内容 |
|---|---|
| migration | SalesOrder.productId を 必須 → nullable に変更（1本・非破壊） |
| 明細の粒度 | SoItem は skuId のみ保持。品番は Sku.productId で辿る |
| 品番の重複保持 | ★しない。recon で Sku.productId（必須・@relation Product Cascade）を確認済み |
| 先方の発注番号 | 既存列 buyerOrderNumber に入れる（発注書1通を後から辿るため） |
| 既存 index | @@index([companyId, productId]) / @@index([isLatest, productId]) は nullable でも有効。触らない |

★1品番しか含まない SO は、複数品番 SO の特殊ケースであって別の型ではない。

---

## 2. ステータスの運用（R-6）

SalesOrderStatus の8値は**追加も削除もしない**。§0 の訂正により意味を割り当て直す。

| 値 | 本システムでの意味 |
|---|---|
| TENTATIVE（既定） | 社内の入力途中（代打ち中・内容未確認） |
| CONFIRMED | 先方の正式発注として確定。★量産発注生成の起点 |
| IN_PRODUCTION | 量産発注済み（既存定義のまま） |
| PARTIAL_DELIVERED / DELIVERED / COMPLETED | 既存定義のまま |
| CANCELLED | ★成立後の取り消しのみ。失注ではない |
| ON_HOLD | 保留 |

★原設計の TENTATIVE コメント「仮受注（受注募集中・展示会中）」は §0 により実態と合わない。
　enum のコメント修正は任意（実装時に判断・schema を触るなら同一 migration に含めない）。

---

## 3. 失注は SO に持たせない（R-7）

上位 spec §2-2 は「サンプル・展示会を経た失注は引き合い段階の失注と性質が違う」とし、
当初は SalesOrderStatus への LOST 追加を検討した。**§0 の訂正により結論が変わった。**

受注が確定数量で渡ってくる以上、**失注した案件には SO がそもそも作られない。**
SO に失注値を置いても「作られなかったレコードの状態」は表せず、分析に使えない。

| 段階 | 失注の置き場所 |
|---|---|
| 引き合い | Inquiry.status = LOST（★実在・recon 5 で確認） |
| 見積 | 確定見積 QE-2 / Quotation 側の状態（B-143 で設計する） |
| 受注 | ★持たない |

★recon 5 の事実: LOST（失注）が実在するのは Inquiry 系のみ。他モデルは軒並み CANCELLED。
　在庫系の LOST は「紛失」で意味が別。

---

## 4. SKU 別 MOQ 判定（R-8）

**初版に含める。** 実務で行われているため（慎太郎さん確認 2026-08-13）。

- SkuMoqStatus の7値（NOT_DETERMINED / MEETS_MOQ / BELOW_MOQ_PRODUCE /
  BELOW_MOQ_PRICE_UP / EXCLUDED / NO_ORDERS / PENDING_DECISION）をそのまま使う
- ★**人が選ぶだけ。自動判定は載せない。**
  取り切り枚数は見積のアップデート時に確認済みという運用のため（慎太郎さん確認）
- 判断理由は moqDecisionReason に自由記述で残す

---

## 5. 減産の扱い（R-9）

慎太郎さん原文（2026-08-13）:

> 基本はないが、工場側や、資材側での減産は稀にある。
> あくまでも納品時の問題です。しかし、受注から納品に流れると思うので、
> その際に、減産にして数量変更などができるようにしておきたい。

減産は**先方の発注数量の変更ではない**。受注実績が生産都合で書き換わらないようにする。

| 列 | 扱い |
|---|---|
| SoItem.orderedQuantity | ★受注数量。原数量のまま固定する |
| SoItem.productionQuantity | 量産数量（歩留まり率込み）。減産はここを動かす |
| SoItem.deliveredQuantity / remainingQuantity | 納品実績 |

- 差分は減産率（B-150・実生産数÷計画数）で拾う
- ★**SalesOrderChangeHistory は初版で作らない。** 数量変更が稀であり、
  減産が受注変更ではないため。必要になった時点で別途起票する

---

## 6. 流入経路（R-10）

慎太郎さん原文（2026-08-13）:

> ほとんどがメール。本文、エクセル、PDF。専用フォーマット、専用システムもある。
> 受注はメールの読み込みや、エクセル、pdf からの読み込みなので、
> 読み込んだものを品番に当てこんでいく必要があります。

| 項目 | 初版 |
|---|---|
| 入力方法 | ★**人が手入力する1系統のみ**（代打ちと同じ経路） |
| 原本 | originalFiles にメール添付・PDF・Excel を保持する |
| ソース種別 | sourceType（OrderSourceType 11値）を初版から記録する |
| 自動読み取り | ★スコープ外（B-149） |

根拠: sku-design v1.0 §2-2「出口を SalesOrder に一本化し、入力経路はすべて
SalesOrder を作る手段として後付けする」。出口が無い状態で取り込み口を作らない。

★専用ページを将来作っても、対応できないクライアントのために**代打ちは必ず必要**。
　したがって手入力経路を先に作っても無駄にならない。

---

## 7. 画面構成（R-11）

**入力は受注一覧に一本化し、品番カルテは品番軸のビューとする。**

| 画面 | できること |
|---|---|
| 受注一覧（新設） | SO の新規作成（クライアント選択 → 品番を1つ以上追加 → SKU 別数量入力）・SO 単位の一覧・詳細 |
| 品番カルテの受注セクション | ★その品番に紐づく SoItem の**集約表示**。SKU 別受注数の合計・MOQ 判定状況・元 SO へのリンク。この品番だけの SO を作るショートカットを置いてもよい（作られるのは通常の SO で、品番が1つのもの） |

### 7-1. カルテ側が集約表示になる理由

1品番は複数の SO に跨って現れる（別クライアントの発注書・追加発注が別 SO で来る等）。
カルテには「この品番の受注合計」が必要で、既存の Sku.orderedQuantity（受注合計）が受け皿になる。

### 7-2. ★実装上の注意

Sku.orderedQuantity は **SO を跨いだ合計**であるため、
SO の作成・変更・キャンセル時に**再集計が必要**。PR-1 の設計に含める。

---

## 8. 実装スコープ（D-1 確定・PR 2本に分割）

### PR-1: 受注の成立

- migration（SalesOrder.productId の nullable 化）
- src/lib/actions/sales-orders.ts 新設
- 受注一覧・詳細・作成フォーム（複数品番・SKU 別数量入力）
- 品番カルテへの受注セクション追加（集約表示）
- SO 発番（SO-2026-0001 形式・既存の採番方式に合わせる）
- Sku.orderedQuantity の再集計（§7-2）

### PR-2: 量産発注への接続

- src/lib/actions/production-order-generation.ts の skuQuantities 手入力を
  SoItem 由来に置換する
- ★このファイルは B-156（Σ入力数量0でも生成できる）を抱えている。
  PR-2 の設計時に同時に判断する

分割の理由: PR-2 は既存の発注生成を触るため、受注の登録が独立して検証できる状態を先に作る。

★原マイルストーン M4 の完了基準は「受注登録・**量産発注連動**が動く」。
　M4 の完了は PR-2 まで。PR-1 単独では M4 は完了しない。

---

## 9. スコープ外（★B番号を振ること）

| 要件 | 状態 |
|---|---|
| メール・Excel・PDF からの取り込み／専用ページ | B-149（起票済み） |
| 確定見積 QE-2 との連携（quotationId / quotationVersion の使用） | B-143（起票済み） |
| 受注変更履歴（SalesOrderChangeHistory） | ★未起票 |
| SKU 別 MOQ の自動判定 | ★未起票 |
| 減産率の記録（実生産数÷計画数） | B-150（起票済み） |
| SalesOrderStatus の TENTATIVE コメント修正 | ★未起票（軽微） |

---

## 10. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| R-5 | SO の単位 | 発注1通 = 1 SO・複数品番可。productId を nullable 化。SoItem は skuId のみ |
| R-6 | ステータス | 8値を変更せず意味を割り当て直す。TENTATIVE=入力途中 / CONFIRMED=正式発注 / CANCELLED=成立後の取消 |
| R-7 | 失注 | SO に持たせない。QE-2（B-143）側の状態とする |
| R-8 | MOQ 判定 | 初版に含める。人が選ぶのみ・自動判定なし |
| R-9 | 減産 | 受注数量は不変。量産・納品数量を動かす。変更履歴テーブルは作らない |
| R-10 | 流入経路 | 手入力1系統。sourceType・originalFiles は初版から保持。自動読み取りは B-149 |
| R-11 | 画面構成 | 入力は受注一覧に一本化。カルテは品番軸の集約表示 |

---

## 11. live recon の記録（2026-08-13）

| # | 確認事項 | 結果 |
|---|---|---|
| 1 | SO 系の実装状況 | prisma.salesOrder / soItem / salesOrderChangeHistory の src/ 参照 **ゼロ**＝完全休眠 |
| 2 | SalesOrderStatus | 8値。★LOST 無し |
| 3 | OrderSourceType | 11値（ORDER_PAGE / SAAGARA_V2 / EMAIL / PDF_DOCUMENT / EXCEL_FILE / PAPER_DOCUMENT / PHONE / CHAT / EXHIBITION / DIRECT_VISIT / OTHER） |
| 4 | Sku.productId | 必須・@relation Product Cascade で実在 → SoItem に productId 重複保持は不要 |
| 5 | 数量の代用箇所 | src/lib/actions/production-order-generation.ts（★指示時に想定した production-orders/generation.ts は不在）。data.skuQuantities → qtyBySku → totalQty（136-166行）。生地 computeRequirement(totalQty,…)（219行）・工程行 quantity: totalQty（273行） |
| 6 | 失注の前例 | Inquiry.status = LOST のみ。他は CANCELLED。在庫系の LOST は「紛失」で別義 |

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-13 | v1.0 | 初版。★展示会積み上げ前提の訂正（§0）を含む。R-5〜R-11 を確定。live recon 6項目を記録 |
