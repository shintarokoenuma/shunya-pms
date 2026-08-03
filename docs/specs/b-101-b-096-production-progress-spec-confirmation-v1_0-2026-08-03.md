# 仕様確認議事録 — B-101 量産進行 + B-096 進行表ボード（v1.0 確定版）

- 作成日: 2026-08-02（v0.1）／ 2026-08-03（v1.0）
- バージョン: **v1.0（確定・実装ブリーフ着手可）**
- 起点 commit: b23780f
- live recon: 2026-08-02（v0.1）＋ **2026-08-03 追加3回**（enum dry-run 実測／紐付け構造／発火点）
- 上位: production-axis-spec-addendum-v0_1-2026-08-02.md §3
- migration: **あり**（enum 値追加3つのみ・テーブル変更なし）
- v0.1 からの差分: §6 の未確定 P11〜P14 を全確定。新規論点 **P15（紐付け方式）・P16（DONE 判定）** を追加確定。§5 の PostgreSQL 制約を実測値に差し替え。B-104 / B-105 を起票。

---

## 0. v0.1 から変わらないもの

v0.1 の §0（目的・背景）／§1（live recon 真値）／§2-1（12行）／§2-2（enum 追加3値）／§2-3（生成トリガー）／§2-4（一括チェック案A′）／§2-6（権限は v1 で実装しない）／§3-1〜3-2（配置・未生成時表示）／§4（B-096）は **そのまま有効**。本書はそれを置き換えず、未確定分の確定と新規論点の追加を行う。

**変更されたもの: v0.1 §2-5（自動算出と手動の衝突回避）→ 本書 §2（P16）により書き換え。**

---

## 1. 追加 recon の真値（2026-08-03・記憶ではなく実測）

| 対象 | 実測結果 |
|---|---|
| PostgreSQL | **18.4**（Debian 18.4-1.pgdg13+1） |
| `ProgressTaskType` 現在値 | 14値。CUTTING/FINISHING/PACKING は**未存在**（追加3値で確定どおり） |
| enum dry-run | `BEGIN → ADD VALUE ×3 → ROLLBACK` **成功**。14値へ完全復帰 |
| 同一 tx 内での新値使用 | `ERROR: unsafe use of new value` / `HINT: New enum values must be committed before they can be used.` |
| `progressTaskId` を持つモデル | `PurchaseOrder`(3907)・`WorkOrder`(4183)。**両方 `String?` 単数**。ProgressTask 側は伝票への FK を持たない |
| 量産生成 PO/WO の `progressTaskId` | **`null` を明示代入**（production-order-generation.ts 290 / 316） |
| 量産 WO の `workCategory` | `WorkOrderCategory.PRODUCTION`（同 309） |
| 量産 PO/WO の集約キー | **PO＝仕入先単位／WO＝発注先単位**。工程軸ではない |
| WO の workType 混在時 | 「先頭行の workType を採用」（同 254-260・混在を前提としたコード） |
| `recomputeTaskStatus` 発火点 | **3経路のみ**。(1)`recomputeLinks`（work-orders.ts:34） (2)同（purchase-orders.ts:35） (3)`updateTask` の `isReceived` 変更時（progress-tasks.ts:395） |
| `createWorkOrder` | **`recomputeTaskStatus` を呼ばない**（work-orders.ts:52 に明記） |
| `updateWorkOrderStatus` | 1本のみ（1030-）。`recomputeLinks([progressTaskId], [samplProductionId])` を呼ぶ（1064） |
| revalidate の現況 | `recomputeTaskStatus`(661) / `updateTaskStatus` / `updateTask` / `removeProcessingTask` / `updateWorkOrderStatus` すべて **`/samples/{id}` のみ** |
| `SAMPLE_TASK_TEMPLATE` | `src/lib/progress-task-template.ts`。`PROCESSING_SORT_ORDER_BASE = 65` |
| `progress-checklist.tsx` | 465行・呼び出し元は `samples/[id]/page.tsx` 1箇所のみ |
| 品番カルテ | `products/[id]/page.tsx:285` が「(1)ステータス履歴」Card（先頭 Card） |

---

## 2. P16: DONE 判定 — 発注完了 ≠ 工程完了（✓ 確定・慎太郎さん指摘 2026-08-03）

> **縫製タスクの完了ではなく、縫製発注の完了。仕上げに入るなり発送するなりしないと完了しない。**

WO が `COMPLETED` なのは工場が「終わった」と申告した事実にすぎず、現物が次工程へ渡っていなければ工程は完了していない。これは S-3 の「**発注済み ≠ 入荷済み**」（`isReceived`）と同一の構図であり、同じ原則を工程側にも適用する。

### 2-1. 確定ルール

**自動算出は `NOT_STARTED → IN_PROGRESS` の一段のみ。`DONE` は必ず人が押す。**

| 系統 | taskType | 自動でできること | DONE |
|---|---|---|---|
| WO 導出（5行） | GRADING / CUTTING / SEWING / PROCESSING / FINISHING | 対応 WO が1件以上 → `IN_PROGRESS` | 人が押す |
| 入荷（2行） | FABRIC / TRIM | — | **工場入荷チェック → `DONE`** |
| 手動（5行） | INSPECTION / PACKING / SHIPPING / DELIVERY / INVOICE | なし | 人が押す |

### 2-2. v0.1 §2-5 の書き換え

v0.1 §2-5 は「手動チェック時に `evidenceMode` を MANUAL に落とす」ことで自動算出との衝突を防ぐ設計だった。**P16 により自動算出が `DONE` に到達しなくなるため、衝突の主因が消える。**

ただし `evidenceMode` を MANUAL に落とす処理は**残す**。理由は、人が意図的に `SKIPPED`／`BLOCKED`／手動 `IN_PROGRESS` を選んだ行を、後から立った WO が動かさないようにするため。**P6 は維持。**

### 2-3. 副作用（意図的に受け入れる）

**サンプル側と挙動が食い違う。** 既存 SAMPLE は「WO 全件 COMPLETED → `DONE`」で動いている。原則としては量産側が正しいが、**サンプル側は本 PR では触らない**（B-101 に回帰リスクを持ち込まない）。→ **B-104 として別 PR で是正。**

---

## 3. P15: 伝票との紐付け — 案C 導出照合（✓ 確定）

### 3-1. 却下した案とその理由

**案A（生成時に `progressTaskId` を付与）→ 却下。**
発注書の集約キー（PO＝仕入先／WO＝発注先）と、タスク軸（工程種別）が**直交している**。

- 生地と付属が同一仕入先 → PO 1枚に対し FABRIC・TRIM の2タスク。`progressTaskId` は単数カラムのため**片方に嘘をつくしかない**。
- 縫製と仕上げが同一工場 → WO 1枚に対し SEWING・FINISHING の2タスク。コード自身が「混在時は先頭行の workType を採用」と明記しており、混在は例外ではなく前提。

成立させるには (B) 量産発注生成の集約キーを「仕入先×資材区分」「工場×工程」へ変更する必要があり、production-order-generation v0.1 の確定事項の変更＝B-101 の射程外。

**案B（v1 は全 MANUAL）→ 却下。** P3（裁断・仕上げは WO 有無で自動/手動の両対応）を捨てることになる。

### 3-2. 採用: 案C — `progressTaskId` を使わず導出照合する

伝票側には**何も書き込まない**。タスク側が条件検索で伝票を引く。

    where: {
      companyId,
      productId:     task.productId,
      workCategory:  WorkOrderCategory.PRODUCTION,   // 生成時に付与済み
      workType:      <taskType から導出>,
      deletedAt:     null,
    }

`WorkOrderType` に CUTTING / FINISHING / GRADING / SEWING は**既存**（recon 済み）。**schema 変更ゼロ・migration は enum 追加3値のみのまま。**

    // src/lib/progress-task-production.ts（新規）
    export const PRODUCTION_WO_TYPE_MAP: Partial<Record<ProgressTaskType, WorkOrderType>> = {
      [ProgressTaskType.GRADING]:   WorkOrderType.GRADING,
      [ProgressTaskType.CUTTING]:   WorkOrderType.CUTTING,
      [ProgressTaskType.SEWING]:    WorkOrderType.SEWING,
      [ProgressTaskType.FINISHING]: WorkOrderType.FINISHING,
      // PROCESSING は ProcessingType.workType を実行時に解決（work-orders.ts:208-214 と同型）
    }

### 3-3. FABRIC / TRIM を WO/PO 照合の対象外とする理由

PO は仕入先単位で束ねられ、生地と付属の区別がつかない。両方を `IN_PROGRESS` に上げると「**付属をまだ発注していないのに進行中に見える**」という、`isReceived` 設計が防ごうとしていたものより悪い嘘が出る。

もともと完了判定は `isReceived`（手動）が正なので、自動化で得られるのは1段のみ。**失うものは小さく、得る嘘は大きい**ため対象外とする。

### 3-4. 限界（明記して受け入れる）

縫製と仕上げを**1枚の WO** に束ねて同一工場へ出した場合、`bucket.workType` は先頭行採用のため FINISHING タスクは WO を見つけられない。

**害は無い。** P16 により自動算出は `IN_PROGRESS` までなので、上がらないだけで嘘は出ない。工程を分けて管理したい案件では WO を分ければよく（DRAFT 生成・B-079 で編集可）、これは「**発注書を分けるか＝別に管理する必要があるか**」という production-axis 追補 §P3 の判断基準と一貫する。

### 3-5. 仕上げが存在しない案件（慎太郎さん指摘 2026-08-03）

> 仕上げは工場により異なり、できない工場もある。できる工場には丸投げが多い。

丸投げは例外ではなく**標準**。この場合 FINISHING 行は `SKIPPED`（対象外）にできる。行を非表示にする案は採らない — 「**縫製工場に含めたので対象外**」という判断が記録として残る方が価値が高い。`SKIPPED` は既存 enum・自動算出も不触の終端状態のため追加コストゼロ。

---

## 4. P15-b: 発火点（✓ 確定・2026-08-03 recon で判明）

案C は「どう探すか」を決めたが、recon の結果 **探しに行くきっかけが存在しない**ことが判明した。

- 発火3経路のうち(1)(2)は `progressTaskId` で対象を特定 → 量産伝票は `null` なので**空振り**。
- `createWorkOrder` は再計算を呼ばない → 「WO ができた → 進行中」も**発火しない**。

### 4-1. 新設する関数

    // PRODUCTION 専用。既存 recomputeTaskStatus は触らない
    recomputeProductionTasksForProduct(productId): Promise<void>
      → phase=PRODUCTION・deletedAt=null のタスクを全件取得
      → 各行に §3-2 の照合を適用（IN_PROGRESS への一段のみ）
      → 不変条件は既存を完全踏襲:
         ・前進のみ（降格しない）
         ・evidenceMode = AUTO_FROM_DOC のみ対象
         ・SKIPPED / BLOCKED は不触
         ・AuditLog(STATUS_CHANGE, entityType=ProgressTask, auto:true)
         ・失敗は握りつぶし（親を巻き込まない）
      → revalidatePath(`/products/${productId}`)

### 4-2. 呼び出し箇所（2箇所のみ）

| 箇所 | タイミング | 条件 |
|---|---|---|
| `generateProductionOrders` | タスク12行生成の直後（return 直前） | 冪等ガード通過時 |
| `updateWorkOrderStatus` | 末尾（既存 `recomputeLinks` の後） | `workCategory === PRODUCTION` かつ `productId != null` |

既存 `recomputeLinks` は**触らない**。SAMPLE の挙動は完全据え置き。`updateWorkOrderStatus` は「status 不変なら即 return」のガードがあるため無駄打ちも起きない。

### 4-3. revalidate 分岐の追加（4箇所・v0.1 §6-2 の確定形）

現況すべて `/samples/{id}` のみ。`sampleProductionId` があれば従来どおり、`productId` があれば `/products/{productId}` も、という**両方呼ぶ分岐**を足す。

- `recomputeTaskStatus`(661) / `updateTaskStatus` / `updateTask` / `updateWorkOrderStatus`

手動操作は画面側の `router.refresh()` で反映されるため、これは自動更新と他経路からの反映のため。

---

## 5. P11: コンポーネント（✓ 確定＝新規作成）

**PRODUCTION 専用を新規作成。**`progress-checklist.tsx`（465行）は写経元とし、phase 引数での共用はしない。

理由（recon 実測）: (1)Props に `sampleProductionId` 必須 (2)0件時ボタンが `generateTasksForRound(sampleProductionId)` (3)PO/WO 起票リンクが `?sampleProductionId=` 前提 (4)`PO_TASK_TYPES`/`WO_TASK_TYPES`/`RECEIVED_TYPES` が SAMPLE 用集合 (5)`AddProcessingDialog` が SP 用。**SAMPLE 依存が全面的**で、分岐を差し込むと SAMPLE 側の回帰リスクを恒久的に背負う。

写経する構造: Badge ＋ status Select ＋ `isReceived` Checkbox ＋ notes Input ＋ 伝票リンク列。

### 5-1. UI 文言（✓ 確定）

- 「入荷済み」→ **「工場入荷」**。注記「自社出荷時に代理チェック可」を添える。
  資材は工場直送が多く、「入荷」は自社着ではなく**工場着**を指すため。
- 納品・請求の2行は視覚的に区別（v0.1 §2-6 の「UI 上の区別のみ」を踏襲）。

---

## 6. P13: 加工行（✓ 確定＝サンプルと同じ手動追加）

サンプル側と同一の操作を量産にも用意する。マスター参照・選択ダイアログ・行削除・WO への `workType` 引き継ぎは**すべて既存機構をそのまま流用**。

**変わるのはぶら下げ先のみ**（サンプルラウンド → 品番）。

    addProductionProcessingTasks(productId, processingTypeIds[])
    // addProcessingTasks(sampleProductionId, ...) の兄弟

### 6-1. 並び順定数

    export const PRODUCTION_PROCESSING_SORT_ORDER_BASE = 55  // 新規
    // SAMPLE 用 PROCESSING_SORT_ORDER_BASE = 65 は変更しない

共用すると量産の並びに合わせた瞬間に SAMPLE の並びが崩れる。

### 6-2. 自動生成を採らない理由

量産見積には加工費目が入っている（サンプル実績のコピー）ため、そこから加工行を自動で立てられれば二度手間が消える。しかし recon の結果、**見積の費目（原価科目）と ProcessingType マスターを結ぶ線がデータ上ゼロ**。対応表の新規設計が必要で B-101 の射程外。

→ **B-105 として起票。**実データで費目名と加工種別の実際の対応を見てから設計する（今から推測で対応表を作ると外す）。

---

## 7. P14: 分納・部分完了（✓ 確定＝`IN_PROGRESS` + メモ）

数量カラムは**追加しない**。ステータスは `IN_PROGRESS` のまま、メモ欄に「300枚上がり 8/5、残200は 8/12予定」等を記録する。

理由:
1. **数量の真値が二重化する。** 数量は既に WoItem / PoItem が持つ。タスク側にも持つと別々に更新され食い違い、優劣判定の仕組みがまた要る。
2. **分納の実体は「現物が何枚どこへ動いたか」**であり、これは **B-103（受け渡し記録）** の領域。タスクに数量を持たせると B-103 実装時に数量が3箇所へ散る。
3. チェックリストは「その工程が今どの状態か」を持つ表であって**数量台帳ではない**。

**代償**: 進捗率をパーセント表示できない（「縫製 60%」は不可・「進行中」のみ）。数量ベースの進捗が必要になったら B-103 と同時に設計する。

---

## 8. P12: migration（✓ 確定・実測反映）

    ALTER TYPE "ProgressTaskType" ADD VALUE 'CUTTING';
    ALTER TYPE "ProgressTaskType" ADD VALUE 'FINISHING';
    ALTER TYPE "ProgressTaskType" ADD VALUE 'PACKING';

- **PostgreSQL 18.4 で `BEGIN → ADD VALUE ×3 → ROLLBACK` は成功**（実測）。ROLLBACK 後 14値へ完全復帰。
  → v0.1 §5 の「トランザクション内で実行できない」注記は **PG11 以前の制約**であり、本環境には該当しない。**triple-gate は通常手順で実施可。**
- ⚠️ **migration は enum 値追加のみに限定する。** 同一 migration / tx 内で新値を使う DML（新値でのタスク行 INSERT 等）を**混ぜない**。実測エラー: `unsafe use of new value "CUTTING"` / `New enum values must be committed before they can be used.`
  → B-101 の実データ生成は commit 後のランタイム（`generateProductionOrders`）なので抵触しない。
- **テーブル変更なし・既存データ不変。**migration 本数: 44 → **45本目**。
- **同一 PR で `PROGRESS_TASK_TYPE_LABELS`（`Record<ProgressTaskType, string>`）に3値を追加**（網羅型のため未追加ならビルドが落ちる・既存鉄則）。

---

## 9. PRODUCTION_TASK_TEMPLATE（✓ 確定）

`src/lib/progress-task-template.ts` に `SAMPLE_TASK_TEMPLATE` と同居させる。

| sortOrder | taskType | evidenceMode | isReceived 初期値 |
|---|---|---|---|
| 10 | FABRIC | AUTO_FROM_DOC | `false` |
| 20 | TRIM | AUTO_FROM_DOC | `false` |
| 30 | GRADING | AUTO_FROM_DOC | null |
| 40 | CUTTING | AUTO_FROM_DOC | null |
| 50 | SEWING | AUTO_FROM_DOC | null |
| (55 起点) | PROCESSING（都度追加） | AUTO_FROM_DOC | null |
| 60 | INSPECTION | MANUAL | null |
| 70 | FINISHING | AUTO_FROM_DOC | null |
| 80 | PACKING | MANUAL | null |
| 90 | SHIPPING | MANUAL | null |
| 100 | DELIVERY | MANUAL | null |
| 110 | INVOICE | MANUAL | null |

共通値: `productId` 必須／`sampleProductionId: null`／`phase: PRODUCTION`／`status: NOT_STARTED`。

---

## 10. B-022 への申し送り（✓ 確定・2026-08-03）

慎太郎さんの実務情報により、外部開放の**最初の具体ユースケース**が特定された。

- 資材は**工場直送**が多く、「入荷」は自社着ではなく工場着。
- **ベトナム工場はシステムを触らせてよい** → 工場自身が「工場入荷」「工程チェック」を押すのが本来の形。
- **日本の工場は触らせない** → 自社出荷時に代理チェックする運用で代替。

v1 のスコープは変えない（P7＝権限ガードは実装しない）。B-022 設計時にこのユースケースを起点とする。

---

## 11. 確定状況（全16点）

| # | 論点 | 状態 |
|---|---|---|
| P1〜P10 | v0.1 で確定済み | ✓ 据え置き（P6 は本書 §2-2 で理由を更新） |
| P11 | コンポーネント | ✓ PRODUCTION 専用を新規作成 |
| P12 | enum migration | ✓ PG18.4・dry-run 有効・enum 追加のみに限定 |
| P13 | 加工行 | ✓ サンプルと同じ手動追加（自動生成は B-105） |
| P14 | 分納・部分完了 | ✓ `IN_PROGRESS` + メモ・数量カラム無し |
| **P15** | 伝票との紐付け | ✓ **案C 導出照合**（`progressTaskId` 不使用） |
| **P15-b** | 発火点 | ✓ 専用関数を新設し2箇所から呼ぶ＋revalidate 4箇所 |
| **P16** | DONE 判定 | ✓ **自動は IN_PROGRESS まで・DONE は人が押す** |

---

## 12. 本書で起票したバックログ

- **B-104（新規）**: サンプル側の DONE 判定を工程完了基準に揃える（P16 の原則を SAMPLE にも適用）。**別 PR**。
- **B-105（新規）**: 量産見積の加工費目 → 加工行の自動生成。費目（原価科目）と ProcessingType の対応表設計を含む。実運用データ蓄積後に着手。
- **B-103（v0.1 で起票済）**: 受け渡し記録。P14 の分納数量はここに寄せる。

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-02 | v0.1 | 初版。live recon を反映し P1〜P10 を確定。P11〜P14 を未確定として残す。B-103 起票 |
| 2026-08-03 | v1.0 | 追加 recon 3回（enum dry-run 実測・紐付け構造・発火点）を反映。P11〜P14 を確定。新規論点 P15（案C 導出照合）・P15-b（発火点）・P16（DONE は人が押す）を追加確定。v0.1 §2-5 を P16 により書き換え。v0.1 §5 の PG 制約注記を実測値へ差し替え。UI 文言（工場入荷）確定。B-022 申し送り追記。B-104 / B-105 起票 |
