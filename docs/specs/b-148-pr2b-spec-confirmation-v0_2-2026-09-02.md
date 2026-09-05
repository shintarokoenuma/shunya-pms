# B-148 PR-2b 仕様確認書 v0.2（2026-09-02）

- 種別: 仕様確認書 v0.2（確定・実装ブリーフ着手可）
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
- 現物確認:
  - v0.1: 2026-08-29 10:30-10:46 JST の read-only recon（main HEAD 40f54a6）を 2026-09-02 に再検証して採用
  - v0.2: 2026-09-02 08:38 JST の実装前 read-only recon（main HEAD cdf65f7・DB 非書き込み）。
    ★この recon で v0.1 §0 の1点（Σ0 のサーバ側ガード）に**誤りが見つかったため訂正した**（§5）

---

## 0. recon で確定した事実（本書の前提）

main cdf65f7 の実コード・実 schema から採取した。

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
- 生成 action generateProductionOrders（421行）は SalesOrder を一切参照しない（grep 0件）。
  呼び出し元は production-order-generate-form.tsx の1箇所のみ。
- 生成 action の return は3系統で、いずれも data に ctx.pe.productId を載せている:
  PO 生成失敗（:343）／WO 生成失敗（:370）／成功（:417）。
- ★**Σ入力数量0 は、画面とサーバの両方で既にブロックされている**（v0.2 で訂正・詳細は §5）:
  画面 = canGenerate（generate-form.tsx:126）／
  サーバ = generateProductionOrders 本体の早期 return（production-order-generation.ts:207）。
  validator（zod）は行単位の quantity >= 0 のみを見ており Σ は見ないが、Σ の検査は action が担っている。
- ★SalesOrderDTO / getSalesOrder に isConvertedToProduction / convertedAt は**含まれていない**
  （include は items のみ）。§7 のヘッダ表示には DTO の拡張が要る。
- 受注詳細（sales-orders/[id]/page.tsx・239行）は既に明細を productId でグルーピングし、
  productInfo から品番コードを表示している（:135 / :143）。ヘッダは Cell label の並び（:113-118）。
- SO は「クライアントからの発注1通＝1受注（複数品番可）」。複数品番 SO は例外ではなく通常形。

## 1. スコープ

PR-2b は B-148 PR-2b・B-156（判定のみ）・B-142（警告のみ）を **一体で扱う**。
3件は同一の生成パイプライン上にあり、別々に触ると同じ場所を2回改修することになるため。

| 項目 | 本書 |
|---|---|
| SalesOrder.isConvertedToProduction / convertedAt の稼働 | 対象 |
| B-156（Σ入力数量0） | ★実装なし。既に解消済みと判定し dev で確認するのみ（§5） |
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

★条件は recomputeSkuOrderedQuantities（sales-orders.ts:134）の where 句と同一であり、
COUNTED_STATUSES（同 :62）をそのまま再利用する。条件を書き写して二重定義にしない。

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
  ★したがって挿入位置は3箇所（:343 / :370 / :417 の各 return の直前）であり、
  条件は createdPos.length + createdWos.length > 0。
- **降ろす経路は作らない**（v1）。手動で false に戻す UI は用意しない。
- **SO をキャンセルしてもフラグは降ろさない。** CANCELLED は COUNTED から外れるため
  Sku の集計からは差し引かれるが、既に生成された DRAFT の PO / WO は残る。
  「使われた」という事実は消えない。
- フラグの書き込みは、生成 action と同一の tx に入れない。
  生成が非アトミックである以上、フラグだけを厳密にしても意味が無いため、
  生成完了後の独立ステップとする。失敗しても生成物は残す（B-101 のタスク生成と同じ扱い）。

## 5. P-4 B-156 — Σ入力数量0

B-156 原文（2026-08-13 dev で発見）: 「Σ入力数量0でも量産発注を生成できる。SKU 未登録の品番で
Σ入力数量 0 / 見積数量 100 のまま生成ボタンが押せる。§4 の警告のみ・ブロックしないは
受注ずれを想定したものでΣ0を含まない。同§4 の WO 工程明細数量 = Σ入力数量 の厳守と矛盾する」

### ★v0.2 での訂正 — B-156 は既に解消されている

v0.1 §0 は「validator は quantity >= 0 を許容しており **サーバ側は Σ0 を弾かない**」と書いた。
**これは誤りだった。** 2026-09-02 08:38 の実装前 recon で、生成 action 本体に早期 return が実在した。

    production-order-generation.ts:207
    if (totalQty <= 0) return { ok: false, error: "SKU 数量が全て 0 です（1つ以上入力してください）" }

画面側（generate-form.tsx:126 の canGenerate）と合わせ、Σ0 は画面とサーバの両方で塞がれている。
B-156 が発見された 2026-08-13 以降のどこかで解消されたものと見られる。

**なぜ誤ったか**: v0.1 は validator（zod）だけを grep して「サーバ側」を断定した。
zod は行単位の quantity しか見ておらず、Σ の検査は action 本体にある。
**近似スキャンの結果を確定として扱った**（file-write-verification 鉄則10 と同型）。
以後、「サーバ側に無い」と断定する前に action 本体を必ず読む。

### 確定

- **本 PR で B-156 に対する新規の実装は行わない。**
- **validator への superRefine 追加は却下する。** 同一条件を zod と action で二重に定義すると
  エラーメッセージが2系統に割れ、どちらが出るかが呼び出し経路に依存する。
  検査は信頼境界である action の1箇所に残す。
- **§11 の動作確認4 で dev の実画面・実 action で確認し、確認できた時点で BACKLOG の B-156 を完了にする。**
  ★コードの存在だけを根拠に「完了」と書かない（file-write-verification 鉄則4）。

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

- 受注詳細（sales-orders/[id]/page.tsx）の品番見出し（:143 の productCode）を
  /products/[productId] へのリンクにする。★既存作法（products/${id} 形式）に合わせる
- ヘッダの Cell 群（:113-118）に「量産へ反映」の1項目を足し、状態と convertedAt を表示する
- **生成の起点は PE のまま**（R-b 不変。PE の無い品番からの直接生成は v1 不許可）。
  受注詳細に生成ボタンは置かない

### 理由

フラグを受注詳細に出すのに、そこから次の行動へ進めないと袋小路になる
（B-183 のダッシュボードと同じ形）。動線マップ §4-2 の実測では
受注詳細から品番カルテへ向かうエッジは 0 本であり、これは B-182 の指摘そのものである。

**本書は B-182 の受注分を消化する。納品分は B-182 に残す。**
実装完了後に B-182 へ「受注分は PR-2b で消化済み・納品分は未」と追記する。

## 8. 変更ファイル（★網羅ガードが無いため手動で漏れなく）

1. src/lib/actions/production-order-generation.ts —
   生成後にフラグを立てる独立ステップ（§4）。挿入は3箇所（:343 / :370 / :417 の各 return の直前）、
   条件は createdPos.length + createdWos.length > 0
2. src/lib/actions/sales-orders.ts —
   ①§3 の条件で対象 SO を引き、フラグを立てるヘルパーを追加（COUNTED_STATUSES を再利用）
   ②★SalesOrderDTO と getSalesOrder に isConvertedToProduction / convertedAt を追加
   （現状 DTO に無く §7 のヘッダ表示ができない・2026-09-02 recon で判明）
   ★recomputeSkuOrderedQuantities は触らない
3. ★実装追従（PR #137・fb129d5）: production-estimates.ts は変更しなかった。
   §8-3 が用意した逃げ道「別 action で取得する形にするなら本ファイルは触らない」を選んだ結果、
   生成 context には載せず、sales-orders.ts に読み取り action listConvertedSalesOrdersForProduct を
   足し、src/app/(app)/production-estimates/[id]/generate/page.tsx がそれを fetch して
   フォームへ props で渡す形にした。production-estimates.ts の context を太らせないこの実装が正しい。
   （変更したのは generate/page.tsx。production-estimates.ts は不変）
4. src/app/(app)/production-estimates/_components/production-order-generate-form.tsx —
   反映済み受注の警告表示（§6）
5. src/app/(app)/sales-orders/[id]/page.tsx —
   ヘッダに「量産へ反映」の Cell、品番見出しを品番カルテへのリンクに（§7）

★prisma/schema.prisma は変更しない。migration は発生しない。
★src/lib/validators/production-order-generation.ts は変更しない（§5）。

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
| 受注↔発注の対応追跡（案B・中間テーブルの新設） | **B-185** |
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
4. ★B-156 の消し込み確認: Σ入力数量0 で画面のボタンが無効であること、かつ
   action を直接叩いた場合も「SKU 数量が全て 0 です」で拒否されること（既存 :207 の挙動確認）
5. Σ入力数量 ≠ 見積数量 は従来どおり警告のみで生成できる（R-d 不変の確認）
6. ★複数品番の SO で片方の品番だけ生成すると、SO 全体にフラグが立つ（§3 の粗さの確認・仕様どおり）
7. SO をキャンセルしてもフラグは降りない（§4）
8. 受注詳細の品番見出しから品番カルテへ遷移できる
9. 既存の dev 残置データ（SO-2026-0001 CANCELLED / 0002 CONFIRMED / 0003 TENTATIVE / 0004）が壊れていない

★4 と 6 は画面の目視で確認する。build 成功だけで完了としない。

## 12. 実装上の禁止事項

- prisma/schema.prisma を変更しない。migration を作らない
- src/lib/validators/production-order-generation.ts に Σ の検査を足さない（§5）
- recomputeSkuOrderedQuantities のロジックを変更しない（PR-2a の確定事項）
- COUNTED_STATUSES を変更しない。条件を書き写して二重定義にしない（D-4・§3）
- 行単位の quantity >= 0 を >= 1 に変えない（§5）
- Σ ≠ 見積数量 をブロックしない（R-d）
- 再生成をブロックしない（§6）
- 生成の起点を PE 以外に増やさない（R-b）。受注詳細に生成ボタンを置かない
- SalesOrder.productId に値を書かない（D-3）
- DeliveryNoteItem の soId / soItemId / woId に触らない
- git add は明示的なファイルパスのみ（-A / . / --all は使わない）
- コードを含む変更のため feature ブランチ + PR 必須。main 直 push は禁止

## 13. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| P-1 | 接続方式 | 案A（SalesOrder のフラグのみ・migration なし）。追跡は B-185 に分離 |
| P-2 | 消し込む SO | PE の品番の Sku を含む COUNTED な SO 全件。★複数品番 SO では粗い。ラベルは「量産へ反映済み」 |
| P-3 | タイミング | 生成後・独立ステップ。部分生成でも立てる（:343 / :370 / :417 の3箇所）。降ろす経路は作らない |
| P-4 | B-156 | ★v0.2 訂正: action:207 で既に解消済み。新規実装なし・validator superRefine は却下。dev 目視で確認して BACKLOG を完了にする |
| P-5 | B-142 | 警告のみ・ブロックなし。B-142 は閉じない |
| P-6 | 動線 | 受注詳細の品番見出しを品番カルテへのリンクに。生成ボタンは置かない。B-182 の受注分を消化 |

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-02 | v0.1 | 初版確定。2026-08-29 の recon（main 40f54a6）を 2026-09-02 に再検証したうえで P-1〜P-6 を確定。B-185 を新規起票 |
| 2026-09-02 | v0.2 | 実装前 recon（08:38 JST・main cdf65f7）で v0.1 §0 の誤り（Σ0 のサーバ側ガード）を訂正。B-156 は解消済みと判定し新規実装を取り止め、validator への superRefine を却下。§8 に SalesOrderDTO の拡張とフラグ挿入位置の file:line を追加 |
| 2026-09-05 | v0.3 | PR #137 マージ後、§8 の変更ファイル一覧を実装に追従（production-estimates.ts は不変・generate ページを変更）。§11 の動作確認9項目すべて dev で完了。B-156 を完了に更新 |
