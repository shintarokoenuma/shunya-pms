# 実装ブリーフ — B-269（見込み）作業発注の「合計数量」と縫製仕様書の「この発注 N 枚」

- 作成日: 2026-10-07 18:41 JST（date 取得）/ claude.ai
- 作成者: 慎太郎さん + Claude
- 起点 commit: 621dcad（2026-10-07 18:05 JST の read-only 実測・main）
- ライフサイクル: 8（量産発注）／5（仕様書）
- schema 変更: なし（WorkOrder.totalQuantity は init migration の CREATE TABLE work_orders に既にある）。★既存データを埋める migration（UPDATE のみ）を1本足す
- B番号: 見込み B-269（BACKLOG の最大番号は B-268。締めで grep してから採番。B-074「量産WO明細数量とSKU量産数の整合チェック常時化」とは別。食い違いを知らせる仕組みは B-074 に残す）
- 慎太郎さんの回答（原文）:
  - 2026-10-07 17:03「この発注 1,710 枚 これ数字違くない？」
  - 2026-10-07 17:59「推奨方法で修正して下さい。」
  - 2026-10-07 18:41「Aでいきましょう。」（作業発注の画面に「合計数量（枚）」の欄を出し、人が直せる）

---

## 0. 実測（2026-10-07・read-only・dev hopper:12921）

| # | 実測 | 帰結 |
|---|---|---|
| 1 | 縫製仕様書 sewing-spec-data.ts:469 `orderQuantity: wo.items.reduce((a, it) => a + it.quantity, 0)`（B-054 addendum v0.2 D-27「WO 明細の quantity の合計」） | 工程ごとの明細を足すので、工程の数だけ倍になる |
| 2 | 量産発注の生成 production-order-generation.ts:322-329 は、LABOR の見積明細1行ごとに WoItem を作り、quantity はどの行も totalQty（Σ入力数量）。仕様どおり（production-axis v1.0 §6-6「量産 WO 工程明細数量＝Σ SKU 量産数」・production-order-generation v0.1 R-d） | 明細は工程の内訳。枚数は「どの行も同じ数」の方 |
| 3 | dev の WO-2026-0021（PE-2026-0004 から生成）: 明細3行「縫製工賃／検品・仕上げ／国際物流・通関」各 570 → PDF は 1,710 | 2026-10-07 17:03 の指摘の原因 |
| 4 | model WorkOrder: `totalQuantity Int? @map("total_quantity")`。DDL は prisma/migrations/20260516075911_init/migration.sql:1992（CREATE TABLE work_orders 内） | schema 変更なし |
| 5 | WO に書き込む処理は work-orders.ts だけ: createWorkOrder（:731・新規作成フォームと量産発注の生成の両方が使う）／updateWorkOrder（:943・B-079 下書き編集・明細は全削除→再作成 :1008-1011）／deleteWorkOrder（:1051）／updateWorkOrderStatus（:1115）。どれも totalQuantity を書いていない | create と update に足す |
| 6 | totalQuantity を読むのは getWorkOrder の返却（work-orders.ts:900）だけ。画面には出していない（WO 詳細は明細ごとに「数量 N 単位」:211） | 詳細画面に出す |
| 7 | 生成した WO を見分ける列は無い。印は title「量産発注（PE-…）」と description「量産見積 PE-… から生成（…）」（:361-362 の固定文言）。dev の生きている生成 WO は 12件・全件で明細の数量がそろい、色・サイズ・skuId は空。明細2行以上は 0020・0021・0022 の3件。削除済みの生成 WO 4件。手入力の WO は明細1行以下（WO-VERIFY-1 だけ [1,1]） | 埋め戻しは「件名＋数量がそろう＋色・サイズが空」で絞る |
| 8 | 全体 lint は 11 errors / 22 warnings（2026-10-06 実測） | 増やさない |

## 1. 確定事項

| # | 事項 | 出典 |
|---|---|---|
| D-1 | ★WorkOrder.totalQuantity を「この作業発注の枚数（工場に頼む枚数）」として使う。明細の数量の合計ではない | 17:59「推奨方法で」・§0 の2 |
| D-2 | ★量産発注の生成（generateProductionOrders）は、作る WO の totalQuantity に totalQty（Σ入力数量）を入れる | 同上 |
| D-3 | ★作業発注の新規作成・編集フォームに「合計数量（枚）」の欄を足す。任意・1以上の整数・空なら null。生成した WO は自動で入った値が出て、人が直せる | 18:41「Aでいきましょう。」 |
| D-4 | ★作業発注の詳細画面に「合計数量」を出す（値があれば「N 枚」、空なら「未入力（明細の合計 M 枚）」） | 同上 |
| D-5 | ★縫製仕様書の「この発注 N 枚」（1枚目・2枚目・3枚目の加工指示）は、totalQuantity があればそれ、空なら今どおり明細の合計。★B-054 addendum v0.2 D-27 の「WO 明細の quantity の合計」をこの形に置き換える | 17:59「推奨方法で」 |
| D-6 | ★既存の生成 WO を埋める migration（UPDATE のみ）を足す。対象: title が「量産発注（PE-」で始まり・totalQuantity が null・明細が1行以上・明細の数量がすべて同じ・明細の色とサイズがすべて空（null か空文字）。入れる値はその共通の数量。削除済み（deletedAt あり）も同じ条件で埋めてよい。★条件に合わない WO（数量がそろっていないもの）は触らない | 17:18 の提案「生成済みの WO は工程の行の数量から埋める」 |
| D-7 | 画面の文言: 欄の名前「合計数量（枚）」。説明「工場に頼む枚数です。量産発注の生成では自動で入ります。空のときは、縫製仕様書で明細の数量を合計して出します。」 | Claude 既定（変更可） |
| D-8 | 明細と合計数量が食い違ったときに知らせる仕組みは作らない（B-074 で受ける） | 18:13 の提案 |

## 2. 作り方

1. src/lib/actions/production-order-generation.ts: createWorkOrder に渡す引数に totalQuantity: totalQty を足す
2. src/lib/actions/work-orders.ts: createWorkOrder / updateWorkOrder の入力型と data に totalQuantity を足す。updateWorkOrder はフォームの値で上書きする（明細の数量からは自動計算しない）
3. validator（作業発注の zod スキーマ・既存の work-order.test.ts があるファイル）に totalQuantity を足す（任意・整数・1以上・空文字は null）。work-order.test.ts にケースを足す
4. src/app/(app)/work-orders/_components/work-order-form.tsx: 「合計数量（枚）」の欄と説明（D-7）。新規・編集の両方。編集では今の値を初期値にする
5. src/app/(app)/work-orders/[id]/page.tsx: 詳細に「合計数量」（D-4）
6. src/lib/pdf/sewing-spec-data.ts: 宛先 WO の select に totalQuantity を足し、orderQuantity を「totalQuantity ?? 明細の合計」に。判定は純関数（例 resolveOrderQuantity）にして sewing-spec-format.test.ts かその隣のテストで固定する
7. prisma/migrations/<日時>_b269_backfill_wo_total_quantity/migration.sql: D-6 の UPDATE。テーブル名・列名は schema.prisma の @@map / @map で確かめてから書く。SQL の目安:
   UPDATE work_orders w SET total_quantity = s.q FROM (SELECT wo_id, MIN(quantity) AS q FROM wo_items GROUP BY wo_id HAVING COUNT(*) >= 1 AND MIN(quantity) = MAX(quantity) AND BOOL_AND(COALESCE(color_code,'') = '' AND COALESCE(size,'') = '')) s WHERE s.wo_id = w.id AND w.total_quantity IS NULL AND w.title LIKE '量産発注（PE-%';
   （列名 wo_id・color_code・size・title は実物で確かめて合わせる）
8. 画面の文言を grep して、作業発注の画面に「明細の合計」や数量の説明で食い違う文が無いかを見る

## 3. 手順（Claude Code）

0. 確認（read-only）: date／main・status 空・HEAD 621dcad／.env の host が hopper:12921（dev）／全体 lint の件数
1. ブランチ fix/b269-wo-total-quantity を main から切る
2. このブリーフを docs/specs/b-269-implementation-brief-2026-10-07.md に保存して検証（末尾 END-OF-BRIEF-B269）→ 最初の commit
3. §2 を実装
4. 【dev：postgres-development】埋め戻しの SQL を dev に当てる前に、同じ条件の SELECT（woNumber・明細の数量・入る値）を出して件数を見る（期待: 生きている 12件＋削除済み 4件の生成 WO のうち、条件に合うもの）。そのあと migration.sql を dev に当てる（npx prisma db execute --file … ・host を先に確認）。当てた後に SELECT で totalQuantity が入ったことを確かめる。★dev には _prisma_migrations が無いので migrate deploy は使わない。prisma migrate dev・reset は使わない
5. npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script が空であること（schema 変更が無いことの確認）
6. tsc・触ったファイルの eslint 0・全体 lint が手順 0 から増えない・テスト（work-order.test.ts・縫製仕様書の純関数）全合格・next build（3001 を止めて build → .next を消す → このブランチで PORT=3001 npm run dev を起動し直す）
7. dev の read-only 確認: WO-2026-0021 の縫製仕様書の orderQuantity が 570 になること（getSewingSpecPdfData を読み取りで呼ぶ）。AOI の手入力 WO は今までと同じ値
8. commit → push → PR を開く。PR 本文に、埋め戻しの SELECT の結果（dev）と、本番で同じ SELECT を流して件数を見る手順（read-only）を書く。★マージは慎太郎さん

## 4. dev での確認（慎太郎さん・localhost:3001）

- WO-2026-0021 の詳細に「合計数量 570 枚」が出る
- ETB-27SS-U-TP-001 の縫製仕様書で「この発注 570 枚」になる
- WO-2026-0021 の編集画面で合計数量を 600 にして保存 → 詳細と縫製仕様書が 600 になる → 570 に戻す
- 新規作成フォームに「合計数量（枚）」の欄と説明が出る（作らなくてよい）

## 5. 守ること

- 全クエリに companyId（getWorkOrder・縫製仕様書の取得は既存のまま）
- migration は UPDATE のみ。DDL を足さない
- 本番の DB を手で触らない（本番はマージ時の migrate deploy で埋まる）
- 本番の確認はプレビューだけ
- open PR の上に次の PR を積まない

## 6. 繰り延べ（B番号）

- 明細と合計数量の食い違いの知らせ → B-074（定義欄に「合計数量の欄は B-269 で入った」を締めで追記）
- 発注書・作業発注書 PDF に合計数量を出すか → 今回はしない。必要なら起票

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-10-07 | 新規。18:05 の read-only 実測と、17:59「推奨方法で」・18:41「Aでいきましょう。」を反映。D-1〜D-8 |

END-OF-BRIEF-B269
