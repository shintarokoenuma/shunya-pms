# B-148 PR-2b 仕様確認書 v0.1（2026-09-02）

- 種別: 仕様確認書 v0.1（確定・実装ブリーフ着手可）
- 対象: B-148 PR-2b（受注 → 量産発注の接続）／B-156（Σ入力数量0）／B-142（再生成ガード・警告のみ）
- 上位: 原マイルストーン M4（受注MVP＝受注登録・量産発注連動が動く）。本書の実装完了で M4 が完了する
- 根拠 spec:
  - production-order-generation-spec-confirmation-v0_1-2026-07-26.md（R-b / R-d / R-e / R-f）
  - production-order-generation-spec-addendum-v0_1-2026-08-12.md（§2-2 保存タイミングの思想）
  - b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md（D-1 / D-4 / D-8）
  - b-148-pr2a-implementation-brief-2026-08-19.md §1（PR-2b の範囲定義）
  - b-148-pr1-implementation-brief-2026-08-13.md §11（D-3 = SalesOrder.productId に値を書かない）
  - docs/SALES_ORDER_QUANTITY_DESIGN.md §1-2 / §3 / §6
  - 20260516_01_仕様書_Part1 §2.6（量産発注は受注合計＋歩留まり率で自動計算）
- 現物確認: 2026-08-29 10:30-10:46 JST の read-only recon（main HEAD 40f54a6・DB 非書き込み）。★本書の作成日は 2026-09-02 であり recon から中3日空いている。2026-09-02 に origin/main の HEAD と §0 の主要4点を再検証したうえで採用した

---

## 0. recon で確定した事実（本書の前提）

すべて main 40f54a6 の実コード・実 schema から採取した。推測で埋めていない。

- SalesOrder.isConvertedToProduction（schema 4480・Boolean @default(false)）と
  SalesOrder.convertedAt（4481・DateTime?）は **本番に既存で、参照ゼロの休眠列**。
  PR-2b はこの2列の書き込みを開始するだけであり、DDL は発生しない。
- **SO と発注（PO / WO / PE）を結ぶ FK は schema 上に1本も存在しない。**
  SoItem 側にも PO / WO / PE 側にも無い。唯一の連結は PR-2a が確立した
  Sku.productionQuantity（SO 由来のキャッシュ）という間接経路のみ。
- 同名の別列に注意（流用禁止）:
  Inquiry.convertedAt（1788）／ Quotation.isConvertedToOrder・convertedAt（3382-3383）／
  QuotationConversion（3859）／ DeliveryNoteItem.soId・soItemId・woId（6100-6102・納品↔SO の休眠列）。
  いずれも本書の対象外。
- **SalesOrder.productId には値を書かない運用**（PR-1 §11 の D-3）。
  SO から品番を辿る経路は SoItem → Sku → Product のみ。
- 生成 action generateProductionOrders（421行）は SalesOrder を一切参照しない。
  呼び出し元は production-order-generate-form.tsx の1箇所のみ。
- 生成フォームは canGenerate = missingCount === 0 かつ totalQty > 0 で
  **画面上は Σ0 を既にブロックしている**が、validator は quantity >= 0 を許容しており
  **サーバ側は Σ0 を弾かない**。
- SO は「クライアントからの発注1通＝1受注（複数品番可）」。複数品番 SO は例外ではなく通常形。

## 1. スコープ

PR-2b は B-148 PR-2b・B-156・B-142（警告のみ）を **一体で扱う**。
3件は同一の生成パイプライン上にあり、別々に触ると同じ場所を2回改修することになるため。

| 項目 | 本書 |
|---|---|
| SalesOrder.isConvertedToProduction / convertedAt の稼働 | 対象 |
| B-156（Σ入力数量0 のサーバ側拒否） | 対象 |
| B-142（再生成時の警告表示。ブロックはしない） | 対象（B-142 は閉じない） |
| 受注詳細から品番カルテへの動線 | 対象（B-182 の受注分を消化） |
| migration | **なし**（既存列への書き込み開始のみ） |

## 2. P-1 接続方式 — 案A で確定

生成成功時に SalesOrder.isConvertedToProduction を true にし、convertedAt に日時を書く。
**受注と発注の対応表は作らない。**

### 採用理由

原設計 §2.6 は「量産発注は **受注合計** ＋ 歩留まり率で自動計算」と定めている。
実装もそうなっており、Sku.productionQuantity は COUNTED な SO 全件の Σ である
（SALES_ORDER_QUANTITY_DESIGN §1-2）。

つまり **1つの発注セットは複数の受注に対応する多対多**であり、
PO / WO 側に salesOrderId を1列足す形では正しく表現できない。
正しく作るなら中間テーブルの新設（新モデル＋migration）が要り、
PR-2a ブリーフ §1 が定めた「PR-2b は migration なし」の射程を超える。

半端な形で作ると後で壊して作り直すことになるため、**追跡は B-185 に分離する**（§10）。

### 案A が案B を塞がないこと

isConvertedToProduction は「この受注は量産へ流れた」という受注ヘッダ単位の状態であり、
案B（対応表）が入っても導出可能な状態として矛盾なく残る。案A は案B の踏み台である。

## 3. P-2 消し込む SO の決め方

対象 SO は次の条件をすべて満たすもの。

- その PE の productId に属する Sku を1つ以上、SoItem として含む
  （SoItem.skuId → Sku.productId = PE.productId で引く。SalesOrder.productId は使わない・D-3）
- SalesOrder.status が COUNTED_STATUSES に含まれる
  （CONFIRMED / IN_PRODUCTION / PARTIAL_DELIVERED / DELIVERED / COMPLETED）
- deletedAt が null かつ isLatest が true

この集合は **Sku.productionQuantity の Σ に寄与した SO 集合と完全に一致する**。
生成の既定数量の出どころと、消し込む対象の定義がズレない。

### ★仕様として明記する粗さ

**複数品番の SO で1品番だけ生成しても、SO 全体にフラグが立つ。**

SoItem 側に変換状態を持つ列が無く、本書は migration なしのため、これ以上細かくできない。
したがって画面のラベルは「発注完了」ではなく **「量産へ反映済み」** とする。
意味は「この受注の数量が、少なくとも1回、量産発注の生成に使われた」であり、
「この受注の全品番の発注が済んだ」ではない。

★この粗さこそが B-185（案B）の存在理由である。実装者はこれをバグとして直そうとしないこと。

## 4. P-3 立てるタイミングと降ろす経路

- **生成が成功した後**に立てる。PO / WO の生成の後。
  ★addendum §2-2 が「相手先の保存は生成の前」としたのは、人の入力を失わないためである。
  フラグは事実の記録であり、事実が成立した後に書く。思想が異なるので同じにしない。
- (B) は文書間が非アトミック。**1本でも生成できたら立てる**。
  部分生成でも受注数量は実際に使われているため。
- **降ろす経路は作らない**（v1）。手動で false に戻す UI は用意しない。
- **SO をキャンセルしてもフラグは降ろさない。** CANCELLED は COUNTED から外れるため
  Sku の集計からは差し引かれるが、既に生成された DRAFT の PO / WO は残る。
  「使われた」という事実は消えない。
- フラグの書き込みは、生成 action と同一の tx に入れない。
  生成が非アトミックである以上、フラグだけを厳密にしても意味が無いため、
  生成完了後の独立ステップとする。失敗しても生成物は残す（ログに残す）。

## 5. P-4 B-156 — Σ入力数量0

B-156 原文: 「Σ入力数量0でも量産発注を生成できる。SKU 未登録の品番で
Σ入力数量 0 / 見積数量 100 のまま生成ボタンが押せる。§4 の警告のみ・ブロックしないは
受注ずれを想定したものでΣ0を含まない。同§4 の WO 工程明細数量 = Σ入力数量 の厳守と矛盾する」

### 確定

- **サーバ側でも Σ0 を拒否する。** generateProductionOrdersInputSchema に
  superRefine を追加し、skuQuantities の合計が 0 より大きいことを検証する。
- **行単位の quantity >= 0 は変更しない。** 特定の色・サイズを作らない指定は正常な業務であり、
  0 は行としては正しい値である。禁じるのは合計が 0 の生成のみ。
- 根拠: 数量0の WO は業務上意味を持たず、R-d の「WO 工程明細数量 = Σ入力数量」の厳守と矛盾する。
- 画面側の canGenerate（totalQty > 0）は現行のまま残す。**多重防御**とする。

### 不変（誤って触らないこと）

**Σ入力数量 ≠ PE.estimateQuantity は R-d のとおり警告のみでブロックしない。**
見積数量と受注確定数量のずれは正常な業務である。B-156 はΣ0 だけの話であり、
ずれの扱いを変える根拠にはならない。

## 6. P-5 B-142 — 再生成ガード

### 確定: 警告のみ。ブロックはしない。B-142 は閉じない

生成画面を開いた時点で、対象 SO（§3 の条件）に isConvertedToProduction が true のものが
あれば、「この品番には量産へ反映済みの受注があります（SO番号・反映日時）」を表示する。
生成ボタンは無効化しない。

### ブロックしない理由

リピート・分納・追加生産による再生成は正当な業務である
（B-169 が「リピートは正当な業務で、同一品番が別納期で再発注される」と確定している）。
機械が止めるのではなく、人が気づける材料を出す。

### B-142 の扱い

B-142 は「PE 単位で生成済みかを判定する列も導線も無い」という穴であり、
本書の警告はその代替にならない（受注側から見た間接的な兆候にすぎない）。
**B-142 は未着手のまま残す。** 実装完了後に BACKLOG へ
「PR-2b で警告のみ実装済み・完全ガードは未」と追記する。

## 7. P-6 受注起点の動線

### 確定: 受注詳細の明細に、品番カルテへのリンクを置く。生成ボタンは置かない

- 受注詳細（sales-orders/[id]）の明細行の品番名を /products/[id] へのリンクにする
- **生成の起点は PE のまま**（R-b 不変。PE の無い品番からの直接生成は v1 不許可）
- 受注詳細のヘッダに「量産へ反映済み」の状態と convertedAt を表示する

### 理由

フラグを受注詳細に出すのに、そこから次の行動へ進めないと袋小路になる
（B-183 のダッシュボードと同じ形）。動線マップ §4-2 の実測では
受注詳細から品番カルテへ向かうエッジは 0 本であり、これは B-182 の指摘そのものである。

**本書は B-182 の受注分を消化する。納品分は B-182 に残す。**
実装完了後に B-182 へ「受注分は PR-2b で消化済み・納品分は未」と追記する。

## 8. 変更ファイル（★網羅ガードが無いため手動で漏れなく）

1. src/lib/validators/production-order-generation.ts — superRefine で Σ > 0（§5）
2. src/lib/actions/production-order-generation.ts — 生成成功後にフラグを立てる独立ステップ（§4）
3. src/lib/actions/sales-orders.ts — 対象 SO を引くヘルパー（§3 の条件）。
   ★recomputeSkuOrderedQuantities は触らない
4. src/app/(app)/production-estimates/_components/production-order-generate-form.tsx — 反映済み受注の警告表示（§6）
5. src/app/(app)/sales-orders/[id]/page.tsx — 反映状態の表示＋明細の品番リンク（§7）

★prisma/schema.prisma は変更しない。migration は発生しない。

## 9. migration

**なし。** 既存列（sales_orders.is_converted_to_production / converted_at）への
書き込みを開始するだけで、DDL は1行も出ない。

したがって **triple-gate（dev → 本番 dry-run → マージ）は不要**。
dev 動作確認 → PR レビュー → マージ の通常フローで足りる。
★ただしマージ = Railway の main 自動デプロイ = 本番反映であることは変わらない。

取り消しは、フラグを false に戻す UPDATE のみ。数量・金額には触れない。

## 10. スコープ外（★その場で B番号を振る）

| 要件 | B番号 |
|---|---|
| 受注↔発注の対応追跡（案B・中間テーブルの新設） | **B-185（本書で新規起票）** |
| PE 単位の完全な再生成ガード | B-142（継続・§6） |
| 同一品番の重複 SO 検知と主従の是正 | B-169 |
| 納品↔SO の休眠列（DeliveryNoteItem.soId / soItemId / woId）の稼働 | 触らない（ステップ11・12 の領分） |
| B-182 の納品分の動線 | B-182（継続・§7） |
| 確定見積 QE-2 との単価突合 | B-143 |
| 受注変更履歴（SalesOrderChangeHistory） | B-162 |
| SKU 別 MOQ の自動判定 | B-163 |
| 受注前カルテの試算数量の供給 | B-177 |
| Sku.productionQuantity 列の廃止 | B-178 |

## 11. 動作確認（dev・localhost:3001 / hopper:12921）

★本番 DB（shuttle:16099）には接続しない。

1. CONFIRMED な SO がある品番の PE から生成すると、受注詳細に「量産へ反映済み」と日時が出る
2. 生成前は出ない
3. 同じ PE で2回目の生成画面を開くと、反映済み受注の警告が出る。**生成ボタンは押せる**
4. Σ入力数量0 で、画面のボタンが無効なだけでなく、**action を直接叩いてもサーバ側で拒否される**
5. Σ入力数量 ≠ 見積数量 は従来どおり警告のみで生成できる（R-d 不変の確認）
6. ★複数品番の SO で片方の品番だけ生成すると、SO 全体にフラグが立つ（§3 の粗さの確認・仕様どおり）
7. SO をキャンセルしてもフラグは降りない（§4）
8. 受注詳細の明細から品番カルテへ遷移できる
9. 既存の dev 残置データ（SO-2026-0001 CANCELLED / 0002 CONFIRMED / 0003 TENTATIVE / 0004）が壊れていない

★4 と 6 は画面の目視で確認する。build 成功だけで完了としない。

## 12. 実装上の禁止事項

- prisma/schema.prisma を変更しない。migration を作らない
- recomputeSkuOrderedQuantities のロジックを変更しない（PR-2a の確定事項）
- COUNTED_STATUSES を変更しない（D-4）
- 行単位の quantity >= 0 を >= 1 に変えない（§5）
- Σ ≠ 見積数量 をブロックしない（R-d）
- 再生成をブロックしない（§6）
- 生成の起点を PE 以外に増やさない（R-b）
- SalesOrder.productId に値を書かない（D-3）
- DeliveryNoteItem の soId / soItemId / woId に触らない
- git add は明示的なファイルパスのみ（-A / . / --all は使わない）
- コードを含む変更のため feature ブランチ + PR 必須。main 直 push は禁止

## 13. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| P-1 | 接続方式 | 案A（SalesOrder のフラグのみ・migration なし）。追跡は B-185 に分離 |
| P-2 | 消し込む SO | PE の品番の Sku を含む COUNTED な SO 全件。★複数品番 SO では粗い。ラベルは「量産へ反映済み」 |
| P-3 | タイミング | 生成成功後・独立ステップ。部分生成でも立てる。降ろす経路は作らない |
| P-4 | B-156 | サーバ側でも Σ0 を拒否（superRefine）。行単位の >= 0 と Σ≠見積の警告のみは不変 |
| P-5 | B-142 | 警告のみ・ブロックなし。B-142 は閉じない |
| P-6 | 動線 | 受注詳細の明細に品番カルテへのリンク。生成ボタンは置かない。B-182 の受注分を消化 |

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-02 | v0.1 | 初版確定。2026-08-29 の recon（main 40f54a6）を 2026-09-02 に再検証したうえで P-1〜P-6 を確定。B-185 を新規起票 |
