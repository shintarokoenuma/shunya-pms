# 仕様確認議事録 — B-101 量産進行 + B-096 進行表ボード（v0.1 ドラフト）

- 作成日: 2026-08-02 / Claude.ai
- バージョン: v0.1（論点整理・確定分と未確定分を明示。実装着手は v1.0 から）
- 起点 commit: 7842810（live recon 済み 2026-08-02）
- 上位: production-axis-spec-addendum-v0_1-2026-08-02.md §3 の具体化
- 関連: product-sample-spec-confirmation-v1_0-2026-06-06.md §3（進行チェックリスト）／
  s-3-progress-task-implementation-brief-2026-06-07.md ／
  s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md
- 一次資料: docs/reference/20260801_production-progress-ui-prototype_v0_1.html
- migration: **あり**（enum 値追加3つのみ・テーブル変更なし）

---

## 0. 目的と背景

### 0-1. 埋めたい穴

サンプルは SP 作成時に進行チェックリスト8行が自動生成され、進行を追える。
一方**量産に入ると進行を追う場所が一切ない**。`ProgressTask.phase = PRODUCTION` は
箱だけ存在し、live recon（2026-08-02）で **src からの参照ゼロ**を確認した。

### 0-2. なぜ PO/WO では足りないか（設計の核心・慎太郎さん指摘）

> **PO や WO は発注までだから**

PO/WO は「頼んだ」で終わる。「**届いた・終わった・次に渡した**」は別の状態。
S-3 の設計の肝「発注済み ≠ 入荷済み」（`isReceived`）がまさにこれで、量産では
生地の遅延が納期全体を飛ばすため、サンプル以上に必要になる。

参考プロトタイプ（reference HTML）も同じ指摘をしている:
> 現物が外注先を何度も往復する構造のため、受け渡しを記録しないと進行が推測になります

---

## 1. live recon の真値（2026-08-02・記憶ではなく実測）

| 対象 | 実測結果 |
|---|---|
| `SAMPLE_TASK_TEMPLATE` | QUOTE(10)/SPEC_LOCK(20)/PATTERN(30)/FABRIC(40,isReceived=false)/TRIM(50,isReceived=false)/SEWING(60)/INSPECTION(70)/CLIENT_REVIEW(80)。PROCESSING は 65 起点で後から追加 |
| **`GRADING` は SAMPLE で生成されない** | テンプレートに含まれない＝PRODUCTION 専用にできる |
| `AUTO_FROM_DOC_TASK_TYPES` | PATTERN/FABRIC/TRIM/SEWING/PROCESSING/BODY の6種。他は MANUAL |
| `WO_DRIVEN_TASK_TYPES` | PATTERN/SEWING/PROCESSING/GRADING |
| `PO_DRIVEN_TASK_TYPES` | FABRIC/TRIM/BODY |
| `recomputeTaskStatus` | **実装済み**（空殻ではない）。`revalidatePath` は `/samples/{id}` のみ |
| `WorkOrderType` | CUTTING・FINISHING が**既に存在**（PACKING は無い） |
| `UserRole` | OWNER/ADMIN/PRODUCTION/ACCOUNTING/SALES/DESIGNER/STAFF/EXTERNAL |
| **UserRole ベースのガード実例** | **src/lib/actions/ に1件も無い**（既存ガードは全て tenantType=MASTER_ADMIN） |
| 生成パイプライン | `generateProductionOrders`（production-order-generation.ts）1本。return 直前で productId/createdPos/createdWos が確定 |
| 品番カルテ | 「①ステータス履歴」が先頭 Card（products/[id]/page.tsx:285-） |
| サイドバー | `src/components/app-shell/nav-items.ts` の NAV_SECTIONS。`/progress` 等の既存ルートは無い |

---

## 2. 確定事項

### 2-1. 量産の工程は12行（✓ 慎太郎さん確定 2026-08-02）

| # | 工程 | taskType | 新規 | 駆動 | isReceived |
|---|---|---|---|---|---|
| 1 | 生地手配 → 入荷 | `FABRIC` | | PO | ✓ |
| 2 | 付属手配 → 入荷 | `TRIM` | | PO | ✓ |
| 3 | グレーディング | `GRADING` | | WO | |
| 4 | 裁断 | **`CUTTING`** | ★ | WO or 手動 | |
| 5 | 縫製 | `SEWING` | | WO | |
| 6 | 加工（種別ごと） | `PROCESSING` | | WO | |
| 7 | 検品 | `INSPECTION` | | 手動 | |
| 8 | 仕上げ | **`FINISHING`** | ★ | WO or 手動 | |
| 9 | 梱包 | **`PACKING`** | ★ | 手動 | |
| 10 | 出荷 | `SHIPPING` | | 手動 | |
| 11 | 納品 | `DELIVERY` | | 手動 | |
| 12 | 請求 | `INVOICE` | | 手動 | |

- 裁断・仕上げは **自社/外注が案件ごとに変わる**ため「**WO があれば自動算出・
  無ければ手動チェック**」の両対応とする（慎太郎さん確定）。
- `BODY`（ボディ仕入）は量産では使わない前提。必要なら v2 で追加（Json ではなく
  テンプレート定数の変更で済む）。

### 2-2. enum 追加（✓ 確定・migration の全量）

`ProgressTaskType` に3値を追加する。**テーブル変更なし・enum 値追加のみ。**

```prisma
enum ProgressTaskType {
  // ... 既存 ...
  // --- PRODUCTION phase ---
  CUTTING     // 裁断
  GRADING     // グレーディング（既存）
  FINISHING   // 仕上げ
  PACKING     // 梱包
  SHIPPING    // 出荷明細（既存）
  DELIVERY    // 納品書（既存）
  INVOICE     // 請求書（既存）
}
```

- **同一 PR でラベル定義を必ず追加する**（既存ルール）。
  `src/app/(app)/samples/_components/progress-task-labels.ts` の
  `PROGRESS_TASK_TYPE_LABELS: Record<ProgressTaskType, string>` は網羅型なので、
  **追加しないとビルドが落ちる**。
- `WorkOrderType` は **変更不要**（CUTTING/FINISHING は既存。PACKING は WO を立てない）。

### 2-3. 生成トリガー（✓ 確定）

**`generateProductionOrders` の成功 return 直前**で PRODUCTION タスクを生成する。

- 理由: (B) 量産発注生成が量産の起点として既に確立している。`Product.status` 変更を
  トリガーにすると、status を動かさない運用のときにタスクが生えない。
- 冪等ガード必須: `phase=PRODUCTION` の行が既に1件でもあれば生成しない
  （`generateTasksForRound` と同じ形）。生成は複数回走りうるため。
- 失敗しても親（PO/WO 生成）を巻き込まない（`recomputeTaskStatus` と同じ握りつぶし方針）。

### 2-4. 一括チェックは「確認ダイアログ付きの提案」（✓ 確定・案A′）

工程は順序どおりに進まない（付属が後着・加工が裁断前・分納・検品の分割）。
素の「上を全部 DONE」は `isReceived` に嘘をつかせるため採らない。

```
縫製を完了にします。あわせて以下も完了にしますか？

  ☑ 生地手配              （入荷☑ 済）
  ☐ 付属手配              ⚠ 未入荷のままです
  ☑ グレーディング
  ☑ 裁断

           [ 選択した行を完了にする ]  [ 縫製だけ完了にする ]
```

- 既定は全選択（順序どおりの日は1タップ）
- **既定で外す行**: `isReceived === false`（未入荷）／`BLOCKED`／`SKIPPED`
- 「押した行だけ完了」の選択肢を常に残す
- **「全部 DONE」ボタンは置かない**（請求まで完了になる事故を防ぐ）

### 2-5. 手動チェックと自動算出の衝突回避（✓ 確定）

`recomputeTaskStatus` は `evidenceMode !== AUTO_FROM_DOC` の行を触らない。
これを利用し、**人が手でチェックした行は `evidenceMode` を MANUAL に落とす**。

- 一括チェック・個別チェックのいずれでも、更新時に MANUAL へ落とす。
- これにより「一括チェックした直後に自動算出が上書きする」事故を防ぐ。
- 逆に WO/PO を後から作った場合、その行は MANUAL のままなので自動では動かない。
  人が意図的に手で確定した状態を尊重する（＝人の判断が勝つ）。

### 2-6. 権限は v1 では実装しない（✓ 確定・案A）

慎太郎さんの要望は「生産工程は工場にも触らせるかもしれないが、納品・請求は
権限ある人だけ」。ただし:

- UserRole ベースのガード実例が **src に1件も無い**（live 確認）。
- 現在は社内1名運用で外部開放していないため、ガードが働く場面が無い。
- 前例の無い権限機構を、使わないうちに入れると設計が固まる。

→ **v1 は UI 上の区別のみ**（納品・請求の2行を視覚的に分ける・注記を出す）。
実際のガードは **B-022（外部開放）と同時に設計**する。

---

## 3. B-101: 品番カルテの「進行」セクション

### 3-1. 配置と構成

品番カルテ先頭の「①ステータス履歴」Card を「**進行**」Card に拡張する。
同一カード内で上下2段に分ける。

```
【進行】Card
├─ 量産進行チェックリスト（現在の状態・編集可）  ← 新規
│    phase=PRODUCTION の12行
└─ ステータス履歴（過去の記録・追記のみ・read-only）  ← 既存をそのまま下段へ
```

- `ProductStatusHistory` は**追記専用のイベントログ**、`ProgressTask` は**書き換える
  状態テーブル**。性質が逆なので**同じ行に混ぜない**。上下に分けるだけ。
- **SAMPLE phase は品番カルテに出さない**。SAMPLE タスクは `sampleProductionId`
  単位で生成され（A-2）、UI も `/samples/{id}` 配下で完結している（`revalidatePath`
  もそこ前提）。カルテに持ってくると「どのラウンドを表示するか」問題が発生し、
  既存 UI の作り直しになる。→ **進行セクションは PRODUCTION 専用**。

### 3-2. 未生成時の表示

`phase=PRODUCTION` の行が0件のとき（＝まだ量産発注を生成していない）は、
チェックリスト部分を出さず「量産発注を生成すると進行管理が始まります」と案内する。
手動生成ボタンは v1 では置かない（生成トリガーを1本に絞る）。

### 3-3. 写経元

`src/app/(app)/samples/_components/progress-checklist.tsx`（465行）。
PRODUCTION 用に新規コンポーネントを作るか、既存を phase 引数で共用するかは
実装ブリーフ時に判断（**未確定・§6-1**）。

---

## 4. B-096: 進行表ボード

### 4-1. 位置づけ

- **カルテ側（B-101）** = 1品番の縦の詳細
- **ボード側（B-096）** = 品番×工程の横断マトリクス

同じ `ProgressTask` を参照するため**二重管理にならない**。

### 4-2. ルートとナビ

- 新規ルート `/progress`（`(app)` 直下に既存の進行表ルートは無い）
- `nav-items.ts` の **「案件」セクション**に追加（品番カルテ・サンプル製作の並び）

### 4-3. v1 で採用する要素（プロトタイプから）

| プロトタイプの要素 | v1 |
|---|---|
| 案件×工程のドットマトリクス | **採用**（本体） |
| 5状態表示（未着手/進行中/完了/停止/対象外） | **採用**。既存 enum でそのまま表現（SKIPPED＝対象外） |
| 遅延行ハイライト | **採用**。ただし判定は `Product.plannedDeliveryDate` のみ |
| フィルタ（遅延のみ 等） | 採用 |
| KPI（進行中件数・遅延件数） | 採用 |

### 4-4. v1 で採用しない要素

| 要素 | 理由・行き先 |
|---|---|
| **ガント（納期モニタ）** | タスク単位の予定日カラムが必要＝migration が増える。**v2** |
| **受け渡し記録** | 別モデルが必要。**B-103 として新規起票** |
| 外注先ライン空き状況 | キャパシティ管理は別領域。将来 |
| 現場端末・QR | **B-022（外部開放）**の領域。受け皿（`checkedByExternal`）は既にある |
| 資材引当・在庫判定 | **B-023/B-024（在庫）**の領域 |

---

## 5. migration

```sql
ALTER TYPE "ProgressTaskType" ADD VALUE 'CUTTING';
ALTER TYPE "ProgressTaskType" ADD VALUE 'FINISHING';
ALTER TYPE "ProgressTaskType" ADD VALUE 'PACKING';
```

- **テーブル変更なし**・既存データ不変。
- ⚠️ PostgreSQL の `ALTER TYPE ... ADD VALUE` は**トランザクション内で実行できない**
  （同一 tx 内で追加した値を直後に使えない制約）。dry-run の BEGIN/ROLLBACK が
  通常どおり効くか、**実装ブリーフ時に確認して手順を決める**（**未確定・§6-4**）。
- triple-gate は通常どおり（dev → 本番 dry-run → 本番 deploy）。
- migration 本数: 44 → **45本目**。

---

## 6. 未確定の論点（v1.0 で確定させる）

### 6-1. progress-checklist.tsx を共用するか新規作成するか
既存は SAMPLE 前提（`generateTasksForRound` 呼び出し・SP へのリンク・
`/samples` への revalidate）。phase 引数で共用すると分岐が増える。
実装ブリーフ時に既存コード全文を読んで判断する。

### 6-2. `recomputeTaskStatus` の revalidatePath 分岐
現状 `if (task.sampleProductionId) revalidatePath('/samples/{id}')` のみ。
PRODUCTION タスクは `sampleProductionId = null` なので**再検証が走らない**。
`revalidatePath('/products/{productId}')` の分岐追加が必須。

### 6-3. 量産 WO の workCategory
`work-orders.ts` の taskType→workCategory マッピングは SAMPLE/PATTERN/GRADING のみで
**PRODUCTION を割り当てる分岐が無い**。量産 WO の `workCategory=PRODUCTION` は
`generateProductionOrders` 側が別途設定している（要確認）。B-096 のフィルタで
「量産のみ」を出すならここが効く。

### 6-4. enum 追加 migration の dry-run 可否
§5 の PostgreSQL 制約。dev で先に検証し、本番 dry-run の形を決める。

### 6-5. PROCESSING 行の量産側での扱い
サンプルでは「加工を追加」で種別ごとに行が増える（B-2）。量産でも同じ UI を出すか、
量産発注生成時に PE の加工費目から自動で行を立てるか。

### 6-6. 分納・部分完了
プロトタイプには「一部完了で保存」がある。現状 `ProgressTaskStatus` に部分完了の
概念が無い（NOT_STARTED/IN_PROGRESS/DONE/BLOCKED/SKIPPED）。IN_PROGRESS + notes で
凌ぐか、数量カラムを足すか。**v1 は IN_PROGRESS + notes で凌ぐ**方針だが要確認。

---

## 7. 確定状況

| # | 論点 | 状態 |
|---|---|---|
| P1 | 量産の工程は12行 | ✓ 確定 |
| P2 | enum 追加3値（CUTTING/FINISHING/PACKING） | ✓ 確定 |
| P3 | 裁断・仕上げは WO 有無で自動/手動の両対応 | ✓ 確定 |
| P4 | 生成トリガー＝量産発注生成の完了時 | ✓ 確定 |
| P5 | 一括チェックは確認ダイアログ付き提案（案A′） | ✓ 確定 |
| P6 | 手動チェック時は evidenceMode を MANUAL に落とす | ✓ 確定 |
| P7 | 権限ガードは v1 で実装しない（案A・B-022 と同時設計） | ✓ 確定 |
| P8 | 進行セクションは PRODUCTION 専用（SAMPLE は SP 詳細のまま） | ✓ 確定 |
| P9 | B-096 は新規ルート /progress・案件セクション | ✓ 確定 |
| P10 | ガント・受け渡し記録は v1 スコープ外 | ✓ 確定 |
| P11 | コンポーネント共用/新規 | 未確定（§6-1） |
| P12 | enum migration の dry-run 手順 | 未確定（§6-4） |
| P13 | PROCESSING 行の量産側の扱い | 未確定（§6-5） |
| P14 | 分納・部分完了 | 未確定（§6-6） |

---

## 8. 本書で起票したバックログ

- **B-103（新規）**: 受け渡し記録（現物の移動ログ）。外注先を往復する現物の
  発送・受領を記録しないと進行が推測になる。プロトタイプの一次資料に指摘あり。
  別モデルが必要。B-096 v2 と同時期を想定。

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-02 | v0.1 | 初版。live recon（SAMPLE テンプレート・駆動セット・UserRole・生成パイプライン・WorkOrderType・サイドバー）を反映し P1〜P10 を確定。P11〜P14 を未確定として残す。B-103 起票 |
